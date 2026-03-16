import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Affiliate" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div> Loading affiliates... </div>}>
      {children}
    </Suspense>
  );
}
