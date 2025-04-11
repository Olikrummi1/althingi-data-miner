
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createScrapeJob, stopScrapeJob, updateScrapeJobStatus } from "@/services/scrapeJobsService";
import { getScrapeSettings } from "@/services/scrapeSettingsService";
import { handleEdgeFunctionError } from "@/services/scrapedItemsService";

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
  const [consecutiveErrors, setConsecutiveErrors] = useState(0);

  useEffect(() => {
    
    const loadSettings = async () => {
      setIsSettingsLoading(true);
      try {
        const settings = await getScrapeSettings();
        if (settings) {
          // Modify settings to always save raw HTML
          setSettings({
            ...settings,
            save_raw_html: true
          });
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
    
    const intervalId = setInterval(loadActiveJobs, 2000);
    
    return () => clearInterval(intervalId);
  }, [activeJobs, totalItemsScraped, isLoadingJobs]);

  const toggleScraper = (id: string, enabled: boolean) => {
    setEnabledScrapers(prev => ({
      ...prev,
      [id]: enabled
    }));
  };

  const handleScrape = async (id: string, config: { url: string; depth: number; maxItems?: number }) => {
    if (!settings) {
      toast.error("Scrape settings not loaded");
      return;
    }
    
    
    const activeJobsCount = Object.values(activeJobs).filter(job => 
      job.status === "running" || job.status === "pending"
    ).length;
    
    if (activeJobsCount >= 2) {
      toast.error("Too many active scrape jobs. Please wait for the current jobs to complete before starting another.");
      return;
    }
    
    try {
      toast.info(`Setting up ${id} scraper...`);
      
      
      let customConfig = { ...config };
      if (id === "mps") {
        if (customConfig.depth > 2) {
          toast.warning("Reducing MPs scrape depth to 2 to avoid resource limits");
          customConfig.depth = 2;
        }
        if (!customConfig.maxItems || customConfig.maxItems > 100) {
          customConfig.maxItems = 100;
          toast.info("Limiting MPs to 100 items to avoid timeouts");
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
        
        
        const enhancedConfig = {
          ...settings,
          url: customConfig.url,
          depth: customConfig.depth,
          max_items: customConfig.maxItems || (id === "mps" ? 50 : 100),
          follow_links: true,
          save_raw_html: true, // Always save raw HTML
          throttle: Math.max(settings.throttle, 500), 
          explore_breadth: id === "mps" ? 5 : 10, 
          timeout_seconds: Math.min(settings.timeout_seconds, 30) 
        };
        
        
        let retryCount = 0;
        const maxRetries = 2;
        let success = false;
        let lastError;
        
        while (retryCount <= maxRetries && !success) {
          try {
            if (retryCount > 0) {
              
              await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
              toast.info(`Retry attempt ${retryCount} for ${id} scraper...`);
            }
            
            const { data, error } = await supabase.functions.invoke("run-scraper", {
              body: { 
                type: id, 
                jobId: job.id,
                config: enhancedConfig
              }
            });
            
            if (error) {
              console.error(`Error invoking scraper function (attempt ${retryCount + 1}):`, error);
              lastError = error;
              retryCount++;
              continue;
            }
            
            success = true;
            setActiveJobs(prev => ({
              ...prev,
              [id]: { 
                ...job,
                status: "running"
              } as ActiveJob
            }));
            
            toast.success(`Started scraping ${id}`);
            setConsecutiveErrors(0); 
            return data;
          } catch (error: any) {
            console.error(`Error invoking scraper function (attempt ${retryCount + 1}):`, error);
            lastError = error;
            retryCount++;
          }
        }
        
        
        await updateScrapeJobStatus(job.id, "failed", 0, lastError?.message || "Max retries exceeded");
        
        if (lastError) {
          await handleEdgeFunctionError(lastError, id);
        } else {
          toast.error(`Failed to start ${id} scraper after ${maxRetries} attempts`);
        }
        
        
        setConsecutiveErrors(prev => prev + 1);
        
        
        setActiveJobs(prev => {
          const newJobs = { ...prev };
          delete newJobs[id];
          return newJobs;
        });
        
        throw lastError || new Error("Max retries exceeded");
      } catch (error: any) {
        console.error(`Error scraping ${id}:`, error);
        
        
        if (error.message?.includes("timeout") || error.message?.includes("busy")) {
          toast.error(`Server busy or timed out. Try again with smaller depth and max items.`);
        } else if (error.message?.includes("resource") || error.message?.includes("memory")) {
          toast.error(`Resource limit reached. Try again with smaller depth and max items.`);
        } else {
          await updateScrapeJobStatus(job.id, "failed", 0, error.message || "Unknown error");
        }
        
        
        if (consecutiveErrors >= 2) {
          toast.error("Multiple scrape attempts failed. Try these troubleshooting steps:", {
            duration: 8000,
          });
          
          toast.info("1. Reduce scrape depth to 1", { duration: 7000 });
          toast.info("2. Lower max items to 50", { duration: 7000 });
          toast.info("3. Wait a few minutes before trying again", { duration: 7000 });
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
    
    
    if (enabledCount > 2) {
      toast.warning("Running multiple scrapers simultaneously may cause timeouts. Consider running fewer at once.");
    }
    
    setIsRunningAll(true);
    toast.success(`Starting to scrape ${enabledCount} data categories`);
    
    let successCount = 0;
    let errorCount = 0;
    
    
    const prioritizedScrapers = [...enabledScraperIds].sort((a, b) => {
      
      if (a === "mps") return 1;
      if (b === "mps") return -1;
      return 0;
    });
    
    for (const id of prioritizedScrapers) {
      try {
        const baseUrl = getBaseUrlForScraper(id);
        
        
        const maxDepth = id === "mps" ? 1 : 2;
        const maxItems = id === "mps" ? 50 : 100;
        
        await handleScrape(id, { 
          url: baseUrl, 
          depth: maxDepth,
          maxItems: maxItems
        });
        successCount++;
        
        
        await new Promise(resolve => setTimeout(resolve, 3000));
      } catch (error) {
        console.error(`Error scraping ${id}:`, error);
        errorCount++;
        
        
        if (errorCount >= 2) {
          toast.error("Multiple errors occurred. Stopping batch scrape to prevent overloading.");
          break;
        }
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
