import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { readingItems } from "../../../db/schema";
import { apiError, ApiError, boundedText, publicReading, readJson, requireApiUser, validDate } from "../_shared";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser(request);
    const rows = await getDb().select().from(readingItems).where(eq(readingItems.ownerId, user.id)).orderBy(desc(readingItems.date), desc(readingItems.id)).limit(1000);
    return Response.json({ items: rows.map(publicReading) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser(request, { mutation: true });
    const payload = await readJson<ReadingPayload>(request);
    const values = readingValues(payload);
    const [item] = await getDb().insert(readingItems).values({ ownerId: user.id, ownerEmail: user.email, ...values }).returning();
    return Response.json({ item: publicReading(item) }, { status: 201 });
  } catch (error) { return apiError(error); }
}

export type ReadingPayload = { date?: unknown; title?: unknown; source?: unknown; url?: unknown; imageUrl?: unknown; note?: unknown; tags?: unknown; resourceType?: unknown; primaryCategory?: unknown; workflowStatus?: unknown; intendedUse?: unknown; topic?: unknown };

export function readingValues(payload: ReadingPayload) {
  const date = typeof payload.date === "string" ? payload.date : "";
  if (!validDate(date)) throw new ApiError(400, "阅读日期不正确");
  return {
    date,
    title: boundedText(payload.title, "标题", 200, true),
    source: boundedText(payload.source, "来源", 100),
    url: safeLink(payload.url),
    imageUrl: safeLink(payload.imageUrl, "封面图片链接", 1000),
    note: boundedText(payload.note, "阅读笔记", 3000),
    tags: boundedText(payload.tags, "标签", 500),
    resourceType: allowed(payload.resourceType, ["图片", "网页链接", "文档", "文字想法", "用户反馈", "供应商资料"], "文字想法") as "图片" | "网页链接" | "文档" | "文字想法" | "用户反馈" | "供应商资料",
    primaryCategory: allowed(payload.primaryCategory, ["品牌定位", "视觉系统", "产品设计", "材质工艺", "包装", "摄影", "内容文案", "用户洞察"], "品牌定位"),
    workflowStatus: allowed(payload.workflowStatus, ["pending", "confirmed"], "pending") as "pending" | "confirmed",
    intendedUse: allowedMany(payload.intendedUse, ["产品开发", "视觉设计", "包装设计", "拍摄计划", "内容选题", "品牌定位", "暂时研究"], "暂时研究"),
    topic: boundedText(payload.topic, "专题", 120),
  };
}

function allowed(value: unknown, values: string[], fallback: string) {
  return typeof value === "string" && values.includes(value) ? value : fallback;
}

function allowedMany(value: unknown, values: string[], fallback: string) {
  if (typeof value !== "string") return fallback;
  const selected = Array.from(new Set(value.split(/[，,、;；\n]+/).map(item => item.trim()).filter(item => values.includes(item))));
  return selected.length ? selected.join("，") : fallback;
}

function safeLink(value: unknown, field = "原文链接", max = 500) {
  const input = boundedText(value, field, max);
  if (!input) return "";
  if (field === "封面图片链接" && /^\/api\/reading\/media\/[a-f0-9-]{36}$/i.test(input)) return input;
  let url: URL;
  try { url = new URL(input); } catch { throw new ApiError(400, `${field}格式不正确`); }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new ApiError(400, `${field}只支持 HTTP 或 HTTPS`);
  return url.toString();
}
