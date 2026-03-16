import type { Metadata } from "next";
import { Suspense } from "react";

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
    <Suspense fallback={<div> Loading login...</div>}>{children}</Suspense>
  );
}
