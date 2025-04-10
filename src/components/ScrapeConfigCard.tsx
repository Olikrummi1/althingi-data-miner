
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Loader2, StopCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type ScrapeConfigCardProps = {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  onScrape: (config: { url: string; depth: number }) => Promise<void>;
  activeJob?: { id: string; status: string; started_at: string; items_scraped?: number } | null;
};

const ScrapeConfigCard = ({
  title,
  description,
  enabled,
  onToggle,
  onScrape,
  activeJob
}: ScrapeConfigCardProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [jobStatus, setJobStatus] = useState<string | null>(activeJob?.status || null);
  const [itemsScraped, setItemsScraped] = useState<number>(activeJob?.items_scraped || 0);
  const urlRef = useRef<HTMLInputElement>(null);
  const depthRef = useRef<HTMLInputElement>(null);

  // Helper function to get the correct default URL based on the scraper type
  const getDefaultUrl = () => {
    switch (title.toLowerCase()) {
      case "bills":
        return "https://www.althingi.is/thingstorf/thingmalalistar-eftir-thingum/";
      case "votes":
        return "https://www.althingi.is/thingstorf/atkvaedagreidslur/";
      case "speeches":
        return "https://www.althingi.is/altext/raedur/";
      case "mps":
        // Try different possible URLs for MPs
        return "https://www.althingi.is/thingmenn/althingismenn/";
      case "committees":
        return "https://www.althingi.is/thingnefndir/fastanefndir/";
      case "issues":
        return "https://www.althingi.is/thingstorf/thingmalalistar-eftir-thingum/";
      default:
        return `https://www.althingi.is/`;
    }
  };

  // Poll for job status updates when there's an active job
  useEffect(() => {
    if (!activeJob || !activeJob.id) return;

    setJobStatus(activeJob.status);
    if (activeJob.items_scraped) {
      setItemsScraped(activeJob.items_scraped);
    }

    let intervalId: number;
    
    // Only set up polling for running jobs
    if (activeJob.status === "running" || activeJob.status === "pending") {
      intervalId = window.setInterval(async () => {
        try {
          const { data, error } = await supabase
            .from("scrape_jobs")
            .select("status, items_scraped")
            .eq("id", activeJob.id)
            .single();
          
          if (error) {
            console.error("Error fetching job status:", error);
            return;
          }
          
          if (data) {
            setJobStatus(data.status);
            if (data.items_scraped) {
              setItemsScraped(data.items_scraped);
            }
            
            // Clear interval if job is no longer running
            if (data.status !== "running" && data.status !== "pending") {
              clearInterval(intervalId);
            }
          }
        } catch (error) {
          console.error("Error in status polling:", error);
        }
      }, 3000); // Poll every 3 seconds
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [activeJob]);

  const handleScrape = async () => {
    if (!enabled) return;
    
    const url = urlRef.current?.value || getDefaultUrl();
    const depthValue = depthRef.current?.value || "2";
    const depth = parseInt(depthValue, 10);
    
    setIsLoading(true);
    
    try {
      // Call the scrape function with config values
      await onScrape({ url, depth });
      toast.success(`Started scraping ${title}`);
    } catch (error) {
      console.error(`Error scraping ${title}:`, error);
      toast.error(`Error starting ${title} scraper: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopScraping = async () => {
    if (!activeJob || !activeJob.id) return;
    
    try {
      // Update job status to stopped
      const { error } = await supabase
        .from("scrape_jobs")
        .update({ 
          status: "stopped", 
          completed_at: new Date().toISOString(),
          error_message: "Manually stopped by user"
        })
        .eq("id", activeJob.id);
      
      if (error) {
        console.error("Error stopping job:", error);
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

  const getStatusBadge = () => {
    if (!jobStatus) return null;
    
    let color = "";
    let text = jobStatus;
    
    switch(jobStatus) {
      case "running":
        color = "bg-yellow-200 text-yellow-800";
        break;
      case "completed":
        color = "bg-green-200 text-green-800";
        break;
      case "failed":
        color = "bg-red-200 text-red-800";
        break;
      case "stopped":
        color = "bg-gray-200 text-gray-800";
        text = "Stopped";
        break;
      case "pending":
        color = "bg-blue-200 text-blue-800";
        text = "Pending";
        break;
      default:
        color = "bg-gray-200 text-gray-800";
    }
    
    return (
      <Badge className={color}>
        {text} {jobStatus === "running" && itemsScraped > 0 && `(${itemsScraped} items)`}
      </Badge>
    );
  };

  const isJobRunning = jobStatus === "running" || jobStatus === "pending";

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{title}</CardTitle>
          <Switch 
            checked={enabled} 
            onCheckedChange={onToggle} 
            className="data-[state=checked]:bg-althingi-blue"
          />
        </div>
        <div className="flex items-center justify-between">
          <CardDescription>{description}</CardDescription>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="flex-grow">
        <div className="space-y-4">
          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor={`url-${title}`}>URL</Label>
            <Input 
              id={`url-${title}`} 
              defaultValue={getDefaultUrl()}
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
        </div>
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
            onClick={handleScrape}
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
};

export default ScrapeConfigCard;
