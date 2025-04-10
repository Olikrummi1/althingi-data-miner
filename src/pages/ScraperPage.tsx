
import Header from "@/components/Header";
import LoadingIndicator from "@/components/LoadingIndicator";
import ScraperDashboard from "@/components/scraper/ScraperDashboard";
import ScraperGrid from "@/components/scraper/ScraperGrid";
import useScraper, { scraperConfigs } from "@/hooks/useScraper";

const ScraperPage = () => {
  const {
    enabledScrapers,
    isRunningAll,
    isSettingsLoading,
    activeJobs,
    isLoadingJobs,
    totalItemsScraped,
    runningJobsCount,
    toggleScraper,
    handleScrape,
    runAllEnabled
  } = useScraper();

  if (isSettingsLoading || isLoadingJobs) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="container mx-auto py-6 px-4">
          <div className="flex items-center justify-center h-[70vh]">
            <LoadingIndicator size="large" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="container mx-auto py-6 px-4">
        <ScraperDashboard
          isRunningAll={isRunningAll}
          isSettingsLoading={isSettingsLoading}
          runningJobsCount={runningJobsCount}
          totalItemsScraped={totalItemsScraped}
          onRunAll={runAllEnabled}
        />
        
        <ScraperGrid
          configs={scraperConfigs}
          enabledScrapers={enabledScrapers}
          activeJobs={activeJobs}
          onToggle={toggleScraper}
          onScrape={handleScrape}
        />
      </main>
    </div>
  );
};

export default ScraperPage;
