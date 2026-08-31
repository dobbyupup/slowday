import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { readingItems } from "../../../../db/schema";
import { apiError, ApiError, boundedText, enforceRateLimit, publicReading, readJson, requireSessionUser, todayInTimeZone } from "../../_shared";
import { attachmentKeyFromUrl, getAttachmentBucket } from "../_attachments";
import { localizeMetadata } from "./_localize";

const MAX_HTML_BYTES = 1_000_000;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function POST(request: Request) {
  try {
    const user = await requireSessionUser(request, { mutation: true });
    await enforceRateLimit(`reading-import:${user.id}`, 20);
    const payload = await readJson<{ url?: unknown }>(request);
    const submitted = boundedText(payload.url, "链接", 1000, true);
    const startUrl = validatedPublicUrl(submitted);
    const db = getDb();
    const [existing] = await db.select().from(readingItems)
      .where(and(eq(readingItems.ownerId, user.id), eq(readingItems.url, startUrl.toString()))).limit(1);
    const { html, finalUrl } = await fetchHtml(startUrl);
    let duplicate = existing;
    if (finalUrl.toString() !== startUrl.toString()) {
      const [redirectDuplicate] = await db.select().from(readingItems)
        .where(and(eq(readingItems.ownerId, user.id), eq(readingItems.url, finalUrl.toString()))).limit(1);
      duplicate ||= redirectDuplicate;
    }
    const metadata = extractPageMetadata(html, finalUrl);
    const localized = await localizeMetadata(user.id, metadata);
    const cachedImage = await cacheRemoteImage(metadata.imageUrl, finalUrl, user.id);
    const values = {
      ownerId: user.id,
      ownerEmail: user.email,
      date: duplicate?.date ?? todayInTimeZone(),
      title: localized.title,
      source: metadata.source,
      url: finalUrl.toString(),
      imageUrl: cachedImage.url || duplicate?.imageUrl || metadata.imageUrl,
      note: localized.description,
      tags: localized.tags || duplicate?.tags || "",
      resourceType: "网页链接" as const,
      primaryCategory: localized.primaryCategory || duplicate?.primaryCategory || "内容文案",
      workflowStatus: duplicate?.workflowStatus || "pending" as const,
      intendedUse: localized.intendedUse || duplicate?.intendedUse || "暂时研究",
      topic: duplicate?.topic || "",
      updatedAt: new Date(),
    };
    if (duplicate) {
      const [item] = await db.update(readingItems).set(values).where(and(eq(readingItems.id, duplicate.id), eq(readingItems.ownerId, user.id))).returning();
      const previousKey = attachmentKeyFromUrl(duplicate.imageUrl);
      if (previousKey && previousKey !== cachedImage.key && duplicate.imageUrl !== values.imageUrl) {
        try { await getAttachmentBucket().delete(previousKey); } catch { /* refreshed record still wins */ }
      }
      return Response.json({ item: publicReading(item), duplicate: true, refreshed: true, localized: localized.localized, imageCaptured: Boolean(item.imageUrl) });
    }
    try {
      const [item] = await db.insert(readingItems).values(values).returning();
      return Response.json({ item: publicReading(item), duplicate: false, refreshed: false, localized: localized.localized, imageCaptured: Boolean(item.imageUrl) }, { status: 201 });
    } catch (error) {
      if (cachedImage.key) { try { await getAttachmentBucket().delete(cachedImage.key); } catch { /* best effort rollback */ } }
      throw error;
    }
  } catch (error) {
    return apiError(error);
  }
}

async function fetchHtml(startUrl: URL) {
  let current = startUrl;
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    let response: Response;
    try {
      response = await fetch(current, {
        headers: { "User-Agent": "SlowdayLinkPreview/1.0", Accept: "text/html,application/xhtml+xml" },
        redirect: "manual",
        signal: AbortSignal.timeout(12_000),
      });
    } catch {
      throw new ApiError(422, "这个网页暂时无法访问，可以稍后重试或手动添加");
    }
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location || redirects === MAX_REDIRECTS) throw new ApiError(422, "网页跳转次数过多，无法安全读取");
      current = validatedPublicUrl(new URL(location, current).toString());
      continue;
    }
    if (!response.ok) throw new ApiError(422, response.status === 401 || response.status === 403 ? "这个网页需要登录，暂时无法自动读取" : `网页返回 ${response.status}，无法读取`);
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) throw new ApiError(422, "这个链接不是可读取的网页");
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > MAX_HTML_BYTES) throw new ApiError(422, "网页内容过大，暂时无法自动读取");
    return { html: await readLimitedText(response, MAX_HTML_BYTES), finalUrl: current };
  }
  throw new ApiError(422, "网页跳转次数过多，无法安全读取");
}

async function readLimitedText(response: Response, limit: number) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      throw new ApiError(422, "网页内容过大，暂时无法自动读取");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}

export function extractPageMetadata(html: string, pageUrl: URL) {
  const metas = Array.from(html.matchAll(/<meta\s+[^>]*>/gi)).map(match => attributes(match[0]));
  const pick = (...names: string[]) => {
    const wanted = new Set(names.map(name => name.toLowerCase()));
    const meta = metas.find(item => wanted.has((item.property || item.name || "").toLowerCase()));
    return clean(meta?.content ?? "");
  };
  const rawTitle = pick("og:title", "twitter:title") || clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  const description = (pick("og:description", "twitter:description", "description") || "这个网页没有提供简介，已经替你留下标题和来源。").slice(0, 3000);
  const source = (pick("og:site_name", "application-name") || pageUrl.hostname.replace(/^www\./, "")).slice(0, 100);
  const links = Array.from(html.matchAll(/<link\s+[^>]*>/gi)).map(match => attributes(match[0]));
  const linkedImage = links.find(item => /(^|\s)image_src(\s|$)/i.test(item.rel || ""))?.href || "";
  const structuredImage = extractStructuredImage(html);
  const image = pick("og:image", "og:image:url", "twitter:image", "twitter:image:src") || linkedImage || structuredImage;
  let imageUrl = "";
  if (image) {
    try { imageUrl = validatedPublicUrl(new URL(image, pageUrl).toString()).toString().slice(0, 1000); } catch { imageUrl = ""; }
  }
  const fallbackTitle = pageUrl.pathname.split("/").filter(Boolean).pop()?.replace(/[-_]+/g, " ") || source;
  return { title: (rawTitle || fallbackTitle || "未命名阅读").slice(0, 200), source, description, imageUrl };
}

function extractStructuredImage(html: string) {
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const found = findImageInJson(JSON.parse(decode(match[1])));
      if (found) return found;
    } catch { /* malformed structured data */ }
  }
  const escaped = html.match(/["'](?:image_url|thumbnail_url|thumbnailUrl)["']\s*:\s*["']((?:\\.|[^"'])+)["']/i)?.[1];
  if (!escaped) return "";
  try { return JSON.parse(`"${escaped.replace(/"/g, '\\"')}"`); } catch { return escaped.replace(/\\\//g, "/").replace(/\\u0026/gi, "&"); }
}

function findImageInJson(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return /^https?:\/\//i.test(value) ? value : "";
  if (Array.isArray(value)) {
    for (const item of value) { const found = findImageInJson(item); if (found) return found; }
    return "";
  }
  if (typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  for (const key of ["image", "thumbnailUrl", "thumbnail", "contentUrl"]) {
    const found = findImageInJson(record[key]);
    if (found) return found;
  }
  return "";
}

async function cacheRemoteImage(imageUrl: string, pageUrl: URL, ownerId: string) {
  if (!imageUrl) return { url: "", key: "" };
  try {
    let current = validatedPublicUrl(imageUrl);
    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
      const response = await fetch(current, { headers: { "User-Agent": "SlowdayLinkPreview/1.0", Accept: "image/avif,image/webp,image/png,image/jpeg,image/gif", Referer: pageUrl.toString() }, redirect: "manual", signal: AbortSignal.timeout(12_000) });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location || redirects === MAX_REDIRECTS) break;
        current = validatedPublicUrl(new URL(location, current).toString());
        continue;
      }
      const contentType = (response.headers.get("content-type") || "").split(";")[0].toLowerCase();
      if (!response.ok || !ALLOWED_IMAGE_TYPES.has(contentType)) break;
      const bytes = await readLimitedBytes(response, MAX_IMAGE_BYTES);
      const key = crypto.randomUUID();
      await getAttachmentBucket().put(key, bytes, { httpMetadata: { contentType }, customMetadata: { ownerId, originalName: "网页封面", sourceUrl: current.toString().slice(0, 500) } });
      return { url: `/api/reading/media/${key}`, key };
    }
  } catch (error) { console.warn("Reading cover cache failed", error instanceof Error ? error.message : "unknown error"); }
  return { url: imageUrl, key: "" };
}

async function readLimitedBytes(response: Response, limit: number) {
  if (!response.body) return new Uint8Array();
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > limit) throw new Error("image too large");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) { await reader.cancel(); throw new Error("image too large"); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

function attributes(tag: string) {
  const result: Record<string, string> = {};
  for (const match of tag.matchAll(/([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) result[match[1].toLowerCase()] = decode(match[2] ?? match[3] ?? match[4] ?? "");
  return result;
}

function clean(value: string) {
  return decode(value.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function decode(value: string) {
  return value.replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (_, entity: string) => {
    const lower = entity.toLowerCase();
    if (lower.startsWith("#x")) return String.fromCodePoint(Number.parseInt(lower.slice(2), 16));
    if (lower.startsWith("#")) return String.fromCodePoint(Number.parseInt(lower.slice(1), 10));
    return ({ amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " } as Record<string, string>)[lower] ?? "";
  });
}

export function validatedPublicUrl(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { throw new ApiError(400, "请发送一个完整的网址，例如 https://example.com"); }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new ApiError(400, "只支持 HTTP 或 HTTPS 网页链接");
  if (url.username || url.password) throw new ApiError(400, "链接不能包含账号或密码");
  if (url.port && url.port !== "80" && url.port !== "443") throw new ApiError(400, "链接端口不受支持");
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal") || isPrivateIp(hostname)) throw new ApiError(400, "这个地址无法安全访问");
  url.hash = "";
  return url;
}

function isPrivateIp(hostname: string) {
  if (hostname.includes(":")) return hostname === "::1" || hostname === "::" || /^(fc|fd|fe[89ab])/i.test(hostname) || hostname.startsWith("::ffff:");
  const parts = hostname.split(".");
  if (parts.length !== 4 || parts.some(part => !/^\d+$/.test(part) || Number(part) > 255)) return false;
  const [a, b] = parts.map(Number);
  return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19));
}
