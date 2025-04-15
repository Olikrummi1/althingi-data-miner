
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "./DataTable";
import { Search } from "lucide-react";
import { ScrapedItem } from "@/services/scrapedItemsService";
import { getItemsByType } from "@/services/scrapedItemsService";

export function DatabaseExplorer() {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentType, setCurrentType] = useState("bills");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["scraped-items", currentType],
    queryFn: () => getItemsByType(currentType),
  });

  const filteredItems = items.filter((item: ScrapedItem) => 
    item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.content?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.url.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Database Explorer</h1>
        <div className="relative w-96">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search in title, content or URL..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      <Tabs defaultValue="bills" onValueChange={setCurrentType}>
        <TabsList>
          <TabsTrigger value="bills">Bills</TabsTrigger>
          <TabsTrigger value="votes">Votes</TabsTrigger>
          <TabsTrigger value="speeches">Speeches</TabsTrigger>
          <TabsTrigger value="mps">MPs</TabsTrigger>
          <TabsTrigger value="committees">Committees</TabsTrigger>
          <TabsTrigger value="issues">Issues</TabsTrigger>
        </TabsList>

        <TabsContent value="bills">
          <DataTable data={filteredItems} isLoading={isLoading} />
        </TabsContent>
        <TabsContent value="votes">
          <DataTable data={filteredItems} isLoading={isLoading} />
        </TabsContent>
        <TabsContent value="speeches">
          <DataTable data={filteredItems} isLoading={isLoading} />
        </TabsContent>
        <TabsContent value="mps">
          <DataTable data={filteredItems} isLoading={isLoading} />
        </TabsContent>
        <TabsContent value="committees">
          <DataTable data={filteredItems} isLoading={isLoading} />
        </TabsContent>
        <TabsContent value="issues">
          <DataTable data={filteredItems} isLoading={isLoading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
