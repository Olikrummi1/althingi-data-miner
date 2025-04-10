
export type LanguageKey = "en" | "is";

export type Translations = {
  [key in LanguageKey]: {
    [key: string]: string;
  };
};

export const translations: Translations = {
  en: {
    // General
    dashboard: "Dashboard",
    settings: "Settings",
    scraper: "Scraper",
    save: "Save",
    cancel: "Cancel",
    loading: "Loading...",
    
    // Dashboard
    totalItemsScraped: "Total Items Scraped",
    totalRecordsDescription: "Total number of records in the database",
    lastScrape: "Last Scrape",
    lastScrapeDescription: "Time of the last successful scrape",
    scrapeSpeed: "Scrape Speed",
    scrapeSpeedDescription: "Average items scraped per second",
    recentItems: "Recent Items",
    dataByType: "Data by Type",

    // Scraper page
    configureScraper: "Configure Scrapers",
    runAllEnabled: "Run All Enabled",
    runningAll: "Running All...",
    
    // Scraper types
    bills: "Bills & Legislation",
    billsDescription: "Scrape bills, amendments, and legislative documents",
    votes: "Voting Records",
    votesDescription: "Collect MP voting records on bills and proposals",
    speeches: "Parliamentary Speeches",
    speechesDescription: "Gather speeches and discussions from parliament sessions",
    mps: "Members of Parliament",
    mpsDescription: "Information about past and present MPs",
    committees: "Committees",
    committeesDescription: "Committee data, members and activities",
    issues: "Parliamentary Issues",
    issuesDescription: "Track issues discussed in parliament",
    
    // Settings
    scraperConfiguration: "Scraper Configuration",
    scraperConfigDescription: "Control how the scraper behaves when extracting data",
    concurrency: "Concurrency",
    throttle: "Throttle (ms)",
    timeout: "Request Timeout (s)",
    maxDepth: "Max Crawl Depth",
    userAgent: "User Agent",
    respectRobotsTxt: "Respect robots.txt",
    saveRawHtml: "Save raw HTML",
    enableNotifications: "Enable notifications",
    retryFailed: "Retry failed requests",
    saveSettings: "Save Settings",
    saving: "Saving...",
    databaseConnection: "Database & Storage",
    databaseDescription: "Configure database connection and manage data",
    testConnection: "Test Connection",
    clearCache: "Clear Cache",
    resetDatabase: "Reset Database",
    databaseSize: "Current database size:",
    lastBackup: "Last backup:",
  },
  is: {
    // General
    dashboard: "Mælaborð",
    settings: "Stillingar",
    scraper: "Skafa",
    save: "Vista",
    cancel: "Hætta við",
    loading: "Hleður...",
    
    // Dashboard
    totalItemsScraped: "Heildarfjöldi safnaðra atriða",
    totalRecordsDescription: "Heildarfjöldi færslna í gagnagrunni",
    lastScrape: "Síðasta söfnun",
    lastScrapeDescription: "Tími síðustu skröpunar",
    scrapeSpeed: "Söfnunarhraði",
    scrapeSpeedDescription: "Meðalfjöldi atriða á sekúndu",
    recentItems: "Nýlegar færslur",
    dataByType: "Gögn eftir tegund",

    // Scraper page
    configureScraper: "Stilla skröpun",
    runAllEnabled: "Keyra allt valið",
    runningAll: "Keyrir allt...",
    
    // Scraper types
    bills: "Frumvörp og löggjöf",
    billsDescription: "Safna frumvörpum, breytingum og lagaskjölum",
    votes: "Atkvæðagreiðslur",
    votesDescription: "Safna atkvæðagreiðslum þingmanna",
    speeches: "Ræður á þingi",
    speechesDescription: "Safna ræðum og umræðum á þingfundum",
    mps: "Þingmenn",
    mpsDescription: "Upplýsingar um fyrrverandi og núverandi þingmenn",
    committees: "Nefndir",
    committeesDescription: "Gögn um nefndir, nefndarmenn og starfsemi",
    issues: "Þingmál",
    issuesDescription: "Fylgjast með málefnum sem rædd eru á þingi",
    
    // Settings
    scraperConfiguration: "Stillingar skröpunar",
    scraperConfigDescription: "Stjórnaðu hegðun skröpunarinnar við söfnun gagna",
    concurrency: "Fjöldi samtímis beiðna",
    throttle: "Bið milli beiðna (ms)",
    timeout: "Tími fyrningar (s)",
    maxDepth: "Hámarksdýpt",
    userAgent: "Notendaauðkenni",
    respectRobotsTxt: "Virða robots.txt",
    saveRawHtml: "Vista HTML",
    enableNotifications: "Virkja tilkynningar",
    retryFailed: "Endurtaka misheppnaðar beiðnir",
    saveSettings: "Vista stillingar",
    saving: "Vistar...",
    databaseConnection: "Gagnagrunnur og geymsla",
    databaseDescription: "Stilla tengingu við gagnagrunn og stjórna gögnum",
    testConnection: "Prófa tengingu",
    clearCache: "Hreinsa skyndiminni",
    resetDatabase: "Núllstilla gagnagrunn",
    databaseSize: "Núverandi stærð gagnagrunns:",
    lastBackup: "Síðasta afrit:",
  }
};
