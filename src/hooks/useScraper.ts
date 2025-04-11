
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createScrapeJob, stopScrapeJob, updateScrapeJobStatus } from "@/services/scrapeJobsService";
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

  useEffect(() => {
    const loadActiveJobs = async () => {
      try {
        if (isLoadingJobs) {
          setIsLoadingJobs(true);
        }
        
        const { data, error } = await supabase
          .from("scrape_jobs")
          .select("*")
          .in("status", ["running", "pending"])
          .order("created_at", { ascending: false });
        
        if (error) {
          throw error;
        }
        
        const jobsByType: Record<string, ActiveJob> = {};
        let totalItems = 0;
        
        if (data && data.length > 0) {
          data.forEach(job => {
            if (!jobsByType[job.type] || new Date(job.created_at) > new Date(jobsByType[job.type].created_at)) {
              jobsByType[job.type] = job as ActiveJob;
            }
            
            if (job.items_scraped) {
              totalItems += job.items_scraped;
            }
          });
        }
        
        if (JSON.stringify(jobsByType) !== JSON.stringify(activeJobs)) {
          setActiveJobs(jobsByType);
        }
        
        if (totalItems !== totalItemsScraped) {
          setTotalItemsScraped(totalItems);
        }
      } catch (error) {
        console.error("Error loading active jobs:", error);
      } finally {
        if (isLoadingJobs) {
          setIsLoadingJobs(false);
        }
      }
    };
    
    loadActiveJobs();
    
    // Increased polling frequency to get more up-to-date information
    const intervalId = setInterval(loadActiveJobs, 2000); // Changed from 3000 to 2000
    
    return () => clearInterval(intervalId);
  }, [activeJobs, totalItemsScraped, isLoadingJobs]);

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
      toast.info(`Setting up ${id} scraper...`);
      
      // For MPs scraper, use more conservative settings to avoid resource limits
      let customConfig = { ...config };
      if (id === "mps") {
        if (customConfig.depth > 2) {
          toast.warning("Reducing MPs scrape depth to 2 to avoid resource limits");
          customConfig.depth = 2;
        }
      }
      
      const job = await createScrapeJob(id as any, {
        url: customConfig.url,
        depth: customConfig.depth,
        ...settings
      });
      
      if (!job) {
        throw new Error("Failed to create scrape job");
      }
      
      try {
        setActiveJobs(prev => ({
          ...prev,
          [id]: { 
            ...job,
            status: "pending"
          } as ActiveJob
        }));
        
        // Enhanced configuration to get more data
        const enhancedConfig = {
          ...settings,
          url: customConfig.url,
          depth: customConfig.depth,
          // Adding additional settings to maximize data collection
          max_items: id === "mps" ? 50 : 100, // Lower for MPs to prevent resource exhaustion
          follow_links: true,
          save_raw_html: settings.save_raw_html
        };
        
        const { data, error } = await supabase.functions.invoke("run-scraper", {
          body: { 
            type: id, 
            jobId: job.id,
            config: enhancedConfig
          }
        });
        
        if (error) {
          console.error("Error invoking scraper function:", error);
          await updateScrapeJobStatus(job.id, "failed", 0, `Failed to send a request to the Edge Function: ${error.message}`);
          throw error;
        }
        
        setActiveJobs(prev => ({
          ...prev,
          [id]: { 
            ...job,
            status: "running"
          } as ActiveJob
        }));
        
        toast.success(`Started scraping ${id}`);
        return data;
      } catch (error: any) {
        console.error("Error invoking scraper function:", error);
        await updateScrapeJobStatus(job.id, "failed", 0, error.message || "Unknown error");
        
        // Check if it's a resource limit error for MPs
        if (id === "mps" && error.message && (
            error.message.includes("non-2xx status code") || 
            error.message.includes("WORKER_LIMIT") ||
            error.message.includes("timeout")
        )) {
          toast.error(`The MPs scraper hit resource limits. Try with a smaller depth (1-2) or wait for other jobs to complete.`);
        } else {
          toast.error(`Failed to start ${id} scraper: ${error.message || "Unknown error"}`);
        }
        
        setActiveJobs(prev => {
          const newJobs = { ...prev };
          delete newJobs[id];
          return newJobs;
        });
        
        throw error;
      }
    } catch (error: any) {
      console.error(`Error scraping ${id}:`, error);
      toast.error(`Error starting ${id} scraper: ${error.message || "Unknown error"}`);
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
    
    for (const id of enabledScraperIds) {
      try {
        // Get appropriate URL for this scraper type
        const baseUrl = getBaseUrlForScraper(id);
        
        await handleScrape(id, { 
          url: baseUrl, 
          depth: settings?.max_depth || 3 // Increased from 2 to 3
        });
        successCount++;
        
        // Adding delay between scrapers to prevent overloading
        await new Promise(resolve => setTimeout(resolve, 1500));
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
  
  // Helper function to get the most appropriate URL for each scraper type
  const getBaseUrlForScraper = (id: string): string => {
    switch(id) {
      case "bills":
        return "https://www.althingi.is/thingstorf/thingmalalistar-eftir-thingum/";
      case "votes":
        return "https://www.althingi.is/thingstorf/atkvaedagreidslur/";
      case "speeches":
        return "https://www.althingi.is/altext/raedur/";
      case "mps":
        return "https://www.althingi.is/thingmenn/althingismenn/";
      case "committees":
        return "https://www.althingi.is/thingnefndir/fastanefndir/";
      case "issues":
        return "https://www.althingi.is/thingstorf/thingmalalistar-eftir-thingum/";
      default:
        return `https://www.althingi.is/${id}`;
    }
  };
  
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
