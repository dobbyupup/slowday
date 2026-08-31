import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { apiKeys } from "../../../../../db/schema";
import { apiError, ApiError, requireSessionUser } from "../../../_shared";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser(request, { mutation: true });
    const id = Number((await context.params).id);
    if (!Number.isSafeInteger(id) || id < 1) throw new ApiError(400, "API Key 编号不正确");
    const [key] = await getDb().update(apiKeys).set({ revokedAt: new Date() })
      .where(and(eq(apiKeys.id, id), eq(apiKeys.ownerId, user.id))).returning({ id: apiKeys.id });
    if (!key) throw new ApiError(404, "API Key 不存在");
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
