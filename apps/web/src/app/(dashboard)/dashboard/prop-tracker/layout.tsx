import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Prop Tracker" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div> Loading prop tracker... </div>}>
      {children}
    </Suspense>
  );
}
