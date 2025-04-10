
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Vote, User, Users, Folder, Bookmark, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export type RecentItem = {
  id: string;
  type: "bill" | "vote" | "speech" | "mp" | "committee" | "issue";
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
      case "mp":
        return <User className="h-4 w-4 text-althingi-blue" />;
      case "committee":
        return <Users className="h-4 w-4 text-althingi-blue" />;
      case "issue":
        return <Folder className="h-4 w-4 text-althingi-blue" />;
      default:
        return <Bookmark className="h-4 w-4 text-althingi-blue" />;
    }
  };

  // Ensure URL is complete with https if not already
  const formatUrl = (url: string) => {
    if (!url) return "#";
    if (url.startsWith("http")) return url;
    return url.startsWith("/") 
      ? `https://www.althingi.is${url}` 
      : `https://www.althingi.is/${url}`;
  };

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, url: string) => {
    // Check if URL seems valid before opening
    if (!url || url === "#") {
      e.preventDefault();
      toast.error("Invalid URL. This item may have been scraped incorrectly.");
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
          {items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No items have been scraped yet. Use the scraper tool to collect data.
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item) => (
                <div key={item.id} className="flex items-start space-x-4 border-b pb-4">
                  <div className="bg-althingi-lightBlue p-2 rounded">
                    {getIcon(item.type)}
                  </div>
                  <div className="space-y-1 flex-grow">
                    <p className="font-medium">{item.title}</p>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <span>{item.timestamp}</span>
                      <span className="mx-2">•</span>
                      <span className="capitalize">{item.type}</span>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    asChild
                  >
                    <a 
                      href={formatUrl(item.url)} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-1"
                      onClick={(e) => handleLinkClick(e, item.url)}
                    >
                      View <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default RecentItemsList;
