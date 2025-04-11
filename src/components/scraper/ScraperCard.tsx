
import React, { useState, useEffect, useRef, memo } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import ScrapeConfigToggle from "./ScrapeConfigToggle";
import ScrapeStatusBadge from "./ScrapeStatusBadge";
import { useScrapeForm } from "@/hooks/useScrapeForm";
import { Button } from "@/components/ui/button";
import { Loader2, StopCircle } from "lucide-react";
import { stopScrapeJob } from "@/services/scrapeJobsService";
import { toast } from "sonner";
import { handleEdgeFunctionError } from "@/services/scrapedItemsService";

type ScrapeConfigCardProps = {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  onScrape: (config: { url: string; depth: number; maxItems?: number }) => Promise<void>;
  activeJob?: { id: string; status: string; started_at: string; items_scraped?: number } | null;
  scrapeJobId?: string | null;
};

const ScraperCard = memo(({
  title,
  description,
  enabled,
  onToggle,
  onScrape,
  activeJob,
  scrapeJobId
}: ScrapeConfigCardProps) => {
  const [jobStatus, setJobStatus] = useState<string | null>(activeJob?.status || null);
  const [itemsScraped, setItemsScraped] = useState<number>(activeJob?.items_scraped || 0);
  const [isPolling, setIsPolling] = useState(false);
  const pollingRef = useRef<number | null>(null);
  const initialStatusSetRef = useRef(false);
  const previousItemsScraped = useRef(0);
  const pollingStartTimeRef = useRef<number | null>(null);
  const POLLING_TIMEOUT_MS = 60000; // 1 minute timeout for polling if no progress
  
  const getDefaultUrl = () => {
    switch (title.toLowerCase()) {
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
        return `https://www.althingi.is/`;
    }
  };
  
  const defaultUrl = getDefaultUrl();
  const isMpsScraper = title.toLowerCase() === "mps";

  // Default depth based on scraper type
  const defaultDepth = isMpsScraper ? "1" : "2";
  // Default max items based on scraper type
  const defaultMaxItems = isMpsScraper ? "50" : "100";
  // Max depth constraint based on scraper type
  const maxDepthAllowed = isMpsScraper ? 2 : 3;
  
  const { isLoading, urlRef, depthRef, maxItemsRef, handleSubmit } = useScrapeForm({
    title,
    onScrape,
    enabled,
    defaultUrl,
    onError: (error) => handleEdgeFunctionError(error, title)
  });

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
        const { data, error } = await supabase
          .from("scrape_jobs")
          .select("status, items_scraped")
          .eq("id", jobId)
          .single();
        
        if (error) {
          console.error("Error fetching job status:", error);
          return;
        }
        
        if (data) {
          if (data.status !== jobStatus) {
            console.log(`Job status changed from ${jobStatus} to ${data.status}`);
            setJobStatus(data.status);
          }
          
          if (data.items_scraped !== undefined && data.items_scraped !== itemsScraped) {
            console.log(`Items scraped changed from ${itemsScraped} to ${data.items_scraped}`);
            setItemsScraped(data.items_scraped);
            previousItemsScraped.current = data.items_scraped;
            
            // Reset timeout when making progress
            if (pollingStartTimeRef.current !== null) {
              pollingStartTimeRef.current = Date.now();
            }
          }
          
          // Check if we should stop polling
          const isCompleted = data.status === "completed" || data.status === "failed" || data.status === "stopped";
          
          // Handle premature status changes
          if (data.status === "completed" && data.items_scraped < 1) {
            console.log("Job marked as completed but no items scraped, might be premature");
            
            // Wait for a few more polling attempts before giving up
            if (pollingStartTimeRef.current && (Date.now() - pollingStartTimeRef.current < 10000)) {
              return; // Keep polling for a bit in case items appear
            }
          }
          
          if (isCompleted) {
            setIsPolling(false);
            
            // Show notification only if we actually scraped something
            if (data.status === "completed" && data.items_scraped > 0) {
              toast.success(`${title} scraper completed with ${data.items_scraped} items`);
            } else if (data.status === "failed") {
              toast.error(`${title} scraper failed`);
            }
          }
          
          // Check for timeout (no progress for a minute)
          if (pollingStartTimeRef.current && (Date.now() - pollingStartTimeRef.current > POLLING_TIMEOUT_MS)) {
            if (previousItemsScraped.current === data.items_scraped) {
              console.log("Polling timeout reached with no progress, stopping polling");
              setIsPolling(false);
              
              if (data.status === "running") {
                // Job might be stuck, try to stop it
                await stopScrapeJob(jobId);
                toast.warning(`${title} scraper appears to be stuck, stopped polling`);
              }
            }
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
      previousItemsScraped.current = itemsScraped;
      
      // Initial poll
      pollJobStatus(scrapeJobId);
      
      // Set up polling interval
      pollingRef.current = window.setInterval(() => pollJobStatus(scrapeJobId), 2000);
    } else if (!isActiveJob && isPolling) {
      console.log("Stopping polling as job is no longer active");
      setIsPolling(false);
    }
    
    return () => {
      if (pollingRef.current !== null) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [scrapeJobId, jobStatus, itemsScraped, isPolling, title]);

  const handleStopScraping = async () => {
    if (!activeJob || !activeJob.id) return;
    
    try {
      toast.info(`Attempting to stop ${title} scraper...`);
      const success = await stopScrapeJob(activeJob.id);
      
      if (!success) {
        toast.error("Failed to stop scraper");
        return;
      }
      
      setJobStatus("stopped");
      toast.success(`Stopped ${title} scraper`);
    } catch (error) {
      console.error("Error stopping scraper:", error);
      toast.error("Failed to stop scraper");
    }
  };

  const isJobRunning = jobStatus === "running" || jobStatus === "pending";

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{title}</CardTitle>
          <ScrapeConfigToggle enabled={enabled} onToggle={onToggle} />
        </div>
        <div className="flex items-center justify-between">
          <CardDescription>{description}</CardDescription>
          <ScrapeStatusBadge status={jobStatus} itemsScraped={itemsScraped} />
        </div>
      </CardHeader>
      <CardContent className="flex-grow">
        <form id={`scrape-form-${title}`} onSubmit={handleSubmit} className="space-y-4">
          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor={`url-${title}`}>URL</Label>
            <Input 
              id={`url-${title}`} 
              defaultValue={defaultUrl}
              disabled={!enabled || isJobRunning} 
              className="bg-background"
              ref={urlRef}
            />
          </div>
          
          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor={`depth-${title}`}>Scrape Depth</Label>
            <Input 
              id={`depth-${title}`} 
              type="number" 
              defaultValue={defaultDepth} 
              min="1" 
              max={maxDepthAllowed.toString()} 
              disabled={!enabled || isJobRunning} 
              className="bg-background"
              ref={depthRef}
            />
            <p className="text-xs text-muted-foreground">
              Higher depth values will scrape more pages but take longer.
            </p>
          </div>
          
          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor={`maxitems-${title}`}>Max Items</Label>
            <Input 
              id={`maxitems-${title}`} 
              type="number" 
              defaultValue={defaultMaxItems} 
              min="10" 
              max={isMpsScraper ? "100" : "200"} 
              disabled={!enabled || isJobRunning} 
              className="bg-background"
              ref={maxItemsRef}
            />
            <p className="text-xs text-muted-foreground">
              Maximum number of pages to scrape. Lower values prevent timeouts.
            </p>
          </div>
        </form>
      </CardContent>
      <CardFooter>
        {isJobRunning ? (
          <Button 
            className="w-full bg-red-500 hover:bg-red-600 text-white" 
            onClick={handleStopScraping}
          >
            <StopCircle className="mr-2 h-4 w-4" /> Stop Scraping
          </Button>
        ) : (
          <Button 
            className="w-full bg-althingi-blue hover:bg-althingi-darkBlue" 
            disabled={!enabled || isLoading} 
            type="submit"
            form={`scrape-form-${title}`}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Scraping...
              </>
            ) : (
              "Start Scrape"
            )}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
});

ScraperCard.displayName = 'ScraperCard';

export default ScraperCard;
