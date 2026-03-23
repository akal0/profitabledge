import type { Metadata } from "next";
import { Suspense } from "react";
import { RouteLoadingFallback } from "@/components/ui/route-loading-fallback";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const inviter = decodeURIComponent(username ?? "").trim() || "someone";

  return {
    title: { absolute: `profitabledge - You've been invited by ${inviter}` },
    description:
      "You've been invited to join profitabledge — the sharpest trading journal on the market. Sign up and find your own profitable edge.",
  };
}

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
