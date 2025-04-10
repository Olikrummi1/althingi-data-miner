
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import StatusCard from "@/components/StatusCard";

interface ScraperDashboardProps {
  isRunningAll: boolean;
  isSettingsLoading: boolean;
  runningJobsCount: number;
  totalItemsScraped: number;
  onRunAll: () => void;
}

const ScraperDashboard = ({
  isRunningAll,
  isSettingsLoading,
  runningJobsCount,
  totalItemsScraped,
  onRunAll
}: ScraperDashboardProps) => {
  const { t } = useLanguage();

  return (
    <div className="flex justify-between items-center mb-6">
      <h2 className="text-2xl font-bold">{t('configureScraper')}</h2>
      <div className="flex space-x-2">
        {runningJobsCount > 0 && (
          <StatusCard 
            title={t('activeJobs')}
            value={runningJobsCount.toString()}
            description={`${totalItemsScraped} ${t('itemsScraped')}`}
            status="running"
          />
        )}
        <Button 
          onClick={onRunAll} 
          disabled={isRunningAll || isSettingsLoading || runningJobsCount > 0}
          className="bg-althingi-blue hover:bg-althingi-darkBlue"
        >
          {isRunningAll ? t('runningAll') : t('runAllEnabled')}
        </Button>
      </div>
    </div>
  );
};

export default ScraperDashboard;
