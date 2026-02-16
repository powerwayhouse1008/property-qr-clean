import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { user, pass } = await req.json();

  const ADMIN_USER = process.env.ADMIN_USER || "";
  const ADMIN_PASS = process.env.ADMIN_PASS || "";

  if (!ADMIN_USER || !ADMIN_PASS) {
    return NextResponse.json({ ok: false, error: "Missing ADMIN_USER / ADMIN_PASS" }, { status: 500 });
  }

  if (user !== ADMIN_USER || pass !== ADMIN_PASS) {
    return NextResponse.json({ ok: false, error: "Sai tài khoản hoặc mật khẩu" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });

  // cookie 7 ngày
  res.cookies.set("admin_auth", "1", {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: 60 * 60 * 24 * 7,
});

  return res;
}
