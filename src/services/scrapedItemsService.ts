
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type ScrapedItem = {
  id: string;
  type: "bill" | "vote" | "speech" | "mp" | "committee" | "issue";
  title: string;
  content: string | null;
  url: string;
  scraped_at: string;
  metadata: any | null;
};

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
    const { data, error } = await supabase
      .from("scraped_items")
      .select("type, count(*)")
      .group("type");

    if (error) {
      console.error("Error fetching item counts:", error);
      toast.error("Failed to load statistics");
      return [];
    }

    return data.map(item => ({
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
      .limit(1);

    if (error || !data.length) {
      console.error("Error fetching last scraped date:", error);
      return null;
    }

    return data[0].scraped_at;
  } catch (error) {
    console.error("Error in getLastScrapedDate:", error);
    return null;
  }
}
