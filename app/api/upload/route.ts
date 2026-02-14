import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ ok: false, error: "file required" }, { status: 400 });

  const allowed = ["application/pdf", "image/jpeg", "image/png"];
  if (!allowed.includes(file.type)) return NextResponse.json({ ok: false, error: "Only PDF/JPG/PNG" }, { status: 400 });

  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ ok: false, error: "File too large (max 10MB)" }, { status: 400 });

  const bytes = Buffer.from(await file.arrayBuffer());
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `uploads/${Date.now()}_${safeName}`;

  const { error } = await supabaseAdmin.storage.from("uploads").upload(path, bytes, {
    contentType: file.type,
    upsert: false,
  });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  const { data } = supabaseAdmin.storage.from("uploads").getPublicUrl(path);
  return NextResponse.json({ ok: true, url: data.publicUrl });
}
