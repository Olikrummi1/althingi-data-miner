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

const EDGE_FUNCTION_TIMEOUT_MS = 50000; // Extended to 50 seconds
const MAX_ITEMS_PER_TYPE = 500; // Increased max items
const BATCH_SIZE = 10;
const SAVE_INTERVAL_MS = 2000; // More frequent saving

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
    "https://www.althingi.is/altext/cv/is/",
    "https://www.althingi.is/thingmenn/",
  ];
}

function getAdditionalStartUrls(scraperType: string): string[] {
  switch(scraperType) {
    case "bills":
      return [
        "https://www.althingi.is/thingstorf/thingmalalistar-eftir-thingum/",
        "https://www.althingi.is/thingstorf/thingmalalistar-eftir-thingum/ferill-mala/",
      ];
    case "votes":
      return [
        "https://www.althingi.is/thingstorf/atkvaedagreidslur/",
        "https://www.althingi.is/thingstorf/atkvaedagreidslur/atkvaedagreidslur-a-151-loggjafarthingi/",
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

// Extract ALL text from a document without any filtering
function extractAllTextFromDocument(doc: any): string {
  if (!doc) return "";
  
  // Get the entire text content from the body
  const textContent = doc.body ? doc.body.textContent : doc.textContent;
  
  // Only do minimal cleaning - keep all content but remove excessive whitespace
  return textContent
    ? textContent.replace(/\s+/g, ' ').trim()
    : "";
}

// Extract ALL text from raw HTML without any filtering
function extractAllTextFromHtml(html: string): string {
  if (!html) return "";
  
  // Simple regex to strip HTML tags but keep ALL text content
  const textContent = html.replace(/<[^>]*>/g, ' ');
  
  // Only do minimal cleaning - keep all content but remove excessive whitespace
  return textContent.replace(/\s+/g, ' ').trim();
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

async function scrapeData(scraperType: string, config: any, jobId: string) {
  console.log(`Scraping data type: ${scraperType} with config:`, config);
  
  const validType = getValidItemType(scraperType);
  
  // Use config parameters with higher defaults
  const maxDepth = Math.min(config.depth || 3, 5); // Increased max depth
  const throttle = Math.max(config.throttle || 800, 300); // Slightly faster throttle
  const saveRawHtml = true; // Always save raw HTML
  const timeout = Math.min((config.timeout_seconds || 20) * 1000, 25000); // Extended timeout
  const exploreBreadth = Math.min(config.explore_breadth || 20, 30); // Increased link breadth
  const maxItems = Math.min(config.max_items || 200, MAX_ITEMS_PER_TYPE); // Increased max items
  
  const { data: runningJobs } = await supabase
    .from("scrape_jobs")
    .select("id")
    .in("status", ["running", "pending"])
    .neq("id", jobId);
  
  // Limit concurrent jobs to 3 instead of 2
  if (runningJobs && runningJobs.length > 3) {
    await supabase
      .from("scrape_jobs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: "The server is busy processing other requests. Please try again later or try with a smaller scrape depth."
      })
      .eq("id", jobId);
    
    return new Response(
      JSON.stringify({ 
        error: "Too many concurrent scrape jobs. Please try again later." 
      }),
      { 
        status: 429, 
        headers: { 
          "Content-Type": "application/json",
          ...corsHeaders
        } 
      }
    );
  }
  
  // Only apply depth limits to MPs
  if (scraperType === "mps" && maxDepth > 3) { // Increased limit for MPs
    await supabase
      .from("scrape_jobs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: "MP scraper is limited to depth 3 to avoid resource constraints."
      })
      .eq("id", jobId);
    
    return new Response(
      JSON.stringify({ 
        error: "MP scraper is limited to depth 3. Please reduce the scrape depth." 
      }),
      { 
        status: 400, 
        headers: { 
          "Content-Type": "application/json",
          ...corsHeaders
        } 
      }
    );
  }

  let itemsScraped = 0;
  let urlsToVisit: string[] = [];
  
  // Get more starting URLs for MPs
  if (scraperType === "mps") {
    urlsToVisit = getMpUrls();
  } else {
    const baseUrl = config.url || getBaseUrl(scraperType);
    urlsToVisit = [baseUrl, ...getAdditionalStartUrls(scraperType)];
  }
  
  // Ensure URLs are unique
  urlsToVisit = [...new Set(urlsToVisit)];
  
  const visitedUrls = new Set<string>();
  const scrapedItems: any[] = [];
  const failedUrls: {url: string, error: string}[] = [];
  
  const successfulResponses = new Map<string, {html: string, url: string}>();
  
  // Update job status to running and record start time
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
  
  // Improved batch saving with error handling and retries
  async function saveBatchToDb(items: any[], forceUpdate = false): Promise<boolean> {
    if (!items || items.length === 0) return true;
    
    const currentTime = Date.now();
    pendingItems.push(...items);
    
    if (pendingItems.length >= BATCH_SIZE || 
        currentTime - lastSaveTime > SAVE_INTERVAL_MS || 
        forceUpdate) {
      
      try {
        console.log(`Saving batch of ${pendingItems.length} items to database...`);
        
        // Handle null bytes and extremely large content
        const sanitizedItems = pendingItems.map(item => {
          const sanitizedContent = item.content ? item.content.replace(/\u0000/g, '') : item.content;
          const sanitizedHtml = item.raw_html ? item.raw_html.replace(/\u0000/g, '') : item.raw_html;
          
          return {
            ...item,
            // Truncate extremely large content if needed
            content: sanitizedContent?.length > 1000000 ? sanitizedContent.substring(0, 1000000) : sanitizedContent,
            raw_html: sanitizedHtml
          };
        });
        
        // Try inserting the batch, with retries
        let success = false;
        let attempts = 0;
        const maxAttempts = 3;
        
        while (!success && attempts < maxAttempts) {
          attempts++;
          
          try {
            const { error } = await supabase
              .from("scraped_items")
              .insert(sanitizedItems);
            
            if (error) {
              console.error(`Batch save attempt ${attempts} failed:`, error);
              
              if (attempts < maxAttempts) {
                // Wait longer between retries
                await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
                continue;
              }
              
              return false;
            }
            
            success = true;
          } catch (err) {
            console.error(`Exception in batch save attempt ${attempts}:`, err);
            
            if (attempts < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
              continue;
            }
            
            return false;
          }
        }
        
        if (success) {
          console.log(`Successfully saved ${pendingItems.length} items to database`);
          lastSaveTime = currentTime;
          pendingItems = []; // Clear pending items after successful save
          return true;
        } else {
          console.error(`Failed to save batch after ${maxAttempts} attempts`);
          return false;
        }
      } catch (error) {
        console.error("Unexpected exception saving batch to database:", error);
        return false;
      }
    }
    
    return true; // No save attempted yet
  }
  
  let isTimedOut = false;
  
  // Set timeout for function
  const timeoutId = setTimeout(async () => {
    console.log("Approaching function timeout, saving remaining data and completing job...");
    isTimedOut = true;
    
    if (pendingItems.length > 0) {
      await saveBatchToDb([], true); // Force save any pending items
    }
    
    // Use "completed" status if any items were scraped, even on timeout
    await supabase
      .from("scrape_jobs")
      .update({ 
        status: itemsScraped > 0 ? "completed" : "failed", 
        completed_at: new Date().toISOString(),
        items_scraped: itemsScraped,
        error_message: itemsScraped > 0 ? 
          "Function timed out but some data was saved successfully" : 
          "Function timed out before scraping any data"
      })
      .eq("id", jobId);
      
    console.log("Saved all pending data before timeout");
  }, EDGE_FUNCTION_TIMEOUT_MS);
  
  let batchCount = 0;
  const scrapedItemsBatch: any[] = [];
  
  try {
    // More frequent status updates
    const statusUpdateInterval = setInterval(async () => {
      if (itemsScraped > 0) {
        await supabase
          .from("scrape_jobs")
          .update({ items_scraped: itemsScraped })
          .eq("id", jobId);
        console.log(`Updated job status: ${itemsScraped} items scraped`);
      }
    }, 1500); // Every 1.5 seconds
    
    // Process each starting URL
    for (const startUrl of urlsToVisit) {
      if (visitedUrls.has(startUrl) || isTimedOut) continue;
      
      let currentDepthUrls = [startUrl];
      console.log(`Starting with URL: ${startUrl}`);
      
      // Process each depth level
      for (let depth = 0; depth < maxDepth && currentDepthUrls.length > 0 && !isTimedOut; depth++) {
        console.log(`Processing depth ${depth + 1}/${maxDepth}, ${currentDepthUrls.length} URLs in queue`);
        
        const nextDepthUrls: string[] = [];
        
        // Process more URLs per depth (increased from 20)
        const urlsToProcess = currentDepthUrls.slice(0, Math.min(50, currentDepthUrls.length));
        
        // Process each URL at current depth
        for (const url of urlsToProcess) {
          if (isTimedOut) break;
          
          // Force save more frequently
          if (Date.now() - lastSaveTime > SAVE_INTERVAL_MS) {
            await saveBatchToDb([], true); // Force save
          }
          
          // Check if job is still active
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
          
          // Check if we've reached the maximum items limit
          if (itemsScraped >= maxItems) {
            console.log(`Reached maximum items limit (${maxItems}), stopping scrape`);
            break;
          }
          
          try {
            // Throttle requests
            if (throttle > 0) {
              await new Promise(resolve => setTimeout(resolve, throttle));
            }
            
            console.log(`Fetching ${url}...`);
            
            // Set up request headers
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
            
            // Fetch the URL with retry logic
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
            
            // Get the HTML content
            const html = await response.text();
            
            // Store successful response for fallback extraction
            successfulResponses.set(url, {html, url});
            
            // Parse the HTML
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");
            
            if (!doc) {
              console.error(`Failed to parse HTML from ${url}`);
              failedUrls.push({url, error: "Failed to parse HTML"});
              continue;
            }
            
            // Extract ALL text content, with no filtering
            const allTextContent = extractAllTextFromDocument(doc);
            
            // Get title or use URL if none found
            const title = doc.querySelector("h1, .title, .name, header h2, title")?.textContent?.trim() || 
                          `Content from ${url}`;
            
            const normalizedUrl = normalizeUrl(url, startUrl);
            
            // Store minimal metadata
            const metadata: Record<string, any> = {
              pageType: validType,
              sourceUrl: url,
              scrapedDate: new Date().toISOString(),
              textLength: allTextContent.length
            };
            
            // Sanitize content to prevent storage issues
            const sanitizedContent = allTextContent.replace(/\u0000/g, '');
            const sanitizedHtml = html.replace(/\u0000/g, '');
            
            // Create the item with ALL content
            const newItem = {
              title,
              content: sanitizedContent,
              url: normalizedUrl,
              type: validType,
              scraped_at: new Date().toISOString(),
              metadata,
              raw_html: sanitizedHtml
            };
            
            scrapedItems.push(newItem);
            scrapedItemsBatch.push(newItem);
            itemsScraped++;
            
            // Prepare to save batch if enough items
            batchCount++;
            if (batchCount >= BATCH_SIZE) {
              await saveBatchToDb(scrapedItemsBatch);
              scrapedItemsBatch.length = 0;
              batchCount = 0;
            }
            
            // Update job status
            await supabase
              .from("scrape_jobs")
              .update({ items_scraped: itemsScraped })
              .eq("id", jobId);
            
            // Find more links to follow if we're not at max depth
            if (depth < maxDepth - 1 && !isTimedOut) {
              const links = doc.querySelectorAll("a");
              let linkCount = 0;
              
              // Get more links (increased from exploreBreadth)
              for (let i = 0; i < links.length && linkCount < exploreBreadth && !isTimedOut; i++) {
                const link = links[i];
                const href = link.getAttribute("href");
                
                if (!href) continue;
                
                const nextUrl = normalizeUrl(href, url);
                
                // Only follow links on althingi.is
                if (!nextUrl.includes("althingi.is")) continue;
                
                if (!visitedUrls.has(nextUrl)) {
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
        
        // Prepare next depth URLs (increased from 30)
        currentDepthUrls = nextDepthUrls.slice(0, Math.min(100, nextDepthUrls.length));
      }
    }
    
    // Save any remaining items
    if (scrapedItemsBatch.length > 0) {
      await saveBatchToDb(scrapedItemsBatch, true);
    }
    
    // Clean up
    clearTimeout(timeoutId);
    clearInterval(statusUpdateInterval);
    
    // Fallback extraction if no items were found via DOM parser
    if (scrapedItems.length === 0 && successfulResponses.size > 0) {
      console.log("No items scraped with DOM parser. Trying direct HTML extraction...");
      
      for (const [url, data] of successfulResponses) {
        const textContent = extractAllTextFromHtml(data.html);
        
        if (textContent) {
          const sanitizedContent = textContent.replace(/\u0000/g, '');
          const sanitizedHtml = data.html.replace(/\u0000/g, '');
          
          const newItem = {
            title: `Content from ${url}`,
            content: sanitizedContent,
            url: url,
            type: validType,
            scraped_at: new Date().toISOString(),
            metadata: {
              extractionMethod: "direct",
              textLength: sanitizedContent.length
            },
            raw_html: sanitizedHtml
          };
          
          scrapedItems.push(newItem);
          
          await saveBatchToDb([newItem], true);
          itemsScraped++;
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
    
    // Complete the job
    const finalStatus = scrapedItems.length > 0 ? "completed" : failedUrls.length > 0 ? "completed" : "failed";
    const errorMessage = scrapedItems.length === 0 && failedUrls.length > 0 ? 
      `Failed to scrape any items, ${failedUrls.length} URLs failed` : null;
    
    await supabase
      .from("scrape_jobs")
      .update({ 
        status: finalStatus, 
        completed_at: new Date().toISOString(),
        items_scraped: itemsScraped,
        error_message: errorMessage
      })
      .eq("id", jobId);
    
    return {
      items: scrapedItems,
      failedUrls: failedUrls,
      status: finalStatus
    };
  } catch (error) {
    console.error("Scraping error:", error);
    
    // Try to save any captured items even on error
    if (scrapedItemsBatch.length > 0) {
      await saveBatchToDb(scrapedItemsBatch, true);
    }
    
    // Mark job as completed if we got some items, otherwise failed
    await supabase
      .from("scrape_jobs")
      .update({ 
        status: itemsScraped > 0 ? "completed" : "failed",
        completed_at: new Date().toISOString(),
        error_message: error instanceof Error ? error.message : String(error),
        items_scraped: itemsScraped
      })
      .eq("id", jobId);
    
    clearTimeout(timeoutId);
    
    throw error;
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
    
    // Allow more concurrent jobs
    const { data: activeJobs } = await supabase
      .from("scrape_jobs")
      .select("id")
      .in("status", ["running", "pending"])
      .neq("id", jobId);
    
    if (activeJobs && activeJobs.length >= 3) {
      await supabase
        .from("scrape_jobs")
        .update({ 
          status: "failed", 
          completed_at: new Date().toISOString(),
          error_message: "The server is busy processing other requests. Please try again later or try with a smaller scrape depth."
        })
        .eq("id", jobId);
      
      return new Response(
        JSON.stringify({ 
          error: "The server is busy processing other requests. Please try again later or try with a smaller scrape depth." 
        }),
        { 
          status: 429, 
          headers: { 
            "Content-Type": "application/json",
            ...corsHeaders
          } 
        }
      );
    }
    
    // Special handling for MPs
    if (type === "mps") {
      const safeConfig = { ...config };
      
      // Increased limits for MP scraper
      if (safeConfig.depth > 3) {
        safeConfig.depth = 3;
        console.log("Limiting MPs scraper depth to 3");
      }
      
      if (!safeConfig.max_items || safeConfig.max_items > 200) { // Increased from 100
        safeConfig.max_items = 200;
        console.log("Limiting MPs scraper to 200 items maximum");
      }
      
      safeConfig.throttle = Math.max(safeConfig.throttle || 800, 500);
      
      try {
        const scrapeResult = await scrapeData(type, safeConfig, jobId);
        
        if (scrapeResult) {
          const scrapedItems = scrapeResult.items || [];
          const failedUrls = scrapeResult.failedUrls || [];
          
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
        } else {
          return new Response(
            JSON.stringify({ error: "Scrape operation failed" }),
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
    } else {
      console.log(`Starting scrape job ${jobId} for type ${type}`);
      
      try {
        const scrapeResult = await scrapeData(type, config || {}, jobId);
        
        const scrapedItems = scrapeResult.items || [];
        const failedUrls = scrapeResult.failedUrls || [];
        
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
