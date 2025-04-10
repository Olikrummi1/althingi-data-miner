
// Supabase Edge Function for running scrapers
// Note: Import from URL is required for edge functions
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { type, config } = await req.json();

    // Create a new scrape job
    const { data: job, error: jobError } = await supabase
      .from('scrape_jobs')
      .insert({
        type,
        status: 'pending',
        config,
      })
      .select()
      .single();

    if (jobError) {
      console.error('Error creating scrape job:', jobError);
      return new Response(
        JSON.stringify({ error: 'Failed to create scrape job' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      );
    }

    // Simulate starting the scraper in the background
    EdgeRuntime.waitUntil((async () => {
      try {
        // Update job to running
        await supabase
          .from('scrape_jobs')
          .update({ 
            status: 'running',
            started_at: new Date().toISOString()
          })
          .eq('id', job.id);

        // Fetch settings
        const { data: settings } = await supabase
          .from('scrape_settings')
          .select('*')
          .eq('id', 1)
          .single();

        // Simulate scraping (would be replaced with actual scraper logic)
        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
        await delay(5000); // Simulate 5 seconds of work

        // Create some mock scraped items
        const mockItems = Array.from({ length: 5 }).map((_, i) => ({
          type: type.slice(0, -1), // Remove 's' from end (bills -> bill)
          title: `Mock ${type.slice(0, -1)} ${i + 1}`,
          url: `https://althingi.is/mock/${type}/${i + 1}`,
          content: `This is mock content for ${type} ${i + 1}`,
          metadata: { mockId: i + 1, source: 'edge-function-simulator' }
        }));

        // Insert mock items
        await supabase.from('scraped_items').insert(mockItems);

        // Update job to completed
        await supabase
          .from('scrape_jobs')
          .update({ 
            status: 'completed',
            completed_at: new Date().toISOString(),
            items_scraped: mockItems.length
          })
          .eq('id', job.id);

        console.log(`Simulated scraping job ${job.id} completed`);
      } catch (error) {
        console.error('Error in background scraper task:', error);
        
        // Update job to failed
        await supabase
          .from('scrape_jobs')
          .update({ 
            status: 'failed',
            completed_at: new Date().toISOString(),
            error_message: error instanceof Error ? error.message : 'Unknown error'
          })
          .eq('id', job.id);
      }
    })());

    return new Response(
      JSON.stringify({ message: 'Scraper started', jobId: job.id }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Error in run-scraper function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
