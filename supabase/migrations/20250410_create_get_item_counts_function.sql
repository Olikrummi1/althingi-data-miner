
-- Create RPC function to get item counts by type
CREATE OR REPLACE FUNCTION public.get_item_counts_by_type()
RETURNS TABLE (type text, count bigint)
LANGUAGE sql
AS $$
  SELECT type, COUNT(*) as count
  FROM public.scraped_items
  GROUP BY type;
$$;
