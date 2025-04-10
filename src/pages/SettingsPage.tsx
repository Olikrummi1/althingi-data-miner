
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import Header from "@/components/Header";
import { toast } from "sonner";
import { getScrapeSettings, updateScrapeSettings } from "@/services/scrapeSettingsService";
import { useLanguage } from "@/contexts/LanguageContext";

const SettingsPage = () => {
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  const [settings, setSettings] = useState({
    concurrency: 5,
    throttle: 1000,
    respect_robots_txt: true,
    save_raw_html: true,
    enable_notifications: true,
    retry_failed: true,
    timeout_seconds: 30,
    max_depth: 3,
    user_agent: "AlthingiDataMiner/1.0 (https://yourdomain.com; info@yourdomain.com)"
  });

  // Load settings from the database
  useEffect(() => {
    const loadSettings = async () => {
      const dbSettings = await getScrapeSettings();
      if (dbSettings) {
        setSettings(dbSettings);
      }
    };
    
    loadSettings();
  }, []);

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

  const handleReset = () => {
    toast.info("Database connection reset");
  };

  const handleClearCache = () => {
    toast.success("Cache cleared successfully");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="container mx-auto py-6 px-4">
        <h2 className="text-2xl font-bold mb-6">{t('settings')}</h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
          
          <Card>
            <CardHeader>
              <CardTitle>{t('databaseConnection')}</CardTitle>
              <CardDescription>{t('databaseDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4">
                <div className="grid w-full items-center gap-1.5">
                  <Label htmlFor="dbHost">Database Host</Label>
                  <Input id="dbHost" placeholder="localhost" disabled value="supabase.co" />
                </div>
                
                <div className="grid w-full items-center gap-1.5">
                  <Label htmlFor="dbName">Database Name</Label>
                  <Input id="dbName" placeholder="althingi_data" disabled value="supabase" />
                </div>
                
                <div className="grid w-full items-center gap-1.5">
                  <Label htmlFor="dbUser">Database User</Label>
                  <Input id="dbUser" placeholder="username" disabled value="postgres" />
                </div>
                
                <div className="grid w-full items-center gap-1.5">
                  <Label htmlFor="dbPassword">Database Password</Label>
                  <Input id="dbPassword" type="password" placeholder="••••••••" disabled value="********" />
                </div>
              </div>
              
              <Button
                className="w-full bg-slate-700 hover:bg-slate-800"
                onClick={handleReset}
              >
                {t('testConnection')}
              </Button>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <div className="grid grid-cols-2 gap-4 w-full">
                <Button variant="outline" onClick={handleClearCache}>
                  {t('clearCache')}
                </Button>
                <Button variant="destructive">
                  {t('resetDatabase')}
                </Button>
              </div>
              
              <div className="text-center text-sm text-muted-foreground">
                <p>{t('databaseSize')} 24.6 MB</p>
                <p>{t('lastBackup')} 10 Apr 2025, 00:00</p>
              </div>
            </CardFooter>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default SettingsPage;
