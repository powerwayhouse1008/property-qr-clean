import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendMail } from "@/lib/mailer";

const statusLabelMap: Record<string, string> = {
  available: "募集中",
  pending: "申込有り",
  sold: "成約",
  rented: "賃貸中",
};

function toStatusLabel(status: string | null | undefined) {
  if (!status) return "-";
  return statusLabelMap[status] ?? status;
}

function formatDateTimeJa(raw: string | null | undefined) {
  if (!raw) return "-";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const propertyId = typeof body?.property_id === "string" ? body.property_id.trim() : "";
    const nextPrice = typeof body?.price === "string" ? body.price.trim() : "";

    if (!propertyId) {
      return NextResponse.json({ ok: false, error: "property_id required" }, { status: 400 });
    }
    if (!nextPrice) {
      return NextResponse.json({ ok: false, error: "price required" }, { status: 400 });
    }

    const { data: property, error: propertyError } = await supabaseAdmin
      .from("properties")
      .select("id, property_code, building_name, address, status, price")
      .eq("id", propertyId)
      .single();

    if (propertyError || !property) {
      return NextResponse.json({ ok: false, error: propertyError?.message ?? "Property not found" }, { status: 400 });
    }

    const prevPrice = (property.price ?? "").trim();
    if (prevPrice === nextPrice) {
      return NextResponse.json({ ok: true, changed: false, notified: 0, failed: 0 });
    }

    const { error: updateError } = await supabaseAdmin
      .from("properties")
      .update({ price: nextPrice })
      .eq("id", propertyId);

    if (updateError) {
      return NextResponse.json({ ok: false, error: updateError.message }, { status: 400 });
    }

    const { data: inquiries, error: inquiryError } = await supabaseAdmin
      .from("inquiries")
      .select("person_gmail, person_name, inquiry_type, created_at")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false });

    if (inquiryError) {
      return NextResponse.json({ ok: false, error: inquiryError.message }, { status: 400 });
    }

    const latestByMail = new Map<string, { person_name: string; inquiry_type: string; created_at: string | null }>();
    for (const row of inquiries ?? []) {
      const email = (row.person_gmail ?? "").trim();
      if (!email || latestByMail.has(email)) continue;
      latestByMail.set(email, {
        person_name: row.person_name ?? "お客様",
        inquiry_type: row.inquiry_type ?? "-",
        created_at: row.created_at ?? null,
      });
    }

    let notified = 0;
    let failed = 0;
    const notifyErrors: Record<string, string> = {};
    const statusLabel = toStatusLabel(property.status);

    for (const [email, latest] of latestByMail.entries()) {
      const subject = `【価格変更のお知らせ】${property.building_name ?? property.property_code ?? "物件"}`;
      const text = `${latest.person_name} 様

お問い合わせいただいた「${property.building_name ?? "-"}」について、
価格が以下のとおり変更されましたので、ご報告申し上げます。

旧 ${prevPrice || "-"} → 新 ${nextPrice}

【物件情報】
物件名: ${property.building_name ?? "-"}
物件コード: ${property.property_code ?? "-"}
状態: ${statusLabel} (${formatDateTimeJa(new Date().toISOString())}現在)
販売価格: ${nextPrice}
所在地: ${property.address ?? "-"}

【お問い合わせ内容】
お問い合わせ日時: ${formatDateTimeJa(latest.created_at)}
お問い合わせ種別: ${latest.inquiry_type}
メールアドレス: ${email}

販売状況などの物件確認はこちらよりご確認ください。`;

      try {
        await sendMail({ to: email, subject, text });
        notified += 1;
      } catch (e: unknown) {
        failed += 1;
        notifyErrors[email] = e instanceof Error ? e.message : String(e);
      }
    }

    return NextResponse.json({
      ok: true,
      changed: true,
      notified,
      failed,
      notifyErrors,
      warning: failed > 0 ? "Price updated, but some customer emails failed." : "",
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 400 }
    );
  }
}
