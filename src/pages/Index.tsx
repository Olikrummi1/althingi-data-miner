
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
  getLastScrapedDate 
} from "@/services/scrapedItemsService";
import { getLatestScrapeJob, getScrapingSpeed } from "@/services/scrapeJobsService";
import { format } from "date-fns";

const Index = () => {
  const [scrapeStatus, setScrapeStatus] = useState<"idle" | "running" | "completed" | "failed">("idle");
  
  // Fetch recent items
  const { data: recentItems = [] } = useQuery({
    queryKey: ['recentItems'],
    queryFn: () => getRecentItems(7)
  });
  
  // Fetch data stats for chart
  const { data: chartData = [] } = useQuery({
    queryKey: ['itemCountsByType'],
    queryFn: getItemCountsByType
  });
  
  // Fetch total items count
  const { data: totalItems = 0 } = useQuery({
    queryKey: ['totalItemsCount'],
    queryFn: getTotalItemsCount
  });
  
  // Fetch last scraped date
  const { data: lastScrapedDate } = useQuery({
    queryKey: ['lastScrapedDate'],
    queryFn: getLastScrapedDate
  });
  
  // Fetch scraping speed
  const { data: scrapingSpeed } = useQuery({
    queryKey: ['scrapingSpeed'],
    queryFn: getScrapingSpeed
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
  
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="container mx-auto py-6 px-4">
        <h2 className="text-2xl font-bold mb-6">Dashboard</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <StatusCard 
            title="Total Items Scraped" 
            value={totalItems.toString()} 
            description="Total number of records in the database" 
            status={scrapeStatus}
          />
          <StatusCard 
            title="Last Scrape" 
            value={formattedLastScrapedDate} 
            description="Time of the last successful scrape" 
            status="completed"
          />
          <StatusCard 
            title="Scrape Speed" 
            value={scrapingSpeed ? `${scrapingSpeed}/s` : "N/A"} 
            description="Average items scraped per second" 
          />
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DataStatsChart data={chartData.length > 0 ? chartData : []} />
          <RecentItemsList items={recentItems.map(item => ({
            id: item.id,
            type: item.type,
            title: item.title,
            timestamp: format(new Date(item.scraped_at), "yyyy-MM-dd HH:mm"),
            url: item.url
          }))} />
        </div>
      </main>
    </div>
  );
};

export default Index;
