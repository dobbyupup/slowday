import { getDb } from "../../../db";
import { tasks } from "../../../db/schema";
import { apiError, ApiError, boundedText, publicTask, readJson, requireApiUser, validDate } from "../_shared";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser(request, { mutation: true });
    const payload = await readJson<{ date?: string; title?: string; category?: string }>(request);
    const date = payload.date ?? "";
    const title = boundedText(payload.title, "待办内容", 200, true);
    const category = payload.category;
    if (!validDate(date) || !["工作", "生活", "成长"].includes(category ?? "")) {
      throw new ApiError(400, "待办内容不完整");
    }
    const [task] = await getDb().insert(tasks).values({ ownerId: user.id, ownerEmail: user.email, date, title, category: category as "工作" | "生活" | "成长" }).returning();
    return Response.json({ task: publicTask(task) }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
