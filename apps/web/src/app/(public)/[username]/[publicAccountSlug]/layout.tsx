import { Suspense } from "react";
import { RouteLoadingFallback } from "@/components/ui/route-loading-fallback";

export default function PublicProofLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<RouteLoadingFallback route="publicProof" className="min-h-screen bg-sidebar" />}>
      <div className="min-h-screen w-full self-start bg-sidebar">{children}</div>
    </Suspense>
  );
}
