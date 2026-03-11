import { NextRequest, NextResponse } from "next/server";
import { sessionCookieName, verifySession } from "@/lib/auth";
import { getRedirectUrl } from "@/lib/redirectUrl";

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/mobile"];

const FIELDER_PATH_PREFIX = "/fielder";

function isFielderPath(pathname: string): boolean {
  const lower = pathname.toLowerCase();
  return lower === FIELDER_PATH_PREFIX || lower.startsWith(FIELDER_PATH_PREFIX + "/");
}

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.toLowerCase().startsWith(p));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(sessionCookieName)?.value;
  const session = await verifySession(token);

  if (!session) {
    const loginUrl = getRedirectUrl(request, "/login", { redirectTo: pathname });
    return NextResponse.redirect(loginUrl);
  }

  if (session.role === "fielder") {
    if (pathname.toLowerCase().startsWith("/api/auth/logout")) {
      return NextResponse.next();
    }
    if (isFielderPath(pathname)) {
      return NextResponse.next();
    }
    return NextResponse.redirect(getRedirectUrl(request, "/fielder"));
  }

  if (session.role === "admin" && isFielderPath(pathname)) {
    return NextResponse.redirect(getRedirectUrl(request, "/"));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

