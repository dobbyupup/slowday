import { apiError, ApiError, requireSessionUser } from "../../../_shared";
import { getAttachmentBucket } from "../../_attachments";

export async function GET(request: Request, context: { params: Promise<{ key: string }> }) {
  try {
    const user = await requireSessionUser(request);
    const key = (await context.params).key;
    if (!/^[a-f0-9-]{36}$/i.test(key)) throw new ApiError(404, "图片不存在");
    const object = await getAttachmentBucket().get(key);
    if (!object || object.customMetadata?.ownerId !== user.id) throw new ApiError(404, "图片不存在");
    const headers = new Headers({ "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" });
    object.writeHttpMetadata(headers);
    headers.set("Content-Disposition", "inline");
    return new Response(object.body, { headers });
  } catch (error) { return apiError(error); }
}
