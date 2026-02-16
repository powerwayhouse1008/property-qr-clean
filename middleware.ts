import { NextRequest, NextResponse } from "next/server";

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // ✅ cho phép login page + login API đi qua (KHÔNG bắt auth)
  if (path.startsWith("/admin/login") || path.startsWith("/api/admin/login")) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get("admin_auth")?.value;
  if (cookie === "1") return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/admin/login";
  url.searchParams.set("next", path);
  return NextResponse.redirect(url);
}
