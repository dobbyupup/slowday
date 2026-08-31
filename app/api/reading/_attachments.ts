import { env } from "cloudflare:workers";

export function getAttachmentBucket() {
  if (!env.ATTACHMENTS) throw new Error("Cloudflare R2 binding `ATTACHMENTS` is unavailable");
  return env.ATTACHMENTS;
}

export function attachmentKeyFromUrl(value: string) {
  const prefix = "/api/reading/media/";
  if (!value.startsWith(prefix)) return null;
  const key = value.slice(prefix.length);
  return /^[a-f0-9-]{36}$/i.test(key) ? key : null;
}
