import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { PropertyCreateSchema } from "@/lib/validators";

function getSiteUrl(req: Request) {
  // 1) ưu tiên env
  const envSite = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (envSite) return envSite.replace(/\/+$/, "");

  // 2) fallback theo domain đang chạy (Vercel/proxy)
  const proto =
    req.headers.get("x-forwarded-proto") ??
    (process.env.NODE_ENV === "development" ? "http" : "https");

  const host =
    req.headers.get("x-forwarded-host") ??
    req.headers.get("host");

  if (!host) return null;

  return `${proto}://${host}`.replace(/\/+$/, "");
}

export async function POST(req: Request) {
  try {
    const body = PropertyCreateSchema.parse(await req.json());

    const site = getSiteUrl(req);
    if (!site) {
      return NextResponse.json(
        { ok: false, error: "Missing NEXT_PUBLIC_SITE_URL and cannot detect host" },
        { status: 500 }
      );
    }

    // 1) Insert property
    const { data: inserted, error: ie } = await supabaseAdmin
      .from("properties")
      .insert([body])
      .select("*")
      .single();

    if (ie) {
      return NextResponse.json({ ok: false, error: ie.message }, { status: 400 });
    }

    // 2) Form link (không đổi khi status đổi)
    const formUrl = `${site}/inquiry?property_id=${inserted.id}&via=qrcode`;

    // 3) Lưu form_url vào DB
    const { data: updated, error: ue } = await supabaseAdmin
      .from("properties")
      .update({ form_url: formUrl })
      .eq("id", inserted.id)
      .select("*")
      .single();

    if (ue) {
      return NextResponse.json(
        { ok: false, error: `Created but failed to save form_url: ${ue.message}` },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, property: updated, formUrl });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? String(e) },
      { status: 400 }
    );
  }
}

