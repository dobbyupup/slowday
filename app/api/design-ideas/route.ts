import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { designIdeas, readingItems } from "../../../db/schema";
import { apiError, ApiError, boundedText, publicDesignIdea, readJson, requireApiUser } from "../_shared";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser(request);
    const rows = await getDb().select().from(designIdeas).where(eq(designIdeas.ownerId, user.id)).orderBy(desc(designIdeas.updatedAt), desc(designIdeas.id)).limit(1000);
    return Response.json({ ideas: rows.map(publicDesignIdea) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser(request, { mutation: true });
    const payload = await readJson<{ readingItemId?: unknown; title?: unknown; note?: unknown }>(request);
    const readingItemId = payload.readingItemId === undefined || payload.readingItemId === null ? null : Number(payload.readingItemId);
    if (readingItemId !== null) {
      if (!Number.isSafeInteger(readingItemId) || readingItemId < 1) throw new ApiError(400, "阅读记录编号不正确");
      const [reading] = await getDb().select({ id: readingItems.id }).from(readingItems).where(and(eq(readingItems.id, readingItemId), eq(readingItems.ownerId, user.id))).limit(1);
      if (!reading) throw new ApiError(404, "阅读记录不存在");
    }
    const [idea] = await getDb().insert(designIdeas).values({ ownerId: user.id, ownerEmail: user.email, readingItemId, title: boundedText(payload.title, "灵感名称", 160, true), note: boundedText(payload.note, "实验说明", 2000), status: "seed" }).returning();
    return Response.json({ idea: publicDesignIdea(idea) }, { status: 201 });
  } catch (error) { return apiError(error); }
}
