
import { useEffect } from "react";
import Header from "@/components/Header";
import ScraperConfigCard from "@/components/settings/ScraperConfigCard";
import DatabaseCard from "@/components/settings/DatabaseCard";
import { useScraperSettings } from "@/hooks/useScraperSettings";
import { useLanguage } from "@/contexts/LanguageContext";

const SettingsPage = () => {
  const { t } = useLanguage();
  const { settings, setSettings, isLoading } = useScraperSettings();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="container mx-auto py-6 px-4">
          <div className="flex items-center justify-center h-[70vh]">
            <p className="text-lg text-gray-500">{t('loading')}</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="container mx-auto py-6 px-4">
        <h2 className="text-2xl font-bold mb-6">{t('settings')}</h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ScraperConfigCard settings={settings} setSettings={setSettings} />
          <DatabaseCard />
        </div>
      </main>
    </div>
  );
};

export default SettingsPage;
