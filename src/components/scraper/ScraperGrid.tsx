
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

const ScraperGrid = ({
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
        />
      ))}
    </div>
  );
};

export default ScraperGrid;
