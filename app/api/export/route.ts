import { asc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { aiConfigs, brandMilestones, brandProfiles, brandProfileVersions, designIdeas, readingItems, reviews, tasks } from "../../../db/schema";
import { apiError, publicBrandMilestone, publicDesignIdea, publicReading, publicReview, publicTask, requireSessionUser } from "../_shared";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireSessionUser(request);
    const db = getDb();
    const url = new URL(request.url);
    const format = url.searchParams.get("format") || "json";
    const [taskRows, reviewRows, readingRows, designRows, configRows, profileRows, profileHistory, milestoneRows] = await Promise.all([
      db.select().from(tasks).where(eq(tasks.ownerId, user.id)).orderBy(asc(tasks.date), asc(tasks.id)).limit(10_000),
      db.select().from(reviews).where(eq(reviews.ownerId, user.id)).orderBy(asc(reviews.date)).limit(10_000),
      db.select().from(readingItems).where(eq(readingItems.ownerId, user.id)).orderBy(asc(readingItems.date), asc(readingItems.id)).limit(10_000),
      db.select().from(designIdeas).where(eq(designIdeas.ownerId, user.id)).orderBy(asc(designIdeas.id)).limit(10_000),
      db.select({ provider: aiConfigs.provider, model: aiConfigs.model, baseUrl: aiConfigs.baseUrl, keyHint: aiConfigs.keyHint, updatedAt: aiConfigs.updatedAt }).from(aiConfigs).where(eq(aiConfigs.ownerId, user.id)).limit(1),
      db.select().from(brandProfiles).where(eq(brandProfiles.ownerId, user.id)).limit(1),
      db.select().from(brandProfileVersions).where(eq(brandProfileVersions.ownerId, user.id)).orderBy(asc(brandProfileVersions.version)).limit(1000),
      db.select().from(brandMilestones).where(eq(brandMilestones.ownerId, user.id)).orderBy(asc(brandMilestones.dueDate)).limit(10_000),
    ]);
    const stamp = new Date().toISOString().slice(0, 10);
    const data = { format: "slowday-export", version: 3, exportedAt: new Date().toISOString(), account: { displayName: user.displayName }, brandProfile: profileRows[0] ?? null, brandProfileHistory: profileHistory.map(row => ({ ...row, snapshot: JSON.parse(row.snapshot) })), tasks: taskRows.map(publicTask), reviews: reviewRows.map(publicReview), knowledge: readingRows.map(publicReading), followups: milestoneRows.map(publicBrandMilestone), designIdeas: designRows.map(publicDesignIdea), aiConfig: configRows[0] ?? null };
    const exported = format === "markdown" ? toMarkdown(data) : format === "csv" ? toCsv(data.knowledge) : JSON.stringify(data, null, 2);
    const extension = format === "markdown" ? "md" : format === "csv" ? "csv" : "json";
    const contentType = format === "markdown" ? "text/markdown" : format === "csv" ? "text/csv" : "application/json";
    return new Response(exported, {
      headers: {
        "Content-Type": `${contentType}; charset=utf-8`,
        "Content-Disposition": `attachment; filename="slowday-brand-archive-${stamp}.${extension}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}

function csvCell(value: unknown) { return `"${String(value ?? "").replaceAll('"', '""')}"`; }
function toCsv(items: Array<ReturnType<typeof publicReading>>) {
  const headers = ["日期", "类型", "主分类", "标题", "来源", "原文链接", "图片链接", "细分标签", "用途", "专题", "状态", "中文解读"];
  const rows = items.map(item => [item.date, item.resourceType, item.primaryCategory, item.title, item.source, item.url, item.imageUrl, item.tags, item.intendedUse, item.topic, item.workflowStatus, item.note]);
  return `\uFEFF${[headers, ...rows].map(row => row.map(csvCell).join(",")).join("\n")}`;
}

function toMarkdown(data: { exportedAt: string; account: { displayName: string }; brandProfile: typeof brandProfiles.$inferSelect | null; knowledge: Array<ReturnType<typeof publicReading>> }) {
  const profile = data.brandProfile;
  const profileLines = profile ? [["品牌故事", profile.story], ["核心理念", profile.philosophy], ["目标用户", profile.audience], ["品牌关键词", profile.keywords], ["差异化特点", profile.differentiation], ["产品方向", profile.productDirection], ["视觉语言", profile.visualLanguage], ["年度目标", profile.annualGoal]].map(([label, value]) => `## ${label}\n\n${value || "未填写"}`).join("\n\n") : "尚未建立品牌档案。";
  const knowledge = data.knowledge.map(item => `## ${item.title}\n\n- 日期：${item.date}\n- 类型：${item.resourceType}\n- 分类：${item.primaryCategory}\n- 来源：${item.source || "未标注"}\n- 原文：${item.url || "无"}\n- 图片：${item.imageUrl || "无"}\n- 标签：${item.tags || "无"}\n- 用途：${item.intendedUse}\n- 专题：${item.topic || "未归入专题"}\n\n${item.note}`).join("\n\n---\n\n");
  return `# ${data.account.displayName} 的品牌档案\n\n导出时间：${data.exportedAt}\n\n${profileLines}\n\n# 品牌知识库\n\n${knowledge || "暂无资料"}\n`;
}
