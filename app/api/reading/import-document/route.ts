import { getDb } from "../../../../db";
import { readingItems } from "../../../../db/schema";
import { apiError, ApiError, boundedText, publicReading, requireSessionUser, todayInTimeZone } from "../../_shared";
import { getAttachmentBucket } from "../_attachments";

const MAX_BYTES = 12 * 1024 * 1024;
const allowed = new Set(["application/pdf", "text/plain", "text/markdown", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]);

export async function POST(request: Request) {
  try {
    const user = await requireSessionUser(request, { mutation: true });
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "请选择文档");
    if (!allowed.has(file.type)) throw new ApiError(400, "支持 PDF、Word、Excel、Markdown 或纯文字文档");
    if (!file.size || file.size > MAX_BYTES) throw new ApiError(400, "文档不能超过 12MB");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const key = crypto.randomUUID();
    await getAttachmentBucket().put(key, bytes, { httpMetadata: { contentType: file.type || "application/octet-stream", contentDisposition: `attachment; filename="${file.name.replace(/["\\]/g, "_")}"` }, customMetadata: { ownerId: user.id, originalName: file.name.slice(0, 180) } });
    const note = file.type.startsWith("text/") ? new TextDecoder().decode(bytes.slice(0, 10_000)).trim().slice(0, 3000) : boundedText(form.get("message"), "资料说明", 300);
    const [item] = await getDb().insert(readingItems).values({ ownerId: user.id, ownerEmail: user.email, date: todayInTimeZone(), title: file.name.replace(/\.[^.]+$/, "").slice(0, 200), source: "文件上传", url: `/api/reading/media/${key}`, imageUrl: "", note: note || "文档已进入待整理，确认前可补充标题、分类与用途。", tags: "", resourceType: "文档", primaryCategory: "品牌定位", workflowStatus: "pending", intendedUse: "暂时研究", topic: "", contentHash: await digest(bytes) }).returning();
    return Response.json({ item: publicReading(item) }, { status: 201 });
  } catch (error) { return apiError(error); }
}

async function digest(bytes: Uint8Array) {
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
}
