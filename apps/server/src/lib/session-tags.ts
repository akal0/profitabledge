const SESSION_COLORS: Record<string, string> = {
  Asia: "#FF33F3",
  London: "#3357FF",
  "New York": "#FF5733",
  "London Lunch": "#FF8C33",
  "London Close": "#8C33FF",
};

const SESSION_WINDOWS = [
  { name: "London Lunch", startMinutes: 660, endMinutes: 780 },
  { name: "London Close", startMinutes: 960, endMinutes: 1020 },
  { name: "New York", startMinutes: 780, endMinutes: 1320 },
  { name: "London", startMinutes: 420, endMinutes: 960 },
  { name: "Asia", startMinutes: 0, endMinutes: 420 },
] as const;

export function getSessionColor(sessionTag: string | null | undefined) {
  if (!sessionTag) {
    return null;
  }

  return SESSION_COLORS[sessionTag] ?? "#FF5733";
}

function isMinuteInRange(
  minuteOfDay: number,
  startMinutes: number,
  endMinutes: number
) {
  if (startMinutes <= endMinutes) {
    return minuteOfDay >= startMinutes && minuteOfDay < endMinutes;
  }

  return minuteOfDay >= startMinutes || minuteOfDay < endMinutes;
}

export function deriveSessionTagAt(value: Date | null | undefined) {
  if (!value || Number.isNaN(value.getTime())) {
    return {
      sessionTag: null,
      sessionTagColor: null,
    };
  }

  const minuteOfDay = value.getUTCHours() * 60 + value.getUTCMinutes();
  const match = SESSION_WINDOWS.find((session) =>
    isMinuteInRange(minuteOfDay, session.startMinutes, session.endMinutes)
  );
  const sessionTag = match?.name ?? null;

  return {
    sessionTag,
    sessionTagColor: getSessionColor(sessionTag),
  };
}
