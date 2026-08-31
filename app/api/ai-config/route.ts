import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { aiConfigs } from "../../../db/schema";
import { apiError, readJson, requireSessionUser } from "../_shared";
import { encryptApiKey } from "./_crypto";
import { validatedApiKey, validatedBaseUrl, validatedModel, validatedProvider } from "./_providers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireSessionUser(request);
    const [config] = await getDb().select({ provider: aiConfigs.provider, model: aiConfigs.model, baseUrl: aiConfigs.baseUrl, keyHint: aiConfigs.keyHint, updatedAt: aiConfigs.updatedAt })
      .from(aiConfigs).where(eq(aiConfigs.ownerId, user.id)).limit(1);
    return Response.json({ configured: Boolean(config), config: config ?? null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireSessionUser(request, { mutation: true });
    const payload = await readJson<{ provider?: unknown; model?: unknown; baseUrl?: unknown; apiKey?: unknown }>(request);
    const provider = validatedProvider(payload.provider);
    const model = validatedModel(payload.model, provider);
    const baseUrl = validatedBaseUrl(payload.baseUrl, provider);
    const db = getDb();
    const [existing] = await db.select().from(aiConfigs).where(eq(aiConfigs.ownerId, user.id)).limit(1);
    const apiKey = validatedApiKey(payload.apiKey, !existing || existing.provider !== provider);
    const now = new Date();

    if (apiKey) {
      const encrypted = await encryptApiKey(apiKey, user.id);
      await db.insert(aiConfigs).values({
        ownerId: user.id,
        provider,
        model,
        baseUrl,
        ...encrypted,
        keyHint: `••••${apiKey.slice(-4)}`,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      }).onConflictDoUpdate({
        target: aiConfigs.ownerId,
        set: { provider, model, baseUrl, ...encrypted, keyHint: `••••${apiKey.slice(-4)}`, updatedAt: now },
      });
    } else {
      await db.update(aiConfigs).set({ provider, model, baseUrl, updatedAt: now }).where(eq(aiConfigs.ownerId, user.id));
    }

    return Response.json({ configured: true, config: { provider, model, baseUrl, keyHint: apiKey ? `••••${apiKey.slice(-4)}` : existing?.keyHint } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireSessionUser(request, { mutation: true });
    await getDb().delete(aiConfigs).where(eq(aiConfigs.ownerId, user.id));
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
