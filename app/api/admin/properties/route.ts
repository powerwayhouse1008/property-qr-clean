import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("properties")
      .select(
        "id, property_code, building_name, address, view_method, status, manager_name, manager_email, form_url, created_at"
      )
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

  
    return NextResponse.json(
      { ok: true, properties: data ?? [] },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const propertyIds = Array.isArray(body?.property_ids)
      ? body.property_ids.filter((id: unknown): id is string => typeof id === "string" && id.trim().length > 0)
      : [];

    if (propertyIds.length === 0) {
      return NextResponse.json({ ok: false, error: "property_ids required" }, { status: 400 });
    }

    const { error: inquiryError, count: inquiryCount } = await supabaseAdmin
      .from("inquiries")
      .delete({ count: "exact" })
      .in("property_id", propertyIds);

    if (inquiryError) {
      return NextResponse.json({ ok: false, error: inquiryError.message }, { status: 400 });
    }

    const { error: propertyError, count: propertyCount } = await supabaseAdmin
      .from("properties")
      .delete({ count: "exact" })
      .in("id", propertyIds);

    if (propertyError) {
      return NextResponse.json({ ok: false, error: propertyError.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      deleted: {
        inquiries: inquiryCount ?? 0,
        properties: propertyCount ?? 0,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}
