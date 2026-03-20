import type { Metadata } from "next";
import { Suspense } from "react";
import { RouteLoadingFallback } from "@/components/ui/route-loading-fallback";

export const metadata: Metadata = {
  title: { absolute: "profitabledge - You've been invited" },
  description:
    "You've been invited to join profitabledge — the sharpest trading journal on the market. Sign up and find your own profitable edge.",
};

export default function InviteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={<RouteLoadingFallback route="signUp" className="min-h-screen" />}
    >
      {children}
    </Suspense>
  );
}
