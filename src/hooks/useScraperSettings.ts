
import { useState, useEffect } from "react";
import { getScrapeSettings } from "@/services/scrapeSettingsService";
import type { ScrapeSettings } from "@/services/scrapeSettingsService";

const defaultSettings: ScrapeSettings = {
  concurrency: 5,
  throttle: 1000,
  respect_robots_txt: true,
  save_raw_html: true,
  enable_notifications: true,
  retry_failed: true,
  timeout_seconds: 30,
  max_depth: 3,
  user_agent: "AlthingiDataMiner/1.0 (https://yourdomain.com; info@yourdomain.com)",
  id: 1
};

export const useScraperSettings = () => {
  const [settings, setSettings] = useState<ScrapeSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      setIsLoading(true);
      const dbSettings = await getScrapeSettings();
      if (dbSettings) {
        setSettings(dbSettings);
      }
      setIsLoading(false);
    };
    
    loadSettings();
  }, []);

  return { settings, setSettings, isLoading };
};
