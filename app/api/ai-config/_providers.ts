import { ApiError } from "../_shared";
import { safeCustomBaseUrl } from "./custom-url";

export type AIProvider = "deepseek" | "openai" | "custom";

export const providerDefaults: Record<Exclude<AIProvider, "custom">, { model: string; modelsUrl: string }> = {
  deepseek: { model: "deepseek-v4-flash", modelsUrl: "https://api.deepseek.com/models" },
  openai: { model: "gpt-5.6-luna", modelsUrl: "https://api.openai.com/v1/models" },
};

export function validatedProvider(value: unknown): AIProvider {
  if (value !== "deepseek" && value !== "openai" && value !== "custom") throw new ApiError(400, "模型服务不受支持");
  return value;
}

export function validatedModel(value: unknown, provider: AIProvider) {
  const fallback = provider === "custom" ? "your-model-name" : providerDefaults[provider].model;
  const model = typeof value === "string" && value.trim() ? value.trim() : fallback;
  if (model.length > 80 || !/^[a-zA-Z0-9._:-]+$/.test(model)) throw new ApiError(400, "模型名称格式不正确");
  return model;
}

export function validatedBaseUrl(value: unknown, provider: AIProvider) {
  if (provider !== "custom") return null;
  const url = safeCustomBaseUrl(value);
  if (!url) throw new ApiError(400, "自定义接口必须是安全的公网 HTTPS 地址");
  return url;
}

export function customEndpoint(baseUrl: string, path: "models" | "chat/completions") {
  return `${baseUrl.replace(/\/+$/, "")}/${path}`;
}

export function validatedApiKey(value: unknown, required = true) {
  if (typeof value !== "string" || !value.trim()) {
    if (required) throw new ApiError(400, "请输入 API Key");
    return null;
  }
  const key = value.trim();
  if (key.length < 20 || key.length > 500 || /\s/.test(key)) throw new ApiError(400, "API Key 格式不正确");
  return key;
}
