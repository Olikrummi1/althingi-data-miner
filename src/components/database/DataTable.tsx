
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrapedItem } from "@/services/scrapedItemsService";

interface DataTableProps {
  data: ScrapedItem[];
  isLoading: boolean;
}

export function DataTable({ data, isLoading }: DataTableProps) {
  if (isLoading) {
    return <div className="text-center py-4">Loading...</div>;
  }

  if (data.length === 0) {
    return <div className="text-center py-4">No data found</div>;
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>URL</TableHead>
            <TableHead>Scraped At</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item) => (
            <TableRow key={item.id}>
              <TableCell>{item.title}</TableCell>
              <TableCell>
                <a 
                  href={item.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {item.url}
                </a>
              </TableCell>
              <TableCell>
                {new Date(item.scraped_at!).toLocaleString()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
