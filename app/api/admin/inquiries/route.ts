import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const propertyId = searchParams.get("property_id")?.trim();

    if (!propertyId) {
      return NextResponse.json({ ok: false, error: "property_id required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("inquiries")
      .select(
        "id, inquiry_type, company_name, person_name, person_mobile, person_gmail, visit_datetime, created_at"
      )
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { ok: true, inquiries: data ?? [] },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}
