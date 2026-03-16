import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = { title: "EA Setup" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div> Loading EA setup... </div>}>{children}</Suspense>
  );
}
