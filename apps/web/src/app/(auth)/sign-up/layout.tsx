import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthEntryGate } from "@/components/auth/auth-entry-gate";
import { RouteLoadingFallback } from "@/components/ui/route-loading-fallback";

export const metadata: Metadata = {
  title: { absolute: "profitabledge - Sign up" },
  description:
    "Create your profitabledge account. Start tracking your trades, journaling your setups, and discovering your profitable edge.",
};

export default function SignUpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<RouteLoadingFallback route="signUp" className="min-h-screen" />}>
      <AuthEntryGate>{children}</AuthEntryGate>
    </Suspense>
  );
}
