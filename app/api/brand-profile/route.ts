import { and, desc, eq, gt } from "drizzle-orm";
import { getDb } from "../../../db";
import { brandProfiles, brandProfileVersions, readingItems } from "../../../db/schema";
import { apiError, boundedText, readJson, requireApiUser } from "../_shared";

const emptyProfile = { story: "", philosophy: "", audience: "", keywords: "", differentiation: "", productDirection: "", visualLanguage: "", annualGoal: "", version: 0, updatedAt: null };
const branchLabels = { story: "品牌故事", philosophy: "核心理念", audience: "目标用户", keywords: "品牌关键词", differentiation: "差异化特点", productDirection: "产品方向", visualLanguage: "视觉语言", annualGoal: "年度目标" } as const;

function parseBranchLabels(value?: string) {
  try {
    const parsed = JSON.parse(value || "{}") as Record<string, unknown>;
    return Object.fromEntries(Object.keys(branchLabels).flatMap(key => typeof parsed[key] === "string" && parsed[key].trim() ? [[key, parsed[key].trim().slice(0, 30)]] : []));
  } catch { return {}; }
}

function readBranchLabels(value: unknown, fallback = "{}") {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : parseBranchLabels(fallback);
  return Object.fromEntries(Object.keys(branchLabels).flatMap(key => typeof source[key] === "string" && source[key].trim() ? [[key, boundedText(source[key], "卡片标题", 30)]] : []));
}

function publicProfile(row?: typeof brandProfiles.$inferSelect) {
  return row ? { story: row.story, philosophy: row.philosophy, audience: row.audience, keywords: row.keywords, differentiation: row.differentiation, productDirection: row.productDirection, visualLanguage: row.visualLanguage, annualGoal: row.annualGoal, branchLabels: parseBranchLabels(row.branchLabels), version: row.version, updatedAt: row.updatedAt } : emptyProfile;
}

export async function GET(request: Request) {
  try {
    const user = await requireApiUser(request);
    const db = getDb();
    const [[profile], history, knowledge] = await Promise.all([
      db.select().from(brandProfiles).where(eq(brandProfiles.ownerId, user.id)).limit(1),
      db.select().from(brandProfileVersions).where(eq(brandProfileVersions.ownerId, user.id)).orderBy(desc(brandProfileVersions.version)).limit(20),
      db.select({ id: readingItems.id, updatedAt: readingItems.updatedAt }).from(readingItems).where(eq(readingItems.ownerId, user.id)),
    ]);
    const newKnowledgeCount = profile
      ? (await db.select({ id: readingItems.id }).from(readingItems).where(and(eq(readingItems.ownerId, user.id), gt(readingItems.updatedAt, profile.updatedAt)))).length
      : knowledge.length;
    return Response.json({
      profile: publicProfile(profile),
      history: history.map(item => ({ id: item.id, version: item.version, snapshot: JSON.parse(item.snapshot), changeNote: item.changeNote, createdAt: item.createdAt })),
      knowledgeStats: { total: knowledge.length, newSinceVersion: newKnowledgeCount },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}

export async function PUT(request: Request) {
  try {
    const user = await requireApiUser(request, { mutation: true });
    const payload = await readJson<Record<string, unknown>>(request);
    const db = getDb();
    const [previous] = await db.select().from(brandProfiles).where(eq(brandProfiles.ownerId, user.id)).limit(1);
    const version = (previous?.version ?? 0) + 1;
    const nextBranchLabels = readBranchLabels(payload.branchLabels, previous?.branchLabels);
    const values = {
      ownerId: user.id,
      story: boundedText(payload.story, "品牌故事", 3000),
      philosophy: boundedText(payload.philosophy, "核心理念", 1500),
      audience: boundedText(payload.audience, "目标用户", 1500),
      keywords: boundedText(payload.keywords, "品牌关键词", 500),
      differentiation: boundedText(payload.differentiation, "差异化特点", 1500),
      productDirection: boundedText(payload.productDirection, "产品方向", 1500),
      visualLanguage: boundedText(payload.visualLanguage, "视觉语言", 1500),
      annualGoal: boundedText(payload.annualGoal, "年度目标", 1500),
      branchLabels: JSON.stringify(nextBranchLabels),
      version,
      updatedAt: new Date(),
    };
    const snapshot = JSON.stringify({ ...values, branchLabels: nextBranchLabels, ownerId: undefined, updatedAt: undefined });
    const previousBranchLabels = parseBranchLabels(previous?.branchLabels);
    const changedBranches = Object.entries(branchLabels).filter(([key, defaultLabel]) => (previous?.[key as keyof typeof branchLabels] || "").trim() !== values[key as keyof typeof branchLabels].trim() || (previousBranchLabels[key] || defaultLabel) !== (nextBranchLabels[key] || defaultLabel)).map(([key, defaultLabel]) => nextBranchLabels[key] || defaultLabel);
    const changeNote = changedBranches.length
      ? `系统检测：${previous ? "本次更新" : "首次建立"}${changedBranches.join("、")}${changedBranches.length > 1 ? `等 ${changedBranches.length} 个分支` : ""}`
      : "系统检测：本次保存未发现文字变化";
    const [profile] = await db.insert(brandProfiles).values(values).onConflictDoUpdate({ target: brandProfiles.ownerId, set: values }).returning();
    await db.insert(brandProfileVersions).values({ ownerId: user.id, version, snapshot, changeNote });
    return Response.json({ profile: publicProfile(profile) });
  } catch (error) { return apiError(error); }
}
