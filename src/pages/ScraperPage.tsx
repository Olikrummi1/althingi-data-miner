
import { useState, useEffect } from "react";
import ScrapeConfigCard from "@/components/ScrapeConfigCard";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { createScrapeJob } from "@/services/scrapeJobsService";
import { getScrapeSettings } from "@/services/scrapeSettingsService";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

const scraperConfigs = [
  {
    id: "bills",
    titleKey: "bills",
    descriptionKey: "billsDescription"
  },
  {
    id: "votes",
    titleKey: "votes",
    descriptionKey: "votesDescription"
  },
  {
    id: "speeches",
    titleKey: "speeches",
    descriptionKey: "speechesDescription"
  },
  {
    id: "mps",
    titleKey: "mps",
    descriptionKey: "mpsDescription"
  },
  {
    id: "committees",
    titleKey: "committees",
    descriptionKey: "committeesDescription"
  },
  {
    id: "issues",
    titleKey: "issues",
    descriptionKey: "issuesDescription"
  }
];

const ScraperPage = () => {
  const { t } = useLanguage();
  const [enabledScrapers, setEnabledScrapers] = useState<Record<string, boolean>>({
    bills: true,
    votes: true,
    speeches: false,
    mps: true,
    committees: false,
    issues: false
  });
  
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const [isSettingsLoading, setIsSettingsLoading] = useState(true);

  // Load scrape settings
  useEffect(() => {
    const loadSettings = async () => {
      setIsSettingsLoading(true);
      try {
        const settings = await getScrapeSettings();
        if (settings) {
          setSettings(settings);
        }
      } catch (error) {
        console.error("Error loading settings:", error);
        toast.error("Failed to load scraper settings");
      } finally {
        setIsSettingsLoading(false);
      }
    };
    
    loadSettings();
  }, []);

  const toggleScraper = (id: string, enabled: boolean) => {
    setEnabledScrapers(prev => ({
      ...prev,
      [id]: enabled
    }));
  };

  const handleScrape = async (id: string, config: { url: string; depth: number }) => {
    if (!settings) {
      toast.error("Scrape settings not loaded");
      return;
    }
    
    try {
      // Create a scrape job in the database with the provided config
      const job = await createScrapeJob(id as any, {
        url: config.url,
        depth: config.depth,
        ...settings
      });
      
      if (!job) {
        throw new Error("Failed to create scrape job");
      }
      
      // Call the edge function to start scraping
      const { data, error } = await supabase.functions.invoke("run-scraper", {
        body: { 
          type: id, 
          jobId: job.id,
          config: {
            ...settings,
            url: config.url,
            depth: config.depth
          }
        }
      });
      
      if (error) {
        console.error("Error invoking scraper function:", error);
        throw new Error(`Failed to send a request to the Edge Function: ${error.message}`);
      }
      
      toast.success(`Started scraping ${t(id)}`);
      return data;
    } catch (error) {
      console.error("Error invoking scraper function:", error);
      throw error;
    }
  };

  const runAllEnabled = async () => {
    const enabledScraperIds = Object.entries(enabledScrapers)
      .filter(([_, enabled]) => enabled)
      .map(([id]) => id);
    
    const enabledCount = enabledScraperIds.length;
    
    if (enabledCount === 0) {
      toast.error("Please enable at least one scraper");
      return;
    }
    
    setIsRunningAll(true);
    toast.success(`Started scraping ${enabledCount} data categories`);
    
    let successCount = 0;
    let errorCount = 0;
    
    // Run each enabled scraper
    for (const id of enabledScraperIds) {
      try {
        // Use default config for batch scraping
        await handleScrape(id, { url: `https://althingi.is/${id}`, depth: 2 });
        successCount++;
      } catch (error) {
        console.error(`Error scraping ${id}:`, error);
        errorCount++;
      }
    }
    
    setIsRunningAll(false);
    
    if (errorCount === 0) {
      toast.success("All scraping tasks completed successfully");
    } else if (successCount === 0) {
      toast.error("All scraping tasks failed");
    } else {
      toast.warning(`${successCount} scraping tasks completed, ${errorCount} failed`);
    }
  };

  if (isSettingsLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="container mx-auto py-6 px-4">
          <div className="flex items-center justify-center h-[70vh]">
            <p className="text-lg text-gray-500">{t('loading')}</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="container mx-auto py-6 px-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">{t('configureScraper')}</h2>
          <Button 
            onClick={runAllEnabled} 
            disabled={isRunningAll || isSettingsLoading}
            className="bg-althingi-blue hover:bg-althingi-darkBlue"
          >
            {isRunningAll ? t('runningAll') : t('runAllEnabled')}
          </Button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {scraperConfigs.map(config => (
            <ScrapeConfigCard
              key={config.id}
              title={t(config.titleKey)}
              description={t(config.descriptionKey)}
              enabled={enabledScrapers[config.id] || false}
              onToggle={(enabled) => toggleScraper(config.id, enabled)}
              onScrape={(configValues) => handleScrape(config.id, configValues)}
            />
          ))}
        </div>
      </main>
    </div>
  );
};

export default ScraperPage;
