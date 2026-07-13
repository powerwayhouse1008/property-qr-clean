import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { z } from "zod";

const ManagerUpdateSchema = z.object({
  property_id: z.string().min(1),
  manager_name: z.string().trim().min(1, "manager_name required"),
  manager_email: z.string().trim().email("manager_email must be a valid email"),
});

export async function POST(req: Request) {
  try {
    const body = ManagerUpdateSchema.parse(await req.json());

    const { data: property, error: propertyError } = await supabaseAdmin
      .from("properties")
      .select("id, manager_name, manager_email, form_url")
      .eq("id", body.property_id)
      .single();

    if (propertyError || !property) {
      return NextResponse.json({ ok: false, error: propertyError?.message ?? "Property not found" }, { status: 400 });
    }

    const prevManagerName = (property.manager_name ?? "").trim();
    const prevManagerEmail = (property.manager_email ?? "").trim();
    const prevFormUrl = property.form_url ?? null;
    if (prevManagerName === body.manager_name && prevManagerEmail === body.manager_email) {
      return NextResponse.json({ ok: true, changed: false });
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("properties")
      .update({
        manager_name: body.manager_name,
        manager_email: body.manager_email,
      })
      .eq("id", body.property_id)
      .select("form_url")
      .single();

    if (updateError) {
      return NextResponse.json({ ok: false, error: updateError.message }, { status: 400 });
    }

    if ((updated?.form_url ?? null) !== prevFormUrl) {
      return NextResponse.json({ ok: false, error: "Manager updated, but QR form URL changed unexpectedly." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, changed: true });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 400 }
    );
  }
}
