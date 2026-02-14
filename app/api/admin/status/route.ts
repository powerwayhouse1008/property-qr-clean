import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const { property_id, status } = await req.json();
    if (!property_id) return NextResponse.json({ ok: false, error: "property_id required" }, { status: 400 });
    if (!["available","sold","rented"].includes(status)) {
      return NextResponse.json({ ok: false, error: "invalid status" }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from("properties").update({ status }).eq("id", property_id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 400 });
  }
}
