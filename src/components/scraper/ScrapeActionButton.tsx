
import React, { useState, memo } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, StopCircle } from "lucide-react";
import { toast } from "sonner";
import { stopScrapeJob } from "@/services/scrapeJobsService";

type ScrapeActionButtonProps = {
  isJobRunning: boolean;
  enabled: boolean;
  title: string;
  activeJobId?: string;
};

const ScrapeActionButton = memo(({ 
  isJobRunning, 
  enabled, 
  title, 
  activeJobId 
}: ScrapeActionButtonProps) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleStopScraping = async () => {
    if (!activeJobId) {
      toast.error("No active job to stop");
      return;
    }
    
    try {
      setIsLoading(true);
      const success = await stopScrapeJob(activeJobId);
      
      if (!success) {
        toast.error(`Failed to stop ${title} scraper`);
        return;
      }
      
      toast.success(`Stopped ${title} scraper`);
    } catch (error) {
      console.error("Error stopping scraper:", error);
      toast.error(`Failed to stop ${title} scraper`);
    } finally {
      setIsLoading(false);
    }
  };

  return isJobRunning ? (
    <Button 
      className="w-full bg-red-500 hover:bg-red-600 text-white" 
      onClick={handleStopScraping}
      disabled={isLoading}
    >
      {isLoading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <StopCircle className="mr-2 h-4 w-4" />
      )}
      {isLoading ? "Stopping..." : "Stop Scraping"}
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
  );
});

ScrapeActionButton.displayName = 'ScrapeActionButton';

export default ScrapeActionButton;
