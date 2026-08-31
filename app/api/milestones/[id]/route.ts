import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { brandMilestones } from "../../../../db/schema";
import { apiError, ApiError, boundedText, publicBrandMilestone, readJson, requireApiUser, validDate } from "../../_shared";

const phases = ["产品开发", "视觉设计", "包装设计", "拍摄计划", "内容选题", "品牌定位", "暂时研究"] as const;
const statuses = ["planned", "in_progress", "done"] as const;
type Phase = typeof phases[number];
type Status = typeof statuses[number];

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser(request, { mutation: true });
    const id = Number((await context.params).id);
    if (!Number.isSafeInteger(id) || id < 1) throw new ApiError(400, "里程碑编号不正确");
    const payload = await readJson<{ title?: unknown; phase?: unknown; dueDate?: unknown; status?: unknown; progress?: unknown; deliverable?: unknown }>(request);
    const values: { title?: string; phase?: Phase; dueDate?: string; status?: Status; progress?: number; deliverable?: string; updatedAt: Date } = { updatedAt: new Date() };
    if (payload.title !== undefined) values.title = boundedText(payload.title, "里程碑名称", 180, true);
    if (payload.phase !== undefined) {
      if (typeof payload.phase !== "string" || !phases.includes(payload.phase as Phase)) throw new ApiError(400, "品牌阶段不正确");
      values.phase = payload.phase as Phase;
    }
    if (payload.dueDate !== undefined) {
      if (typeof payload.dueDate !== "string" || !validDate(payload.dueDate)) throw new ApiError(400, "截止日期不正确");
      values.dueDate = payload.dueDate;
    }
    if (payload.status !== undefined) {
      if (typeof payload.status !== "string" || !statuses.includes(payload.status as Status)) throw new ApiError(400, "里程碑状态不正确");
      values.status = payload.status as Status;
    }
    if (payload.progress !== undefined) {
      const progress = Number(payload.progress);
      if (!Number.isInteger(progress) || progress < 0 || progress > 100) throw new ApiError(400, "进度应为 0–100");
      values.progress = progress;
      if (progress === 100) values.status = "done";
      else if (progress > 0 && values.status === undefined) values.status = "in_progress";
    }
    if (values.status === "done") values.progress = 100;
    if (payload.deliverable !== undefined) values.deliverable = boundedText(payload.deliverable, "交付物", 1000);
    if (Object.keys(values).length === 1) throw new ApiError(400, "没有可更新的字段");
    const [milestone] = await getDb().update(brandMilestones).set(values).where(and(eq(brandMilestones.id, id), eq(brandMilestones.ownerId, user.id))).returning();
    if (!milestone) throw new ApiError(404, "里程碑不存在");
    return Response.json({ milestone: publicBrandMilestone(milestone) });
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser(request, { mutation: true });
    const id = Number((await context.params).id);
    if (!Number.isSafeInteger(id) || id < 1) throw new ApiError(400, "里程碑编号不正确");
    const [milestone] = await getDb().delete(brandMilestones).where(and(eq(brandMilestones.id, id), eq(brandMilestones.ownerId, user.id))).returning();
    if (!milestone) throw new ApiError(404, "里程碑不存在");
    return Response.json({ ok: true });
  } catch (error) { return apiError(error); }
}
