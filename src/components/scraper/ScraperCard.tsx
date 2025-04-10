
import React, { useState, useEffect, memo } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import ScrapeConfigToggle from "./ScrapeConfigToggle";
import ScrapeStatusBadge from "./ScrapeStatusBadge";
import { useScrapeForm } from "@/hooks/useScrapeForm";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, StopCircle } from "lucide-react";
import { stopScrapeJob } from "@/services/scrapeJobsService";

type ScrapeConfigCardProps = {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  onScrape: (config: { url: string; depth: number }) => Promise<void>;
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
  const { isLoading, urlRef, depthRef, handleSubmit } = useScrapeForm({
    title,
    onScrape,
    enabled,
    defaultUrl
  });

  useEffect(() => {
    if (activeJob) {
      setJobStatus(activeJob.status);
      setItemsScraped(activeJob.items_scraped || 0);
    } else {
      setJobStatus(null);
      setItemsScraped(0);
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
            setJobStatus(data.status);
          }
          
          if (data.items_scraped !== undefined && data.items_scraped !== itemsScraped) {
            setItemsScraped(data.items_scraped);
          }
          
          if (data.status !== "running" && data.status !== "pending") {
            setIsPolling(false);
          }
        }
      } catch (error) {
        console.error("Error in status polling:", error);
      }
    };

    const isActiveJob = jobStatus === "running" || jobStatus === "pending";
    
    if (isActiveJob && scrapeJobId && !isPolling) {
      setIsPolling(true);
      pollJobStatus(scrapeJobId);
      pollingRef.current = window.setInterval(() => pollJobStatus(scrapeJobId), 3000);
    } else if (!isActiveJob && isPolling) {
      setIsPolling(false);
    }
    
    return () => {
      if (pollingRef.current !== null) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [scrapeJobId, jobStatus, itemsScraped, isPolling]);

  const handleStopScraping = async () => {
    if (!activeJob || !activeJob.id) return;
    
    try {
      const success = await stopScrapeJob(activeJob.id);
      
      if (!success) {
        toast.error("Failed to stop scraper");
        return;
      }
      
      setJobStatus("failed");
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
              defaultValue="2" 
              min="1" 
              max="5" 
              disabled={!enabled || isJobRunning} 
              className="bg-background"
              ref={depthRef}
            />
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
