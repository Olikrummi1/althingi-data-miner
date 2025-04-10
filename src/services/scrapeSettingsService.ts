
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Database } from "@/integrations/supabase/types";

export type ScrapeSettings = Database["public"]["Tables"]["scrape_settings"]["Row"];

export async function getScrapeSettings(): Promise<ScrapeSettings | null> {
  try {
    const { data, error } = await supabase
      .from("scrape_settings")
      .select("*")
      .eq("id", 1)
      .single();

    if (error) {
      console.error("Error fetching scrape settings:", error);
      toast.error("Failed to load scrape settings");
      return null;
    }

    return data as ScrapeSettings;
  } catch (error) {
    console.error("Error in getScrapeSettings:", error);
    toast.error("Failed to load scrape settings");
    return null;
  }
}

export async function updateScrapeSettings(settings: Partial<ScrapeSettings>): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("scrape_settings")
      .update(settings)
      .eq("id", 1);

    if (error) {
      console.error("Error updating scrape settings:", error);
      toast.error("Failed to update settings");
      return false;
    }

    toast.success("Settings saved successfully");
    return true;
  } catch (error) {
    console.error("Error in updateScrapeSettings:", error);
    toast.error("Failed to update settings");
    return false;
  }
}
