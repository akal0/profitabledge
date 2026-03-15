"use client";

export function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour < 5) return "Remember to catch some sleep";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Late night";
}

export function getActiveTradingSession() {
  const now = new Date();
  const utcHour = now.getUTCHours();

  if (utcHour >= 12 && utcHour < 21) {
    return {
      name: "New York",
      color: "bg-blue-500/20 text-blue-400 border-blue-500/20",
    };
  }

  if (utcHour >= 7 && utcHour < 16) {
    return {
      name: "London",
      color: "bg-purple-500/20 text-purple-400 border-purple-500/20",
    };
  }

  if (utcHour >= 0 && utcHour < 9) {
    return {
      name: "Tokyo",
      color: "bg-amber-500/20 text-amber-400 border-amber-500/20",
    };
  }

  return {
    name: "Sydney",
    color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/20",
  };
}
