
import StatusCard from "@/components/StatusCard";
import RecentItemsList from "@/components/RecentItemsList";
import DataStatsChart from "@/components/DataStatsChart";
import Header from "@/components/Header";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  getRecentItems, 
  getItemCountsByType, 
  getTotalItemsCount, 
  getLastScrapedDate,
  purgeScrapedItems
} from "@/services/scrapedItemsService";
import { getLatestScrapeJob, getScrapingSpeed } from "@/services/scrapeJobsService";
import { format } from "date-fns";
import { type RecentItem } from "@/components/RecentItemsList";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

const Index = () => {
  const { t } = useLanguage();
  const [scrapeStatus, setScrapeStatus] = useState<"idle" | "running" | "completed" | "failed">("idle");
  const [isPurging, setIsPurging] = useState(false);
  
  // Fetch recent items with refetch interval
  const { 
    data: recentItems = [], 
    refetch: refetchRecentItems
  } = useQuery({
    queryKey: ['recentItems'],
    queryFn: () => getRecentItems(7),
    refetchInterval: 10000  // Refetch every 10 seconds
  });
  
  // Fetch data stats for chart with refetch interval
  const { 
    data: chartData = [],
    refetch: refetchChartData
  } = useQuery({
    queryKey: ['itemCountsByType'],
    queryFn: getItemCountsByType,
    refetchInterval: 10000
  });
  
  // Fetch total items count with refetch interval
  const { 
    data: totalItems = 0,
    refetch: refetchTotalItems
  } = useQuery({
    queryKey: ['totalItemsCount'],
    queryFn: getTotalItemsCount,
    refetchInterval: 10000
  });
  
  // Fetch last scraped date
  const { 
    data: lastScrapedDate,
    refetch: refetchLastScrapedDate
  } = useQuery({
    queryKey: ['lastScrapedDate'],
    queryFn: getLastScrapedDate,
    refetchInterval: 10000
  });
  
  // Fetch scraping speed
  const { 
    data: scrapingSpeed,
    refetch: refetchScrapingSpeed
  } = useQuery({
    queryKey: ['scrapingSpeed'],
    queryFn: getScrapingSpeed,
    refetchInterval: 10000
  });
  
  // Check latest scrape job status
  useEffect(() => {
    const checkLatestJob = async () => {
      const latestJob = await getLatestScrapeJob();
      if (latestJob) {
        setScrapeStatus(latestJob.status as any);
      }
    };
    
    checkLatestJob();
    
    // Poll for status updates if a job is running
    const intervalId = setInterval(() => {
      if (scrapeStatus === "running") {
        checkLatestJob();
      }
    }, 5000);
    
    return () => clearInterval(intervalId);
  }, [scrapeStatus]);
  
  // Format the last scraped date
  const formattedLastScrapedDate = lastScrapedDate 
    ? format(new Date(lastScrapedDate), "d MMM, HH:mm")
    : "Never";
  
  // Map the database items to the format expected by RecentItemsList
  const mappedRecentItems: RecentItem[] = recentItems.map(item => ({
    id: item.id,
    type: item.type as RecentItem["type"],
    title: item.title,
    timestamp: format(new Date(item.scraped_at || new Date()), "yyyy-MM-dd HH:mm"),
    url: item.url
  }));

  const handlePurgeData = async () => {
    try {
      setIsPurging(true);
      await purgeScrapedItems();
      toast.success("Successfully purged all mock data");
      
      // Refetch all data
      await Promise.all([
        refetchRecentItems(),
        refetchChartData(),
        refetchTotalItems(),
        refetchLastScrapedDate(),
        refetchScrapingSpeed()
      ]);
    } catch (error) {
      console.error("Error purging data:", error);
      toast.error("Failed to purge data");
    } finally {
      setIsPurging(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="container mx-auto py-6 px-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">{t('dashboard')}</h2>
          <Button
            variant="destructive"
            size="sm"
            onClick={handlePurgeData}
            disabled={isPurging}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {isPurging ? "Purging..." : "Purge Mock Data"}
          </Button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <StatusCard 
            title={t('totalItemsScraped')} 
            value={totalItems.toString()} 
            description={t('totalRecordsDescription')} 
            status={scrapeStatus}
          />
          <StatusCard 
            title={t('lastScrape')} 
            value={formattedLastScrapedDate} 
            description={t('lastScrapeDescription')} 
            status="completed"
          />
          <StatusCard 
            title={t('scrapeSpeed')} 
            value={scrapingSpeed ? `${scrapingSpeed}/s` : "N/A"} 
            description={t('scrapeSpeedDescription')} 
          />
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DataStatsChart data={chartData.length > 0 ? chartData : []} />
          <RecentItemsList items={mappedRecentItems} />
        </div>
      </main>
    </div>
  );
};

export default Index;
