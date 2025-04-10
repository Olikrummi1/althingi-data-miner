
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.24.0";

// Define CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Function to simulate scraping (in a real app, you would implement actual scraping logic)
async function simulateScraping(
  type: string, 
  client: any, 
  jobId: string, 
  config: any
): Promise<{ success: boolean; itemsScraped: number; error?: string }> {
  try {
    // Update job status to running
    await client
      .from("scrape_jobs")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("id", jobId);

    // In a real implementation, you would:
    // 1. Fetch pages from althingi.is
    // 2. Parse the content
    // 3. Store the results in the database
    
    // For this demo, we'll simulate scraping by adding random items
    const itemsToScrape = Math.floor(Math.random() * 10) + 5; // 5-15 items
    const delay = config.throttle || 1000;
    
    // Different mock titles based on type
    const mockTitles: Record<string, string[]> = {
      bills: [
        "Frumvarp til laga um breytingu á lögum um tekjuskatt",
        "Frumvarp til laga um umhverfisvernd",
        "Frumvarp til laga um lífeyrissjóði",
        "Frumvarp til laga um menntamál",
        "Frumvarp til laga um heilbrigðisþjónustu"
      ],
      votes: [
        "Atkvæðagreiðsla um frumvarp til laga um tekjuskatt",
        "Atkvæðagreiðsla um fjárlög",
        "Atkvæðagreiðsla um tillögu til þingsályktunar um samgöngumál",
        "Atkvæðagreiðsla um frumvarp til laga um heilbrigðisþjónustu",
        "Atkvæðagreiðsla um frumvarp til laga um umhverfisvernd"
      ],
      speeches: [
        "Ræða um efnahagsmál",
        "Andsvör við ræðu um menntamál",
        "Ræða um heilbrigðisþjónustu",
        "Ræða um umhverfismál",
        "Ræða forsætisráðherra um stöðu ríkisfjármála"
      ],
      mps: [
        "Upplýsingar um þingmann: Jón Jónsson",
        "Upplýsingar um þingmann: Anna Sveinsdóttir",
        "Upplýsingar um þingmann: Sigurður Guðmundsson",
        "Upplýsingar um þingmann: Guðrún Pétursdóttir",
        "Upplýsingar um þingmann: Ólafur Ragnarsson"
      ],
      committees: [
        "Fjárlaganefnd - upplýsingar og fundargerðir",
        "Umhverfis- og samgöngunefnd - upplýsingar og fundargerðir",
        "Velferðarnefnd - upplýsingar og fundargerðir",
        "Stjórnskipunar- og eftirlitsnefnd - upplýsingar og fundargerðir",
        "Allsherjar- og menntamálanefnd - upplýsingar og fundargerðir"
      ],
      issues: [
        "Málefni: Húsnæðismál - umræður og tillögur",
        "Málefni: Heilbrigðisþjónusta - umræður og tillögur",
        "Málefni: Menntamál - umræður og tillögur",
        "Málefni: Umhverfisvernd - umræður og tillögur",
        "Málefni: Skattamál - umræður og tillögur"
      ]
    };
    
    // Convert plural type to singular for the scraped_items table
    const singularType = type.endsWith('s') 
      ? type.substring(0, type.length - 1) 
      : type;
      
    for (let i = 0; i < itemsToScrape; i++) {
      // Get a random title from the mock titles for this type
      const titleIndex = Math.floor(Math.random() * mockTitles[type].length);
      const title = mockTitles[type][titleIndex];
      
      // Insert a mock scraped item
      await client.from("scraped_items").insert({
        type: singularType,
        title: `${title} ${Math.floor(Math.random() * 1000)}`,
        url: `https://althingi.is/example/${type}/${Math.floor(Math.random() * 10000)}`,
        content: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam eget felis eget urna ultricies dapibus.",
        metadata: { source: "simulation", scraper_version: "1.0.0" }
      });
      
      // Update the job's items_scraped count
      await client
        .from("scrape_jobs")
        .update({ items_scraped: i + 1 })
        .eq("id", jobId);
        
      // Simulate throttling
      await new Promise(resolve => setTimeout(resolve, delay / 10)); // Reduced for demo
    }
    
    // Update job status to completed
    await client
      .from("scrape_jobs")
      .update({ 
        status: "completed", 
        completed_at: new Date().toISOString(),
        items_scraped: itemsToScrape
      })
      .eq("id", jobId);
      
    return { success: true, itemsScraped: itemsToScrape };
  } catch (error) {
    console.error("Error in simulateScraping:", error);
    
    // Update job status to failed
    await client
      .from("scrape_jobs")
      .update({ 
        status: "failed", 
        completed_at: new Date().toISOString(),
        error_message: error.message || "Unknown error occurred"
      })
      .eq("id", jobId);
      
    return { 
      success: false, 
      itemsScraped: 0, 
      error: error.message || "Unknown error occurred" 
    };
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    // Get request details
    const { type, jobId, config } = await req.json();
    
    if (!type || !jobId) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }
    
    // Create a Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Run the scraping operation
    const result = await simulateScraping(type, supabase, jobId, config || {});
    
    return new Response(
      JSON.stringify(result),
      { 
        status: result.success ? 200 : 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  } catch (error) {
    console.error("Error in edge function:", error);
    
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
