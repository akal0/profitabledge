import type { Metadata } from "next";

export const metadata: Metadata = { title: "Security Settings" };

export default function SecuritySettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
