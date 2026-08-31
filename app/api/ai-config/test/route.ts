import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { aiConfigs } from "../../../../db/schema";
import { apiError, ApiError, enforceRateLimit, requireSessionUser } from "../../_shared";
import { decryptApiKey } from "../_crypto";
import { customEndpoint, providerDefaults, validatedBaseUrl, validatedProvider } from "../_providers";

export async function POST(request: Request) {
  try {
    const user = await requireSessionUser(request, { mutation: true });
    await enforceRateLimit(`ai-test:${user.id}`, 5);
    const [config] = await getDb().select().from(aiConfigs).where(eq(aiConfigs.ownerId, user.id)).limit(1);
    if (!config) throw new ApiError(400, "请先保存 AI 配置");
    const provider = validatedProvider(config.provider);
    const baseUrl = validatedBaseUrl(config.baseUrl, provider);
    const apiKey = await decryptApiKey(config.encryptedKey, config.keyIv, user.id);
    const modelsUrl = provider === "custom" ? customEndpoint(baseUrl!, "models") : providerDefaults[provider].modelsUrl;
    const response = await fetch(modelsUrl, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new ApiError(400, response.status === 401 || response.status === 403 ? "API Key 无效或无权访问" : `模型服务返回 ${response.status}；部分兼容服务不提供 /models，可直接尝试 AI 分析`);
    return Response.json({ ok: true, provider, model: config.model });
  } catch (error) {
    return apiError(error);
  }
}
