import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, TWO_FA_COOKIE, verifySessionToken } from "@/lib/auth/jwt";

const PUBLIC_PATHS = ["/", "/login", "/login/2fa"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic =
    PUBLIC_PATHS.includes(pathname) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/ocr/worker") ||
    pathname.includes(".");

  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value;
  const session = sessionToken ? await verifySessionToken(sessionToken) : null;

  const isApp =
    pathname.startsWith("/documents") ||
    pathname.startsWith("/search") ||
    pathname.startsWith("/audit") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/folders") ||
    pathname.startsWith("/api/");

  if (isApp && !session && !pathname.startsWith("/api/ocr/worker")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  if ((pathname === "/login" || pathname === "/login/2fa") && session) {
    const url = request.nextUrl.clone();
    url.pathname = "/documents";
    return NextResponse.redirect(url);
  }

  if (pathname === "/login/2fa") {
    const pending = request.cookies.get(TWO_FA_COOKIE)?.value;
    if (!pending && !session) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
  }

  if (pathname.startsWith("/audit") || pathname.startsWith("/settings")) {
    if (session && session.role !== "ADMIN_ESPACE" && session.role !== "SUPER_ADMIN") {
      const url = request.nextUrl.clone();
      url.pathname = "/documents";
      return NextResponse.redirect(url);
    }
  }

  void isPublic;
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
