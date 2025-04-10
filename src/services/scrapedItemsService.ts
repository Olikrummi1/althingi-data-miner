
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Database } from "@/integrations/supabase/types";

export type ScrapedItem = Database["public"]["Tables"]["scraped_items"]["Row"];

export async function getRecentItems(limit = 10): Promise<ScrapedItem[]> {
  try {
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

    return data as ScrapedItem[];
  } catch (error) {
    console.error("Error in getRecentItems:", error);
    toast.error("Failed to load recent items");
    return [];
  }
}

export async function getItemCountsByType(): Promise<{ name: string; count: number }[]> {
  try {
    // Using RPC function to get item counts by type
    // Cast the rpc function to any to avoid TypeScript errors with functions not in the types
    const { data, error } = await (supabase.rpc as any)('get_item_counts_by_type');

    if (error) {
      console.error("Error fetching item counts:", error);
      toast.error("Failed to load statistics");
      return [];
    }

    if (!data) return [];
    
    // Transform the data to match the expected format
    return (data as Array<{type: string, count: number}>).map(item => ({
      name: item.type.charAt(0).toUpperCase() + item.type.slice(1),
      count: item.count
    }));
  } catch (error) {
    console.error("Error in getItemCountsByType:", error);
    toast.error("Failed to load statistics");
    return [];
  }
}

export async function getTotalItemsCount(): Promise<number> {
  try {
    const { count, error } = await supabase
      .from("scraped_items")
      .select("*", { count: "exact", head: true });

    if (error) {
      console.error("Error fetching total items count:", error);
      toast.error("Failed to load total count");
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error("Error in getTotalItemsCount:", error);
    toast.error("Failed to load total count");
    return 0;
  }
}

export async function getLastScrapedDate(): Promise<string | null> {
  try {
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

    return data?.scraped_at || null;
  } catch (error) {
    console.error("Error in getLastScrapedDate:", error);
    return null;
  }
}
