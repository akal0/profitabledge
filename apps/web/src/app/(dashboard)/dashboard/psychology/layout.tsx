import type { Metadata } from "next";

export const metadata: Metadata = { title: "Psychology" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
