import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { readingItems } from "../../../../db/schema";
import { apiError, ApiError, boundedText, publicReading, requireSessionUser, todayInTimeZone } from "../../_shared";
import { getAttachmentBucket } from "../_attachments";
import { interpretScreenshotsAutomatically, ScreenshotInterpretationError } from "./_interpret";

const MAX_FILES = 4;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_REQUEST_BYTES = 20 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function POST(request: Request) {
  const uploadedKeys: string[] = [];
  try {
    const user = await requireSessionUser(request, { mutation: true });
    const declared = Number(request.headers.get("content-length") ?? 0);
    if (declared > MAX_REQUEST_BYTES) throw new ApiError(413, "附件总大小不能超过 20MB");
    const form = await request.formData();
    const files = form.getAll("files").filter((value): value is File => value instanceof File);
    if (!files.length) throw new ApiError(400, "请选择或粘贴图片");
    if (files.length > MAX_FILES) throw new ApiError(400, `一次最多添加 ${MAX_FILES} 张图片`);
    for (const file of files) {
      if (!ALLOWED_TYPES.has(file.type)) throw new ApiError(400, "附件支持 JPG、PNG、WebP 或 GIF 图片");
      if (file.size < 1 || file.size > MAX_FILE_BYTES) throw new ApiError(400, "每张图片不能超过 8MB");
    }
    const message = boundedText(form.get("message"), "附言", 300);
    const bucket = getAttachmentBucket();
    const prepared = await Promise.all(files.map(async file => ({ file, bytes: new Uint8Array(await file.arrayBuffer()) })));
    const images = prepared.map(item => ({ type: item.file.type, bytes: item.bytes }));
    let interpretations;
    let recognitionAttempts;
    try {
      const recognition = await interpretScreenshotsAutomatically(user.id, images, message, { strict: true });
      interpretations = recognition.interpretations;
      recognitionAttempts = recognition.attempts;
    } catch (error) {
      if (error instanceof ScreenshotInterpretationError) throw new ApiError(error.status, error.userMessage);
      throw error;
    }
    const values = [];
    const db = getDb();
    for (const [index, preparedFile] of prepared.entries()) {
      const { file, bytes } = preparedFile;
      const contentHash = await digestBytes(bytes);
      const [duplicate] = await db.select({ id: readingItems.id }).from(readingItems).where(and(eq(readingItems.ownerId, user.id), eq(readingItems.contentHash, contentHash))).limit(1);
      const key = crypto.randomUUID();
      await bucket.put(key, bytes, { httpMetadata: { contentType: file.type }, customMetadata: { ownerId: user.id, originalName: file.name.slice(0, 180) } });
      uploadedKeys.push(key);
      const interpretation = interpretations[index]!;
      values.push({
        ownerId: user.id,
        ownerEmail: user.email,
        date: todayInTimeZone(),
        title: interpretation.title.slice(0, 200),
        source: interpretation.source || "截图识别",
        url: interpretation.url,
        imageUrl: `/api/reading/media/${key}`,
        note: interpretation.description,
        tags: interpretation.tags,
        resourceType: interpretation.resourceType,
        primaryCategory: interpretation.primaryCategory,
        workflowStatus: "pending" as const,
        intendedUse: interpretation.intendedUse,
        contentHash,
        duplicateOf: duplicate?.id ?? null,
        topic: "",
      });
    }
    const items = await db.insert(readingItems).values(values).returning();
    return Response.json({ items: items.map(publicReading), interpretedCount: interpretations.filter(Boolean).length, recognitionAttempts }, { status: 201 });
  } catch (error) {
    if (uploadedKeys.length) {
      try { await getAttachmentBucket().delete(uploadedKeys); } catch { /* best-effort rollback */ }
    }
    return apiError(error);
  }
}

async function digestBytes(bytes: Uint8Array) {
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
}
