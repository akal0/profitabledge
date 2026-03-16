import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "profitabledge - Sign up" },
  description:
    "Create your profitabledge account. Start tracking your trades, journaling your setups, and discovering your profitable edge.",
};

export default function SignUpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
