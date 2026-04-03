import type { Metadata } from "next";

import { TradeIdeaPublicPage } from "@/features/trade-ideas/components/trade-idea-public-page";
import { fetchPublicTradeIdea } from "@/features/trade-ideas/lib/public-trade-ideas";
import {
  buildTradeIdeaDescription,
  buildTradeIdeaMetaTitle,
  buildTradeIdeaOgImagePath,
} from "@/features/trade-ideas/lib/trade-idea-utils";

export const dynamic = "force-dynamic";

function UnavailableState() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#06080d] px-6 text-white">
      <div className="w-full max-w-xl rounded-[28px] border border-white/8 bg-white/[0.03] px-6 py-8 text-center">
        <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/34">
          Trade idea unavailable
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">
          This trade idea is no longer available
        </h1>
        <p className="mt-3 text-sm leading-7 text-white/52">
          The share may have expired, been deactivated, or the link is invalid.
        </p>
      </div>
    </div>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const idea = await fetchPublicTradeIdea(token);

  if (!idea) {
    return {
      title: "Trade Idea Not Found",
      description: "This shared trade idea is no longer available on profitabledge.",
    };
  }

  const title = buildTradeIdeaMetaTitle(idea as any);
  const description = buildTradeIdeaDescription(idea as any);
  const imagePath = buildTradeIdeaOgImagePath(idea as any);
  const pagePath = `/idea/${token}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: pagePath,
      type: "article",
      siteName: "profitabledge",
      images: [
        {
          url: imagePath,
          width: 1200,
          height: 630,
          alt: `${idea.symbol} trade idea chart`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imagePath],
    },
  };
}

export default async function TradeIdeaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const idea = await fetchPublicTradeIdea(token);

  if (!idea) {
    return <UnavailableState />;
  }

  return <TradeIdeaPublicPage token={token} idea={idea as any} />;
}
