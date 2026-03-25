export type GoalType = "daily" | "weekly" | "monthly" | "milestone";

function padDatePart(value: number) {
  return value.toString().padStart(2, "0");
}

export function toLocalDateString(date: Date) {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(
    date.getDate()
  )}`;
}

export function getGoalSchedule(type: GoalType, fromDate = new Date()) {
  const start = new Date(
    fromDate.getFullYear(),
    fromDate.getMonth(),
    fromDate.getDate()
  );

  let deadline: string | null = null;

  switch (type) {
    case "daily": {
      const nextDay = new Date(start);
      nextDay.setDate(nextDay.getDate() + 1);
      deadline = toLocalDateString(nextDay);
      break;
    }
    case "weekly": {
      const nextWeek = new Date(start);
      nextWeek.setDate(nextWeek.getDate() + 7);
      deadline = toLocalDateString(nextWeek);
      break;
    }
    case "monthly":
      deadline = toLocalDateString(
        new Date(start.getFullYear(), start.getMonth() + 1, 0)
      );
      break;
    case "milestone":
      deadline = null;
      break;
  }

  return {
    startDate: toLocalDateString(start),
    deadline,
  };
}

export function parseGoalDate(dateString: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
  if (match) {
    const [, year, month, day] = match;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  const parsed = new Date(dateString);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
