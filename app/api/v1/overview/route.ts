import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { getDb } from "../../../../db";
import { goals, reviews, tasks } from "../../../../db/schema";
import { apiError, ApiError, publicReview, requireApiUser, todayInTimeZone, validDate } from "../../_shared";
import { goalPeriods, type GoalScope } from "../../goals/_period";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser(request);
    const url = new URL(request.url);
    const periodParam = url.searchParams.get("period");
    const period = periodParam === "week" || periodParam === "year" ? periodParam : "month";
    const anchor = url.searchParams.get("anchor") ?? todayInTimeZone();
    if (!validDate(anchor)) throw new ApiError(400, "日期格式应为 YYYY-MM-DD");
    const anchorDate = new Date(`${anchor}T12:00:00`);
    if (Number.isNaN(anchorDate.getTime())) throw new ApiError(400, "日期不正确");
    let fromDate: Date;
    let toDate: Date;
    if (period === "week") {
      const mondayOffset = (anchorDate.getDay() + 6) % 7;
      fromDate = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate() - mondayOffset);
      toDate = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate() + 6);
    } else if (period === "year") {
      fromDate = new Date(anchorDate.getFullYear(), 0, 1);
      toDate = new Date(anchorDate.getFullYear(), 11, 31);
    } else {
      fromDate = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
      toDate = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0);
    }
    const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const from = dateKey(fromDate);
    const to = dateKey(toDate);
    const label = period === "week"
      ? `${fromDate.getMonth() + 1} 月 ${fromDate.getDate()} 日 – ${toDate.getMonth() + 1} 月 ${toDate.getDate()} 日`
      : period === "year" ? `${anchorDate.getFullYear()} 年` : `${anchorDate.getFullYear()} 年 ${anchorDate.getMonth() + 1} 月`;
    const db = getDb();
    const periods = goalPeriods(anchor);
    const yearlyMonthPeriods = period === "year" ? Array.from({ length: 12 }, (_, monthIndex) => {
      const monthAnchor = `${anchorDate.getFullYear()}-${String(monthIndex + 1).padStart(2, "0")}-01`;
      return goalPeriods(monthAnchor).month;
    }) : [];
    const goalPeriodKeys = [...Object.values(periods).map(item => item.periodKey), ...yearlyMonthPeriods.map(item => item.periodKey)];
    const weekFrom = periods.week.periodKey;
    const weekStart = new Date(`${weekFrom}T12:00:00`);
    const weekTo = dateKey(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6));
    const [taskRows, reviewRows, goalRows, weekTaskRows, weekReviewRows] = await Promise.all([
      db.select().from(tasks).where(and(eq(tasks.ownerId, user.id), gte(tasks.date, from), lte(tasks.date, to))).orderBy(asc(tasks.date), asc(tasks.id)).limit(2000),
      db.select().from(reviews).where(and(eq(reviews.ownerId, user.id), gte(reviews.date, from), lte(reviews.date, to))).orderBy(asc(reviews.date)).limit(366),
      db.select().from(goals).where(and(eq(goals.ownerId, user.id), inArray(goals.periodKey, goalPeriodKeys))).limit(24),
      db.select().from(tasks).where(and(eq(tasks.ownerId, user.id), gte(tasks.date, weekFrom), lte(tasks.date, weekTo))).limit(500),
      db.select().from(reviews).where(and(eq(reviews.ownerId, user.id), gte(reviews.date, weekFrom), lte(reviews.date, weekTo))).limit(7),
    ]);
    const completed = taskRows.filter(task => task.done).length;
    const moodCounts = reviewRows.reduce<Record<string, number>>((counts, review) => {
      counts[review.mood] = (counts[review.mood] ?? 0) + 1;
      return counts;
    }, {});
    const dominantMood = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "暂无";
    const averageEnergy = reviewRows.length
      ? Number((reviewRows.reduce((sum, review) => sum + review.energy, 0) / reviewRows.length).toFixed(1))
      : 0;
    return Response.json({
      period,
      anchor,
      from,
      to,
      label,
      summary: {
        reviewDays: reviewRows.length,
        taskCount: taskRows.length,
        completed,
        completionRate: Math.round(completed / Math.max(taskRows.length, 1) * 100),
        averageEnergy,
        dominantMood,
      },
      moodCounts,
      weekSummary: {
        taskCount: weekTaskRows.length,
        completed: weekTaskRows.filter(task => task.done).length,
        completionRate: Math.round(weekTaskRows.filter(task => task.done).length / Math.max(weekTaskRows.length, 1) * 100),
        reviewDays: weekReviewRows.length,
      },
      goals: (Object.keys(periods) as GoalScope[]).reduce<Record<GoalScope, { scope: GoalScope; periodKey: string; label: string; content: string }>>((items, scope) => {
        const period = periods[scope];
        const row = goalRows.find(goal => goal.scope === scope && goal.periodKey === period.periodKey);
        items[scope] = { scope, periodKey: period.periodKey, label: period.label, content: row?.content ?? "", progress: row?.progress ?? 0 };
        return items;
      }, {} as Record<GoalScope, { scope: GoalScope; periodKey: string; label: string; content: string; progress: number }>),
      monthlyGoals: yearlyMonthPeriods.map((monthPeriod, monthIndex) => {
        const row = goalRows.find(goal => goal.scope === "month" && goal.periodKey === monthPeriod.periodKey);
        return { scope: "month" as const, periodKey: monthPeriod.periodKey, label: `${monthIndex + 1} 月`, content: row?.content ?? "", progress: row?.progress ?? 0 };
      }),
      reviews: reviewRows.map(publicReview),
      tasksByDate: taskRows.reduce<Record<string, { total: number; completed: number }>>((days, task) => {
        days[task.date] ??= { total: 0, completed: 0 };
        days[task.date].total += 1;
        if (task.done) days[task.date].completed += 1;
        return days;
      }, {}),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
