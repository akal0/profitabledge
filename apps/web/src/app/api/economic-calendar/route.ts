import { NextRequest, NextResponse } from "next/server";

const TE_BASE = "https://api.tradingeconomics.com/calendar/country/all";
const FF_BASE = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";
const GUEST_TE_API_KEY = "guest:guest";
const CALENDAR_REVALIDATE_SECONDS = 300;

type TradingEconomicsItem = Record<string, unknown> & {
  Date?: string;
  ReferenceDate?: string;
  Importance?: number | string;
  Event?: string;
  Category?: string;
  Currency?: string;
  Country?: string;
  Actual?: string | number | null;
  Forecast?: string | number | null;
  TEForecast?: string | number | null;
  Previous?: string | number | null;
};

type ForexFactoryItem = Record<string, unknown> & {
  date?: string;
  impact?: string;
  title?: string;
  country?: string;
  actual?: string | number | null;
  forecast?: string | number | null;
  previous?: string | number | null;
};

type CalendarEvent = {
  title: string;
  country: string;
  date: string;
  impact: string;
  actual: string | number | null;
  forecast: string | number | null;
  previous: string | number | null;
};

type CalendarFetchResult = {
  ok: boolean;
  events: CalendarEvent[];
  status: number;
};

function parseDate(value: string | null, fallback: Date) {
  const parsed = value ? new Date(value) : fallback;
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function resolveTradingEconomicsApiKey() {
  return (
    process.env.TRADING_ECONOMICS_API_KEY?.trim() ||
    process.env.TRADINGECONOMICS_API_KEY?.trim() ||
    GUEST_TE_API_KEY
  );
}

function hasConfiguredTradingEconomicsKey(apiKey: string) {
  return apiKey !== GUEST_TE_API_KEY;
}

function mapTradingEconomics(
  data: TradingEconomicsItem[],
  startTime: number,
  endTime: number
): CalendarEvent[] {
  return data
    .map((item) => {
      const rawDate =
        typeof item.Date === "string"
          ? item.Date
          : typeof item.ReferenceDate === "string"
          ? item.ReferenceDate
          : null;
      const parsedDate = rawDate ? new Date(rawDate) : null;
      if (!parsedDate || Number.isNaN(parsedDate.getTime())) return null;
      if (parsedDate.getTime() < startTime || parsedDate.getTime() > endTime) {
        return null;
      }
      const importance =
        typeof item.Importance === "number"
          ? item.Importance
          : Number(item.Importance || 0);
      let impact = "Low";
      const eventLabel = String(item.Event || item.Category || "");
      if (eventLabel.toLowerCase().includes("holiday")) {
        impact = "Holiday";
      } else if (importance >= 3) {
        impact = "High";
      } else if (importance === 2) {
        impact = "Medium";
      }
      const currency = item.Currency ? String(item.Currency) : "";
      return {
        title: String(item.Event || item.Category || "Untitled event"),
        country: String(currency || item.Country || "Global"),
        date: parsedDate.toISOString(),
        impact,
        actual: item.Actual ?? null,
        forecast: item.Forecast ?? item.TEForecast ?? null,
        previous: item.Previous ?? null,
      };
    })
    .filter((item): item is CalendarEvent => item !== null);
}

function dedupeCalendarEvents(events: CalendarEvent[]) {
  const seen = new Set<string>();

  return events.filter((event) => {
    const key = `${event.title}-${event.country}-${event.date}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mapForexFactory(
  data: ForexFactoryItem[],
  startTime: number,
  endTime: number
): CalendarEvent[] {
  return data
    .map((item) => {
      const rawDate = typeof item.date === "string" ? item.date : null;
      const parsedDate = rawDate ? new Date(rawDate) : null;
      if (!parsedDate || Number.isNaN(parsedDate.getTime())) return null;
      if (parsedDate.getTime() < startTime || parsedDate.getTime() > endTime) {
        return null;
      }
      const impact = String(item.impact || "Low");
      return {
        title: String(item.title || "Untitled event"),
        country: String(item.country || "Global"),
        date: parsedDate.toISOString(),
        impact,
        actual: item.actual ?? null,
        forecast: item.forecast ?? null,
        previous: item.previous ?? null,
      };
    })
    .filter((item): item is CalendarEvent => item !== null);
}

async function fetchTradingEconomicsCalendar(
  startISO: string,
  endISO: string,
  startTime: number,
  endTime: number,
  apiKey: string
): Promise<CalendarFetchResult> {
  const teUrl = `${TE_BASE}/${startISO}/${endISO}?c=${encodeURIComponent(apiKey)}`;
  const response = await fetch(teUrl, {
    headers: {
      "User-Agent": "profitabledge/1.0",
      Accept: "application/json",
    },
    next: { revalidate: CALENDAR_REVALIDATE_SECONDS },
  });

  if (!response.ok) {
    return { ok: false, events: [], status: response.status };
  }

  const text = await response.text();
  let parsed: unknown = [];
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = [];
  }

  return {
    ok: true,
    events: mapTradingEconomics(
      Array.isArray(parsed) ? (parsed as TradingEconomicsItem[]) : [],
      startTime,
      endTime
    ),
    status: response.status,
  };
}

async function fetchForexFactoryCalendar(
  startTime: number,
  endTime: number
): Promise<CalendarFetchResult> {
  const response = await fetch(FF_BASE, {
    headers: {
      "User-Agent": "profitabledge/1.0",
      Accept: "application/json",
    },
    next: { revalidate: CALENDAR_REVALIDATE_SECONDS },
  });

  if (!response.ok) {
    return { ok: false, events: [], status: response.status };
  }

  const text = await response.text();
  let parsed: unknown = [];
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = [];
  }

  return {
    ok: true,
    events: mapForexFactory(
      Array.isArray(parsed) ? (parsed as ForexFactoryItem[]) : [],
      startTime,
      endTime
    ),
    status: response.status,
  };
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
    const tradingEconomicsApiKey = resolveTradingEconomicsApiKey();

    // Prefer the official TradingEconomics feed when real credentials are
    // configured. Keep the existing FairEconomy fallback in beta until we
    // fully replace the guest-tier source with a licensed production feed.
    if (hasConfiguredTradingEconomicsKey(tradingEconomicsApiKey)) {
      const teResult = await fetchTradingEconomicsCalendar(
        startISO,
        endISO,
        startTime,
        endTime,
        tradingEconomicsApiKey
      );

      if (teResult.ok) {
        return NextResponse.json(dedupeCalendarEvents(teResult.events));
      }

      const ffResult = await fetchForexFactoryCalendar(startTime, endTime);
      if (ffResult.ok) {
        return NextResponse.json(dedupeCalendarEvents(ffResult.events));
      }

      return NextResponse.json(
        { error: "calendar_fetch_failed" },
        { status: teResult.status || ffResult.status || 502 }
      );
    }

    const [teResult, ffResult] = await Promise.all([
      fetchTradingEconomicsCalendar(
        startISO,
        endISO,
        startTime,
        endTime,
        tradingEconomicsApiKey
      ),
      fetchForexFactoryCalendar(startTime, endTime),
    ]);

    if (!teResult.ok && !ffResult.ok) {
      return NextResponse.json(
        { error: "calendar_fetch_failed" },
        { status: teResult.status || ffResult.status || 502 }
      );
    }

    return NextResponse.json(
      dedupeCalendarEvents([...teResult.events, ...ffResult.events])
    );
  } catch (error) {
    console.error("[economic-calendar]", error);
    return NextResponse.json(
      { error: "calendar_unavailable" },
      { status: 503 }
    );
  }
}
