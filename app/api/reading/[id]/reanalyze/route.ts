import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { readingItems } from "../../../../../db/schema";
import { apiError, ApiError, enforceRateLimit, publicReading, requireApiUser } from "../../../_shared";
import { attachmentKeyFromUrl, getAttachmentBucket } from "../../_attachments";
import { interpretScreenshotsAutomatically, ScreenshotInterpretationError } from "../../import-media/_interpret";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser(request, { mutation: true });
    await enforceRateLimit(`reading-reanalyze:${user.id}`, 10);
    const id = Number((await context.params).id);
    if (!Number.isSafeInteger(id) || id < 1) throw new ApiError(400, "阅读记录编号不正确");
    const db = getDb();
    const [previous] = await db.select().from(readingItems).where(and(eq(readingItems.id, id), eq(readingItems.ownerId, user.id))).limit(1);
    if (!previous) throw new ApiError(404, "阅读记录不存在");
    const key = attachmentKeyFromUrl(previous.imageUrl);
    if (!key) throw new ApiError(400, "这条记录没有可重新识别的原图");
    const object = await getAttachmentBucket().get(key);
    if (!object || object.customMetadata?.ownerId !== user.id) throw new ApiError(404, "原图已经不存在");
    let interpretation;
    try {
      const result = await interpretScreenshotsAutomatically(user.id, [{ type: object.httpMetadata?.contentType || "image/jpeg", bytes: new Uint8Array(await object.arrayBuffer()) }], "请重新识别图片，并完整分析设计比例、设计准则、设计参考和真正值得借鉴的灵感", { strict: true });
      [interpretation] = result.interpretations;
    } catch (error) {
      if (error instanceof ScreenshotInterpretationError) throw new ApiError(error.status, error.userMessage);
      throw new ApiError(502, "视觉模型没有返回可用的中文解读，请稍后重试");
    }
    if (!interpretation) throw new ApiError(422, "当前模型仍未识别图片，请检查 AI 配置后重试");
    const [item] = await db.update(readingItems).set({ title: interpretation.title, source: interpretation.source || "截图识别", url: interpretation.url, note: interpretation.description, tags: interpretation.tags, resourceType: interpretation.resourceType, primaryCategory: interpretation.primaryCategory, intendedUse: interpretation.intendedUse, updatedAt: new Date() }).where(and(eq(readingItems.id, id), eq(readingItems.ownerId, user.id))).returning();
    return Response.json({ item: publicReading(item) });
  } catch (error) {
    return apiError(error);
  }
}
