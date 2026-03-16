import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: { absolute: "Growth admin" },
  description: "Growth admin of accounts.",
};

export default function GrowthAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Suspense>{children}</Suspense>;
}
