import { Suspense } from "react";
import type { Metadata } from "next";
import DashboardLayoutClient from "./dashboard-layout-client";

import { connection } from "next/server";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();

  return (
    <Suspense fallback={null}>
      <DashboardLayoutClient>{children}</DashboardLayoutClient>
    </Suspense>
  );
}
