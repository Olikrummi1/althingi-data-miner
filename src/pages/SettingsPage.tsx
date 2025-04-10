
import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import Header from "@/components/Header";
import { toast } from "sonner";

const SettingsPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [settings, setSettings] = useState({
    concurrency: 5,
    throttle: 1000,
    respectRobotsTxt: true,
    saveRawHtml: true,
    enableNotifications: true,
    retryFailed: true,
    timeoutSeconds: 30,
    maxDepth: 3,
    userAgent: "AlthingiDataMiner/1.0 (https://yourdomain.com; info@yourdomain.com)"
  });

  const handleChange = (key: keyof typeof settings, value: any) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSave = () => {
    setIsLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      toast.success("Settings saved successfully");
    }, 1000);
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
        <h2 className="text-2xl font-bold mb-6">Settings</h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Scraper Configuration</CardTitle>
              <CardDescription>Control how the scraper behaves when extracting data</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4">
                <div className="grid grid-cols-2 items-center gap-4">
                  <Label htmlFor="concurrency">Concurrency</Label>
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
                  <Label htmlFor="throttle">Throttle (ms)</Label>
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
                  <Label htmlFor="timeoutSeconds">Request Timeout (s)</Label>
                  <Input 
                    id="timeoutSeconds" 
                    type="number" 
                    min="5" 
                    max="120" 
                    value={settings.timeoutSeconds}
                    onChange={(e) => handleChange('timeoutSeconds', parseInt(e.target.value))}
                  />
                </div>
                
                <div className="grid grid-cols-2 items-center gap-4">
                  <Label htmlFor="maxDepth">Max Crawl Depth</Label>
                  <Input 
                    id="maxDepth" 
                    type="number" 
                    min="1" 
                    max="10" 
                    value={settings.maxDepth}
                    onChange={(e) => handleChange('maxDepth', parseInt(e.target.value))}
                  />
                </div>
                
                <div className="grid grid-cols-2 items-center gap-4">
                  <Label htmlFor="userAgent">User Agent</Label>
                  <Input 
                    id="userAgent" 
                    value={settings.userAgent}
                    onChange={(e) => handleChange('userAgent', e.target.value)}
                  />
                </div>
              </div>
              
              <Separator />
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="respectRobotsTxt">Respect robots.txt</Label>
                  <Switch 
                    id="respectRobotsTxt" 
                    checked={settings.respectRobotsTxt}
                    onCheckedChange={(checked) => handleChange('respectRobotsTxt', checked)}
                    className="data-[state=checked]:bg-althingi-blue"
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="saveRawHtml">Save raw HTML</Label>
                  <Switch 
                    id="saveRawHtml" 
                    checked={settings.saveRawHtml}
                    onCheckedChange={(checked) => handleChange('saveRawHtml', checked)}
                    className="data-[state=checked]:bg-althingi-blue"
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="enableNotifications">Enable notifications</Label>
                  <Switch 
                    id="enableNotifications" 
                    checked={settings.enableNotifications}
                    onCheckedChange={(checked) => handleChange('enableNotifications', checked)}
                    className="data-[state=checked]:bg-althingi-blue"
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="retryFailed">Retry failed requests</Label>
                  <Switch 
                    id="retryFailed" 
                    checked={settings.retryFailed}
                    onCheckedChange={(checked) => handleChange('retryFailed', checked)}
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
                {isLoading ? "Saving..." : "Save Settings"}
              </Button>
            </CardFooter>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Database & Storage</CardTitle>
              <CardDescription>Configure database connection and manage data</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4">
                <div className="grid w-full items-center gap-1.5">
                  <Label htmlFor="dbHost">Database Host</Label>
                  <Input id="dbHost" placeholder="localhost" />
                </div>
                
                <div className="grid w-full items-center gap-1.5">
                  <Label htmlFor="dbName">Database Name</Label>
                  <Input id="dbName" placeholder="althingi_data" />
                </div>
                
                <div className="grid w-full items-center gap-1.5">
                  <Label htmlFor="dbUser">Database User</Label>
                  <Input id="dbUser" placeholder="username" />
                </div>
                
                <div className="grid w-full items-center gap-1.5">
                  <Label htmlFor="dbPassword">Database Password</Label>
                  <Input id="dbPassword" type="password" placeholder="••••••••" />
                </div>
              </div>
              
              <Button
                className="w-full bg-slate-700 hover:bg-slate-800"
                onClick={handleReset}
              >
                Test Connection
              </Button>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <div className="grid grid-cols-2 gap-4 w-full">
                <Button variant="outline" onClick={handleClearCache}>
                  Clear Cache
                </Button>
                <Button variant="destructive">
                  Reset Database
                </Button>
              </div>
              
              <div className="text-center text-sm text-muted-foreground">
                <p>Current database size: 24.6 MB</p>
                <p>Last backup: 10 Apr 2025, 00:00</p>
              </div>
            </CardFooter>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default SettingsPage;
