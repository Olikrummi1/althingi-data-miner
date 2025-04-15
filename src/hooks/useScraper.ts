
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
  const [isPendingJobCompletion, setIsPendingJobCompletion] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      setIsSettingsLoading(true);
      try {
        const settings = await getScrapeSettings();
        if (settings) {
          setSettings({
            ...settings,
            save_raw_html: true // Always save raw HTML
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
        
        if (Object.keys(jobsByType).length === 0 && isPendingJobCompletion) {
          setIsPendingJobCompletion(false);
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
    
    // More frequent polling (every 1.5 seconds)
    const intervalId = setInterval(loadActiveJobs, 1500);
    
    return () => clearInterval(intervalId);
  }, [activeJobs, totalItemsScraped, isLoadingJobs, isPendingJobCompletion]);

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
    
    // Allow 3 active jobs instead of 2
    const activeJobsCount = Object.values(activeJobs).filter(job => 
      job.status === "running" || job.status === "pending"
    ).length;
    
    if (activeJobsCount >= 3) {
      toast.error("Too many active scrape jobs. Please wait for the current jobs to complete before starting another.");
      return;
    }
    
    try {
      const setupToastId = toast.info(`Setting up ${id} scraper...`, {
        duration: 20000 // Longer duration for setup toast
      });
      
      setIsPendingJobCompletion(true);
      
      let customConfig = { ...config };
      // Adjust constraints for MP scraper
      if (id === "mps") {
        if (customConfig.depth > 3) { // Increased from 2
          toast.warning("Reducing MPs scrape depth to 3 to avoid resource limits");
          customConfig.depth = 3;
        }
        if (!customConfig.maxItems || customConfig.maxItems > 200) { // Increased from 100
          customConfig.maxItems = 200;
          toast.info("Limiting MPs to 200 items to avoid timeouts");
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
        // Update active jobs immediately to show pending status
        setActiveJobs(prev => ({
          ...prev,
          [id]: { 
            ...job,
            status: "pending"
          } as ActiveJob
        }));
        
        // Use config parameters with increased defaults
        const enhancedConfig = {
          ...settings,
          url: customConfig.url,
          depth: customConfig.depth,
          max_items: customConfig.maxItems || (id === "mps" ? 150 : 200), // Increased defaults
          follow_links: true,
          save_raw_html: true, // Always save raw HTML
          throttle: Math.max(settings.throttle, 300), // Faster throttle
          explore_breadth: id === "mps" ? 10 : 20, // Increased breadth 
          timeout_seconds: Math.min(settings.timeout_seconds, 50) // Increased timeout
        };
        
        let retryCount = 0;
        const maxRetries = 3; // Increased from 2
        let success = false;
        let lastError;
        
        while (retryCount <= maxRetries && !success) {
          try {
            if (retryCount > 0) {
              await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
              toast.info(`Retry attempt ${retryCount} for ${id} scraper...`);
            }
            
            if (setupToastId) {
              toast.dismiss(setupToastId);
            }
            
            // Invoke the edge function to start scraping
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
            
            // Update job status to running
            setActiveJobs(prev => ({
              ...prev,
              [id]: { 
                ...job,
                status: "running"
              } as ActiveJob
            }));
            
            toast.success(`Started scraping ${id} with comprehensive data capture`);
            setConsecutiveErrors(0); 
            
            setIsPendingJobCompletion(true);
            
            return data;
          } catch (error: any) {
            console.error(`Error invoking scraper function (attempt ${retryCount + 1}):`, error);
            lastError = error;
            retryCount++;
          }
        }
        
        // All retries failed
        await updateScrapeJobStatus(job.id, "failed", 0, lastError?.message || "Max retries exceeded");
        
        if (lastError) {
          await handleEdgeFunctionError(lastError, id);
        } else {
          toast.error(`Failed to start ${id} scraper after ${maxRetries} attempts`);
        }
        
        setConsecutiveErrors(prev => prev + 1);
        
        // Remove failed job from active jobs
        setActiveJobs(prev => {
          const newJobs = { ...prev };
          delete newJobs[id];
          return newJobs;
        });
        
        setIsPendingJobCompletion(false);
        
        throw lastError || new Error("Max retries exceeded");
      } catch (error: any) {
        console.error(`Error scraping ${id}:`, error);
        
        // Better error messaging
        if (error.message?.includes("timeout") || error.message?.includes("busy")) {
          toast.error(`Server busy or timed out. Try with a smaller depth (1-2) and fewer max items.`);
        } else if (error.message?.includes("resource") || error.message?.includes("memory")) {
          toast.error(`Resource limit reached. Try with a smaller depth (1-2) and fewer max items.`);
        } else {
          await updateScrapeJobStatus(job.id, "failed", 0, error.message || "Unknown error");
        }
        
        // Enhanced troubleshooting on multiple errors
        if (consecutiveErrors >= 2) {
          toast.error("Multiple scrape attempts failed. Try these troubleshooting steps:", {
            duration: 10000,
          });
          
          toast.info("1. Reduce scrape depth to 1", { duration: 8000 });
          toast.info("2. Lower max items to 50", { duration: 8000 });
          toast.info("3. Try scrapers one at a time instead of in parallel", { duration: 8000 });
          toast.info("4. Wait a few minutes before trying again", { duration: 8000 });
        }
        
        // Remove failed job from active jobs
        setActiveJobs(prev => {
          const newJobs = { ...prev };
          delete newJobs[id];
          return newJobs;
        });
        
        setIsPendingJobCompletion(false);
        
        throw error;
      }
    } catch (error: any) {
      console.error(`Error scraping ${id}:`, error);
      toast.error(`Error starting ${id} scraper: ${error.message || "Unknown error"}`);
      setIsPendingJobCompletion(false);
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
    
    // More cautious warning message
    if (enabledCount > 2) {
      toast.warning("Running multiple scrapers simultaneously may cause timeouts or incomplete data. Consider running fewer at once for more reliable results.");
    }
    
    setIsRunningAll(true);
    toast.success(`Starting to scrape ${enabledCount} data categories`);
    
    let successCount = 0;
    let errorCount = 0;
    
    // Run MPs last since it's typically more resource-intensive
    const prioritizedScrapers = [...enabledScraperIds].sort((a, b) => {
      if (a === "mps") return 1;
      if (b === "mps") return -1;
      return 0;
    });
    
    for (const id of prioritizedScrapers) {
      try {
        const baseUrl = getBaseUrlForScraper(id);
        
        // More conservative depth and maxItems values for batch scraping
        const maxDepth = id === "mps" ? 1 : 2;
        const maxItems = id === "mps" ? 100 : 150;
        
        await handleScrape(id, { 
          url: baseUrl, 
          depth: maxDepth,
          maxItems: maxItems
        });
        successCount++;
        
        // Wait longer between scrape jobs
        await new Promise(resolve => setTimeout(resolve, 5000));
      } catch (error) {
        console.error(`Error scraping ${id}:`, error);
        errorCount++;
        
        // Stop after 2 errors to prevent overloading
        if (errorCount >= 2) {
          toast.error("Multiple errors occurred. Stopping batch scrape to prevent overloading.");
          break;
        }
        
        // Wait even longer after an error
        await new Promise(resolve => setTimeout(resolve, 8000));
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
    isPendingJobCompletion,
    toggleScraper,
    handleScrape,
    runAllEnabled
  };
}
