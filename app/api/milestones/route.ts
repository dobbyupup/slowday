import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { brandMilestones, readingItems } from "../../../db/schema";
import { apiError, ApiError, boundedText, publicBrandMilestone, readJson, requireApiUser, validDate } from "../_shared";

const phases = ["产品开发", "视觉设计", "包装设计", "拍摄计划", "内容选题", "品牌定位", "暂时研究"] as const;
type Phase = typeof phases[number];

export async function GET(request: Request) {
  try {
    const user = await requireApiUser(request);
    const rows = await getDb().select().from(brandMilestones).where(eq(brandMilestones.ownerId, user.id)).orderBy(asc(brandMilestones.dueDate), asc(brandMilestones.id)).limit(500);
    return Response.json({ milestones: rows.map(publicBrandMilestone) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser(request, { mutation: true });
    const payload = await readJson<{ title?: unknown; phase?: unknown; dueDate?: unknown; deliverable?: unknown; sourceReadingId?: unknown }>(request);
    if (typeof payload.phase !== "string" || !phases.includes(payload.phase as Phase)) throw new ApiError(400, "品牌阶段不正确");
    if (typeof payload.dueDate !== "string" || !validDate(payload.dueDate)) throw new ApiError(400, "截止日期不正确");
    const sourceReadingId = payload.sourceReadingId === undefined || payload.sourceReadingId === null ? null : Number(payload.sourceReadingId);
    if (sourceReadingId !== null) {
      if (!Number.isSafeInteger(sourceReadingId) || sourceReadingId < 1) throw new ApiError(400, "灵感编号不正确");
      const [reading] = await getDb().select({ id: readingItems.id }).from(readingItems).where(and(eq(readingItems.id, sourceReadingId), eq(readingItems.ownerId, user.id))).limit(1);
      if (!reading) throw new ApiError(404, "品牌灵感不存在");
      const [existing] = await getDb().select().from(brandMilestones).where(and(eq(brandMilestones.ownerId, user.id), eq(brandMilestones.sourceReadingId, sourceReadingId))).limit(1);
      if (existing) return Response.json({ milestone: publicBrandMilestone(existing), duplicate: true });
    }
    const [milestone] = await getDb().insert(brandMilestones).values({
      ownerId: user.id,
      ownerEmail: user.email,
      sourceReadingId,
      title: boundedText(payload.title, "里程碑名称", 180, true),
      phase: payload.phase as Phase,
      dueDate: payload.dueDate,
      deliverable: boundedText(payload.deliverable, "交付物", 1000),
    }).returning();
    return Response.json({ milestone: publicBrandMilestone(milestone), duplicate: false }, { status: 201 });
  } catch (error) { return apiError(error); }
}
