
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";

const DatabaseCard = () => {
  const { t } = useLanguage();

  const handleReset = () => {
    toast.info("Database connection reset");
  };

  const handleClearCache = () => {
    toast.success("Cache cleared successfully");
  };

  return (
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
  );
};

export default DatabaseCard;
