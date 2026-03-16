import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Compliance" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div> Loading compliance... </div>}>
      {children}
    </Suspense>
  );
}
