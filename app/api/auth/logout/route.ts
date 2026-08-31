import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { sessions } from "../../../../db/schema";
import { apiError, clearSessionCookie, requireSameOrigin, SESSION_COOKIE, sha256 } from "../../_shared";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const item = request.headers.get("cookie")?.split(";").map(value => value.trim()).find(value => value.startsWith(`${SESSION_COOKIE}=`));
    const token = item?.slice(SESSION_COOKIE.length + 1);
    if (token) await getDb().delete(sessions).where(eq(sessions.tokenHash, await sha256(token)));
    return Response.json({ ok: true }, { headers: { "Set-Cookie": clearSessionCookie(), "Cache-Control": "no-store", "Clear-Site-Data": '"cache"' } });
  } catch (error) {
    return apiError(error);
  }
}
