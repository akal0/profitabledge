import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Psychology" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div> Loading psychology... </div>}>
      {children}
    </Suspense>
  );
}
