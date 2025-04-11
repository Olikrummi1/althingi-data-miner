
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.24.0";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VALID_TYPES = ["bill", "vote", "speech", "mp", "committee", "issue"];

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/117.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPad; CPU OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1'
];

const EDGE_FUNCTION_TIMEOUT_MS = 25000; // 25 seconds (conservative to allow for cleanup)
const MAX_ITEMS_PER_TYPE = 500; // Increased max items per type
const BATCH_SIZE = 20; // Increased batch size
const SAVE_INTERVAL_MS = 4000; // Save more frequently

function getValidItemType(scraperType: string): string {
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

function getMpUrls(): string[] {
  return [
    "https://www.althingi.is/thingmenn/althingismenn/",
    "https://www.althingi.is/altext/cv/is/",  // Alternative URL for MP info
    "https://www.althingi.is/thingmenn/",     // Main MPs section
    "https://www.althingi.is/thingmenn/thingmenn/",  // Another potential URL
    "https://www.althingi.is/thingmenn/thingmenn-eftir-thingflokkum/", // By party
    "https://www.althingi.is/thingmenn/thingmenn/thingrodun/", // By constituency
  ];
}

function getAdditionalStartUrls(scraperType: string): string[] {
  switch(scraperType) {
    case "bills":
      return [
        "https://www.althingi.is/thingstorf/thingmalalistar-eftir-thingum/",
        "https://www.althingi.is/thingstorf/thingmalalistar-eftir-thingum/ferill-mala/",
        "https://www.althingi.is/lagasafn/", // Laws repository
      ];
    case "votes":
      return [
        "https://www.althingi.is/thingstorf/atkvaedagreidslur/",
        "https://www.althingi.is/thingstorf/atkvaedagreidslur/atkvaedagreidslur-a-151-loggjafarthingi/",
        "https://www.althingi.is/thingstorf/atkvaedagreidslur/atkvaedagreidslur-a-152-loggjafarthingi/",
      ];
    case "speeches":
      return [
        "https://www.althingi.is/altext/raedur/",
        "https://www.althingi.is/thingstorf/thingmalalistar-eftir-thingum/umraedur-um-einstok-mal/",
      ];
    case "committees":
      return [
        "https://www.althingi.is/thingnefndir/fastanefndir/", 
        "https://www.althingi.is/thingnefndir/nefndarfundir/",
        "https://www.althingi.is/thingnefndir/",
      ];
    case "issues":
      return [
        "https://www.althingi.is/thingstorf/thingmalalistar-eftir-thingum/",
        "https://www.althingi.is/thingstorf/thing-og-mal/",
      ];
    default:
      return [];
  }
}

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

function normalizeUrl(url: string, baseUrl: string): string {
  if (!url) return baseUrl;
  if (url.startsWith("http")) return url;
  
  if (url.startsWith("/")) {
    const baseOrigin = new URL(baseUrl).origin;
    return `${baseOrigin}${url}`;
  }
  
  if (url.startsWith("www.")) {
    return `https://${url}`;
  }
  
  return `${baseUrl}${url}`;
}

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3, delayMs = 2000): Promise<Response> {
  console.log(`Attempting to fetch ${url}...`);
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`Retry attempt ${attempt + 1} for ${url}`);
        await new Promise(resolve => setTimeout(resolve, delayMs * Math.pow(1.5, attempt)));
      }
      
      const response = await fetch(url, options);
      
      if (response.ok) {
        return response;
      }
      
      console.error(`Attempt ${attempt + 1} failed with status ${response.status}: ${response.statusText}`);
      
      if (response.status === 403 || response.status === 429) {
        await new Promise(resolve => setTimeout(resolve, delayMs * 2));
      }
      
      if (attempt === maxRetries - 1) {
        return response;
      }
    } catch (error) {
      console.error(`Fetch error on attempt ${attempt + 1}:`, error);
      
      if (attempt === maxRetries - 1) {
        throw error;
      }
    }
  }
  
  throw new Error(`Failed to fetch ${url} after ${maxRetries} attempts`);
}

// Functions for extracting different types of data
function extractMpDataFromHtml(html: string): any[] {
  console.log("Manually extracting MP data from HTML...");
  
  const mps: any[] = [];
  
  try {
    const tablePattern = /<table[^>]*>[\s\S]*?<\/table>/gi;
    const tableMatch = html.match(tablePattern);
    
    if (!tableMatch) {
      console.log("No table found in HTML");
      return mps;
    }
    
    const table = tableMatch[0];
    
    const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const rows = Array.from(table.matchAll(rowPattern)).map(m => m[0]);
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      
      const cellPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      const cells = Array.from(row.matchAll(cellPattern)).map(m => m[1]);
      
      if (cells.length >= 4) {
        const nameCell = cells[0];
        const linkMatch = /<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i.exec(nameCell);
        
        if (linkMatch) {
          const url = linkMatch[1];
          const name = linkMatch[2].replace(/<[^>]*>/g, '').trim();
          
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

function extractMpProfileDataFromHtml(html: string, url: string, baseData: any = null): any {
  console.log(`Manually extracting MP profile data from HTML for ${url}`);
  
  try {
    const mpData = baseData ? { ...baseData } : {
      title: "",
      content: "",
      url: url,
      type: "mp",
      metadata: {}
    };
    
    if (!mpData.title || mpData.title.length === 0) {
      const namePattern = /<h1[^>]*>([\s\S]*?)<\/h1>/i;
      const nameMatch = html.match(namePattern);
      if (nameMatch) {
        mpData.title = nameMatch[1].replace(/<[^>]*>/g, '').trim();
      }
    }
    
    const imagePattern = /<img[^>]*src="([^"]*myndir[^"]*)"[^>]*>/i;
    const imageMatch = html.match(imagePattern);
    if (imageMatch) {
      const imageSrc = imageMatch[1];
      mpData.metadata.imageUrl = imageSrc.startsWith('http') ? imageSrc : `https://www.althingi.is${imageSrc.startsWith('/') ? '' : '/'}${imageSrc}`;
    }
    
    const emailPattern = /<a[^>]*href="mailto:([^"]*)"[^>]*>/i;
    const emailMatch = html.match(emailPattern);
    if (emailMatch) {
      mpData.metadata.email = emailMatch[1];
    }
    
    const bioPattern = /<div[^>]*class="[^"]*bio[^"]*"[^>]*>([\s\S]*?)<\/div>/i;
    const bioMatch = html.match(bioPattern);
    if (bioMatch) {
      mpData.content = bioMatch[1].replace(/<[^>]*>/g, '').trim();
    } else {
      const paragraphPattern = /<p[^>]*>([\s\S]*?)<\/p>/gi;
      const paragraphs = Array.from(html.matchAll(paragraphPattern))
        .map(m => m[1].replace(/<[^>]*>/g, '').trim())
        .filter(p => p.length > 100);
      
      if (paragraphs.length > 0) {
        mpData.content = paragraphs[0];
      }
    }
    
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

async function extractMpListData(doc: any, baseUrl: string, html: string): Promise<any[]> {
  const mps = [];
  console.log("Extracting MPs data from list page");
  
  if (doc) {
    const table = doc.querySelector("table");
    
    if (table) {
      const rows = table.querySelectorAll("tr:not(:first-child)");
      
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const cells = row.querySelectorAll("td");
        
        if (cells.length >= 4) {
          const nameCell = cells[0];
          const partyCell = cells[3];
          const constituencyCell = cells[2];
          
          const link = nameCell.querySelector("a");
          const mpUrl = link ? link.getAttribute("href") : null;
          const normalizedMpUrl = mpUrl ? normalizeUrl(mpUrl, baseUrl) : null;
          
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
  
  if (mps.length === 0 && html) {
    return extractMpDataFromHtml(html);
  }
  
  console.log(`Found ${mps.length} MPs in the list`);
  return mps;
}

async function extractMpProfileData(doc: any, url: string, html: string, baseData: any = null): Promise<any> {
  console.log(`Extracting MP profile data from ${url}`);
  
  const mpData = baseData ? { ...baseData } : {
    title: "",
    content: "",
    url: url,
    type: "mp",
    metadata: {}
  };
  
  if (doc) {
    if (!mpData.title || mpData.title.length === 0) {
      const nameElement = doc.querySelector("h1") || doc.querySelector(".name") || doc.querySelector("header h2");
      if (nameElement) {
        mpData.title = nameElement.textContent?.trim() || "";
      }
    }
    
    const imageElement = doc.querySelector("img[src*='myndir']") || doc.querySelector(".profile-image img") || doc.querySelector("img[alt*='mynd']");
    if (imageElement) {
      const imageSrc = imageElement.getAttribute("src");
      if (imageSrc) {
        mpData.metadata.imageUrl = normalizeUrl(imageSrc, url);
      }
    }
    
    const positionElement = doc.querySelector(".position") || doc.querySelector("[class*='position']") || doc.querySelector(".title") || doc.querySelector("h3");
    if (positionElement) {
      mpData.metadata.position = positionElement.textContent?.trim() || "";
    }
    
    const bioElement = doc.querySelector(".bio") || doc.querySelector(".about") || doc.querySelector(".description") || doc.querySelector("article p");
    if (bioElement) {
      mpData.content = bioElement.textContent?.trim() || mpData.content;
    }
    
    const emailElement = doc.querySelector("[href^='mailto:']") || doc.querySelector(".email") || doc.querySelector("a[href*='@']");
    if (emailElement) {
      const email = emailElement.getAttribute("href")?.replace("mailto:", "") || emailElement.textContent?.trim();
      if (email) {
        mpData.metadata.email = email;
      }
    }
    
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
    return extractMpProfileDataFromHtml(html, url, baseData);
  }
  
  console.log(`Extracted profile data for ${mpData.title}`);
  return mpData;
}

async function scrapeData(scraperType: string, config: any, jobId: string) {
  console.log(`Scraping data type: ${scraperType} with config:`, config);
  
  const validType = getValidItemType(scraperType);
  
  const maxDepth = Math.min(config.depth || 3, 6); // Increased max depth to 6
  const throttle = Math.max(config.throttle || 1000, 200); // Reduced minimum throttle to 200ms
  const saveRawHtml = config.save_raw_html || false;
  const timeout = Math.min((config.timeout_seconds || 20) * 1000, 20000); // Increased maximum timeout
  const exploreBreadth = config.explore_breadth || 15; // How many links to follow at each depth
  const maxItems = config.max_items || MAX_ITEMS_PER_TYPE;
  
  let itemsScraped = 0;
  let urlsToVisit: string[] = [];
  
  if (scraperType === "mps") {
    urlsToVisit = getMpUrls();
  } else {
    const baseUrl = config.url || getBaseUrl(scraperType);
    urlsToVisit = [baseUrl, ...getAdditionalStartUrls(scraperType)];
  }
  
  // Remove duplicate URLs
  urlsToVisit = [...new Set(urlsToVisit)];
  
  const visitedUrls = new Set<string>();
  const scrapedItems: any[] = [];
  const failedUrls: {url: string, error: string}[] = [];
  
  let mpProfiles: any[] = [];
  
  const successfulResponses = new Map<string, {html: string, url: string}>();
  
  const startJobResult = await supabase
    .from("scrape_jobs")
    .update({
      status: "running",
      started_at: new Date().toISOString()
    })
    .eq("id", jobId);
  
  if (startJobResult.error) {
    console.error("Error updating job status to running:", startJobResult.error);
  } else {
    console.log("Updated job status to running");
  }
  
  let lastSaveTime = Date.now();
  let pendingItems: any[] = [];
  
  async function saveBatchToDb(items: any[], forceUpdate = false): Promise<boolean> {
    if (!items || items.length === 0) return true;
    
    const currentTime = Date.now();
    pendingItems.push(...items);
    
    if (pendingItems.length >= BATCH_SIZE || 
        currentTime - lastSaveTime > SAVE_INTERVAL_MS || 
        forceUpdate) {
      
      try {
        console.log(`Saving batch of ${pendingItems.length} items to database...`);
        const { error } = await supabase
          .from("scraped_items")
          .insert(pendingItems);
        
        if (error) {
          console.error("Error saving batch to database:", error);
          return false;
        }
        
        console.log(`Successfully saved ${pendingItems.length} items to database`);
        lastSaveTime = currentTime;
        pendingItems = []; // Clear pending items after successful save
        return true;
      } catch (error) {
        console.error("Exception saving batch to database:", error);
        return false;
      }
    }
    
    return true; // No save attempted yet
  }
  
  let isTimedOut = false;
  
  const timeoutId = setTimeout(async () => {
    console.log("Approaching function timeout, saving remaining data and completing job...");
    isTimedOut = true;
    
    if (pendingItems.length > 0) {
      await saveBatchToDb([], true); // Force save any pending items
    }
    
    await supabase
      .from("scrape_jobs")
      .update({ 
        status: "completed", 
        completed_at: new Date().toISOString(),
        items_scraped: itemsScraped,
        error_message: "Function timed out but data was saved successfully"
      })
      .eq("id", jobId);
      
    console.log("Saved all pending data before timeout");
  }, EDGE_FUNCTION_TIMEOUT_MS);
  
  let batchCount = 0;
  const scrapedItemsBatch: any[] = [];
  
  try {
    const statusUpdateInterval = setInterval(async () => {
      if (itemsScraped > 0) {
        await supabase
          .from("scrape_jobs")
          .update({ items_scraped: itemsScraped })
          .eq("id", jobId);
        console.log(`Updated job status: ${itemsScraped} items scraped`);
      }
    }, 2000); // More frequent updates
    
    for (const startUrl of urlsToVisit) {
      if (visitedUrls.has(startUrl) || isTimedOut) continue;
      
      let currentDepthUrls = [startUrl];
      console.log(`Starting with URL: ${startUrl}`);
      
      // Process each level of depth
      for (let depth = 0; depth < maxDepth && currentDepthUrls.length > 0 && !isTimedOut; depth++) {
        console.log(`Processing depth ${depth + 1}/${maxDepth}, ${currentDepthUrls.length} URLs in queue`);
        
        const nextDepthUrls: string[] = [];
        
        // Take more URLs at each depth for better coverage
        const urlsToProcess = currentDepthUrls.slice(0, Math.min(20, currentDepthUrls.length)); 
        
        for (const url of urlsToProcess) {
          if (isTimedOut) break;
          
          if (Date.now() - lastSaveTime > SAVE_INTERVAL_MS) {
            await saveBatchToDb([], true); // Force save
          }
          
          const jobActive = await isJobStillActive(jobId);
          if (!jobActive) {
            console.log(`Job ${jobId} is no longer active, stopping scrape`);
            
            if (scrapedItemsBatch.length > 0) {
              await saveBatchToDb(scrapedItemsBatch, true);
            }
            
            clearInterval(statusUpdateInterval);
            clearTimeout(timeoutId);
            
            return {
              items: scrapedItems,
              failedUrls: failedUrls,
              stopped: true
            };
          }
          
          if (visitedUrls.has(url)) continue;
          visitedUrls.add(url);
          
          if (itemsScraped >= maxItems) {
            console.log(`Reached maximum items limit (${maxItems}), stopping scrape`);
            break;
          }
          
          try {
            if (throttle > 0) {
              await new Promise(resolve => setTimeout(resolve, throttle));
            }
            
            console.log(`Fetching ${url}...`);
            
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
            
            const response = await fetchWithRetry(url, { 
              headers,
              signal: AbortSignal.timeout(timeout)
            }, 2, throttle);
            
            if (!response.ok) {
              const errorMsg = `Failed to fetch ${url}: ${response.status} ${response.statusText}`;
              console.error(errorMsg);
              failedUrls.push({url, error: errorMsg});
              continue;
            }
            
            const html = await response.text();
            
            successfulResponses.set(url, {html, url});
            
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");
            
            if (!doc) {
              console.error(`Failed to parse HTML from ${url}`);
              failedUrls.push({url, error: "Failed to parse HTML"});
              continue;
            }
            
            // Special handling for MP pages
            if (validType === "mp" && 
                (url.includes("/thingmenn/althingismenn/") || 
                url.includes("/thingmenn/") || 
                url.includes("/altext/cv/is/"))) {
              
              console.log("Processing MPs list page");
              const mpList = await extractMpListData(doc, url, html);
              
              if (mpList.length > 0) {
                console.log(`Successfully found ${mpList.length} MPs in the list`);
                
                for (const mp of mpList) {
                  mp.scraped_at = new Date().toISOString();
                  scrapedItems.push(mp);
                  scrapedItemsBatch.push(mp);
                  itemsScraped++;
                  
                  if (depth < maxDepth - 1 && mp.profileUrl) {
                    nextDepthUrls.push(mp.profileUrl);
                    mpProfiles.push({
                      url: mp.profileUrl,
                      baseData: mp
                    });
                  }
                  
                  batchCount++;
                  if (batchCount >= BATCH_SIZE) {
                    await saveBatchToDb(scrapedItemsBatch);
                    scrapedItemsBatch.length = 0;
                    batchCount = 0;
                  }
                }
                
                await supabase
                  .from("scrape_jobs")
                  .update({ items_scraped: itemsScraped })
                  .eq("id", jobId);
                
                continue;
              }
            }
            
            // Process MP profile pages
            const mpProfile = mpProfiles.find(p => p.url === url);
            if (validType === "mp" && mpProfile) {
              console.log(`Processing MP profile page for URL: ${url}`);
              const profileData = await extractMpProfileData(doc, url, html, mpProfile.baseData);
              
              profileData.scraped_at = new Date().toISOString();
              
              const existingIndex = scrapedItems.findIndex(item => item.url === url);
              if (existingIndex >= 0) {
                scrapedItems[existingIndex] = profileData;
              } else {
                scrapedItems.push(profileData);
                scrapedItemsBatch.push(profileData);
                itemsScraped++;
                
                batchCount++;
                if (batchCount >= BATCH_SIZE) {
                  await saveBatchToDb(scrapedItemsBatch);
                  scrapedItemsBatch.length = 0;
                  batchCount = 0;
                }
              }
              
              await supabase
                .from("scrape_jobs")
                .update({ items_scraped: itemsScraped })
                .eq("id", jobId);
              
              continue;
            }
            
            // Extract content for the current page based on type
            let title = "";
            let content = "";
            let metadata: Record<string, any> = {};
            
            switch (validType) {
              case "bill":
                const billTitle = doc.querySelector("h1, .title, .name, header h2")?.textContent?.trim();
                const billContent = doc.querySelector(".content, .text, article, main p")?.textContent?.trim();
                
                // Extract bill metadata
                const billNumberEl = doc.querySelector(".number, .bill-number, [class*='number']");
                const billNumber = billNumberEl ? billNumberEl.textContent?.trim() : "";
                
                const sessionEl = doc.querySelector(".session, .parliament, [class*='session']");
                const session = sessionEl ? sessionEl.textContent?.trim() : "";
                
                const statusEl = doc.querySelector(".status, .bill-status, [class*='status']");
                const status = statusEl ? statusEl.textContent?.trim() : "";
                
                title = billTitle || `Bill from ${url}`;
                content = billContent || "";
                metadata = {
                  billNumber,
                  session,
                  status
                };
                break;
              
              case "vote":
                const voteTitle = doc.querySelector("h1, .heading, .title, header h2")?.textContent?.trim();
                const voteResults = doc.querySelector(".results, .votes, table, .vote-results")?.textContent?.trim();
                
                // Extract voting metadata
                const voteDate = doc.querySelector(".date, time, [class*='date']")?.textContent?.trim();
                const voteCount = doc.querySelector(".count, .vote-count, [class*='count']")?.textContent?.trim();
                
                title = voteTitle || `Vote from ${url}`;
                content = voteResults || "";
                metadata = {
                  date: voteDate,
                  count: voteCount
                };
                break;
              
              case "speech":
                const speechTitle = doc.querySelector("h1, .title, .header, [class*='title']")?.textContent?.trim();
                const speechText = doc.querySelector(".speech-content, .text, article, main p")?.textContent?.trim();
                
                // Extract speech metadata
                const speakerEl = doc.querySelector(".speaker, .author, [class*='speaker']");
                const speaker = speakerEl ? speakerEl.textContent?.trim() : "";
                
                const dateEl = doc.querySelector(".date, time, [class*='date']");
                const date = dateEl ? dateEl.textContent?.trim() : "";
                
                title = speechTitle || `Speech from ${url}`;
                content = speechText || "";
                metadata = {
                  speaker,
                  date
                };
                break;
              
              case "committee":
                const committeeName = doc.querySelector("h1, .name, .title, header h2")?.textContent?.trim();
                const committeeDesc = doc.querySelector(".description, .info, .about, article p")?.textContent?.trim();
                
                // Extract committee metadata
                const chairEl = doc.querySelector(".chair, .chairman, .chairperson, [class*='chair']");
                const chair = chairEl ? chairEl.textContent?.trim() : "";
                
                const membersEl = doc.querySelector(".members, .committee-members, [class*='members']");
                const members = membersEl ? membersEl.textContent?.trim() : "";
                
                title = committeeName || `Committee from ${url}`;
                content = committeeDesc || "";
                metadata = {
                  chair,
                  members
                };
                break;
              
              case "issue":
                const issueName = doc.querySelector("h1, .title, .name, header h2")?.textContent?.trim();
                const issueDesc = doc.querySelector(".description, .text, .content, article p")?.textContent?.trim();
                
                // Extract issue metadata
                const categoryEl = doc.querySelector(".category, .issue-category, [class*='category']");
                const category = categoryEl ? categoryEl.textContent?.trim() : "";
                
                const statusElement = doc.querySelector(".status, .issue-status, [class*='status']");
                const issueStatus = statusElement ? statusElement.textContent?.trim() : "";
                
                title = issueName || `Issue from ${url}`;
                content = issueDesc || "";
                metadata = {
                  category,
                  status: issueStatus
                };
                break;
              
              default:
                title = doc.querySelector("h1, .title, .name, header h2")?.textContent?.trim() || `Content from ${url}`;
                content = doc.querySelector("main, .content, article, .text, p")?.textContent?.trim() || "";
            }
            
            if (title) {
              const normalizedUrl = normalizeUrl(url, startUrl);
              
              const newItem = {
                title,
                content,
                url: normalizedUrl,
                type: validType,
                scraped_at: new Date().toISOString(),
                metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
                raw_html: saveRawHtml ? html : null
              };
              
              scrapedItems.push(newItem);
              scrapedItemsBatch.push(newItem);
              itemsScraped++;
              
              batchCount++;
              if (batchCount >= BATCH_SIZE) {
                await saveBatchToDb(scrapedItemsBatch);
                scrapedItemsBatch.length = 0;
                batchCount = 0;
              }
              
              await supabase
                .from("scrape_jobs")
                .update({ items_scraped: itemsScraped })
                .eq("id", jobId);
            }
            
            // Find more links to follow for the next depth
            if (depth < maxDepth - 1 && !isTimedOut) {
              const links = doc.querySelectorAll("a");
              let linkCount = 0;
              
              for (let i = 0; i < links.length && linkCount < exploreBreadth && !isTimedOut; i++) {
                const link = links[i];
                const href = link.getAttribute("href");
                
                if (!href) continue;
                
                const nextUrl = normalizeUrl(href, url);
                
                // Only follow links on the same site
                if (!nextUrl.includes("althingi.is")) continue;
                
                // Prioritize relevant links based on the type we're scraping
                let shouldInclude = true;
                
                if (validType === "bill" && !nextUrl.includes("thingmal") && !nextUrl.includes("lagasafn")) {
                  shouldInclude = false;
                } else if (validType === "vote" && !nextUrl.includes("atkvaeda")) {
                  shouldInclude = false;
                } else if (validType === "speech" && !nextUrl.includes("raed")) {
                  shouldInclude = false;
                } else if (validType === "mp" && !nextUrl.includes("thingm")) {
                  shouldInclude = false;
                } else if (validType === "committee" && !nextUrl.includes("nefnd")) {
                  shouldInclude = false;
                } 
                
                if (shouldInclude && !visitedUrls.has(nextUrl)) {
                  nextDepthUrls.push(nextUrl);
                  linkCount++;
                }
              }
            }
          } catch (error) {
            const errorMsg = `Error processing ${url}: ${error instanceof Error ? error.message : String(error)}`;
            console.error(errorMsg);
            failedUrls.push({url, error: errorMsg});
          }
        }
        
        // Limit the number of URLs for the next depth to avoid explosions
        currentDepthUrls = nextDepthUrls.slice(0, Math.min(30, nextDepthUrls.length));
      }
    }
    
    // Save any remaining items
    if (scrapedItemsBatch.length > 0) {
      await saveBatchToDb(scrapedItemsBatch, true);
    }
    
    clearTimeout(timeoutId);
    clearInterval(statusUpdateInterval);
    
    // Attempt direct HTML extraction if no items were found with DOM parser
    if (scrapedItems.length === 0 && successfulResponses.size > 0) {
      console.log("No items scraped with DOM parser. Trying direct HTML extraction...");
      
      for (const [url, data] of successfulResponses) {
        if (validType === "mp") {
          const mpData = extractMpDataFromHtml(data.html);
          if (mpData.length > 0) {
            for (const mp of mpData) {
              mp.scraped_at = new Date().toISOString();
              scrapedItems.push(mp);
            }
            
            await saveBatchToDb(mpData, true);
            itemsScraped += mpData.length;
          } else {
            const profileData = extractMpProfileDataFromHtml(data.html, url);
            if (profileData.title) {
              profileData.scraped_at = new Date().toISOString();
              scrapedItems.push(profileData);
              
              await saveBatchToDb([profileData], true);
              itemsScraped++;
            }
          }
        }
      }
      
      if (scrapedItems.length > 0) {
        await supabase
          .from("scrape_jobs")
          .update({ items_scraped: itemsScraped })
          .eq("id", jobId);
      }
    }
    
    console.log(`Scraped ${scrapedItems.length} items for ${scraperType}`);
    console.log(`Failed URLs: ${failedUrls.length}`);
    
    return {
      items: scrapedItems,
      failedUrls: failedUrls
    };
  } catch (error) {
    console.error("Scraping error:", error);
    
    if (scrapedItemsBatch.length > 0) {
      await saveBatchToDb(scrapedItemsBatch, true);
    }
    
    await supabase
      .from("scrape_jobs")
      .update({ 
        status: "failed", 
        completed_at: new Date().toISOString(),
        error_message: error instanceof Error ? error.message : String(error),
        items_scraped: itemsScraped
      })
      .eq("id", jobId);
    
    clearTimeout(timeoutId);
    
    throw error;
  }
}

async function isJobStillActive(jobId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("scrape_jobs")
      .select("status")
      .eq("id", jobId)
      .maybeSingle();
    
    if (error) {
      console.error("Error checking job status:", error);
      return false;
    }
    
    if (!data) {
      console.error("No job found with ID:", jobId);
      return false;
    }
    
    return data.status === "running" || data.status === "pending";
  } catch (error) {
    console.error("Error in isJobStillActive:", error);
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204, 
      headers: corsHeaders 
    });
  }

  try {
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
    
    try {
      const scrapeResult = await scrapeData(type, config || {}, jobId);
      
      const scrapedItems = scrapeResult.items || [];
      const failedUrls = scrapeResult.failedUrls || [];
      const wasStopped = scrapeResult.stopped;
      
      if (!wasStopped) {
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
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          items: scrapedItems.length,
          failedUrls: failedUrls.length,
          stopped: wasStopped
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
