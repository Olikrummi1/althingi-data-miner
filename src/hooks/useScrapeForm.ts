
import { useRef, useState } from "react";
import { toast } from "sonner";

type ScrapeFormProps = {
  title: string;
  onScrape: (config: { url: string; depth: number }) => Promise<void>;
  enabled: boolean;
  defaultUrl: string;
  onError?: (error: any) => void;
};

export function useScrapeForm({ title, onScrape, enabled, defaultUrl, onError }: ScrapeFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const urlRef = useRef<HTMLInputElement>(null);
  const depthRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!enabled) {
      toast.error(`${title} scraper is disabled`);
      return;
    }
    
    if (!urlRef.current || !depthRef.current) {
      toast.error("Missing required form fields");
      return;
    }
    
    const url = urlRef.current.value.trim();
    const depthValue = depthRef.current.value.trim();
    
    if (!url) {
      toast.error("URL is required");
      return;
    }
    
    if (!depthValue) {
      toast.error("Depth is required");
      return;
    }
    
    const depth = parseInt(depthValue);
    
    if (isNaN(depth) || depth < 1) {
      toast.error("Depth must be a number greater than 0");
      return;
    }
    
    try {
      setIsLoading(true);
      
      if (title.toLowerCase() === "mps" && depth > 2) {
        toast.warning("MPs scraper might hit resource limits with depth > 2. Consider lowering the depth.");
      }
      
      await onScrape({ url, depth });
    } catch (error) {
      console.error(`Error scraping ${title}:`, error);
      if (onError) {
        onError(error);
      } else {
        toast.error(`Error scraping ${title}: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    urlRef,
    depthRef,
    handleSubmit
  };
}
