
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
import { Trash2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const Index = () => {
  const { t } = useLanguage();
  const [scrapeStatus, setScrapeStatus] = useState<"idle" | "running" | "completed" | "failed">("idle");
  const [isPurging, setIsPurging] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Fetch recent items with shorter refetch interval
  const { 
    data: recentItems = [], 
    refetch: refetchRecentItems,
    isLoading: isLoadingRecentItems
  } = useQuery({
    queryKey: ['recentItems'],
    queryFn: () => getRecentItems(10),
    refetchInterval: 3000  // Refetch every 3 seconds (reduced from 5s)
  });
  
  // Fetch data stats for chart with refetch interval
  const { 
    data: chartData = [],
    refetch: refetchChartData,
    isLoading: isLoadingChartData
  } = useQuery({
    queryKey: ['itemCountsByType'],
    queryFn: getItemCountsByType,
    refetchInterval: 3000
  });
  
  // Fetch total items count with refetch interval
  const { 
    data: totalItems = 0,
    refetch: refetchTotalItems,
    isLoading: isLoadingTotalItems
  } = useQuery({
    queryKey: ['totalItemsCount'],
    queryFn: getTotalItemsCount,
    refetchInterval: 3000
  });
  
  // Fetch last scraped date
  const { 
    data: lastScrapedDate,
    refetch: refetchLastScrapedDate,
    isLoading: isLoadingLastScrapedDate
  } = useQuery({
    queryKey: ['lastScrapedDate'],
    queryFn: getLastScrapedDate,
    refetchInterval: 3000
  });
  
  // Fetch scraping speed
  const { 
    data: scrapingSpeed,
    refetch: refetchScrapingSpeed,
    isLoading: isLoadingScrapingSpeed
  } = useQuery({
    queryKey: ['scrapingSpeed'],
    queryFn: getScrapingSpeed,
    refetchInterval: 3000
  });
  
  // Check latest scrape job status more frequently
  useEffect(() => {
    const checkLatestJob = async () => {
      try {
        const latestJob = await getLatestScrapeJob();
        if (latestJob) {
          setScrapeStatus(latestJob.status as any);
          
          // Force data refresh when a job is running
          if (latestJob.status === "running") {
            refetchAllData();
          }
        }
      } catch (error) {
        console.error("Error checking latest job:", error);
      }
    };
    
    checkLatestJob();
    
    // Poll for status updates more frequently
    const intervalId = setInterval(() => {
      checkLatestJob();
    }, 2000); // Reduced from 3000ms
    
    return () => clearInterval(intervalId);
  }, []);
  
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

  // Function to refetch all data
  const refetchAllData = async () => {
    await Promise.all([
      refetchRecentItems(),
      refetchChartData(),
      refetchTotalItems(),
      refetchLastScrapedDate(),
      refetchScrapingSpeed()
    ]);
  };

  const handlePurgeData = async () => {
    try {
      setIsPurging(true);
      const success = await purgeScrapedItems();
      
      if (success) {
        toast.success("Successfully purged all data");
      } else {
        toast.error("Failed to purge data");
      }
      
      // Refetch all data
      await refetchAllData();
    } catch (error) {
      console.error("Error purging data:", error);
      toast.error("Failed to purge data");
    } finally {
      setIsPurging(false);
    }
  };
  
  const handleRefreshData = async () => {
    try {
      setIsRefreshing(true);
      toast.info("Refreshing dashboard data...");
      
      // Refetch all data
      await refetchAllData();
      
      toast.success("Dashboard data refreshed");
    } catch (error) {
      console.error("Error refreshing data:", error);
      toast.error("Failed to refresh data");
    } finally {
      setIsRefreshing(false);
    }
  };
  
  const isLoading = isLoadingRecentItems || isLoadingChartData || isLoadingTotalItems || 
                    isLoadingLastScrapedDate || isLoadingScrapingSpeed;
  
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="container mx-auto py-6 px-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">{t('dashboard')}</h2>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshData}
              disabled={isRefreshing || isLoading}
              className="flex items-center"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? "Refreshing..." : "Refresh Data"}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handlePurgeData}
              disabled={isPurging || isLoading}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {isPurging ? "Purging..." : "Purge All Data"}
            </Button>
          </div>
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
