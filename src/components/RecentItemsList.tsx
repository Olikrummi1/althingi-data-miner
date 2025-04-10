
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Vote } from "lucide-react";

type RecentItem = {
  id: string;
  type: "bill" | "vote" | "speech";
  title: string;
  timestamp: string;
  url: string;
};

const RecentItemsList = ({ items }: { items: RecentItem[] }) => {
  const getIcon = (type: RecentItem["type"]) => {
    switch (type) {
      case "bill":
        return <FileText className="h-4 w-4 text-althingi-blue" />;
      case "vote":
        return <Vote className="h-4 w-4 text-althingi-blue" />;
      case "speech":
        return <FileText className="h-4 w-4 text-althingi-blue" />;
      default:
        return <FileText className="h-4 w-4 text-althingi-blue" />;
    }
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Recently Scraped Items</CardTitle>
        <CardDescription>The latest content that has been scraped from althingi.is</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-4">
            {items.map((item) => (
              <div key={item.id} className="flex items-start space-x-4 border-b pb-4">
                <div className="bg-althingi-lightBlue p-2 rounded">
                  {getIcon(item.type)}
                </div>
                <div className="space-y-1">
                  <p className="font-medium">{item.title}</p>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <span>{item.timestamp}</span>
                    <span className="mx-2">•</span>
                    <a 
                      href={item.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-althingi-blue hover:underline"
                    >
                      View original
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default RecentItemsList;
