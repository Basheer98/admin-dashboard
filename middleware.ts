import { NextRequest, NextResponse } from "next/server";
import { sessionCookieName, verifySession } from "@/lib/auth";
import { getRedirectUrl } from "@/lib/redirectUrl";

const PUBLIC_PATHS = ["/login", "/api/auth/login"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some((path) =>
    pathname.toLowerCase().startsWith(path),
  );

  if (isPublic) {
    return NextResponse.next();
  }

  const token = request.cookies.get(sessionCookieName)?.value;
  const session = await verifySession(token);

  if (!session) {
    const loginUrl = getRedirectUrl(request, "/login", { redirectTo: pathname });
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

