
import React, { memo } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import ScrapeConfigForm from "@/components/scraper/ScrapeConfigForm";
import ScrapeStatusBadge from "@/components/scraper/ScrapeStatusBadge";
import ScrapeActionButton from "@/components/scraper/ScrapeActionButton";

type ScrapeConfigCardProps = {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  onScrape: (config: { url: string; depth: number }) => Promise<void>;
  activeJob?: { id: string; status: string; started_at: string; items_scraped?: number } | null;
  scrapeJobId?: string | null;
};

const ScrapeConfigCard = memo(({
  title,
  description,
  enabled,
  onToggle,
  onScrape,
  activeJob,
  scrapeJobId
}: ScrapeConfigCardProps) => {
  const { t } = useLanguage();
  const jobStatus = activeJob?.status || null;
  const isJobRunning = jobStatus === "running" || jobStatus === "pending";

  const getDefaultUrl = () => {
    switch (title.toLowerCase()) {
      case "bills":
        return "https://www.althingi.is/thingstorf/thingmalalistar-eftir-thingum/";
      case "votes":
        return "https://www.althingi.is/thingstorf/atkvaedagreidslur/";
      case "speeches":
        return "https://www.althingi.is/altext/raedur/";
      case "mps":
        return "https://www.althingi.is/thingmenn/althingismenn/";
      case "committees":
        return "https://www.althingi.is/thingnefndir/fastanefndir/";
      case "issues":
        return "https://www.althingi.is/thingstorf/thingmalalistar-eftir-thingum/";
      default:
        return `https://www.althingi.is/`;
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{title}</CardTitle>
          <ScrapeConfigToggle enabled={enabled} onToggle={onToggle} />
        </div>
        <div className="flex items-center justify-between">
          <CardDescription>{description}</CardDescription>
          <ScrapeStatusBadge status={jobStatus} itemsScraped={activeJob?.items_scraped} />
        </div>
      </CardHeader>
      <CardContent className="flex-grow">
        <ScrapeConfigForm 
          title={title}
          enabled={enabled}
          isJobRunning={isJobRunning}
          defaultUrl={getDefaultUrl()}
          onScrape={onScrape}
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

ScrapeConfigCard.displayName = 'ScrapeConfigCard';

export default ScrapeConfigCard;
