import { NextRequest, NextResponse } from "next/server";

const TE_BASE = "https://api.tradingeconomics.com/calendar/country/all";
const FF_BASE = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";

function parseDate(value: string | null, fallback: Date) {
  const parsed = value ? new Date(value) : fallback;
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function mapTradingEconomics(
  data: unknown[],
  startTime: number,
  endTime: number
) {
  return data
    .map((item) => {
      const rawDate = item?.Date || item?.ReferenceDate || null;
      const parsedDate = rawDate ? new Date(rawDate) : null;
      if (!parsedDate || Number.isNaN(parsedDate.getTime())) return null;
      if (parsedDate.getTime() < startTime || parsedDate.getTime() > endTime) {
        return null;
      }
      const importance =
        typeof item?.Importance === "number"
          ? item.Importance
          : Number(item?.Importance || 0);
      let impact = "Low";
      const eventLabel = String(item?.Event || item?.Category || "");
      if (eventLabel.toLowerCase().includes("holiday")) {
        impact = "Holiday";
      } else if (importance >= 3) {
        impact = "High";
      } else if (importance === 2) {
        impact = "Medium";
      }
      const currency = item?.Currency ? String(item.Currency) : "";
      return {
        title: item?.Event || item?.Category || "Untitled event",
        country: currency || item?.Country || "Global",
        date: parsedDate.toISOString(),
        impact,
        actual: item?.Actual || null,
        forecast: item?.Forecast || item?.TEForecast || null,
        previous: item?.Previous || null,
      };
    })
    .filter(Boolean);
}

function mapForexFactory(
  data: unknown[],
  startTime: number,
  endTime: number
) {
  return data
    .map((item) => {
      const rawDate = item?.date || null;
      const parsedDate = rawDate ? new Date(rawDate) : null;
      if (!parsedDate || Number.isNaN(parsedDate.getTime())) return null;
      if (parsedDate.getTime() < startTime || parsedDate.getTime() > endTime) {
        return null;
      }
      const impact = String(item?.impact || "Low");
      return {
        title: item?.title || "Untitled event",
        country: item?.country || "Global",
        date: parsedDate.toISOString(),
        impact,
        actual: item?.actual || null,
        forecast: item?.forecast || null,
        previous: item?.previous || null,
      };
    })
    .filter(Boolean);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const now = new Date();
    const startFallback = new Date(now);
    startFallback.setDate(now.getDate() - now.getDay());
    const endFallback = new Date(startFallback);
    endFallback.setDate(startFallback.getDate() + 6);
    let startDate = parseDate(searchParams.get("start"), startFallback);
    let endDate = parseDate(searchParams.get("end"), endFallback);
    if (endDate.getTime() < startDate.getTime()) {
      [startDate, endDate] = [endDate, startDate];
    }
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    const startISO = formatDate(startDate);
    const endISO = formatDate(endDate);
    const startTime = startDate.getTime();
    const endTime = endDate.getTime();

    const teUrl = `${TE_BASE}/${startISO}/${endISO}?c=guest:guest`;

    const [teRes, ffRes] = await Promise.all([
      fetch(teUrl, {
        headers: {
          "User-Agent": "profitabledge/1.0",
          Accept: "application/json",
        },
        next: { revalidate: 300 },
      }),
      fetch(FF_BASE, {
        headers: {
          "User-Agent": "profitabledge/1.0",
          Accept: "application/json",
        },
        next: { revalidate: 300 },
      }),
    ]);

    if (!teRes.ok && !ffRes.ok) {
      return NextResponse.json(
        { error: "calendar_fetch_failed" },
        { status: teRes.status || ffRes.status || 502 }
      );
    }

    const teText = teRes.ok ? await teRes.text() : "[]";
    const ffText = ffRes.ok ? await ffRes.text() : "[]";
    let teData: unknown = [];
    let ffData: unknown = [];
    try {
      teData = JSON.parse(teText);
    } catch {
      teData = [];
    }
    try {
      ffData = JSON.parse(ffText);
    } catch {
      ffData = [];
    }

    const teArray = Array.isArray(teData) ? teData : [];
    const ffArray = Array.isArray(ffData) ? ffData : [];

    const teMapped = mapTradingEconomics(teArray, startTime, endTime);
    const ffMapped = mapForexFactory(ffArray, startTime, endTime);

    const merged = [...teMapped, ...ffMapped];
    const seen = new Set<string>();
    const deduped = merged.filter((event) => {
      const key = `${event.title}-${event.country}-${event.date}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return NextResponse.json(deduped);
  } catch (error) {
    console.error("[economic-calendar]", error);
    return NextResponse.json(
      { error: "calendar_unavailable" },
      { status: 503 }
    );
  }
}
