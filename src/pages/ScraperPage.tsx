import { useState, useEffect } from "react";
import ScrapeConfigCard from "@/components/ScrapeConfigCard";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { createScrapeJob } from "@/services/scrapeJobsService";
import { getScrapeSettings } from "@/services/scrapeSettingsService";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import StatusCard from "@/components/StatusCard";
import { Loader2 } from "lucide-react";

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
  const [activeJobs, setActiveJobs] = useState<Record<string, any>>({});
  const [isLoadingJobs, setIsLoadingJobs] = useState(true);
  const [totalItemsScraped, setTotalItemsScraped] = useState(0);

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

  // Load active jobs
  useEffect(() => {
    const loadActiveJobs = async () => {
      setIsLoadingJobs(true);
      try {
        // Get any jobs that are running or pending
        const { data, error } = await supabase
          .from("scrape_jobs")
          .select("*")
          .in("status", ["running", "pending"])
          .order("created_at", { ascending: false });
        
        if (error) {
          throw error;
        }
        
        // Group jobs by type
        const jobsByType: Record<string, any> = {};
        let totalItems = 0;
        
        if (data && data.length > 0) {
          data.forEach(job => {
            // Only keep the most recent job for each type
            if (!jobsByType[job.type] || new Date(job.created_at) > new Date(jobsByType[job.type].created_at)) {
              jobsByType[job.type] = job;
            }
            
            if (job.items_scraped) {
              totalItems += job.items_scraped;
            }
          });
        }
        
        setActiveJobs(jobsByType);
        setTotalItemsScraped(totalItems);
      } catch (error) {
        console.error("Error loading active jobs:", error);
        toast.error("Failed to load active scraper jobs");
      } finally {
        setIsLoadingJobs(false);
      }
    };
    
    loadActiveJobs();
    
    // Set up polling to check for active jobs
    const intervalId = setInterval(loadActiveJobs, 5000);
    
    return () => clearInterval(intervalId);
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
      
      // Update active jobs
      setActiveJobs(prev => ({
        ...prev,
        [id]: { 
          ...job,
          status: "running"
        }
      }));
      
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
      toast.success("All scraping tasks started successfully");
    } else if (successCount === 0) {
      toast.error("All scraping tasks failed to start");
    } else {
      toast.warning(`${successCount} scraping tasks started, ${errorCount} failed`);
    }
  };

  // Count running jobs
  const runningJobsCount = Object.values(activeJobs).length;

  if (isSettingsLoading || isLoadingJobs) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="container mx-auto py-6 px-4">
          <div className="flex items-center justify-center h-[70vh]">
            <div className="flex flex-col items-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-althingi-blue" />
              <p className="text-lg text-gray-500">{t('loading')}</p>
            </div>
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
          <div className="flex space-x-2">
            {runningJobsCount > 0 && (
              <StatusCard 
                title={t('activeJobs')}
                value={runningJobsCount.toString()}
                description={`${totalItemsScraped} ${t('itemsScraped')}`}
                status="running"
              />
            )}
            <Button 
              onClick={runAllEnabled} 
              disabled={isRunningAll || isSettingsLoading || runningJobsCount > 0}
              className="bg-althingi-blue hover:bg-althingi-darkBlue"
            >
              {isRunningAll ? t('runningAll') : t('runAllEnabled')}
            </Button>
          </div>
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
              activeJob={activeJobs[config.id] || null}
            />
          ))}
        </div>
      </main>
    </div>
  );
};

export default ScraperPage;
