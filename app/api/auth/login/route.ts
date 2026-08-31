import { and, eq, lt } from "drizzle-orm";
import { getDb } from "../../../../db";
import { sessions, users } from "../../../../db/schema";
import { ApiError, apiError, createSecret, enforceAnonymousRateLimit, readJson, requireSameOrigin, sessionCookie, sessionExpiry, sha256 } from "../../_shared";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    await enforceAnonymousRateLimit(request, "login", 10);
    const payload = await readJson<{ recoveryKey?: unknown }>(request);
    const recoveryKey = typeof payload.recoveryKey === "string" ? payload.recoveryKey.trim() : "";
    if (!recoveryKey.startsWith("slowday_recovery_") || recoveryKey.length > 100) throw new ApiError(401, "恢复密钥不正确");
    const db = getDb();
    const [user] = await db.select().from(users).where(eq(users.recoveryHash, await sha256(recoveryKey))).limit(1);
    if (!user) throw new ApiError(401, "恢复密钥不正确");
    const sessionToken = createSecret("sd_session_");
    const now = new Date();
    await db.insert(sessions).values({ tokenHash: await sha256(sessionToken), userId: user.id, expiresAt: sessionExpiry(), createdAt: now, lastSeenAt: now });
    if (Math.random() < 0.05) await db.delete(sessions).where(and(eq(sessions.userId, user.id), lt(sessions.expiresAt, now)));
    return Response.json({ authenticated: true, user: { id: user.id, displayName: user.displayName, authType: "slowday" } }, { headers: { "Set-Cookie": sessionCookie(sessionToken), "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
