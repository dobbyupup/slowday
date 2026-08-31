import { getDb } from "../../../db";
import { goals } from "../../../db/schema";
import { apiError, ApiError, boundedText, enforceRateLimit, readJson, requireSessionUser, validDate } from "../_shared";
import { goalPeriods, type GoalScope } from "./_period";

export async function PUT(request: Request) {
  try {
    const user = await requireSessionUser(request, { mutation: true });
    await enforceRateLimit(`goal-save:${user.id}`, 30);
    const payload = await readJson<{ scope?: unknown; anchor?: unknown; content?: unknown; progress?: unknown }>(request);
    if (payload.scope !== "week" && payload.scope !== "month" && payload.scope !== "year") throw new ApiError(400, "目标周期不正确");
    if (typeof payload.anchor !== "string" || !validDate(payload.anchor)) throw new ApiError(400, "目标日期不正确");
    const scope: GoalScope = payload.scope;
    const content = boundedText(payload.content, "目标", 1000);
    const progress = Number(payload.progress ?? 0);
    if (!Number.isInteger(progress) || progress < 0 || progress > 100) throw new ApiError(400, "目标完成度应为 0–100");
    const period = goalPeriods(payload.anchor)[scope];
    const now = new Date();
    const [item] = await getDb().insert(goals).values({ ownerId: user.id, scope, periodKey: period.periodKey, content, progress, updatedAt: now })
      .onConflictDoUpdate({ target: [goals.ownerId, goals.scope, goals.periodKey], set: { content, progress, updatedAt: now } })
      .returning();
    return Response.json({ goal: { scope, periodKey: item.periodKey, label: period.label, content: item.content, progress: item.progress, updatedAt: item.updatedAt } });
  } catch (error) {
    return apiError(error);
  }
}
