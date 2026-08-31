import { and, asc, eq, gte, lte } from "drizzle-orm";
import { getDb } from "../../../../db";
import { reviews } from "../../../../db/schema";
import { apiError, ApiError, parsePagination, publicReview, requireApiUser, todayInTimeZone, validDate } from "../../_shared";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser(request);
    const url = new URL(request.url);
    const today = todayInTimeZone();
    const from = url.searchParams.get("from") ?? `${today.slice(0, 8)}01`;
    const to = url.searchParams.get("to") ?? today;
    const { limit, offset } = parsePagination(url);
    if (!validDate(from) || !validDate(to) || from > to) throw new ApiError(400, "请提供有效的 from 与 to 日期");
    const rows = await getDb().select().from(reviews)
      .where(and(eq(reviews.ownerId, user.id), gte(reviews.date, from), lte(reviews.date, to)))
      .orderBy(asc(reviews.date)).limit(limit).offset(offset);
    return Response.json({ data: rows.map(publicReview), meta: { from, to, count: rows.length, limit, offset, hasMore: rows.length === limit } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
