import { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createScrapeJob } from "@/services/scrapeJobsService";
import { getScrapeSettings } from "@/services/scrapeSettingsService";

export type ActiveJob = {
  id: string;
  status: string;
  created_at: string;
  started_at?: string;
  items_scraped?: number;
  type: string;
};

export type ScraperConfig = {
  id: string;
  titleKey: string;
  descriptionKey: string;
};

export const scraperConfigs: ScraperConfig[] = [
  {
    id: "bills",
    titleKey: "bills",
    descriptionKey: "billsDescription"
  },
  {
    id: "votes",
    titleKey: "votes",
    descriptionKey: "votesDescription"
  },
  {
    id: "speeches",
    titleKey: "speeches",
    descriptionKey: "speechesDescription"
  },
  {
    id: "mps",
    titleKey: "mps",
    descriptionKey: "mpsDescription"
  },
  {
    id: "committees",
    titleKey: "committees",
    descriptionKey: "committeesDescription"
  },
  {
    id: "issues",
    titleKey: "issues",
    descriptionKey: "issuesDescription"
  }
];

export default function useScraper() {
  const [enabledScrapers, setEnabledScrapers] = useState<Record<string, boolean>>({
    bills: true,
    votes: true,
    speeches: false,
    mps: true,
    committees: false,
    issues: false
  });
  
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const [isSettingsLoading, setIsSettingsLoading] = useState(true);
  const [activeJobs, setActiveJobs] = useState<Record<string, ActiveJob>>({});
  const [isLoadingJobs, setIsLoadingJobs] = useState(true);
  const [totalItemsScraped, setTotalItemsScraped] = useState(0);

  // Load scrape settings
  useEffect(() => {
    const loadSettings = async () => {
      setIsSettingsLoading(true);
      try {
        const settings = await getScrapeSettings();
        if (settings) {
          setSettings(settings);
        }
      } catch (error) {
        console.error("Error loading settings:", error);
        toast.error("Failed to load scraper settings");
      } finally {
        setIsSettingsLoading(false);
      }
    };
    
    loadSettings();
  }, []);

  // Load active jobs
  useEffect(() => {
    const loadActiveJobs = async () => {
      setIsLoadingJobs(true);
      try {
        // Get any jobs that are running or pending
        const { data, error } = await supabase
          .from("scrape_jobs")
          .select("*")
          .in("status", ["running", "pending"])
          .order("created_at", { ascending: false });
        
        if (error) {
          throw error;
        }
        
        // Group jobs by type
        const jobsByType: Record<string, ActiveJob> = {};
        let totalItems = 0;
        
        if (data && data.length > 0) {
          data.forEach(job => {
            // Only keep the most recent job for each type
            if (!jobsByType[job.type] || new Date(job.created_at) > new Date(jobsByType[job.type].created_at)) {
              jobsByType[job.type] = job as ActiveJob;
            }
            
            if (job.items_scraped) {
              totalItems += job.items_scraped;
            }
          });
        }
        
        setActiveJobs(jobsByType);
        setTotalItemsScraped(totalItems);
      } catch (error) {
        console.error("Error loading active jobs:", error);
        toast.error("Failed to load active scraper jobs");
      } finally {
        setIsLoadingJobs(false);
      }
    };
    
    loadActiveJobs();
    
    // Set up polling to check for active jobs
    const intervalId = setInterval(loadActiveJobs, 5000);
    
    return () => clearInterval(intervalId);
  }, []);

  const toggleScraper = (id: string, enabled: boolean) => {
    setEnabledScrapers(prev => ({
      ...prev,
      [id]: enabled
    }));
  };

  const handleScrape = async (id: string, config: { url: string; depth: number }) => {
    if (!settings) {
      toast.error("Scrape settings not loaded");
      return;
    }
    
    try {
      // Create a scrape job in the database with the provided config
      const job = await createScrapeJob(id as any, {
        url: config.url,
        depth: config.depth,
        ...settings
      });
      
      if (!job) {
        throw new Error("Failed to create scrape job");
      }
      
      // Call the edge function to start scraping
      const { data, error } = await supabase.functions.invoke("run-scraper", {
        body: { 
          type: id, 
          jobId: job.id,
          config: {
            ...settings,
            url: config.url,
            depth: config.depth
          }
        }
      });
      
      if (error) {
        console.error("Error invoking scraper function:", error);
        throw new Error(`Failed to send a request to the Edge Function: ${error.message}`);
      }
      
      // Update active jobs
      setActiveJobs(prev => ({
        ...prev,
        [id]: { 
          ...job,
          status: "running"
        } as ActiveJob
      }));
      
      toast.success(`Started scraping ${id}`);
      return data;
    } catch (error) {
      console.error("Error invoking scraper function:", error);
      throw error;
    }
  };

  const runAllEnabled = async () => {
    const enabledScraperIds = Object.entries(enabledScrapers)
      .filter(([_, enabled]) => enabled)
      .map(([id]) => id);
    
    const enabledCount = enabledScraperIds.length;
    
    if (enabledCount === 0) {
      toast.error("Please enable at least one scraper");
      return;
    }
    
    setIsRunningAll(true);
    toast.success(`Started scraping ${enabledCount} data categories`);
    
    let successCount = 0;
    let errorCount = 0;
    
    // Run each enabled scraper
    for (const id of enabledScraperIds) {
      try {
        // Use default config for batch scraping
        await handleScrape(id, { url: `https://althingi.is/${id}`, depth: 2 });
        successCount++;
      } catch (error) {
        console.error(`Error scraping ${id}:`, error);
        errorCount++;
      }
    }
    
    setIsRunningAll(false);
    
    if (errorCount === 0) {
      toast.success("All scraping tasks started successfully");
    } else if (successCount === 0) {
      toast.error("All scraping tasks failed to start");
    } else {
      toast.warning(`${successCount} scraping tasks started, ${errorCount} failed`);
    }
  };
  
  // Count running jobs
  const runningJobsCount = Object.values(activeJobs).length;

  return {
    enabledScrapers,
    isRunningAll,
    settings,
    isSettingsLoading,
    activeJobs,
    isLoadingJobs,
    totalItemsScraped,
    runningJobsCount,
    toggleScraper,
    handleScrape,
    runAllEnabled
  };
}
