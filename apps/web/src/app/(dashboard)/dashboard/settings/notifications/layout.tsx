import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Notifications" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div> Loading notifications... </div>}>
      {children}
    </Suspense>
  );
}
