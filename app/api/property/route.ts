import { NextResponse } from "next/server";
import { supabaseAnon } from "@/lib/supabase";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("property_id");
  if (!id) return NextResponse.json({ ok: false, error: "property_id required" }, { status: 400 });

  const { data, error } = await supabaseAnon.from("properties").select("*").eq("id", id).single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, property: data });
}
