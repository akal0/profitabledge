"use client";

import { use } from "react";

import { PublicEdgeProofPage } from "@/features/public-proof/components/public-edge-proof-page";

type PublicEdgeProofRouteProps = {
  params: Promise<{ shareId: string }>;
};

export default function PublicEdgeProofRoute({
  params,
}: PublicEdgeProofRouteProps) {
  const { shareId } = use(params);

  return <PublicEdgeProofPage shareId={shareId} />;
}
