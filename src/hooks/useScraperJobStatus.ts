
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { stopScrapeJob } from "@/services/scrapeJobsService";

export type ActiveJob = {
  id: string;
  status: string;
  started_at: string;
  items_scraped?: number;
};

export const useScraperJobStatus = (
  activeJob: ActiveJob | null | undefined,
  title: string,
  scrapeJobId?: string | null
) => {
  const [jobStatus, setJobStatus] = useState<string | null>(activeJob?.status || null);
  const [itemsScraped, setItemsScraped] = useState<number>(activeJob?.items_scraped || 0);
  const [isPolling, setIsPolling] = useState(false);
  const pollingRef = useRef<number | null>(null);
  const initialStatusSetRef = useRef(false);
  const previousItemsScraped = useRef(0);
  const pollingStartTimeRef = useRef<number | null>(null);
  const lastItemUpdateRef = useRef<number | null>(null);
  const stagnantCountRef = useRef(0);
  const lastPollingCheckRef = useRef<number>(Date.now());

  const POLLING_TIMEOUT_MS = 180000;
  const STAGNANT_THRESHOLD_MS = 45000;

  useEffect(() => {
    if (activeJob && !initialStatusSetRef.current) {
      setJobStatus(activeJob.status);
      setItemsScraped(activeJob.items_scraped || 0);
      initialStatusSetRef.current = true;
    } else if (!activeJob) {
      setJobStatus(null);
      setItemsScraped(0);
      initialStatusSetRef.current = false;
    }
  }, [activeJob]);

  useEffect(() => {
    const pollJobStatus = async (jobId: string) => {
      if (!jobId) return;
      
      try {
        const now = Date.now();
        
        if (now - lastPollingCheckRef.current >= 2000) {
          lastPollingCheckRef.current = now;
          
          const { data, error } = await supabase
            .from("scrape_jobs")
            .select("status, items_scraped, error_message")
            .eq("id", jobId)
            .single();
          
          if (error) {
            console.error("Error fetching job status:", error);
            return;
          }
          
          if (data) {
            if (data.status !== jobStatus) {
              console.log(`Job status changed from ${jobStatus} to ${data.status}`);
              
              if ((data.status === "completed" || data.status === "failed") && jobStatus === "running") {
                if (data.status === "completed" && (data.items_scraped || 0) > 5) {
                  toast.success(`${title} scraper completed with ${data.items_scraped} items`);
                } else if (data.status === "failed" && data.error_message) {
                  toast.error(`${title} scraper failed: ${data.error_message}`);
                }
              }
              
              setJobStatus(data.status);
            }
            
            if (data.items_scraped !== undefined && data.items_scraped !== itemsScraped) {
              console.log(`Items scraped changed from ${itemsScraped} to ${data.items_scraped}`);
              
              if (data.items_scraped > itemsScraped) {
                lastItemUpdateRef.current = Date.now();
                stagnantCountRef.current = 0;
              }
              
              setItemsScraped(data.items_scraped);
              previousItemsScraped.current = data.items_scraped;
            }
            
            if (data.status === "running" && lastItemUpdateRef.current !== null) {
              const timeSinceLastItem = now - lastItemUpdateRef.current;
              
              if (timeSinceLastItem > STAGNANT_THRESHOLD_MS) {
                stagnantCountRef.current += 1;
                
                if (stagnantCountRef.current === 3) {
                  toast.info(`${title} scraper hasn't found new items in a while but is still running`);
                }
              }
            }
            
            const isCompleted = data.status === "completed" || data.status === "failed" || data.status === "stopped";
            
            if (data.status === "completed" && data.items_scraped < 3 && pollingStartTimeRef.current) {
              if (Date.now() - pollingStartTimeRef.current < 15000) {
                return;
              }
            }
            
            if (isCompleted) {
              setIsPolling(false);
            }
          }
        }
        
        if (pollingStartTimeRef.current && (Date.now() - pollingStartTimeRef.current > POLLING_TIMEOUT_MS)) {
          console.log("Polling timeout reached, stopping polling");
          setIsPolling(false);
          
          if (jobStatus === "running") {
            await stopScrapeJob(jobId);
            toast.warning(`${title} scraper has been running for over 3 minutes with no completion. You can try with a smaller depth or wait for it to finish.`);
          }
        }
      } catch (error) {
        console.error("Error in status polling:", error);
      }
    };

    const isActiveJob = jobStatus === "running" || jobStatus === "pending";
    
    if (isActiveJob && scrapeJobId && !isPolling) {
      console.log(`Starting polling for job ${scrapeJobId}`);
      setIsPolling(true);
      pollingStartTimeRef.current = Date.now();
      lastItemUpdateRef.current = Date.now();
      previousItemsScraped.current = itemsScraped;
      stagnantCountRef.current = 0;
      
      pollJobStatus(scrapeJobId);
      pollingRef.current = window.setInterval(() => pollJobStatus(scrapeJobId), 1500);
    } else if (!isActiveJob && isPolling) {
      setIsPolling(false);
    }
    
    return () => {
      if (pollingRef.current !== null) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [scrapeJobId, jobStatus, itemsScraped, isPolling, title]);

  return {
    jobStatus,
    itemsScraped,
    isJobRunning: jobStatus === "running" || jobStatus === "pending"
  };
};
