import { and, eq, gt, isNull, lt, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { apiKeys, apiRateLimits, reviews, sessions, tasks, users } from "../../db/schema";
import { getChatGPTUser, type ChatGPTUser } from "../chatgpt-auth";
import { paginationValues } from "./validation";

export { validDate, validMonth } from "./validation";

const MAX_BODY_BYTES = 32_768;
const DEFAULT_TIME_ZONE = "Asia/Shanghai";

export type ApiUser = ChatGPTUser & { authType: "session" | "api-key" };
export const SESSION_COOKIE = "__Host-slowday_session";
const SESSION_SECONDS = 60 * 60 * 24 * 30;

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function requireApiUser(request: Request, options: { mutation?: boolean } = {}): Promise<ApiUser> {
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    const token = authorization.slice(7).trim();
    if (!token.startsWith("slowday_") || token.length < 40 || token.length > 100) {
      throw new ApiError(401, "API Key 无效");
    }
    const tokenHash = await sha256(token);
    const db = getDb();
    const [key] = await db.select().from(apiKeys)
      .where(and(eq(apiKeys.tokenHash, tokenHash), isNull(apiKeys.revokedAt))).limit(1);
    if (!key) throw new ApiError(401, "API Key 无效或已撤销");
    await enforceRateLimit(`key:${key.id}`, 60);
    await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, key.id));
    return { id: key.ownerId, email: key.ownerEmail, displayName: key.name, fullName: null, authType: "api-key" };
  }

  const user = await getSessionUser(request) ?? await getChatGPTUser(request);
  if (!user) throw new ApiError(401, "请先登录后再使用日历。");
  if (options.mutation) requireSameOrigin(request);
  await enforceRateLimit(`user:${user.id}`, options.mutation ? 40 : 120);
  await claimLegacyRecords(user.id, user.email);
  return { ...user, authType: "session" };
}

export async function requireSessionUser(request: Request, options: { mutation?: boolean } = {}): Promise<ApiUser> {
  if (request.headers.has("authorization")) throw new ApiError(403, "此操作仅支持登录会话");
  return requireApiUser(request, options);
}

export async function optionalSessionUser(request: Request): Promise<ApiUser | null> {
  const local = await getSessionUser(request);
  if (local) return local;
  const chatgpt = await getChatGPTUser(request);
  return chatgpt ? { ...chatgpt, authType: "session" } : null;
}

async function getSessionUser(request: Request): Promise<ApiUser | null> {
  const token = readCookie(request.headers.get("cookie"), SESSION_COOKIE);
  if (!token || !token.startsWith("sd_session_") || token.length > 100) return null;
  const db = getDb();
  const [row] = await db.select({ user: users, session: sessions }).from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, await sha256(token)), gt(sessions.expiresAt, new Date()))).limit(1);
  if (!row) return null;
  if (Date.now() - row.session.lastSeenAt.getTime() > 60 * 60 * 1000) {
    await db.update(sessions).set({ lastSeenAt: new Date() }).where(eq(sessions.tokenHash, row.session.tokenHash));
  }
  return { id: row.user.id, email: `${row.user.id.replace(/[^a-zA-Z0-9]/g, "")}@slowday.invalid`, displayName: row.user.displayName, fullName: row.user.displayName, authType: "session" };
}

export function createSecret(prefix: string) {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const body = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${prefix}${body}`;
}

export function sessionCookie(token: string) {
  return `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${SESSION_SECONDS}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

export function sessionExpiry() {
  return new Date(Date.now() + SESSION_SECONDS * 1000);
}

function readCookie(header: string | null, name: string) {
  if (!header) return null;
  for (const item of header.split(";")) {
    const separator = item.indexOf("=");
    if (separator < 0) continue;
    if (item.slice(0, separator).trim() === name) return item.slice(separator + 1).trim();
  }
  return null;
}

export async function enforceRateLimit(identity: string, limit: number) {
  const windowStart = Math.floor(Date.now() / 60_000) * 60_000;
  const [row] = await getDb().insert(apiRateLimits).values({ identity, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [apiRateLimits.identity, apiRateLimits.windowStart],
      set: { count: sql`${apiRateLimits.count} + 1` },
    }).returning({ count: apiRateLimits.count });
  if ((row?.count ?? 1) > limit) throw new ApiError(429, "操作太频繁，请稍后再试");
  if (Math.random() < 0.01) await getDb().delete(apiRateLimits).where(lt(apiRateLimits.windowStart, windowStart - 7_200_000));
}

async function claimLegacyRecords(ownerId: string, email: string) {
  const db = getDb();
  await db.batch([
    db.update(tasks).set({ ownerId }).where(and(eq(tasks.ownerEmail, email), isNull(tasks.ownerId))),
    db.update(reviews).set({ ownerId }).where(and(eq(reviews.ownerEmail, email), isNull(reviews.ownerId))),
  ]);
}

export function requireSameOrigin(request: Request) {
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (!origin || origin !== url.origin) throw new ApiError(403, "请求来源不可信");
  if (fetchSite === "cross-site") throw new ApiError(403, "不允许跨站写入");
}

export async function enforceAnonymousRateLimit(request: Request, action: string, limit: number) {
  const address = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",", 1)[0] ?? "unknown";
  await enforceRateLimit(`anonymous:${action}:${(await sha256(address)).slice(0, 24)}`, limit);
}

export async function readJson<T>(request: Request): Promise<T> {
  const type = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (type !== "application/json") throw new ApiError(415, "请使用 application/json 提交数据");
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) throw new ApiError(413, "提交内容过大");
  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES) throw new ApiError(413, "提交内容过大");
  try {
    return JSON.parse(body) as T;
  } catch {
    throw new ApiError(400, "JSON 格式不正确");
  }
}

export function apiError(error: unknown) {
  if (error instanceof ApiError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  const requestId = crypto.randomUUID();
  console.error(`[${requestId}]`, error);
  return Response.json({ error: "服务暂时不可用", requestId }, { status: 500 });
}

export function boundedText(value: unknown, field: string, max: number, required = false) {
  if (typeof value !== "string") {
    if (required) throw new ApiError(400, `${field} 为必填项`);
    return "";
  }
  const text = value.trim();
  if (required && !text) throw new ApiError(400, `${field} 为必填项`);
  if (text.length > max) throw new ApiError(400, `${field} 不能超过 ${max} 个字`);
  return text;
}

export function parsePagination(url: URL) {
  const parsed = paginationValues(url.searchParams.get("limit"), url.searchParams.get("offset"));
  if (!parsed) throw new ApiError(400, "分页参数不正确，limit 应为 1–200");
  return parsed;
}

export function todayInTimeZone(timeZone = DEFAULT_TIME_ZONE) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export async function sha256(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
}

export function createApiToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const body = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `slowday_${body}`;
}

export function publicTask<T extends { id: number; date: string; title: string; category: string; done: boolean; createdAt: Date; updatedAt: Date }>(task: T) {
  return { id: task.id, date: task.date, title: task.title, category: task.category, done: task.done, createdAt: task.createdAt, updatedAt: task.updatedAt };
}

export function publicReview<T extends { id: number; date: string; mood: string; energy: number; text: string; win: string; keep: string; start: string; improve: string; stop: string; analysis: string | null; progressSummary: string | null; createdAt: Date; updatedAt: Date }>(review: T) {
  return { id: review.id, date: review.date, mood: review.mood, energy: review.energy, text: review.text, win: review.win, keep: review.keep, start: review.start, improve: review.improve, stop: review.stop, analysis: review.analysis, progressSummary: review.progressSummary, createdAt: review.createdAt, updatedAt: review.updatedAt };
}

export function publicReading<T extends { id: number; date: string; title: string; source: string; url: string; imageUrl: string; note: string; tags: string; resourceType: string; primaryCategory: string; workflowStatus: string; intendedUse: string; contentHash: string; duplicateOf: number | null; topic: string; createdAt: Date; updatedAt: Date }>(item: T) {
  return { id: item.id, date: item.date, title: item.title, source: item.source, url: item.url, imageUrl: item.imageUrl, note: item.note, tags: item.tags, resourceType: item.resourceType, primaryCategory: item.primaryCategory, workflowStatus: item.workflowStatus, intendedUse: item.intendedUse, duplicateOf: item.duplicateOf, topic: item.topic, createdAt: item.createdAt, updatedAt: item.updatedAt };
}

export function publicDesignIdea<T extends { id: number; readingItemId: number | null; title: string; note: string; status: string; createdAt: Date; updatedAt: Date }>(item: T) {
  return { id: item.id, readingItemId: item.readingItemId, title: item.title, note: item.note, status: item.status, createdAt: item.createdAt, updatedAt: item.updatedAt };
}

export function publicBrandMilestone<T extends { id: number; sourceReadingId: number | null; title: string; phase: string; dueDate: string; status: string; progress: number; deliverable: string; createdAt: Date; updatedAt: Date }>(item: T) {
  return { id: item.id, sourceReadingId: item.sourceReadingId, title: item.title, phase: item.phase, dueDate: item.dueDate, status: item.status, progress: item.progress, deliverable: item.deliverable, createdAt: item.createdAt, updatedAt: item.updatedAt };
}
