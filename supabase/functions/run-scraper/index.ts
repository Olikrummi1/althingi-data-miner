
// Update imports to use proper syntax for edge functions
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

// Helper function to get the base URL based on scraper type
function getBaseUrl(scraperType: string): string {
  switch(scraperType) {
    case "bills": return "https://www.althingi.is/thingstorf/thingmalalistar-eftir-thingum/ferill/";
    case "votes": return "https://www.althingi.is/thingstorf/atkvaedagreidslur/";
    case "speeches": return "https://www.althingi.is/altext/raeda/";
    case "mps": return "https://www.althingi.is/thingmenn/althingismenn/";
    case "committees": return "https://www.althingi.is/thingnefndir/fastanefndir/";
    case "issues": return "https://www.althingi.is/thingstorf/thingmalalistar-eftir-thingum/";
    default: return `https://www.althingi.is/`;
  }
}

// Actual scraping function for Althingi
async function scrapeData(scraperType: string, config: any) {
  console.log(`Scraping data type: ${scraperType} with config:`, config);
  
  // Get the valid item type for database insertion
  const validType = getValidItemType(scraperType);
  
  // Define the base URL - use provided URL or default for the type
  const baseUrl = config.url || getBaseUrl(scraperType);
  const maxDepth = config.depth || 2;
  
  // Set up the user agent for fetching
  const userAgent = config.user_agent || 'AlthingiDataMiner/1.0';
  
  // Set up throttling
  const throttle = config.throttle || 1000;
  
  // Start with the base URL
  const urlsToVisit = [baseUrl];
  const visitedUrls = new Set<string>();
  const scrapedItems = [];
  
  // Process each URL up to the max depth
  for (let depth = 0; depth < maxDepth && urlsToVisit.length > 0; depth++) {
    console.log(`Processing depth ${depth + 1}/${maxDepth}, ${urlsToVisit.length} URLs in queue`);
    
    // Get URLs for current depth
    const currentUrls = [...urlsToVisit];
    urlsToVisit.length = 0;
    
    // Process each URL at current depth
    for (const url of currentUrls) {
      if (visitedUrls.has(url)) continue;
      visitedUrls.add(url);
      
      try {
        // Apply throttling
        if (throttle > 0) {
          await new Promise(resolve => setTimeout(resolve, throttle));
        }
        
        // Fetch the page
        const response = await fetch(url, {
          headers: { 'User-Agent': userAgent }
        });
        
        if (!response.ok) {
          console.error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
          continue;
        }
        
        const html = await response.text();
        
        // Parse the HTML
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        
        if (!doc) {
          console.error(`Failed to parse HTML from ${url}`);
          continue;
        }
        
        // Logic specific to each type of content
        let title = "";
        let content = "";
        
        // Extract data based on type
        switch (validType) {
          case "bill":
            // Extract bill information - using Althingi site structure
            const billTitle = doc.querySelector(".PL_FERILL h1, .motionTitle, .text-center h1")?.textContent?.trim();
            const billContent = doc.querySelector(".PL_FERILL, .motionContent, .toggle-box")?.textContent?.trim();
            title = billTitle || `Bill from ${url}`;
            content = billContent || "";
            break;
          
          case "vote":
            // Extract voting information - using Althingi site structure
            const voteTitle = doc.querySelector(".voting-title h1, h1.atmHeader")?.textContent?.trim();
            const voteResults = doc.querySelector(".voting-results, .yes-votes, .no-votes, table.atmTable")?.textContent?.trim();
            title = voteTitle || `Vote from ${url}`;
            content = voteResults || "";
            break;
          
          case "speech":
            // Extract speech information - using Althingi site structure
            const speechTitle = doc.querySelector(".raedur h1, h1.speechTitle")?.textContent?.trim();
            const speechText = doc.querySelector(".raedur-content, div.speech")?.textContent?.trim();
            title = speechTitle || `Speech from ${url}`;
            content = speechText || "";
            break;
          
          case "mp":
            // Extract MP information - using Althingi site structure
            const mpName = doc.querySelector(".thingmadur h1, .mp-name, h1.name")?.textContent?.trim();
            const mpBio = doc.querySelector(".thingmadur-info, .member-info, .biography")?.textContent?.trim();
            title = mpName || `MP from ${url}`;
            content = mpBio || "";
            break;
          
          case "committee":
            // Extract committee information - using Althingi site structure
            const committeeName = doc.querySelector(".nefnd h1, .committee-title, h1.title")?.textContent?.trim();
            const committeeDesc = doc.querySelector(".nefnd-content, .committee-members, .committee-info")?.textContent?.trim();
            title = committeeName || `Committee from ${url}`;
            content = committeeDesc || "";
            break;
          
          case "issue":
            // Extract issue information - using Althingi site structure
            const issueName = doc.querySelector(".thingmal h1, .issue-title, h1.title")?.textContent?.trim();
            const issueDesc = doc.querySelector(".thingmal-content, .issue-description, .content")?.textContent?.trim();
            title = issueName || `Issue from ${url}`;
            content = issueDesc || "";
            break;
          
          default:
            // Generic extraction
            title = doc.querySelector("h1")?.textContent?.trim() || `Content from ${url}`;
            content = doc.querySelector("main, .content, article")?.textContent?.trim() || "";
        }
        
        // Add the scraped item
        if (title) {
          scrapedItems.push({
            title,
            content,
            url,
            type: validType,
            scraped_at: new Date().toISOString(),
            raw_html: config.save_raw_html ? html : null
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
            let nextUrl = href;
            if (href.startsWith("/")) {
              // Convert relative URL to absolute
              const urlObj = new URL(url);
              nextUrl = `${urlObj.origin}${href}`;
            } else if (!href.startsWith("http")) {
              // Skip mailto: tel: and other non-http protocols
              continue;
            }
            
            // Skip URLs that don't contain althingi.is or don't match the current type
            if (!nextUrl.includes("althingi.is")) continue;
            
            // Add to queue if not visited yet
            if (!visitedUrls.has(nextUrl)) {
              urlsToVisit.push(nextUrl);
            }
          }
        }
        
      } catch (error) {
        console.error(`Error processing ${url}:`, error);
      }
    }
  }
  
  console.log(`Scraped ${scrapedItems.length} items for ${scraperType}`);
  return scrapedItems;
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
      const scrapedItems = await scrapeData(type, config);
      
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
              scraped_at: item.scraped_at
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
          items_scraped: scrapedItems.length 
        })
        .eq("id", jobId);
      
      return new Response(
        JSON.stringify({ success: true, items: scrapedItems.length }),
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
