
import React, { memo } from "react";
import { Badge } from "@/components/ui/badge";

type ScrapeStatusBadgeProps = {
  status: string | null;
  itemsScraped?: number;
};

const ScrapeStatusBadge = memo(({ status, itemsScraped = 0 }: ScrapeStatusBadgeProps) => {
  if (!status) return null;
  
  let color = "";
  let text = status;
  
  switch(status) {
    case "running":
      color = "bg-yellow-200 text-yellow-800";
      break;
    case "completed":
      color = "bg-green-200 text-green-800";
      break;
    case "failed":
      color = "bg-red-200 text-red-800";
      break;
    case "stopped":
      color = "bg-gray-200 text-gray-800";
      text = "Stopped";
      break;
    case "pending":
      color = "bg-blue-200 text-blue-800";
      text = "Pending";
      break;
    default:
      color = "bg-gray-200 text-gray-800";
  }
  
  return (
    <Badge className={color}>
      {text} {status === "running" && itemsScraped > 0 && `(${itemsScraped} items)`}
    </Badge>
  );
});

ScrapeStatusBadge.displayName = 'ScrapeStatusBadge';

export default ScrapeStatusBadge;
