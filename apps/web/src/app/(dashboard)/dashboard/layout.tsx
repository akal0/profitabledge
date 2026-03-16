import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function DashboardMetadataLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<div> Loading dashboard... </div>}>{children}</Suspense>
  );
}
