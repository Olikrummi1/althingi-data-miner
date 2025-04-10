
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type StatusProps = {
  status: "idle" | "running" | "completed" | "failed";
};

type StatusCardProps = {
  title: string;
  value: string | number;
  description: string;
  status?: StatusProps["status"];
};

const StatusCard = ({ title, value, description, status = "idle" }: StatusCardProps) => {
  const getStatusColor = () => {
    switch (status) {
      case "running":
        return "bg-yellow-200 text-yellow-800";
      case "completed":
        return "bg-green-200 text-green-800";
      case "failed":
        return "bg-red-200 text-red-800";
      default:
        return "bg-gray-200 text-gray-800";
    }
  };

  const getStatusText = () => {
    switch (status) {
      case "running":
        return "Running";
      case "completed":
        return "Completed";
      case "failed":
        return "Failed";
      default:
        return "Idle";
    }
  };

  const animation = status === "running" ? "animate-pulse-slow" : "";

  return (
    <Card className={`${animation} h-full flex flex-col`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">{title}</CardTitle>
          {status && (
            <Badge className={getStatusColor()}>
              {getStatusText()}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-grow pb-2">
        <div className="text-3xl font-bold">{value}</div>
      </CardContent>
      <CardFooter className="pt-0">
        <CardDescription>{description}</CardDescription>
      </CardFooter>
    </Card>
  );
};

export default StatusCard;
