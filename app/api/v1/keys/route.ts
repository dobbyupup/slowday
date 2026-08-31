import { and, count, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "../../../../db";
import { apiKeys } from "../../../../db/schema";
import { apiError, ApiError, boundedText, createApiToken, readJson, requireSessionUser, sha256 } from "../../_shared";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireSessionUser(request);
    const rows = await getDb().select({
      id: apiKeys.id,
      name: apiKeys.name,
      tokenPrefix: apiKeys.tokenPrefix,
      createdAt: apiKeys.createdAt,
      lastUsedAt: apiKeys.lastUsedAt,
      revokedAt: apiKeys.revokedAt,
    }).from(apiKeys).where(eq(apiKeys.ownerId, user.id)).orderBy(desc(apiKeys.id)).limit(50);
    return Response.json({ data: rows }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireSessionUser(request, { mutation: true });
    const payload = await readJson<{ name?: string }>(request);
    const name = boundedText(payload.name, "名称", 50, true);
    const [active] = await getDb().select({ count: count() }).from(apiKeys)
      .where(and(eq(apiKeys.ownerId, user.id), isNull(apiKeys.revokedAt)));
    if ((active?.count ?? 0) >= 10) throw new ApiError(409, "最多保留 10 个有效 Slowday Key，请先撤销不用的密钥");
    const token = createApiToken();
    const tokenHash = await sha256(token);
    const [key] = await getDb().insert(apiKeys).values({
      ownerId: user.id,
      ownerEmail: user.email,
      name,
      tokenHash,
      tokenPrefix: `${token.slice(0, 16)}…`,
    }).returning({ id: apiKeys.id, name: apiKeys.name, tokenPrefix: apiKeys.tokenPrefix, createdAt: apiKeys.createdAt });
    return Response.json({ data: key, token }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
