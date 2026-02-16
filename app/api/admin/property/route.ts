import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { PropertyCreateSchema } from "@/lib/validators";

export async function POST(req: Request) {
  try {
    const body = PropertyCreateSchema.parse(await req.json());

    const site = process.env.NEXT_PUBLIC_SITE_URL;
    if (!site) {
      return NextResponse.json(
        { ok: false, error: "Missing NEXT_PUBLIC_SITE_URL" },
        { status: 500 }
      );
    }

    // 1) Insert property trước
    const { data: inserted, error: ie } = await supabaseAdmin
      .from("properties")
      .insert([body])
      .select("*")
      .single();

    if (ie) {
      return NextResponse.json({ ok: false, error: ie.message }, { status: 400 });
    }

    // 2) Tạo link form (KHÔNG đổi khi status đổi)
    const formUrl = `${site}/inquiry?property_id=${inserted.id}&via=qrcode`;

    // 3) Lưu form_url vào DB để Admin list lấy ra hiển thị QR/Link
    const { data: updated, error: ue } = await supabaseAdmin
      .from("properties")
      .update({ form_url: formUrl })
      .eq("id", inserted.id)
      .select("*")
      .single();

    if (ue) {
      // nếu update fail vẫn trả về formUrl để test, nhưng báo lỗi rõ
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
