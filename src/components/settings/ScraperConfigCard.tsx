
import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { updateScrapeSettings } from "@/services/scrapeSettingsService";
import type { ScrapeSettings } from "@/services/scrapeSettingsService";

interface ScraperConfigCardProps {
  settings: ScrapeSettings;
  setSettings: React.Dispatch<React.SetStateAction<ScrapeSettings>>;
}

const ScraperConfigCard = ({ settings, setSettings }: ScraperConfigCardProps) => {
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (key: keyof typeof settings, value: any) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSave = async () => {
    setIsLoading(true);
    
    const success = await updateScrapeSettings(settings);
    
    setIsLoading(false);
    
    if (success) {
      toast.success("Settings saved successfully");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('scraperConfiguration')}</CardTitle>
        <CardDescription>{t('scraperConfigDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4">
          <div className="grid grid-cols-2 items-center gap-4">
            <Label htmlFor="concurrency">{t('concurrency')}</Label>
            <Input 
              id="concurrency" 
              type="number" 
              min="1" 
              max="20" 
              value={settings.concurrency}
              onChange={(e) => handleChange('concurrency', parseInt(e.target.value))}
            />
          </div>
          
          <div className="grid grid-cols-2 items-center gap-4">
            <Label htmlFor="throttle">{t('throttle')}</Label>
            <Input 
              id="throttle" 
              type="number" 
              min="0" 
              max="10000" 
              step="100" 
              value={settings.throttle}
              onChange={(e) => handleChange('throttle', parseInt(e.target.value))}
            />
          </div>
          
          <div className="grid grid-cols-2 items-center gap-4">
            <Label htmlFor="timeout_seconds">{t('timeout')}</Label>
            <Input 
              id="timeout_seconds" 
              type="number" 
              min="5" 
              max="120" 
              value={settings.timeout_seconds}
              onChange={(e) => handleChange('timeout_seconds', parseInt(e.target.value))}
            />
          </div>
          
          <div className="grid grid-cols-2 items-center gap-4">
            <Label htmlFor="max_depth">{t('maxDepth')}</Label>
            <Input 
              id="max_depth" 
              type="number" 
              min="1" 
              max="10" 
              value={settings.max_depth}
              onChange={(e) => handleChange('max_depth', parseInt(e.target.value))}
            />
          </div>
          
          <div className="grid grid-cols-2 items-center gap-4">
            <Label htmlFor="user_agent">{t('userAgent')}</Label>
            <Input 
              id="user_agent" 
              value={settings.user_agent}
              onChange={(e) => handleChange('user_agent', e.target.value)}
            />
          </div>
        </div>
        
        <Separator />
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="respect_robots_txt">{t('respectRobotsTxt')}</Label>
            <Switch 
              id="respect_robots_txt" 
              checked={settings.respect_robots_txt}
              onCheckedChange={(checked) => handleChange('respect_robots_txt', checked)}
              className="data-[state=checked]:bg-althingi-blue"
            />
          </div>
          
          <div className="flex items-center justify-between">
            <Label htmlFor="save_raw_html">{t('saveRawHtml')}</Label>
            <Switch 
              id="save_raw_html" 
              checked={settings.save_raw_html}
              onCheckedChange={(checked) => handleChange('save_raw_html', checked)}
              className="data-[state=checked]:bg-althingi-blue"
            />
          </div>
          
          <div className="flex items-center justify-between">
            <Label htmlFor="enable_notifications">{t('enableNotifications')}</Label>
            <Switch 
              id="enable_notifications" 
              checked={settings.enable_notifications}
              onCheckedChange={(checked) => handleChange('enable_notifications', checked)}
              className="data-[state=checked]:bg-althingi-blue"
            />
          </div>
          
          <div className="flex items-center justify-between">
            <Label htmlFor="retry_failed">{t('retryFailed')}</Label>
            <Switch 
              id="retry_failed" 
              checked={settings.retry_failed}
              onCheckedChange={(checked) => handleChange('retry_failed', checked)}
              className="data-[state=checked]:bg-althingi-blue"
            />
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button 
          className="w-full bg-althingi-blue hover:bg-althingi-darkBlue" 
          onClick={handleSave}
          disabled={isLoading}
        >
          {isLoading ? t('saving') : t('saveSettings')}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default ScraperConfigCard;
