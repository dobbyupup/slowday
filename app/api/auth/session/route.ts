import { apiError, optionalSessionUser } from "../../_shared";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await optionalSessionUser(request);
    return Response.json(user ? { authenticated: true, user: { id: user.id, displayName: user.displayName, authType: user.id.startsWith("local:") ? "slowday" : "chatgpt" } } : { authenticated: false }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
