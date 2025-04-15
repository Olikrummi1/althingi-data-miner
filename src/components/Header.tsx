
import { Link, useLocation } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import LanguageSwitcher from "./LanguageSwitcher";

const Header = () => {
  const location = useLocation();
  const { t } = useLanguage();
  
  const isActive = (path: string) => location.pathname === path;
  
  return (
    <header className="bg-white shadow-sm">
      <div className="container mx-auto flex flex-col md:flex-row justify-between items-center py-4 px-4">
        <div className="flex items-center mb-4 md:mb-0">
          <div className="text-xl font-bold text-althingi-blue">Althingi Data Miner</div>
        </div>
        
        <div className="flex flex-col md:flex-row items-center space-y-4 md:space-y-0">
          <nav className="flex space-x-6 md:mr-6">
            <Link 
              to="/" 
              className={`text-gray-600 hover:text-althingi-blue ${isActive('/') ? 'font-semibold text-althingi-blue' : ''}`}
            >
              {t('dashboard')}
            </Link>
            <Link 
              to="/scraper" 
              className={`text-gray-600 hover:text-althingi-blue ${isActive('/scraper') ? 'font-semibold text-althingi-blue' : ''}`}
            >
              {t('scraper')}
            </Link>
            <Link 
              to="/database" 
              className={`text-gray-600 hover:text-althingi-blue ${isActive('/database') ? 'font-semibold text-althingi-blue' : ''}`}
            >
              {t('database')}
            </Link>
            <Link 
              to="/settings" 
              className={`text-gray-600 hover:text-althingi-blue ${isActive('/settings') ? 'font-semibold text-althingi-blue' : ''}`}
            >
              {t('settings')}
            </Link>
          </nav>
          
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
};

export default Header;
