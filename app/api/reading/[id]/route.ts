import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { designIdeas, readingItems } from "../../../../db/schema";
import { apiError, ApiError, publicReading, readJson, requireApiUser } from "../../_shared";
import { readingValues, type ReadingPayload } from "../route";
import { attachmentKeyFromUrl, getAttachmentBucket } from "../_attachments";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser(request, { mutation: true });
    const id = Number((await context.params).id);
    if (!Number.isSafeInteger(id) || id < 1) throw new ApiError(400, "阅读记录编号不正确");
    const db = getDb();
    const [previous] = await db.select().from(readingItems).where(and(eq(readingItems.id, id), eq(readingItems.ownerId, user.id))).limit(1);
    if (!previous) throw new ApiError(404, "阅读记录不存在");
    const payload = await readJson<ReadingPayload>(request);
    const values = readingValues({
      date: payload.date ?? previous.date, title: payload.title ?? previous.title, source: payload.source ?? previous.source,
      url: payload.url ?? previous.url, imageUrl: payload.imageUrl ?? previous.imageUrl, note: payload.note ?? previous.note,
      tags: payload.tags ?? previous.tags, resourceType: payload.resourceType ?? previous.resourceType,
      primaryCategory: payload.primaryCategory ?? previous.primaryCategory, workflowStatus: payload.workflowStatus ?? previous.workflowStatus,
      intendedUse: payload.intendedUse ?? previous.intendedUse, topic: payload.topic ?? previous.topic,
    });
    const [item] = await db.update(readingItems).set({ ...values, updatedAt: new Date() }).where(and(eq(readingItems.id, id), eq(readingItems.ownerId, user.id))).returning();
    if (!item) throw new ApiError(404, "阅读记录不存在");
    const replacedAttachment = attachmentKeyFromUrl(previous.imageUrl);
    if (replacedAttachment && previous.imageUrl !== values.imageUrl) {
      try { await getAttachmentBucket().delete(replacedAttachment); } catch { /* metadata update still wins */ }
    }
    return Response.json({ item: publicReading(item) });
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser(request, { mutation: true });
    const id = Number((await context.params).id);
    if (!Number.isSafeInteger(id) || id < 1) throw new ApiError(400, "阅读记录编号不正确");
    const db = getDb();
    const [item] = await db.select({ id: readingItems.id, imageUrl: readingItems.imageUrl }).from(readingItems).where(and(eq(readingItems.id, id), eq(readingItems.ownerId, user.id))).limit(1);
    if (!item) throw new ApiError(404, "阅读记录不存在");
    const attachmentKey = attachmentKeyFromUrl(item.imageUrl);
    if (attachmentKey) {
      try { await getAttachmentBucket().delete(attachmentKey); } catch { /* record deletion still wins */ }
    }
    await db.batch([
      db.update(designIdeas).set({ readingItemId: null, updatedAt: new Date() }).where(and(eq(designIdeas.ownerId, user.id), eq(designIdeas.readingItemId, id))),
      db.delete(readingItems).where(and(eq(readingItems.id, id), eq(readingItems.ownerId, user.id))),
    ]);
    return Response.json({ ok: true });
  } catch (error) { return apiError(error); }
}
