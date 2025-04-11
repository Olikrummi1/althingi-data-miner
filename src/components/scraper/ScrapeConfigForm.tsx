
import React, { forwardRef, memo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ScrapeConfigFormProps = {
  title: string;
  enabled: boolean;
  isJobRunning: boolean;
  defaultUrl: string;
  onScrape: (config: { url: string; depth: number; maxItems?: number }) => Promise<void>;
};

type ScrapeConfigFormRef = {
  urlRef: React.RefObject<HTMLInputElement>;
  depthRef: React.RefObject<HTMLInputElement>;
  maxItemsRef: React.RefObject<HTMLInputElement>;
};

const ScrapeConfigForm = memo(forwardRef<ScrapeConfigFormRef, ScrapeConfigFormProps>(({ 
  title, 
  enabled, 
  isJobRunning, 
  defaultUrl 
}, ref) => {
  return (
    <div className="space-y-4">
      <div className="grid w-full items-center gap-1.5">
        <Label htmlFor={`url-${title}`}>URL</Label>
        <Input 
          id={`url-${title}`} 
          defaultValue={defaultUrl}
          disabled={!enabled || isJobRunning} 
          className="bg-background"
          ref={ref ? (ref as any).urlRef : null}
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
          ref={ref ? (ref as any).depthRef : null}
        />
        {title.toLowerCase() === "mps" && (
          <p className="text-xs text-gray-500 mt-1">
            For MPs, use a lower depth (1-2) to avoid resource limits
          </p>
        )}
      </div>
      
      <div className="grid w-full items-center gap-1.5">
        <Label htmlFor={`maxitems-${title}`}>Max Items (optional)</Label>
        <Input 
          id={`maxitems-${title}`} 
          type="number" 
          defaultValue={title.toLowerCase() === "mps" ? "100" : "200"} 
          min="10" 
          max={title.toLowerCase() === "mps" ? "200" : "500"} 
          disabled={!enabled || isJobRunning} 
          className="bg-background"
          ref={ref ? (ref as any).maxItemsRef : null}
        />
        <p className="text-xs text-gray-500 mt-1">
          Leave at default or increase to get more data (may increase time)
        </p>
      </div>
    </div>
  );
}));

ScrapeConfigForm.displayName = 'ScrapeConfigForm';

export { ScrapeConfigForm };
export default ScrapeConfigForm;
