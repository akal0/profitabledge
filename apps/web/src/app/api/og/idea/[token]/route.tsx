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

async function loadSansFonts(text: string) {
  try {
    const [regular, semiBold, bold] = await Promise.all([
      loadGoogleFont("Geist", 400, text),
      loadGoogleFont("Geist", 600, text),
      loadGoogleFont("Geist", 700, text),
    ]);

    return [
      { name: "Geist", data: regular, weight: 400 as const, style: "normal" as const },
      { name: "Geist", data: semiBold, weight: 600 as const, style: "normal" as const },
      { name: "Geist", data: bold, weight: 700 as const, style: "normal" as const },
    ];
  } catch {
    const [regular, semiBold, bold] = await Promise.all([
      loadGoogleFont("Inter", 400, text),
      loadGoogleFont("Inter", 600, text),
      loadGoogleFont("Inter", 700, text),
    ]);

    return [
      { name: "Geist", data: regular, weight: 400 as const, style: "normal" as const },
      { name: "Geist", data: semiBold, weight: 600 as const, style: "normal" as const },
      { name: "Geist", data: bold, weight: 700 as const, style: "normal" as const },
    ];
  }
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
    fonts = await loadSansFonts(fontText);
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
