"use client";

import { use } from "react";

import { PublicProofPage } from "@/features/public-proof/components/public-proof-page";

export default function PublicTradesProofPage({
  params,
}: {
  params: Promise<{ username: string; publicAccountSlug: string }>;
}) {
  const { username, publicAccountSlug } = use(params);

  return (
    <PublicProofPage
      username={username}
      publicAccountSlug={publicAccountSlug}
    />
  );
}
