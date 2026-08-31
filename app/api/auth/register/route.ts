import { getDb } from "../../../../db";
import { sessions, users } from "../../../../db/schema";
import { ApiError, apiError, boundedText, createSecret, enforceAnonymousRateLimit, readJson, requireSameOrigin, sessionCookie, sessionExpiry, sha256 } from "../../_shared";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    await enforceAnonymousRateLimit(request, "register", 6);
    const payload = await readJson<{ displayName?: unknown }>(request);
    const displayName = boundedText(payload.displayName, "昵称", 30, true);
    if (/[@<>]/.test(displayName)) throw new ApiError(400, "昵称包含不支持的字符");
    const userId = `local:${crypto.randomUUID()}`;
    const recoveryKey = createSecret("slowday_recovery_");
    const sessionToken = createSecret("sd_session_");
    const now = new Date();
    const db = getDb();
    await db.batch([
      db.insert(users).values({ id: userId, displayName, recoveryHash: await sha256(recoveryKey), createdAt: now }),
      db.insert(sessions).values({ tokenHash: await sha256(sessionToken), userId, expiresAt: sessionExpiry(), createdAt: now, lastSeenAt: now }),
    ]);
    return Response.json({ authenticated: true, user: { id: userId, displayName, authType: "slowday" }, recoveryKey }, { status: 201, headers: { "Set-Cookie": sessionCookie(sessionToken), "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
