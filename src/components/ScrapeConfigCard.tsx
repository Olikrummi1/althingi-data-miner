
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useState, useRef } from "react";
import { toast } from "sonner";

type ScrapeConfigCardProps = {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  onScrape: (config: { url: string; depth: number }) => Promise<void>;
};

const ScrapeConfigCard = ({
  title,
  description,
  enabled,
  onToggle,
  onScrape
}: ScrapeConfigCardProps) => {
  const [isLoading, setIsLoading] = useState(false);
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
        return "https://www.althingi.is/thingmenn/althingismenn/";  // Updated to correct MPs URL
      case "committees":
        return "https://www.althingi.is/thingnefndir/fastanefndir/";
      case "issues":
        return "https://www.althingi.is/thingstorf/thingmalalistar-eftir-thingum/";
      default:
        return `https://www.althingi.is/`;
    }
  };

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
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow">
        <div className="space-y-4">
          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor={`url-${title}`}>URL</Label>
            <Input 
              id={`url-${title}`} 
              defaultValue={getDefaultUrl()}
              disabled={!enabled} 
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
              disabled={!enabled} 
              className="bg-background"
              ref={depthRef}
            />
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button 
          className="w-full bg-althingi-blue hover:bg-althingi-darkBlue" 
          disabled={!enabled || isLoading} 
          onClick={handleScrape}
        >
          {isLoading ? "Scraping..." : "Start Scrape"}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default ScrapeConfigCard;
