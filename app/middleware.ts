import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Chỉ bảo vệ admin + api admin
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    const user = process.env.ADMIN_USER || "";
    const pass = process.env.ADMIN_PASS || "";

    // Nếu chưa set env thì chặn luôn để tránh lộ admin
    if (!user || !pass) {
      return new NextResponse("Missing ADMIN_USER / ADMIN_PASS", { status: 500 });
    }

    const auth = req.headers.get("authorization");
    if (!auth?.startsWith("Basic ")) {
      return new NextResponse("Auth required", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="Admin"' },
      });
    }

    const base64 = auth.split(" ")[1];
    const decoded = Buffer.from(base64, "base64").toString("utf-8");
    const [u, p] = decoded.split(":");

    if (u !== user || p !== pass) {
      return new NextResponse("Unauthorized", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="Admin"' },
      });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
