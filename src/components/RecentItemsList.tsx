
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Vote, User, Users, Folder, Bookmark, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export type RecentItem = {
  id: string;
  type: "bill" | "vote" | "speech" | "mp" | "committee" | "issue";
  title: string;
  timestamp: string;
  url: string;
  metadata?: Record<string, any>;
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

  // Enhanced URL validation and formatting
  const formatUrl = (url: string) => {
    if (!url) return "#";
    
    // Check if URL is well-formed
    try {
      // If it has a protocol, check if it's valid
      if (url.startsWith('http')) {
        new URL(url); // Will throw if invalid
        return url;
      }
      
      // Handle relative URLs
      if (url.startsWith("/")) {
        return `https://www.althingi.is${url}`;
      }
      
      // Add protocol if missing
      if (url.startsWith("www.")) {
        return `https://${url}`;
      }
      
      // Assume it's a path on althingi.is
      return `https://www.althingi.is/${url}`;
    } catch (e) {
      console.error("Invalid URL:", url, e);
      // Return a special marker for invalid URLs
      return "#invalid";
    }
  };

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, url: string) => {
    // Check if URL seems valid before opening
    const formattedUrl = formatUrl(url);
    if (!formattedUrl || formattedUrl === "#" || formattedUrl === "#invalid") {
      e.preventDefault();
      toast.error("Invalid URL. This item may have been scraped incorrectly.");
    }
  };

  // Helper to render MP-specific metadata if available
  const renderMpMetadata = (item: RecentItem) => {
    if (item.type !== "mp" || !item.metadata) return null;
    
    return (
      <div className="mt-2 space-y-1">
        {item.metadata.party && (
          <Badge variant="outline" className="mr-1">
            {item.metadata.party}
          </Badge>
        )}
        {item.metadata.constituency && (
          <Badge variant="outline" className="mr-1">
            {item.metadata.constituency}
          </Badge>
        )}
        {item.metadata.position && (
          <Badge variant="outline" className="text-xs">
            {item.metadata.position}
          </Badge>
        )}
        
        {/* Show MP image if available */}
        {item.metadata.imageUrl && (
          <div className="mt-2">
            <img 
              src={formatUrl(item.metadata.imageUrl)} 
              alt={`${item.title}`} 
              className="w-16 h-16 object-cover rounded-full"
              onError={(e) => {
                // Hide broken images
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        )}
      </div>
    );
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
                    {renderMpMetadata(item)}
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
