
import { Database, GanttChart, Settings } from "lucide-react";
import { Link } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocation } from "react-router-dom";

const Header = () => {
  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <header className="bg-althingi-blue text-white p-4 shadow-md">
      <div className="container mx-auto flex flex-col md:flex-row justify-between items-center">
        <div className="flex items-center mb-4 md:mb-0">
          <h1 className="text-2xl font-bold">Althingi Data Miner</h1>
        </div>
        
        <Tabs defaultValue={currentPath} className="w-full md:w-auto">
          <TabsList className="bg-althingi-darkBlue">
            <TabsTrigger value="/" asChild>
              <Link to="/" className="flex items-center gap-2">
                <GanttChart className="h-4 w-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </Link>
            </TabsTrigger>
            <TabsTrigger value="/scraper" asChild>
              <Link to="/scraper" className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                <span className="hidden sm:inline">Scraper</span>
              </Link>
            </TabsTrigger>
            <TabsTrigger value="/settings" asChild>
              <Link to="/settings" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Settings</span>
              </Link>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
    </header>
  );
};

export default Header;
