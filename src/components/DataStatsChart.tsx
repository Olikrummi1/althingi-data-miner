
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

type DataStatsChartProps = {
  data: Array<{
    name: string;
    count: number;
  }>;
};

const DataStatsChart = ({ data }: DataStatsChartProps) => {
  const hasData = data && data.length > 0;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Data Statistics</CardTitle>
        <CardDescription>Number of items scraped by category</CardDescription>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                margin={{
                  top: 5,
                  right: 30,
                  left: 20,
                  bottom: 5,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#0068b2" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-[300px] items-center justify-center text-muted-foreground">
            No data available. Start a scrape job to collect data.
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DataStatsChart;
