
import React, { memo } from 'react';
import { useLanguage } from "@/contexts/LanguageContext";
import ScrapeConfigCard from "@/components/ScrapeConfigCard";
import { ScraperConfig } from "@/hooks/useScraper";

interface ScraperGridProps {
  configs: ScraperConfig[];
  enabledScrapers: Record<string, boolean>;
  activeJobs: Record<string, any>;
  onToggle: (id: string, enabled: boolean) => void;
  onScrape: (id: string, config: { url: string; depth: number }) => Promise<void>;
}

// Using memo to prevent unnecessary re-renders of the grid itself
const ScraperGrid = memo(({
  configs,
  enabledScrapers,
  activeJobs,
  onToggle,
  onScrape
}: ScraperGridProps) => {
  const { t } = useLanguage();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {configs.map(config => (
        <ScrapeConfigCard
          key={config.id}
          title={t(config.titleKey)}
          description={t(config.descriptionKey)}
          enabled={enabledScrapers[config.id] || false}
          onToggle={(enabled) => onToggle(config.id, enabled)}
          onScrape={(configValues) => onScrape(config.id, configValues)}
          activeJob={activeJobs[config.id] || null}
          scrapeJobId={activeJobs[config.id]?.id || null}
        />
      ))}
    </div>
  );
});

ScraperGrid.displayName = 'ScraperGrid';

export default ScraperGrid;
