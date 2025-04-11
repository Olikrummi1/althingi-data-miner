
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

const EDGE_FUNCTION_TIMEOUT_MS = 20000; // 20 seconds (reduced from 25s)
const MAX_ITEMS_PER_TYPE = 200; // Reduced from 500
const BATCH_SIZE = 10; // Reduced batch size to save more frequently
const SAVE_INTERVAL_MS = 3000; // Save more frequently

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

// Function to extract all text from a document
function extractAllTextFromDocument(doc: any): string {
  if (!doc) return "";
  
  // Get all text nodes from the document body
  const textContent = doc.body ? doc.body.textContent : doc.textContent;
  
  // Clean up the text (remove excess whitespace)
  return textContent
    ? textContent.replace(/\s+/g, ' ').trim()
    : "";
}

// Function to extract all text from HTML string
function extractAllTextFromHtml(html: string): string {
  if (!html) return "";
  
  // Simple regex to strip HTML tags
  const textContent = html.replace(/<[^>]*>/g, ' ');
  
  // Clean up the text (remove excess whitespace)
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
  
  const maxDepth = Math.min(config.depth || 2, 3); // Reduced max depth
  const throttle = Math.max(config.throttle || 1000, 300); // Increased minimum throttle
  const saveRawHtml = true; // Always save raw HTML
  const timeout = Math.min((config.timeout_seconds || 15) * 1000, 15000); // Reduced maximum timeout
  const exploreBreadth = Math.min(config.explore_breadth || 10, 10); // Reduced breadth to explore
  const maxItems = Math.min(config.max_items || 100, MAX_ITEMS_PER_TYPE); // Lower default and cap
  
  const { data: runningJobs } = await supabase
    .from("scrape_jobs")
    .select("id")
    .in("status", ["running", "pending"])
    .neq("id", jobId);
  
  if (runningJobs && runningJobs.length > 2) {
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
  
  if (scraperType === "mps" && maxDepth > 2) {
    await supabase
      .from("scrape_jobs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: "MP scraper is limited to depth 2 to avoid resource constraints."
      })
      .eq("id", jobId);
    
    return new Response(
      JSON.stringify({ 
        error: "MP scraper is limited to depth 2. Please reduce the scrape depth." 
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
  
  if (scraperType === "mps") {
    urlsToVisit = getMpUrls().slice(0, 2); // Limit initial MP URLs
  } else {
    const baseUrl = config.url || getBaseUrl(scraperType);
    urlsToVisit = [baseUrl, ...getAdditionalStartUrls(scraperType).slice(0, 2)];
  }
  
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
      
      for (let depth = 0; depth < maxDepth && currentDepthUrls.length > 0 && !isTimedOut; depth++) {
        console.log(`Processing depth ${depth + 1}/${maxDepth}, ${currentDepthUrls.length} URLs in queue`);
        
        const nextDepthUrls: string[] = [];
        
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
            
            // Extract all text content from the document
            const allTextContent = extractAllTextFromDocument(doc);
            
            // Create the title - use h1 if available, otherwise use the URL
            const title = doc.querySelector("h1, .title, .name, header h2")?.textContent?.trim() || `Content from ${url}`;
            
            // Create the normalized URL
            const normalizedUrl = normalizeUrl(url, startUrl);
            
            // Create the metadata with page type and URL info
            const metadata: Record<string, any> = {
              pageType: validType,
              sourceUrl: url,
              scrapedDate: new Date().toISOString(),
              textLength: allTextContent.length
            };
            
            // Create a new item with all the text content
            const newItem = {
              title,
              content: allTextContent,
              url: normalizedUrl,
              type: validType,
              scraped_at: new Date().toISOString(),
              metadata,
              raw_html: html // Always save raw HTML
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
            
            if (depth < maxDepth - 1 && !isTimedOut) {
              const links = doc.querySelectorAll("a");
              let linkCount = 0;
              
              for (let i = 0; i < links.length && linkCount < exploreBreadth && !isTimedOut; i++) {
                const link = links[i];
                const href = link.getAttribute("href");
                
                if (!href) continue;
                
                const nextUrl = normalizeUrl(href, url);
                
                // Accept any URL from althingi.is domain without filtering by content type
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
        
        currentDepthUrls = nextDepthUrls.slice(0, Math.min(30, nextDepthUrls.length));
      }
    }
    
    if (scrapedItemsBatch.length > 0) {
      await saveBatchToDb(scrapedItemsBatch, true);
    }
    
    clearTimeout(timeoutId);
    clearInterval(statusUpdateInterval);
    
    // If no items were found with the DOM parser, try direct HTML extraction
    if (scrapedItems.length === 0 && successfulResponses.size > 0) {
      console.log("No items scraped with DOM parser. Trying direct HTML extraction...");
      
      for (const [url, data] of successfulResponses) {
        const textContent = extractAllTextFromHtml(data.html);
        
        if (textContent) {
          const newItem = {
            title: `Content from ${url}`,
            content: textContent,
            url: url,
            type: validType,
            scraped_at: new Date().toISOString(),
            metadata: {
              extractionMethod: "direct",
              textLength: textContent.length
            },
            raw_html: data.html
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
    
    await supabase
      .from("scrape_jobs")
      .update({ 
        status: "completed", 
        completed_at: new Date().toISOString(),
        items_scraped: itemsScraped,
      })
      .eq("id", jobId);
    
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
    
    const { data: activeJobs } = await supabase
      .from("scrape_jobs")
      .select("id")
      .in("status", ["running", "pending"])
      .neq("id", jobId);
    
    if (activeJobs && activeJobs.length >= 2) {
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
    
    if (type === "mps") {
      const safeConfig = { ...config };
      
      if (safeConfig.depth > 2) {
        safeConfig.depth = 2;
        console.log("Limiting MPs scraper depth to 2");
      }
      
      if (!safeConfig.max_items || safeConfig.max_items > 100) {
        safeConfig.max_items = 100;
        console.log("Limiting MPs scraper to 100 items maximum");
      }
      
      safeConfig.throttle = Math.max(safeConfig.throttle || 1000, 500);
      
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
