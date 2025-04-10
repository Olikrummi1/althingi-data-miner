
import React, { memo } from "react";
import { Switch } from "@/components/ui/switch";

type ScrapeConfigToggleProps = {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
};

const ScrapeConfigToggle = memo(({ enabled, onToggle }: ScrapeConfigToggleProps) => {
  return (
    <Switch 
      checked={enabled} 
      onCheckedChange={onToggle} 
      className="data-[state=checked]:bg-althingi-blue"
    />
  );
});

ScrapeConfigToggle.displayName = 'ScrapeConfigToggle';

export default ScrapeConfigToggle;
