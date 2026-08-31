import { env } from "cloudflare:workers";
import { ApiError } from "../_shared";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  try {
    return Uint8Array.from(atob(value), character => character.charCodeAt(0));
  } catch {
    throw new Error("AI 配置密文损坏");
  }
}

async function encryptionKey() {
  const secret = (env as unknown as { AI_KEY_ENCRYPTION_SECRET?: string }).AI_KEY_ENCRYPTION_SECRET;
  if (!secret) throw new Error("AI_KEY_ENCRYPTION_SECRET is not configured");
  const bytes = base64ToBytes(secret);
  if (bytes.byteLength !== 32) throw new Error("AI_KEY_ENCRYPTION_SECRET must contain 32 bytes");
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptApiKey(apiKey: string, ownerId: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: encoder.encode(ownerId) },
    await encryptionKey(),
    encoder.encode(apiKey),
  );
  return { encryptedKey: bytesToBase64(new Uint8Array(encrypted)), keyIv: bytesToBase64(iv) };
}

export async function decryptApiKey(encryptedKey: string, keyIv: string, ownerId: string) {
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToBytes(keyIv), additionalData: encoder.encode(ownerId) },
      await encryptionKey(),
      base64ToBytes(encryptedKey),
    );
    return decoder.decode(decrypted);
  } catch {
    throw new ApiError(500, "AI 配置无法解密，请重新保存 API Key");
  }
}
