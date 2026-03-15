"use client";

import {
  CURRENCY_FLAGS,
  IMPACT_ORDER,
  type ImpactLevel,
} from "./economic-calendar-types";

export function formatDateLabel(date: Date) {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatTimeLabel(date: Date) {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatWeekdayLabel(date: Date) {
  const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
  const day = date.getDate();
  const j = day % 10;
  const k = day % 100;
  const suffix =
    j === 1 && k !== 11
      ? "st"
      : j === 2 && k !== 12
        ? "nd"
        : j === 3 && k !== 13
          ? "rd"
          : "th";
  return `${weekday} ${day}${suffix}`;
}

export function normalizeImpact(impact?: string): ImpactLevel {
  if (!impact) return "Low";
  const trimmed = impact.trim();
  if ((IMPACT_ORDER as readonly string[]).includes(trimmed)) {
    return trimmed as ImpactLevel;
  }
  if (trimmed.toLowerCase().includes("holiday")) return "Holiday";
  if (trimmed.toLowerCase().includes("high")) return "High";
  if (trimmed.toLowerCase().includes("medium")) return "Medium";
  return "Low";
}

export function getCurrencyLabel(code?: string) {
  if (!code) return "Global";
  const trimmed = code.trim().toUpperCase();
  const flag = CURRENCY_FLAGS[trimmed];
  return flag ? `${flag} ${trimmed}` : trimmed;
}

export function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

export function buildMonthGrid(date: Date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const startWeekday = first.getDay();
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - startWeekday);

  const days: Date[] = [];
  for (let i = 0; i < 42; i += 1) {
    const current = new Date(gridStart);
    current.setDate(gridStart.getDate() + i);
    days.push(current);
  }
  return days;
}

export function startOfWeek(date: Date) {
  const next = startOfDay(date);
  const day = next.getDay();
  next.setDate(next.getDate() - day);
  return next;
}

export function endOfWeek(date: Date) {
  const start = startOfWeek(date);
  const next = new Date(start);
  next.setDate(start.getDate() + 6);
  next.setHours(23, 59, 59, 999);
  return next;
}
