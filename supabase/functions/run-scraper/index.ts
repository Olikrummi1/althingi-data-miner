
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.24.0";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Cors headers for CORS support
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Get valid item types from the database
const VALID_TYPES = ["bill", "vote", "speech", "mp", "committee", "issue"];

// Array of realistic user agents to rotate
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/117.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPad; CPU OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1'
];

// Map the scraper type to a valid database item type
function getValidItemType(scraperType: string): string {
  // Convert plural to singular where needed
  switch(scraperType) {
    case "bills": return "bill";
    case "votes": return "vote";
    case "speeches": return "speech";
    case "mps": return "mp";
    case "committees": return "committee";
    case "issues": return "issue";
    default: return scraperType;
  }
}

// Helper function to get alternative URLs for MP data
function getMpUrls(): string[] {
  return [
    "https://www.althingi.is/thingmenn/althingismenn/",
    "https://www.althingi.is/altext/cv/is/",  // Alternative URL for MP info
    "https://www.althingi.is/thingmenn/",     // Main MPs section
    "https://www.althingi.is/thingmenn/thingmenn/",  // Another potential URL
  ];
}

// Helper function to get the base URL based on scraper type
function getBaseUrl(scraperType: string): string {
  switch(scraperType) {
    case "bills": return "https://www.althingi.is/thingstorf/thingmalalistar-eftir-thingum/";
    case "votes": return "https://www.althingi.is/thingstorf/atkvaedagreidslur/";
    case "speeches": return "https://www.althingi.is/altext/raedur/";
    case "mps": return "https://www.althingi.is/thingmenn/althingismenn/";
    case "committees": return "https://www.althingi.is/thingnefndir/fastanefndir/";
    case "issues": return "https://www.althingi.is/thingstorf/thingmalalistar-eftir-thingum/";
    default: return `https://www.althingi.is/`;
  }
}

// Normalize URL to ensure it's properly formatted
function normalizeUrl(url: string, baseUrl: string): string {
  if (!url) return baseUrl;
  if (url.startsWith("http")) return url;
  
  // Handle relative URLs
  if (url.startsWith("/")) {
    const baseOrigin = new URL(baseUrl).origin;
    return `${baseOrigin}${url}`;
  }
  
  // Handle URLs without protocol
  if (url.startsWith("www.")) {
    return `https://${url}`;
  }
  
  // Default case: append to base URL if not absolute
  return `${baseUrl}${url}`;
}

// Helper function to get a random user agent
function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// Enhanced fetch function with retry logic
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3, delayMs = 2000): Promise<Response> {
  console.log(`Attempting to fetch ${url}...`);
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`Retry attempt ${attempt + 1} for ${url}`);
        // Exponential backoff: wait longer between each retry
        await new Promise(resolve => setTimeout(resolve, delayMs * Math.pow(2, attempt)));
      }
      
      const response = await fetch(url, options);
      
      if (response.ok) {
        return response;
      }
      
      console.error(`Attempt ${attempt + 1} failed with status ${response.status}: ${response.statusText}`);
      
      // If we get a 403 or 429 (rate limiting), wait longer
      if (response.status === 403 || response.status === 429) {
        await new Promise(resolve => setTimeout(resolve, delayMs * 3));
      }
      
      // If this is the last attempt, return the failed response anyway
      if (attempt === maxRetries - 1) {
        return response;
      }
    } catch (error) {
      console.error(`Fetch error on attempt ${attempt + 1}:`, error);
      
      // If this is the last attempt, throw the error
      if (attempt === maxRetries - 1) {
        throw error;
      }
    }
  }
  
  // This should never be reached due to the return/throw in the loop,
  // but TypeScript requires a return statement
  throw new Error(`Failed to fetch ${url} after ${maxRetries} attempts`);
}

// Function to extract MP data directly from the HTML
function extractMpDataFromHtml(html: string): any[] {
  console.log("Manually extracting MP data from HTML...");
  
  const mps: any[] = [];
  
  try {
    // Find MP table rows
    const tablePattern = /<table[^>]*>[\s\S]*?<\/table>/gi;
    const tableMatch = html.match(tablePattern);
    
    if (!tableMatch) {
      console.log("No table found in HTML");
      return mps;
    }
    
    const table = tableMatch[0];
    
    // Find rows in the table
    const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const rows = Array.from(table.matchAll(rowPattern)).map(m => m[0]);
    
    // Skip the header row
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      
      // Extract data from cells
      const cellPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      const cells = Array.from(row.matchAll(cellPattern)).map(m => m[1]);
      
      if (cells.length >= 4) {
        // Extract name and link
        const nameCell = cells[0];
        const linkMatch = /<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i.exec(nameCell);
        
        if (linkMatch) {
          const url = linkMatch[1];
          const name = linkMatch[2].replace(/<[^>]*>/g, '').trim();
          
          // Extract constituency and party
          const constituencyCell = cells[2];
          const partyCell = cells[3];
          
          const constituency = constituencyCell.replace(/<[^>]*>/g, '').trim();
          const party = partyCell.replace(/<[^>]*>/g, '').trim();
          
          mps.push({
            title: name,
            content: `MP from ${constituency}, representing ${party}`,
            url: url.startsWith('http') ? url : `https://www.althingi.is${url.startsWith('/') ? '' : '/'}${url}`,
            type: "mp",
            metadata: {
              party,
              constituency,
              source: "mp_list"
            },
            profileUrl: url.startsWith('http') ? url : `https://www.althingi.is${url.startsWith('/') ? '' : '/'}${url}`
          });
        }
      }
    }
    
    console.log(`Manually extracted ${mps.length} MPs from HTML`);
  } catch (error) {
    console.error("Error extracting MP data manually:", error);
  }
  
  return mps;
}

// Direct extraction function for MP profiles
function extractMpProfileDataFromHtml(html: string, url: string, baseData: any = null): any {
  console.log(`Manually extracting MP profile data from HTML for ${url}`);
  
  try {
    // Initialize with base data if provided
    const mpData = baseData ? { ...baseData } : {
      title: "",
      content: "",
      url: url,
      type: "mp",
      metadata: {}
    };
    
    // Extract the MP's name if not already set
    if (!mpData.title || mpData.title.length === 0) {
      const namePattern = /<h1[^>]*>([\s\S]*?)<\/h1>/i;
      const nameMatch = html.match(namePattern);
      if (nameMatch) {
        mpData.title = nameMatch[1].replace(/<[^>]*>/g, '').trim();
      }
    }
    
    // Try to get MP's image
    const imagePattern = /<img[^>]*src="([^"]*myndir[^"]*)"[^>]*>/i;
    const imageMatch = html.match(imagePattern);
    if (imageMatch) {
      const imageSrc = imageMatch[1];
      mpData.metadata.imageUrl = imageSrc.startsWith('http') ? imageSrc : `https://www.althingi.is${imageSrc.startsWith('/') ? '' : '/'}${imageSrc}`;
    }
    
    // Extract email if available
    const emailPattern = /<a[^>]*href="mailto:([^"]*)"[^>]*>/i;
    const emailMatch = html.match(emailPattern);
    if (emailMatch) {
      mpData.metadata.email = emailMatch[1];
    }
    
    // Extract bio/content
    const bioPattern = /<div[^>]*class="[^"]*bio[^"]*"[^>]*>([\s\S]*?)<\/div>/i;
    const bioMatch = html.match(bioPattern);
    if (bioMatch) {
      mpData.content = bioMatch[1].replace(/<[^>]*>/g, '').trim();
    } else {
      // Try to extract content from paragraphs
      const paragraphPattern = /<p[^>]*>([\s\S]*?)<\/p>/gi;
      const paragraphs = Array.from(html.matchAll(paragraphPattern))
        .map(m => m[1].replace(/<[^>]*>/g, '').trim())
        .filter(p => p.length > 100); // Only substantial paragraphs
      
      if (paragraphs.length > 0) {
        mpData.content = paragraphs[0];
      }
    }
    
    // Extract social media links
    const socialLinks: string[] = [];
    const socialPattern = /<a[^>]*href="([^"]*(facebook|twitter|instagram)[^"]*)"[^>]*>/gi;
    let socialMatch;
    while ((socialMatch = socialPattern.exec(html)) !== null) {
      socialLinks.push(socialMatch[1]);
    }
    
    if (socialLinks.length > 0) {
      mpData.metadata.socialLinks = socialLinks;
    }
    
    console.log(`Successfully extracted profile data for ${mpData.title || 'MP'}`);
    return mpData;
  } catch (error) {
    console.error("Error extracting MP profile data:", error);
    return baseData || {
      title: "MP Profile",
      content: "Error extracting profile data",
      url: url,
      type: "mp",
      metadata: {}
    };
  }
}

// Specific function to extract MP data from MPs list page
async function extractMpListData(doc: any, baseUrl: string, html: string): Promise<any[]> {
  const mps = [];
  console.log("Extracting MPs data from list page");
  
  // Try with DOM parser first
  if (doc) {
    // Get the MP table
    const table = doc.querySelector("table");
    
    if (table) {
      // Get all rows except the header row
      const rows = table.querySelectorAll("tr:not(:first-child)");
      
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const cells = row.querySelectorAll("td");
        
        if (cells.length >= 4) { // Make sure we have enough cells
          const nameCell = cells[0];
          const partyCell = cells[3];
          const constituencyCell = cells[2];
          
          // Extract the link to the MP's profile page
          const link = nameCell.querySelector("a");
          const mpUrl = link ? link.getAttribute("href") : null;
          const normalizedMpUrl = mpUrl ? normalizeUrl(mpUrl, baseUrl) : null;
          
          // Get the MP's name and other data
          const name = nameCell.textContent?.trim() || "";
          const party = partyCell.textContent?.trim() || "";
          const constituency = constituencyCell.textContent?.trim() || "";
          
          if (name && normalizedMpUrl) {
            mps.push({
              title: name,
              content: `MP from ${constituency}, representing ${party}`,
              url: normalizedMpUrl,
              type: "mp",
              metadata: {
                party,
                constituency,
                source: "mp_list"
              },
              profileUrl: normalizedMpUrl
            });
          }
        }
      }
    }
  }
  
  // If DOM parser didn't work, try direct HTML extraction
  if (mps.length === 0 && html) {
    return extractMpDataFromHtml(html);
  }
  
  console.log(`Found ${mps.length} MPs in the list`);
  return mps;
}

// Function to extract data from an MP's profile page
async function extractMpProfileData(doc: any, url: string, html: string, baseData: any = null): Promise<any> {
  console.log(`Extracting MP profile data from ${url}`);
  
  // Initialize with base data if provided
  const mpData = baseData ? { ...baseData } : {
    title: "",
    content: "",
    url: url,
    type: "mp",
    metadata: {}
  };
  
  // If DOM parsing works, use it
  if (doc) {
    // Extract the MP's name if not already set
    if (!mpData.title || mpData.title.length === 0) {
      const nameElement = doc.querySelector("h1") || doc.querySelector(".name") || doc.querySelector("header h2");
      if (nameElement) {
        mpData.title = nameElement.textContent?.trim() || "";
      }
    }
    
    // Try to get MP's image
    const imageElement = doc.querySelector("img[src*='myndir']") || doc.querySelector(".profile-image img") || doc.querySelector("img[alt*='mynd']");
    if (imageElement) {
      const imageSrc = imageElement.getAttribute("src");
      if (imageSrc) {
        mpData.metadata.imageUrl = normalizeUrl(imageSrc, url);
      }
    }
    
    // Try to extract position
    const positionElement = doc.querySelector(".position") || doc.querySelector("[class*='position']") || doc.querySelector(".title") || doc.querySelector("h3");
    if (positionElement) {
      mpData.metadata.position = positionElement.textContent?.trim() || "";
    }
    
    // Try to extract biography/about
    const bioElement = doc.querySelector(".bio") || doc.querySelector(".about") || doc.querySelector(".description") || doc.querySelector("article p");
    if (bioElement) {
      mpData.content = bioElement.textContent?.trim() || mpData.content;
    }
    
    // Extract contact information
    const emailElement = doc.querySelector("[href^='mailto:']") || doc.querySelector(".email") || doc.querySelector("a[href*='@']");
    if (emailElement) {
      const email = emailElement.getAttribute("href")?.replace("mailto:", "") || emailElement.textContent?.trim();
      if (email) {
        mpData.metadata.email = email;
      }
    }
    
    // Extract social media links
    const socialLinks = doc.querySelectorAll("a[href*='facebook'], a[href*='twitter'], a[href*='instagram']");
    if (socialLinks.length > 0) {
      mpData.metadata.socialLinks = [];
      for (let i = 0; i < socialLinks.length; i++) {
        const link = socialLinks[i];
        const href = link.getAttribute("href");
        if (href) {
          mpData.metadata.socialLinks.push(href);
        }
      }
    }
  } else if (html) {
    // Use regex-based extraction if DOM parsing failed
    return extractMpProfileDataFromHtml(html, url, baseData);
  }
  
  console.log(`Extracted profile data for ${mpData.title}`);
  return mpData;
}

// Actual scraping function for Althingi
async function scrapeData(scraperType: string, config: any) {
  console.log(`Scraping data type: ${scraperType} with config:`, config);
  
  // Get the valid item type for database insertion
  const validType = getValidItemType(scraperType);
  
  // Set default values from config or use defaults
  const maxDepth = config.depth || 2;
  const throttle = config.throttle || 1500;
  const saveRawHtml = config.save_raw_html || false;
  const timeout = (config.timeout_seconds || 30) * 1000;
  
  let urlsToVisit: string[] = [];
  
  // If scraping MPs, try multiple potential URLs
  if (scraperType === "mps") {
    urlsToVisit = getMpUrls();
  } else {
    // Define the base URL - use provided URL or default for the type
    const baseUrl = config.url || getBaseUrl(scraperType);
    urlsToVisit = [baseUrl];
  }
  
  const visitedUrls = new Set<string>();
  const scrapedItems = [];
  const failedUrls: {url: string, error: string}[] = [];
  
  // For MP pages, we'll track MPs separately
  let mpProfiles = [];
  
  // Used to store raw HTML of successful pages
  const successfulResponses = new Map<string, {html: string, url: string}>();
  
  // Process each URL
  for (const startUrl of urlsToVisit) {
    if (visitedUrls.has(startUrl)) continue;
    
    let currentDepthUrls = [startUrl];
    console.log(`Starting with URL: ${startUrl}`);
    
    // Process each depth level
    for (let depth = 0; depth < maxDepth && currentDepthUrls.length > 0; depth++) {
      console.log(`Processing depth ${depth + 1}/${maxDepth}, ${currentDepthUrls.length} URLs in queue`);
      
      const nextDepthUrls: string[] = [];
      
      // Process each URL at current depth
      for (const url of currentDepthUrls) {
        if (visitedUrls.has(url)) continue;
        visitedUrls.add(url);
        
        try {
          // Apply throttling
          if (throttle > 0) {
            await new Promise(resolve => setTimeout(resolve, throttle));
          }
          
          console.log(`Fetching ${url}...`);
          
          // Set up realistic browser headers
          const headers = {
            'User-Agent': getRandomUserAgent(),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9,is;q=0.8',
            'Referer': 'https://www.althingi.is/',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'same-origin',
            'Sec-Fetch-User': '?1',
          };
          
          // Fetch with retry
          const response = await fetchWithRetry(url, { 
            headers,
            signal: AbortSignal.timeout(timeout)
          }, 3, throttle);
          
          if (!response.ok) {
            const errorMsg = `Failed to fetch ${url}: ${response.status} ${response.statusText}`;
            console.error(errorMsg);
            failedUrls.push({url, error: errorMsg});
            continue;
          }
          
          const html = await response.text();
          
          // Save successful response
          successfulResponses.set(url, {html, url});
          
          // Parse the HTML
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, "text/html");
          
          if (!doc) {
            console.error(`Failed to parse HTML from ${url}`);
            failedUrls.push({url, error: "Failed to parse HTML"});
            continue;
          }
          
          // Special handling for MPs list page
          if (validType === "mp" && 
              (url.includes("/thingmenn/althingismenn/") || 
               url.includes("/thingmenn/") || 
               url.includes("/altext/cv/is/"))) {
            
            console.log("Processing MPs list page");
            const mpList = await extractMpListData(doc, url, html);
            
            // Add MPs to scraped items if we found any
            if (mpList.length > 0) {
              console.log(`Successfully found ${mpList.length} MPs in the list`);
              
              for (const mp of mpList) {
                scrapedItems.push(mp);
                
                // Add MP profile URLs to visit if we're not at max depth
                if (depth < maxDepth - 1 && mp.profileUrl) {
                  nextDepthUrls.push(mp.profileUrl);
                  mpProfiles.push({
                    url: mp.profileUrl,
                    baseData: mp
                  });
                }
              }
              
              // Skip the generic extraction below
              continue;
            }
          }
          
          // Check if this is an MP profile page we're already tracking
          const mpProfile = mpProfiles.find(p => p.url === url);
          if (validType === "mp" && mpProfile) {
            console.log(`Processing MP profile page for URL: ${url}`);
            const profileData = await extractMpProfileData(doc, url, html, mpProfile.baseData);
            
            // Update or add the MP data
            const existingIndex = scrapedItems.findIndex(item => item.url === url);
            if (existingIndex >= 0) {
              scrapedItems[existingIndex] = profileData;
            } else {
              scrapedItems.push(profileData);
            }
            
            // Skip the generic extraction below
            continue;
          }
          
          // Generic extraction for other page types
          let title = "";
          let content = "";
          
          // Extract data based on type
          switch (validType) {
            case "bill":
              // Extract bill information - using Althingi site structure
              const billTitle = doc.querySelector("h1, .title, .name")?.textContent?.trim();
              const billContent = doc.querySelector(".content, .text, article")?.textContent?.trim();
              title = billTitle || `Bill from ${url}`;
              content = billContent || "";
              break;
            
            case "vote":
              // Extract voting information - using Althingi site structure
              const voteTitle = doc.querySelector("h1, .heading, .title")?.textContent?.trim();
              const voteResults = doc.querySelector(".results, .votes, table")?.textContent?.trim();
              title = voteTitle || `Vote from ${url}`;
              content = voteResults || "";
              break;
            
            case "speech":
              // Extract speech information - using Althingi site structure
              const speechTitle = doc.querySelector("h1, .title, .header")?.textContent?.trim();
              const speechText = doc.querySelector(".speech-content, .text, article")?.textContent?.trim();
              title = speechTitle || `Speech from ${url}`;
              content = speechText || "";
              break;
            
            case "committee":
              // Extract committee information - using Althingi site structure
              const committeeName = doc.querySelector("h1, .name, .title")?.textContent?.trim();
              const committeeDesc = doc.querySelector(".description, .info, .about")?.textContent?.trim();
              title = committeeName || `Committee from ${url}`;
              content = committeeDesc || "";
              break;
            
            case "issue":
              // Extract issue information - using Althingi site structure
              const issueName = doc.querySelector("h1, .title, .name")?.textContent?.trim();
              const issueDesc = doc.querySelector(".description, .text, .content")?.textContent?.trim();
              title = issueName || `Issue from ${url}`;
              content = issueDesc || "";
              break;
            
            default:
              // Generic extraction
              title = doc.querySelector("h1")?.textContent?.trim() || `Content from ${url}`;
              content = doc.querySelector("main, .content, article")?.textContent?.trim() || "";
          }
          
          // Add the scraped item if it's not a known MP profile we already processed
          if (title && !mpProfile) {
            // Ensure the URL is properly formatted for database storage
            const normalizedUrl = normalizeUrl(url, startUrl);
            
            scrapedItems.push({
              title,
              content,
              url: normalizedUrl,
              type: validType,
              scraped_at: new Date().toISOString(),
              raw_html: saveRawHtml ? html : null
            });
          }
          
          // Find more links to add to the queue if we haven't reached max depth
          if (depth < maxDepth - 1) {
            const links = doc.querySelectorAll("a");
            for (let i = 0; i < links.length; i++) {
              const link = links[i];
              const href = link.getAttribute("href");
              
              if (!href) continue;
              
              // Normalize the URL
              const nextUrl = normalizeUrl(href, url);
              
              // Skip URLs that don't contain althingi.is
              if (!nextUrl.includes("althingi.is")) continue;
              
              // Add to queue if not visited yet
              if (!visitedUrls.has(nextUrl)) {
                nextDepthUrls.push(nextUrl);
              }
            }
          }
          
        } catch (error) {
          const errorMsg = `Error processing ${url}: ${error instanceof Error ? error.message : String(error)}`;
          console.error(errorMsg);
          failedUrls.push({url, error: errorMsg});
        }
      }
      
      // Update URLs for next depth
      currentDepthUrls = nextDepthUrls;
    }
  }
  
  // If we couldn't scrape any items normally, try to extract directly from raw HTML
  if (scrapedItems.length === 0 && successfulResponses.size > 0) {
    console.log("No items scraped with DOM parser. Trying direct HTML extraction...");
    
    for (const [url, data] of successfulResponses) {
      if (validType === "mp") {
        const mpData = extractMpDataFromHtml(data.html);
        if (mpData.length > 0) {
          scrapedItems.push(...mpData);
        } else {
          // Try to extract as a profile page
          const profileData = extractMpProfileDataFromHtml(data.html, url);
          if (profileData.title) {
            scrapedItems.push(profileData);
          }
        }
      }
    }
  }
  
  console.log(`Scraped ${scrapedItems.length} items for ${scraperType}`);
  console.log(`Failed URLs: ${failedUrls.length}`);
  
  return {
    items: scrapedItems,
    failedUrls: failedUrls
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204, 
      headers: corsHeaders 
    });
  }

  try {
    // Check for empty request body
    const contentLength = req.headers.get('content-length');
    if (!contentLength || parseInt(contentLength) === 0) {
      return new Response(
        JSON.stringify({ error: "Empty request body" }),
        { 
          status: 400, 
          headers: { 
            "Content-Type": "application/json",
            ...corsHeaders
          } 
        }
      );
    }

    // Parse request body with error handling
    let requestData;
    try {
      const bodyText = await req.text();
      if (!bodyText) {
        throw new Error("Empty request body");
      }
      requestData = JSON.parse(bodyText);
    } catch (error) {
      console.error("Error parsing request body:", error);
      return new Response(
        JSON.stringify({ error: "Invalid JSON in request body" }),
        { 
          status: 400, 
          headers: { 
            "Content-Type": "application/json",
            ...corsHeaders
          } 
        }
      );
    }

    const { type, jobId, config } = requestData;
    
    if (!type || !jobId) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters (type or jobId)" }),
        { 
          status: 400, 
          headers: { 
            "Content-Type": "application/json",
            ...corsHeaders
          } 
        }
      );
    }
    
    console.log(`Starting scrape job ${jobId} for type ${type}`);
    
    // Update job status to running
    await supabase
      .from("scrape_jobs")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("id", jobId);
    
    try {
      // Do the actual scraping
      const scrapeResult = await scrapeData(type, config);
      const scrapedItems = scrapeResult.items;
      const failedUrls = scrapeResult.failedUrls;
      
      // Insert scraped items into database
      if (scrapedItems.length > 0) {
        const { error } = await supabase
          .from("scraped_items")
          .insert(
            scrapedItems.map(item => ({
              title: item.title,
              url: item.url,
              type: item.type,
              content: item.content,
              raw_html: item.raw_html,
              scraped_at: new Date().toISOString(),
              metadata: item.metadata // Include metadata field
            }))
          );
        
        if (error) {
          console.error("Error inserting scraped items:", error);
          throw new Error(`Failed to insert scraped items: ${error.message}`);
        }
      }
      
      // Update job status to completed
      await supabase
        .from("scrape_jobs")
        .update({ 
          status: "completed", 
          completed_at: new Date().toISOString(),
          items_scraped: scrapedItems.length,
          error_message: failedUrls.length > 0 ? 
            `Scraped ${scrapedItems.length} items with ${failedUrls.length} failures` : null
        })
        .eq("id", jobId);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          items: scrapedItems.length,
          failedUrls: failedUrls.length
        }),
        { 
          status: 200, 
          headers: { 
            "Content-Type": "application/json",
            ...corsHeaders
          } 
        }
      );
    } catch (error) {
      console.error("Scraping error:", error);
      
      // Update job status to failed
      await supabase
        .from("scrape_jobs")
        .update({ 
          status: "failed", 
          completed_at: new Date().toISOString(),
          error_message: error instanceof Error ? error.message : String(error)
        })
        .eq("id", jobId);
      
      return new Response(
        JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
        { 
          status: 500, 
          headers: { 
            "Content-Type": "application/json",
            ...corsHeaders
          } 
        }
      );
    }
  } catch (error) {
    console.error("Server error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { 
        status: 500, 
        headers: { 
          "Content-Type": "application/json",
          ...corsHeaders
        } 
      }
    );
  }
});
