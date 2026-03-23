import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthEntryGate } from "@/components/auth/auth-entry-gate";
import { RouteLoadingFallback } from "@/components/ui/route-loading-fallback";

export const metadata: Metadata = {
  title: { absolute: "profitabledge - Log in" },
  description:
    "Log in to profitabledge to track your trades, journal your setups, and discover your profitable edge.",
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<RouteLoadingFallback route="login" className="min-h-screen" />}>
      <AuthEntryGate>{children}</AuthEntryGate>
    </Suspense>
  );
}
