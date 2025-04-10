
import { useState, useRef, RefObject } from "react";
import { toast } from "sonner";

type UseScrapeFormProps = {
  title: string;
  onScrape: (config: { url: string; depth: number }) => Promise<void>;
  enabled: boolean;
  defaultUrl: string;
};

export function useScrapeForm({ 
  title, 
  onScrape, 
  enabled, 
  defaultUrl 
}: UseScrapeFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const urlRef = useRef<HTMLInputElement>(null);
  const depthRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!enabled) return;
    
    const url = urlRef.current?.value || defaultUrl;
    const depthValue = depthRef.current?.value || "2";
    const depth = parseInt(depthValue, 10);
    
    setIsLoading(true);
    
    try {
      await onScrape({ url, depth });
      toast.success(`Started scraping ${title}`);
    } catch (error) {
      console.error(`Error scraping ${title}:`, error);
      toast.error(`Error starting ${title} scraper: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    urlRef,
    depthRef,
    handleSubmit,
  };
}
