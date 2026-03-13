import { verifySession } from "./auth";
import type { Session } from "./auth";

/** Read Bearer token from Authorization header and verify it. */
export async function getMobileSession(request: Request): Promise<Session | null> {
  const auth = request.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7).trim();
  return verifySession(token);
}

export function unauthorized() {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}
