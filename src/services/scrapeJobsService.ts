
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Database } from "@/integrations/supabase/types";

export type ScrapeJob = Database["public"]["Tables"]["scrape_jobs"]["Row"];

export async function createScrapeJob(type: ScrapeJob["type"], config: any = {}): Promise<ScrapeJob | null> {
  try {
    const { data, error } = await supabase
      .from("scrape_jobs")
      .insert([
        { 
          type, 
          status: "pending", 
          config 
        }
      ])
      .select()
      .single();

    if (error) {
      console.error("Error creating scrape job:", error);
      toast.error(`Failed to start ${type} scraper`);
      return null;
    }

    return data as ScrapeJob;
  } catch (error) {
    console.error("Error in createScrapeJob:", error);
    toast.error(`Failed to start ${type} scraper`);
    return null;
  }
}

export async function updateScrapeJobStatus(
  id: string, 
  status: ScrapeJob["status"], 
  itemsScraped?: number, 
  errorMessage?: string
): Promise<boolean> {
  try {
    const updates: any = { status };
    
    if (status === "running") {
      updates.started_at = new Date().toISOString();
    } else if (status === "completed" || status === "failed" || status === "stopped") {
      updates.completed_at = new Date().toISOString();
    }
    
    if (itemsScraped !== undefined) {
      updates.items_scraped = itemsScraped;
    }
    
    if (errorMessage) {
      updates.error_message = errorMessage;
    }

    const { error } = await supabase
      .from("scrape_jobs")
      .update(updates)
      .eq("id", id);

    if (error) {
      console.error("Error updating scrape job:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error in updateScrapeJobStatus:", error);
    return false;
  }
}

export async function stopScrapeJob(id: string): Promise<boolean> {
  try {
    // First check if the job exists and is running
    const { data: job, error: fetchError } = await supabase
      .from("scrape_jobs")
      .select("*")
      .eq("id", id)
      .single();
    
    if (fetchError || !job) {
      console.error("Error fetching job to stop:", fetchError);
      return false;
    }
    
    // Only update jobs that are in running or pending status
    if (job.status !== "running" && job.status !== "pending") {
      console.log("Job is not running or pending, cannot stop", job.status);
      return false;
    }
    
    const { error } = await supabase
      .from("scrape_jobs")
      .update({
        status: "failed", // Using "failed" status instead of "stopped" to avoid constraint issues
        completed_at: new Date().toISOString(),
        error_message: "Manually stopped by user"
      })
      .eq("id", id);

    if (error) {
      console.error("Error stopping job:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error in stopScrapeJob:", error);
    return false;
  }
}

export async function getActiveJobs(): Promise<ScrapeJob[]> {
  try {
    const { data, error } = await supabase
      .from("scrape_jobs")
      .select("*")
      .in("status", ["running", "pending"])
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching active jobs:", error);
      return [];
    }

    return data as ScrapeJob[];
  } catch (error) {
    console.error("Error in getActiveJobs:", error);
    return [];
  }
}

export async function getLatestScrapeJob(): Promise<ScrapeJob | null> {
  try {
    const { data, error } = await supabase
      .from("scrape_jobs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Error fetching latest scrape job:", error);
      return null;
    }

    return data as ScrapeJob;
  } catch (error) {
    console.error("Error in getLatestScrapeJob:", error);
    return null;
  }
}

export async function getScrapingSpeed(): Promise<number | null> {
  try {
    const { data, error } = await supabase
      .from("scrape_jobs")
      .select("started_at, completed_at, items_scraped")
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(5);

    if (error || !data.length) {
      console.error("Error fetching scrape jobs for speed calculation:", error);
      return null;
    }

    // Calculate average scraping speed from completed jobs
    let totalSpeed = 0;
    let validJobs = 0;

    for (const job of data) {
      if (job.started_at && job.completed_at && job.items_scraped) {
        const startTime = new Date(job.started_at).getTime();
        const endTime = new Date(job.completed_at).getTime();
        const durationSeconds = (endTime - startTime) / 1000;
        
        if (durationSeconds > 0) {
          const speed = job.items_scraped / durationSeconds;
          totalSpeed += speed;
          validJobs++;
        }
      }
    }

    if (validJobs === 0) return null;
    return parseFloat((totalSpeed / validJobs).toFixed(1));
  } catch (error) {
    console.error("Error in getScrapingSpeed:", error);
    return null;
  }
}
