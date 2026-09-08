import { env } from "cloudflare:workers";
import { and, eq, lt } from "drizzle-orm";
import { getDb } from "../../../../db";
import { sessions, users } from "../../../../db/schema";
import { ApiError, apiError, createSecret, enforceAnonymousRateLimit, readJson, requireSameOrigin, sessionCookie, sessionExpiry, sha256 } from "../../_shared";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    await enforceAnonymousRateLimit(request, "login", 10);
    const payload = await readJson<{ password?: unknown }>(request);
    const password = typeof payload.password === "string" ? payload.password : "";
    const expectedPassword = env.SLOWDAY_SITE_PASSWORD;
    const ownerId = env.SLOWDAY_OWNER_ID;
    if (!expectedPassword || !ownerId) throw new ApiError(503, "单账户登录尚未配置");
    if (!(await sameSecret(password, expectedPassword))) throw new ApiError(401, "网站密码不正确");
    const db = getDb();
    const displayName = env.SLOWDAY_OWNER_NAME?.trim().slice(0, 30) || "Slowday";
    await db.insert(users).values({ id: ownerId, displayName, recoveryHash: await sha256(`single-owner:${ownerId}`), createdAt: new Date() })
      .onConflictDoUpdate({ target: users.id, set: { displayName } });
    const sessionToken = createSecret("sd_session_");
    const now = new Date();
    await db.insert(sessions).values({ tokenHash: await sha256(sessionToken), userId: ownerId, expiresAt: sessionExpiry(), createdAt: now, lastSeenAt: now });
    if (Math.random() < 0.05) await db.delete(sessions).where(and(eq(sessions.userId, ownerId), lt(sessions.expiresAt, now)));
    return Response.json({ authenticated: true, user: { id: ownerId, displayName, authType: "slowday" } }, { headers: { "Set-Cookie": sessionCookie(sessionToken), "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}

async function sameSecret(left: string, right: string) {
  const [leftHash, rightHash] = await Promise.all([sha256(left), sha256(right)]);
  let difference = leftHash.length ^ rightHash.length;
  for (let index = 0; index < Math.max(leftHash.length, rightHash.length); index += 1) {
    difference |= (leftHash.charCodeAt(index) || 0) ^ (rightHash.charCodeAt(index) || 0);
  }
  return difference === 0;
}
