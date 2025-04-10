
import { useState } from "react";
import ScrapeConfigCard from "@/components/ScrapeConfigCard";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const scraperConfigs = [
  {
    id: "bills",
    title: "Bills & Legislation",
    description: "Scrape bills, amendments, and legislative documents"
  },
  {
    id: "votes",
    title: "Voting Records",
    description: "Collect MP voting records on bills and proposals"
  },
  {
    id: "speeches",
    title: "Parliamentary Speeches",
    description: "Gather speeches and discussions from parliament sessions"
  },
  {
    id: "mps",
    title: "Members of Parliament",
    description: "Information about past and present MPs"
  },
  {
    id: "committees",
    title: "Committees",
    description: "Committee data, members and activities"
  },
  {
    id: "issues",
    title: "Parliamentary Issues",
    description: "Track issues discussed in parliament"
  }
];

const ScraperPage = () => {
  const [enabledScrapers, setEnabledScrapers] = useState<Record<string, boolean>>({
    bills: true,
    votes: true,
    speeches: false,
    mps: true,
    committees: false,
    issues: false
  });
  
  const [isRunningAll, setIsRunningAll] = useState(false);

  const toggleScraper = (id: string, enabled: boolean) => {
    setEnabledScrapers(prev => ({
      ...prev,
      [id]: enabled
    }));
  };

  const handleScrape = (id: string) => {
    console.log(`Scraping ${id}`);
  };

  const runAllEnabled = () => {
    const enabledCount = Object.values(enabledScrapers).filter(Boolean).length;
    
    if (enabledCount === 0) {
      toast.error("Please enable at least one scraper");
      return;
    }
    
    setIsRunningAll(true);
    
    toast.success(`Started scraping ${enabledCount} data categories`);
    
    // Simulate completion
    setTimeout(() => {
      setIsRunningAll(false);
      toast.success("All scraping tasks completed");
    }, 3000);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="container mx-auto py-6 px-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Configure Scrapers</h2>
          <Button 
            onClick={runAllEnabled} 
            disabled={isRunningAll}
            className="bg-althingi-blue hover:bg-althingi-darkBlue"
          >
            {isRunningAll ? "Running All..." : "Run All Enabled"}
          </Button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {scraperConfigs.map(config => (
            <ScrapeConfigCard
              key={config.id}
              title={config.title}
              description={config.description}
              enabled={enabledScrapers[config.id] || false}
              onToggle={(enabled) => toggleScraper(config.id, enabled)}
              onScrape={() => handleScrape(config.id)}
            />
          ))}
        </div>
      </main>
    </div>
  );
};

export default ScraperPage;
