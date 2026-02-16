import { NextRequest, NextResponse } from "next/server";

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // ✅ allow login page + login API (không chặn)
  if (path.startsWith("/admin/login") || path.startsWith("/api/admin/login")) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get("admin_auth")?.value;
  if (cookie === "1") return NextResponse.next();

  // redirect tới login
  const url = req.nextUrl.clone();
  url.pathname = "/admin/login";
  url.searchParams.set("next", path);
  return NextResponse.redirect(url);
}
