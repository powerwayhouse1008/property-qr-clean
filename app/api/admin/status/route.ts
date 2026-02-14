import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const property_id = body?.property_id as string | undefined;
    const status = body?.status as string | undefined;

    if (!property_id) {
      return NextResponse.json({ ok: false, error: "property_id required" }, { status: 400 });
    }
    if (!status) {
      return NextResponse.json({ ok: false, error: "status required" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("properties")
      .update({ status })
      .eq("id", property_id);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 400 });
  }
}
