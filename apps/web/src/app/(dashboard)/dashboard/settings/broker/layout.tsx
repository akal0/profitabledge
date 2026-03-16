import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Broker" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div> Loading broker... </div>}>{children}</Suspense>
  );
}
