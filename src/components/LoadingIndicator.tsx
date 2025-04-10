
import { Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface LoadingIndicatorProps {
  size?: "small" | "medium" | "large";
  text?: string;
}

const LoadingIndicator = ({ size = "medium", text }: LoadingIndicatorProps) => {
  const { t } = useLanguage();
  
  const sizeClass = {
    small: "h-4 w-4",
    medium: "h-8 w-8",
    large: "h-12 w-12"
  };
  
  const displayText = text || t('loading');
  
  return (
    <div className="flex flex-col items-center justify-center h-full space-y-4">
      <Loader2 className={`${sizeClass[size]} animate-spin text-althingi-blue`} />
      <p className="text-lg text-gray-500">{displayText}</p>
    </div>
  );
};

export default LoadingIndicator;
