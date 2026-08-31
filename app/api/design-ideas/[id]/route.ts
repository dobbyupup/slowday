import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { designIdeas } from "../../../../db/schema";
import { apiError, ApiError, boundedText, publicDesignIdea, readJson, requireApiUser } from "../../_shared";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser(request, { mutation: true });
    const id = Number((await context.params).id);
    const payload = await readJson<{ title?: unknown; note?: unknown; status?: unknown }>(request);
    if (!Number.isSafeInteger(id) || id < 1) throw new ApiError(400, "设计灵感编号不正确");
    const values: { title?: string; note?: string; status?: "seed" | "making" | "done"; updatedAt: Date } = { updatedAt: new Date() };
    if (payload.title !== undefined) values.title = boundedText(payload.title, "灵感名称", 160, true);
    if (payload.note !== undefined) values.note = boundedText(payload.note, "实验说明", 2000);
    if (payload.status !== undefined) {
      if (payload.status !== "seed" && payload.status !== "making" && payload.status !== "done") throw new ApiError(400, "设计状态不正确");
      values.status = payload.status;
    }
    if (values.title === undefined && values.note === undefined && values.status === undefined) throw new ApiError(400, "没有可更新的字段");
    const [idea] = await getDb().update(designIdeas).set(values).where(and(eq(designIdeas.id, id), eq(designIdeas.ownerId, user.id))).returning();
    if (!idea) throw new ApiError(404, "设计灵感不存在");
    return Response.json({ idea: publicDesignIdea(idea) });
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser(request, { mutation: true });
    const id = Number((await context.params).id);
    if (!Number.isSafeInteger(id) || id < 1) throw new ApiError(400, "设计灵感编号不正确");
    const [idea] = await getDb().delete(designIdeas).where(and(eq(designIdeas.id, id), eq(designIdeas.ownerId, user.id))).returning();
    if (!idea) throw new ApiError(404, "设计灵感不存在");
    return Response.json({ ok: true });
  } catch (error) { return apiError(error); }
}
