
import StatusCard from "@/components/StatusCard";
import RecentItemsList from "@/components/RecentItemsList";
import DataStatsChart from "@/components/DataStatsChart";
import Header from "@/components/Header";
import { useState } from "react";

const mockRecentItems = [
  {
    id: "1",
    type: "bill" as const,
    title: "Frumvarp til laga um breytingu á lögum um þingfararkaup alþingismanna",
    timestamp: "2025-04-10 10:15",
    url: "https://althingi.is/thingstorf/thingmalalistar-eftir-thingum/ferill/"
  },
  {
    id: "2",
    type: "vote" as const,
    title: "Atkvæðagreiðsla um frumvarp til laga um vernd, friðun og veiðar á villtum fuglum og villtum spendýrum",
    timestamp: "2025-04-09 15:30",
    url: "https://althingi.is/thingstorf/thingmalalistar-eftir-thingum/atkvaedagreidslur/"
  },
  {
    id: "3",
    type: "speech" as const,
    title: "Ræða forsætisráðherra um stöðu efnahagsmála",
    timestamp: "2025-04-09 13:45",
    url: "https://althingi.is/thingstorf/thingmalalistar-eftir-thingum/raedur/"
  },
  {
    id: "4",
    type: "bill" as const,
    title: "Frumvarp til laga um breytingu á lögum um húsnæðismál",
    timestamp: "2025-04-08 11:20",
    url: "https://althingi.is/thingstorf/thingmalalistar-eftir-thingum/ferill/"
  },
  {
    id: "5",
    type: "vote" as const,
    title: "Atkvæðagreiðsla um þingsályktunartillögu um stefnu í loftslagsmálum",
    timestamp: "2025-04-08 09:10",
    url: "https://althingi.is/thingstorf/thingmalalistar-eftir-thingum/atkvaedagreidslur/"
  },
  {
    id: "6",
    type: "speech" as const,
    title: "Ræða umhverfisráðherra um náttúruvernd",
    timestamp: "2025-04-07 14:25",
    url: "https://althingi.is/thingstorf/thingmalalistar-eftir-thingum/raedur/"
  },
  {
    id: "7",
    type: "bill" as const,
    title: "Frumvarp til laga um breytingu á barnalögum",
    timestamp: "2025-04-07 10:40",
    url: "https://althingi.is/thingstorf/thingmalalistar-eftir-thingum/ferill/"
  }
];

const mockChartData = [
  { name: "Bills", count: 124 },
  { name: "Votes", count: 87 },
  { name: "Speeches", count: 356 },
  { name: "MPs", count: 63 },
  { name: "Committees", count: 12 }
];

const Index = () => {
  const [scrapeStatus, setScrapeStatus] = useState<"idle" | "running" | "completed" | "failed">("idle");
  
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="container mx-auto py-6 px-4">
        <h2 className="text-2xl font-bold mb-6">Dashboard</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <StatusCard 
            title="Total Items Scraped" 
            value="642" 
            description="Total number of records in the database" 
            status={scrapeStatus}
          />
          <StatusCard 
            title="Last Scrape" 
            value="10 Apr, 10:15" 
            description="Time of the last successful scrape" 
            status="completed"
          />
          <StatusCard 
            title="Scrape Speed" 
            value="12.3/s" 
            description="Average items scraped per second" 
          />
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DataStatsChart data={mockChartData} />
          <RecentItemsList items={mockRecentItems} />
        </div>
      </main>
    </div>
  );
};

export default Index;
