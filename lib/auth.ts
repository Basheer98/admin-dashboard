const SESSION_COOKIE_NAME = "admin_session";

export const sessionCookieName = SESSION_COOKIE_NAME;

// For this single-user internal dashboard, we don't need JWTs.
// We just store a simple marker cookie.

export async function createSession(email: string) {
  void email;
  return "1";
}

export async function verifySession(
  token: string | undefined | null,
): Promise<{ email: string } | null> {
  if (!token) return null;
  if (token === "1") {
    return { email: "admin" };
  }
  return null;
}

