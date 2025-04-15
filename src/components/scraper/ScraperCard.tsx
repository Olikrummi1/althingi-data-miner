
import React, { memo } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrapeConfigForm } from "./ScrapeConfigForm";
import ScrapeStatusBadge from "./ScrapeStatusBadge";
import ScrapeConfigToggle from "./ScrapeConfigToggle";
import ScrapeActionButton from "./ScrapeActionButton";
import { useScraperJobStatus } from "@/hooks/useScraperJobStatus";
import { getDefaultUrl } from "@/utils/scraperUrls";

type ScrapeConfigCardProps = {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  onScrape: (config: { url: string; depth: number; maxItems?: number }) => Promise<void>;
  activeJob?: { id: string; status: string; started_at: string; items_scraped?: number } | null;
  scrapeJobId?: string | null;
};

const ScraperCard = memo(({
  title,
  description,
  enabled,
  onToggle,
  onScrape,
  activeJob,
  scrapeJobId
}: ScrapeConfigCardProps) => {
  const { jobStatus, itemsScraped, isJobRunning } = useScraperJobStatus(activeJob, title, scrapeJobId);
  const defaultUrl = getDefaultUrl(title);
  const isMpsScraper = title.toLowerCase() === "mps";

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{title}</CardTitle>
          <ScrapeConfigToggle enabled={enabled} onToggle={onToggle} />
        </div>
        <div className="flex items-center justify-between">
          <CardDescription>{description}</CardDescription>
          <ScrapeStatusBadge status={jobStatus} itemsScraped={itemsScraped} />
        </div>
      </CardHeader>
      <CardContent className="flex-grow">
        <ScrapeConfigForm 
          title={title}
          enabled={enabled}
          isJobRunning={isJobRunning}
          defaultUrl={defaultUrl}
          onScrape={onScrape}
          isMpsScraper={isMpsScraper}
        />
      </CardContent>
      <CardFooter>
        <ScrapeActionButton 
          isJobRunning={isJobRunning}
          enabled={enabled}
          title={title}
          activeJobId={activeJob?.id}
        />
      </CardFooter>
    </Card>
  );
});

ScraperCard.displayName = 'ScraperCard';

export default ScraperCard;
