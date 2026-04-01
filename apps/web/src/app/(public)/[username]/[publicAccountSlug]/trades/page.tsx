import type { Metadata } from "next";

import { PublicProofPage } from "@/features/public-proof/components/public-proof-page";

function formatSegment(value: string) {
  return decodeURIComponent(value).replace(/[-_]+/g, " ").trim();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string; publicAccountSlug: string }>;
}): Promise<Metadata> {
  const { username, publicAccountSlug } = await params;
  const formattedUsername = formatSegment(username) || "Trader";
  const formattedAccount = formatSegment(publicAccountSlug) || "Public proof";
  const title = `${formattedUsername} - ${formattedAccount} public proof`;
  const description =
    "Verified public trading proof on Profitabledge with account performance, trust facts, and trade history.";
  const path = `/${encodeURIComponent(username)}/${encodeURIComponent(publicAccountSlug)}/trades`;

  return {
    title: { absolute: `profitabledge - ${title}` },
    description,
    openGraph: {
      title,
      description,
      url: path,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function PublicTradesProofPage({
  params,
}: {
  params: Promise<{ username: string; publicAccountSlug: string }>;
}) {
  const { username, publicAccountSlug } = await params;

  return (
    <PublicProofPage
      username={username}
      publicAccountSlug={publicAccountSlug}
    />
  );
}
