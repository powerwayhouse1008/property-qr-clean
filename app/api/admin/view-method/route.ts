import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const propertyId = typeof body?.property_id === "string" ? body.property_id.trim() : "";
    const nextViewMethod = typeof body?.view_method === "string" ? body.view_method.trim() : "";

    if (!propertyId) {
      return NextResponse.json({ ok: false, error: "property_id required" }, { status: 400 });
    }
    if (!nextViewMethod) {
      return NextResponse.json({ ok: false, error: "view_method required" }, { status: 400 });
    }

    const { data: property, error: propertyError } = await supabaseAdmin
      .from("properties")
      .select("id, view_method")
      .eq("id", propertyId)
      .single();

    if (propertyError || !property) {
      return NextResponse.json({ ok: false, error: propertyError?.message ?? "Property not found" }, { status: 400 });
    }

    const prevViewMethod = (property.view_method ?? "").trim();
    if (prevViewMethod === nextViewMethod) {
      return NextResponse.json({ ok: true, changed: false });
    }

    const { error: updateError } = await supabaseAdmin
      .from("properties")
      .update({ view_method: nextViewMethod })
      .eq("id", propertyId);

    if (updateError) {
      return NextResponse.json({ ok: false, error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, changed: true });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 400 }
    );
  }
}
