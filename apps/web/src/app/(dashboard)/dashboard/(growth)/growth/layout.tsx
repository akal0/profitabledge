import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: { absolute: "Growth" },
  description: "Growth of your account.",
};

export default function GrowthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<div> Loading growth admin...</div>}>
      {children}
    </Suspense>
  );
}
