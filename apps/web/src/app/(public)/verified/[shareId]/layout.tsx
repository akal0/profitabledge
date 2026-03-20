import { Suspense } from "react";
import { RouteLoadingFallback } from "@/components/ui/route-loading-fallback";

export default function VerifiedTrackRecordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={<RouteLoadingFallback route="verifiedTrackRecord" className="min-h-screen bg-[#0a0a0a]" />}
    >
      {children}
    </Suspense>
  );
}
