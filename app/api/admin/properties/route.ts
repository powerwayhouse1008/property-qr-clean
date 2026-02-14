import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const q = (supabaseAdmin as any)
    .from("properties")
    .select("*")
    .order("created_at", { ascending: false });

  const { data, error } = await q;

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, properties: data });
}

