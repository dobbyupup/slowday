export type GoalScope = "week" | "month" | "year";

const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export function goalPeriods(anchor: string) {
  const date = new Date(`${anchor}T12:00:00`);
  const mondayOffset = (date.getDay() + 6) % 7;
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate() - mondayOffset);
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  return {
    week: { periodKey: dateKey(monday), label: `${monday.getMonth() + 1}.${monday.getDate()} — ${sunday.getMonth() + 1}.${sunday.getDate()}` },
    month: { periodKey: anchor.slice(0, 7), label: `${date.getFullYear()} 年 ${date.getMonth() + 1} 月` },
    year: { periodKey: anchor.slice(0, 4), label: `${date.getFullYear()} 年` },
  } satisfies Record<GoalScope, { periodKey: string; label: string }>;
}
