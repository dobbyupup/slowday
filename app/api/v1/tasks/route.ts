import { and, asc, eq, gte, lte } from "drizzle-orm";
import { getDb } from "../../../../db";
import { tasks } from "../../../../db/schema";
import { apiError, ApiError, boundedText, parsePagination, publicTask, readJson, requireApiUser, todayInTimeZone, validDate } from "../../_shared";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser(request);
    const url = new URL(request.url);
    const from = url.searchParams.get("from") ?? todayInTimeZone();
    const to = url.searchParams.get("to") ?? from;
    const { limit, offset } = parsePagination(url);
    if (!validDate(from) || !validDate(to) || from > to) throw new ApiError(400, "请提供有效的 from 与 to 日期");
    const rows = await getDb().select().from(tasks)
      .where(and(eq(tasks.ownerId, user.id), gte(tasks.date, from), lte(tasks.date, to)))
      .orderBy(asc(tasks.date), asc(tasks.id)).limit(limit).offset(offset);
    return Response.json({ data: rows.map(publicTask), meta: { from, to, count: rows.length, limit, offset, hasMore: rows.length === limit } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser(request, { mutation: true });
    const payload = await readJson<{ date?: string; title?: string }>(request);
    const date = payload.date ?? "";
    const title = boundedText(payload.title, "title", 200, true);
    if (!validDate(date)) throw new ApiError(400, "date 与 title 为必填项");
    const [task] = await getDb().insert(tasks).values({ ownerId: user.id, ownerEmail: user.email, date, title, category: "工作" }).returning();
    return Response.json({ data: publicTask(task) }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
