import { ImageResponse } from "next/og";
import type { ImageResponseOptions } from "next/server";

import { TradeIdeaOgCard } from "@/features/trade-ideas/lib/trade-idea-og-card";
import { fetchPublicTradeIdea } from "@/features/trade-ideas/lib/public-trade-ideas";

export const runtime = "edge";

async function loadGoogleFont(fontFamily: string, weight: number, text: string) {
  const family = fontFamily.replace(/ /g, "+");
  const cssUrl = `https://fonts.googleapis.com/css2?family=${family}:wght@${weight}&text=${encodeURIComponent(
    text
  )}`;
  const css = await fetch(cssUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    },
  }).then((response) => response.text());

  const match = css.match(/src: url\(([^)]+)\) format\('(opentype|truetype|woff2)'\)/);
  if (!match?.[1]) {
    throw new Error(`Unable to load font: ${fontFamily}`);
  }

  return fetch(match[1]).then((response) => response.arrayBuffer());
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
  const idea = await fetchPublicTradeIdea(token);

  if (!idea) {
    return new Response("Not found", { status: 404 });
  }

  const fontText = [
    idea.symbol,
    idea.title,
    idea.description,
    idea.authorDisplayName,
    idea.authorUsername,
    idea.strategyName,
    idea.session,
    idea.timeframe,
    idea.entryPrice,
    idea.stopLoss,
    idea.takeProfit,
    idea.riskReward,
    "profitabledge",
    "Trade idea",
  ]
    .filter(Boolean)
    .join(" ");

  let fonts: ImageResponseOptions["fonts"];

  try {
    const [manrope, jetBrainsMono] = await Promise.all([
      loadGoogleFont("Manrope", 800, fontText),
      loadGoogleFont("JetBrains Mono", 500, fontText),
    ]);

    fonts = [
      { name: "Manrope", data: manrope, weight: 800 as const, style: "normal" },
      {
        name: "JetBrains Mono",
        data: jetBrainsMono,
        weight: 500 as const,
        style: "normal",
      },
    ];
  } catch {
    fonts = undefined;
  }

  const response = new ImageResponse(
    <TradeIdeaOgCard idea={idea as any} width={1200} height={630} />,
    {
      width: 1200,
      height: 630,
      fonts,
    }
  );

  response.headers.set(
    "Cache-Control",
    "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400"
  );
  return response;
}
