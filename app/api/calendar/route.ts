import { and, asc, eq, like } from "drizzle-orm";
import { getDb } from "../../../db";
import { reviews, tasks } from "../../../db/schema";
import { apiError, ApiError, publicReview, publicTask, requireApiUser, validMonth } from "../_shared";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser(request);
    const month = new URL(request.url).searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
    if (!validMonth(month)) throw new ApiError(400, "月份格式不正确");
    const db = getDb();
    const [taskRows, reviewRows] = await Promise.all([
      db.select().from(tasks).where(and(eq(tasks.ownerId, user.id), like(tasks.date, `${month}-%`))).orderBy(asc(tasks.date), asc(tasks.id)).limit(1000),
      db.select().from(reviews).where(and(eq(reviews.ownerId, user.id), like(reviews.date, `${month}-%`))).orderBy(asc(reviews.date)).limit(31),
    ]);
    return Response.json({ tasks: taskRows.map(publicTask), reviews: reviewRows.map(publicReview) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
