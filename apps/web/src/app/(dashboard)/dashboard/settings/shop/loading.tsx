import { RouteLoadingFallback } from "@/components/ui/route-loading-fallback";

export default function Loading() {
  return (
    <RouteLoadingFallback
      route="settings"
      message="Opening the customization shop and laying out your profile loadout..."
      animated={false}
    />
  );
}
