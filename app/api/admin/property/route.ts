import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { PropertyCreateSchema } from "@/lib/validators";

export async function POST(req: Request) {
  try {
    const body = PropertyCreateSchema.parse(await req.json());

    const { data, error } = await supabaseAdmin
      .from("properties")
      .insert([body])
      .select("*")
      .single();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    const site = process.env.NEXT_PUBLIC_SITE_URL;
    if (!site) return NextResponse.json({ ok: false, error: "Missing NEXT_PUBLIC_SITE_URL" }, { status: 500 });

    const formUrl = `${site}/inquiry?property_id=${data.id}&via=qrcode`;
    return NextResponse.json({ ok: true, property: data, formUrl });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 400 });
  }
}
