
import React, { useRef, memo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ScrapeConfigFormProps = {
  title: string;
  enabled: boolean;
  isJobRunning: boolean;
  defaultUrl: string;
  onScrape: (config: { url: string; depth: number }) => Promise<void>;
};

const ScrapeConfigForm = memo(({ 
  title, 
  enabled, 
  isJobRunning, 
  defaultUrl 
}: ScrapeConfigFormProps) => {
  const urlRef = useRef<HTMLInputElement>(null);
  const depthRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-4">
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
    </div>
  );
});

ScrapeConfigForm.displayName = 'ScrapeConfigForm';

export { ScrapeConfigForm };
export default ScrapeConfigForm;
