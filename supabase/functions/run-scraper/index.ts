
// Update imports to use proper syntax for edge functions
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.24.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Mock implementation of a scraper
async function scrapeData(type: string, config: any) {
  console.log(`Scraping data type: ${type} with config:`, config);
  
  // In a real implementation, you would call your scraping code here
  // For this example, we'll simulate scraping by waiting and returning mock data
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Mock data for different types
  const mockData = [
    { title: `${type} item 1`, url: `https://althingi.is/${type}/1`, type },
    { title: `${type} item 2`, url: `https://althingi.is/${type}/2`, type },
    { title: `${type} item 3`, url: `https://althingi.is/${type}/3`, type }
  ];
  
  return mockData;
}

serve(async (req) => {
  try {
    const { type, jobId, config } = await req.json();
    
    if (!type || !jobId) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
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
              scraped_at: new Date().toISOString()
            }))
          );
        
        if (error) {
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
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } catch (error) {
      console.error("Scraping error:", error);
      
      // Update job status to failed
      await supabase
        .from("scrape_jobs")
        .update({ 
          status: "failed", 
          completed_at: new Date().toISOString(),
          error_message: error.message 
        })
        .eq("id", jobId);
      
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("Server error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
