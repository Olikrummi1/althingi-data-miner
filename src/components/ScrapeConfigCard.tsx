
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { toast } from "sonner";

type ScrapeConfigCardProps = {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  onScrape: () => void;
};

const ScrapeConfigCard = ({
  title,
  description,
  enabled,
  onToggle,
  onScrape
}: ScrapeConfigCardProps) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleScrape = async () => {
    setIsLoading(true);
    
    try {
      // Call the scrape function
      await onScrape();
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
              defaultValue="https://althingi.is/" 
              disabled={!enabled} 
              className="bg-background"
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
