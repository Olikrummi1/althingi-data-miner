
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Database } from "@/integrations/supabase/types";

export type ScrapedItem = Database["public"]["Tables"]["scraped_items"]["Row"];

// Define the return type of get_item_counts_by_type RPC function
type ItemCountsByType = {
  type: string;
  count: number;
}

export async function getRecentItems(limit = 10): Promise<ScrapedItem[]> {
  try {
    console.log(`Fetching up to ${limit} recent items`);
    const { data, error } = await supabase
      .from("scraped_items")
      .select("*")
      .order("scraped_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Error fetching recent items:", error);
      toast.error("Failed to load recent items");
      return [];
    }

    if (!data || data.length === 0) {
      console.log("No scraped items found in the database");
      return [];
    }

    console.log(`Found ${data.length} recent items`);
    return data as ScrapedItem[];
  } catch (error) {
    console.error("Error in getRecentItems:", error);
    toast.error("Failed to load recent items");
    return [];
  }
}

export async function getItemsByType(type: string, limit = 100): Promise<ScrapedItem[]> {
  try {
    console.log(`Fetching up to ${limit} items of type ${type}`);
    const { data, error } = await supabase
      .from("scraped_items")
      .select("*")
      .eq("type", type)
      .order("scraped_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error(`Error fetching items of type ${type}:`, error);
      toast.error(`Failed to load ${type} items`);
      return [];
    }

    if (!data || data.length === 0) {
      console.log(`No items of type ${type} found in the database`);
      return [];
    }

    console.log(`Found ${data.length} items of type ${type}`);
    return data as ScrapedItem[];
  } catch (error) {
    console.error(`Error in getItemsByType for ${type}:`, error);
    toast.error(`Failed to load ${type} items`);
    return [];
  }
}

export async function getItemCountsByType(): Promise<{ name: string; count: number }[]> {
  try {
    console.log("Fetching item counts by type");
    // Using the properly created RPC function to get item counts by type
    const { data, error } = await supabase
      .rpc('get_item_counts_by_type')
      .returns<ItemCountsByType[]>();

    if (error) {
      console.error("Error fetching item counts:", error);
      toast.error("Failed to load statistics");
      return [];
    }

    if (!data || !Array.isArray(data) || data.length === 0) {
      console.log("No data returned from get_item_counts_by_type");
      return [];
    }
    
    console.log(`Found counts for ${data.length} item types`);
    
    // Transform the data to match the expected format for the chart
    return data.map(item => ({
      name: item.type.charAt(0).toUpperCase() + item.type.slice(1),
      count: Number(item.count)
    }));
  } catch (error) {
    console.error("Error in getItemCountsByType:", error);
    toast.error("Failed to load statistics");
    return [];
  }
}

export async function getTotalItemsCount(): Promise<number> {
  try {
    console.log("Fetching total items count");
    const { count, error } = await supabase
      .from("scraped_items")
      .select("*", { count: "exact", head: true });

    if (error) {
      console.error("Error fetching total items count:", error);
      toast.error("Failed to load total count");
      return 0;
    }

    console.log(`Total items count: ${count || 0}`);
    return count || 0;
  } catch (error) {
    console.error("Error in getTotalItemsCount:", error);
    toast.error("Failed to load total count");
    return 0;
  }
}

export async function getLastScrapedDate(): Promise<string | null> {
  try {
    console.log("Fetching last scraped date");
    const { data, error } = await supabase
      .from("scraped_items")
      .select("scraped_at")
      .order("scraped_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Error fetching last scraped date:", error);
      return null;
    }

    if (data?.scraped_at) {
      console.log(`Last scraped date: ${data.scraped_at}`);
    } else {
      console.log("No last scraped date found");
    }

    return data?.scraped_at || null;
  } catch (error) {
    console.error("Error in getLastScrapedDate:", error);
    return null;
  }
}

export async function purgeScrapedItems(): Promise<boolean> {
  try {
    console.log("Purging all scraped items");
    const { error } = await supabase
      .from("scraped_items")
      .delete()
      .not("id", "is", null); // This will delete all records
    
    if (error) {
      console.error("Error purging scraped items:", error);
      toast.error("Failed to purge scraped items");
      return false;
    }
    
    console.log("Successfully purged all scraped items");
    toast.success("Successfully purged all scraped items");
    return true;
  } catch (error) {
    console.error("Error in purgeScrapedItems:", error);
    toast.error("Failed to purge scraped items");
    return false;
  }
}

export async function refreshScrapedItems(): Promise<boolean> {
  try {
    // This function doesn't actually refresh the data from the source,
    // it just forces a re-fetch from the database which can be useful
    // when data has been updated by background processes
    
    // We don't need to do anything special here, just return true
    // The calling component should re-fetch the data after calling this
    toast.success("Refreshed data from database");
    return true;
  } catch (error) {
    console.error("Error in refreshScrapedItems:", error);
    toast.error("Failed to refresh data");
    return false;
  }
}

// New function to handle edge function errors more gracefully
export async function handleEdgeFunctionError(error: any, type: string): Promise<void> {
  let errorMessage = "Unknown error occurred";
  
  if (error?.message) {
    errorMessage = error.message;
  }
  
  if (errorMessage.includes("Edge Function returned a non-2xx status code")) {
    // This is likely a resource limit issue, provide a more helpful message
    toast.error(`The server is busy processing other requests. Please try again later or try with a smaller scrape depth.`);
    console.error(`Edge Function error for ${type} scraper:`, errorMessage);
  } else if (errorMessage.includes("WORKER_LIMIT")) {
    toast.error(`Resource limit reached. Try again with a smaller scrape depth or wait for current jobs to complete.`);
    console.error(`Worker limit reached for ${type} scraper:`, errorMessage);
  } else if (errorMessage.includes("timeout")) {
    toast.error(`The scraper timed out. Try with a smaller scrape depth or more focused URL.`);
    console.error(`Timeout for ${type} scraper:`, errorMessage);
  } else if (errorMessage.includes("memory")) {
    toast.error(`The scraper ran out of memory. Try with a smaller scrape depth.`);
    console.error(`Memory limit for ${type} scraper:`, errorMessage);
  } else {
    toast.error(`Failed to start ${type} scraper: ${errorMessage}`);
    console.error(`Error starting ${type} scraper:`, errorMessage);
  }
}

// New function to get additional items beyond the initial limit
export async function getMoreItemsByType(type: string, offset = 0, limit = 50): Promise<ScrapedItem[]> {
  try {
    console.log(`Fetching additional items of type ${type} (offset: ${offset}, limit: ${limit})`);
    const { data, error } = await supabase
      .from("scraped_items")
      .select("*")
      .eq("type", type)
      .order("scraped_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error(`Error fetching additional items of type ${type}:`, error);
      toast.error(`Failed to load more ${type} items`);
      return [];
    }

    if (!data || data.length === 0) {
      console.log(`No additional items of type ${type} found in the database`);
      return [];
    }

    console.log(`Found ${data.length} additional items of type ${type}`);
    return data as ScrapedItem[];
  } catch (error) {
    console.error(`Error in getMoreItemsByType for ${type}:`, error);
    toast.error(`Failed to load more ${type} items`);
    return [];
  }
}
