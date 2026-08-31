import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { reviews } from "../../../../db/schema";
import { apiError, ApiError, boundedText, readJson, requireSessionUser, validDate } from "../../_shared";

type JournalEntry = { date?: string; text?: string };

export async function POST(request: Request) {
  try {
    const user = await requireSessionUser(request, { mutation: true });
    const payload = await readJson<{ entries?: JournalEntry[] }>(request);
    if (!Array.isArray(payload.entries) || payload.entries.length < 1 || payload.entries.length > 25) {
      throw new ApiError(400, "每次请导入 1–25 篇日记");
    }

    const entries = payload.entries.map(entry => {
      const date = entry.date ?? "";
      if (!validDate(date)) throw new ApiError(400, `日期 ${date || "（空）"} 不正确`);
      return { date, text: boundedText(entry.text, `${date} 日记`, 5000, true) };
    });
    if (new Set(entries.map(entry => entry.date)).size !== entries.length) throw new ApiError(400, "同一批次存在重复日期");

    const db = getDb();
    const imported: string[] = [];
    const skipped: string[] = [];
    for (const entry of entries) {
      const [existing] = await db.select({ id: reviews.id, text: reviews.text }).from(reviews)
        .where(and(eq(reviews.ownerId, user.id), eq(reviews.date, entry.date))).limit(1);
      if (existing?.text.trim()) {
        skipped.push(entry.date);
        continue;
      }
      if (existing) {
        await db.update(reviews).set({ text: entry.text, updatedAt: new Date() }).where(eq(reviews.id, existing.id));
      } else {
        await db.insert(reviews).values({ ownerId: user.id, ownerEmail: user.email, date: entry.date, text: entry.text });
      }
      imported.push(entry.date);
    }
    return Response.json({ imported, skipped });
  } catch (error) {
    return apiError(error);
  }
}
