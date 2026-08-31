export type AuthenticatedIdentity = {
  id: string;
  displayName: string;
  email: string;
  fullName: string | null;
};

export function parseAuthenticatedIdentity(requestHeaders: Headers): AuthenticatedIdentity | null {
  const id = requestHeaders.get("oai-authenticated-user-id");
  const email = requestHeaders.get("oai-authenticated-user-email");
  if (!id || !email) return null;
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName = encodedFullName && requestHeaders.get("oai-authenticated-user-full-name-encoding") === "percent-encoded-utf-8"
    ? safeDecodeURIComponent(encodedFullName)
    : null;
  return { id, email, fullName, displayName: fullName ?? email };
}

function safeDecodeURIComponent(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}
