import type { Metadata } from "next";

import { AffiliateApplicationPage } from "@/features/growth/components/affiliate-application-page";

export const metadata: Metadata = {
  title: { absolute: "profitabledge - Affiliate application" },
  description:
    "Apply for affiliate access with your referral history, promotion plan, and social context.",
};

export default function AffiliateApplicationRoute() {
  return <AffiliateApplicationPage />;
}
