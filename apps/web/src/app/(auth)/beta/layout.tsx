import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "profitabledge - Private Beta" },
  description: "Enter your beta access code to join profitabledge.",
};

export default function BetaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
