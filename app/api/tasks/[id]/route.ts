import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { tasks } from "../../../../db/schema";
import { apiError, ApiError, boundedText, publicTask, readJson, requireApiUser, validDate } from "../../_shared";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser(request, { mutation: true });
    const id = Number((await context.params).id);
    const payload = await readJson<{ done?: boolean; title?: string; date?: string }>(request);
    if (!Number.isSafeInteger(id) || id < 1) throw new ApiError(400, "待办编号不正确");
    const values: { done?: boolean; title?: string; date?: string; updatedAt: Date } = { updatedAt: new Date() };
    if (typeof payload.done === "boolean") values.done = payload.done;
    if (payload.title !== undefined) values.title = boundedText(payload.title, "待办内容", 200, true);
    if (payload.date !== undefined) {
      if (!validDate(payload.date)) throw new ApiError(400, "待办日期不正确");
      values.date = payload.date;
    }
    if (values.done === undefined && values.title === undefined && values.date === undefined) throw new ApiError(400, "没有可更新的字段");
    const [task] = await getDb().update(tasks).set(values).where(and(eq(tasks.id, id), eq(tasks.ownerId, user.id))).returning();
    if (!task) throw new ApiError(404, "待办不存在");
    return Response.json({ task: publicTask(task) });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser(request, { mutation: true });
    const id = Number((await context.params).id);
    if (!Number.isSafeInteger(id) || id < 1) throw new ApiError(400, "待办编号不正确");
    const [task] = await getDb().delete(tasks).where(and(eq(tasks.id, id), eq(tasks.ownerId, user.id))).returning();
    if (!task) throw new ApiError(404, "待办不存在");
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
