import { NextRequest, NextResponse } from "next/server";

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};

export function middleware(req: NextRequest) {
  const user = process.env.ADMIN_USER || "";
  const pass = process.env.ADMIN_PASS || "";

  // Nếu chưa set env thì chặn luôn để khỏi lộ admin
  if (!user || !pass) {
    return new NextResponse("Missing ADMIN_USER / ADMIN_PASS", { status: 500 });
  }

  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Basic ")) {
    return unauthorized();
  }

  const base64 = auth.split(" ")[1] || "";
  const decoded = Buffer.from(base64, "base64").toString();
  const [u, p] = decoded.split(":");

  if (u !== user || p !== pass) {
    return unauthorized();
  }

  return NextResponse.next();
}

function unauthorized() {
  return new NextResponse("Auth required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Admin"' },
  });
}
