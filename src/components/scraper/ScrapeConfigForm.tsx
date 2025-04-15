
import React, { memo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useScrapeForm } from "@/hooks/useScrapeForm";

type ScrapeConfigFormProps = {
  title: string;
  enabled: boolean;
  isJobRunning: boolean;
  defaultUrl: string;
  onScrape: (config: { url: string; depth: number; maxItems?: number }) => Promise<void>;
  isMpsScraper?: boolean;
};

export const ScrapeConfigForm = memo(({ 
  title, 
  enabled, 
  isJobRunning, 
  defaultUrl,
  onScrape,
  isMpsScraper
}: ScrapeConfigFormProps) => {
  const { urlRef, depthRef, maxItemsRef } = useScrapeForm({
    title,
    onScrape,
    enabled,
    defaultUrl
  });

  const defaultDepth = isMpsScraper ? "2" : "3";
  const defaultMaxItems = isMpsScraper ? "150" : "200";
  const maxDepthAllowed = isMpsScraper ? 3 : 5;

  return (
    <form id={`scrape-form-${title}`} onSubmit={(e) => e.preventDefault()} className="space-y-4">
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
          Higher depth values (1-{maxDepthAllowed}) will scrape more pages but take longer.
        </p>
      </div>
      
      <div className="grid w-full items-center gap-1.5">
        <Label htmlFor={`maxitems-${title}`}>Max Items</Label>
        <Input 
          id={`maxitems-${title}`} 
          type="number" 
          defaultValue={defaultMaxItems}
          min="10" 
          max={isMpsScraper ? "300" : "500"}
          disabled={!enabled || isJobRunning} 
          className="bg-background"
          ref={maxItemsRef}
        />
        <p className="text-xs text-muted-foreground">
          Maximum number of pages to scrape. Higher values capture more data.
        </p>
      </div>
    </form>
  );
});

ScrapeConfigForm.displayName = 'ScrapeConfigForm';
