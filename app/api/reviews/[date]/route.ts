import { getDb } from "../../../../db";
import { reviews } from "../../../../db/schema";
import { apiError, ApiError, boundedText, publicReview, readJson, requireApiUser, validDate } from "../../_shared";

export async function PUT(request: Request, context: { params: Promise<{ date: string }> }) {
  try {
    const user = await requireApiUser(request, { mutation: true });
    const date = (await context.params).date;
    const payload = await readJson<{ mood?: string; energy?: number; text?: string; keep?: string; start?: string; improve?: string; stop?: string }>(request);
    if (!validDate(date)) throw new ApiError(400, "日期格式不正确");
    const energy = Number(payload.energy ?? 3);
    if (!Number.isInteger(energy) || energy < 1 || energy > 5) throw new ApiError(400, "能量值应为 1–5");
    const allowedMoods = ["开心", "轻松", "平静", "低落", "疲惫"];
    if (payload.mood !== undefined && !allowedMoods.includes(payload.mood)) throw new ApiError(400, "心情标签不正确");
    const values = {
      mood: payload.mood ?? "平静",
      energy,
      text: boundedText(payload.text, "日记原文", 5000),
      keep: boundedText(payload.keep, "保持的", 1500),
      start: boundedText(payload.start, "开始的", 1500),
      improve: boundedText(payload.improve, "改进的", 1500),
      stop: boundedText(payload.stop, "舍弃的", 1500),
      updatedAt: new Date(),
    };
    const [review] = await getDb().insert(reviews)
      .values({ ownerId: user.id, ownerEmail: user.email, date, ...values })
      .onConflictDoUpdate({ target: [reviews.ownerId, reviews.date], set: values })
      .returning();
    return Response.json({ review: publicReview(review) });
  } catch (error) {
    return apiError(error);
  }
}
