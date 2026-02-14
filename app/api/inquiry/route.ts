// app/api/inquiry/route.ts
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabase";
import { InquirySchema } from "@/lib/validators";

async function postTeams(message: string) {
  const url = process.env.TEAMS_WEBHOOK_URL;
  if (!url) return;

  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: message }),
  });
}

export async function POST(req: Request) {
  try {
    // 1) ENV checks
    const RESEND_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_KEY) {
      return NextResponse.json(
        { ok: false, error: "Missing RESEND_API_KEY" },
        { status: 500 }
      );
    }
    const resend = new Resend(RESEND_KEY);

    // 2) Validate body
    const body = InquirySchema.parse(await req.json());

    // 3) Load property
    const { data: prop, error: pe } = await supabaseAdmin
      .from("properties")
      .select("*")
      .eq("id", body.property_id)
      .single();

    if (pe || !prop) {
      return NextResponse.json(
        { ok: false, error: pe?.message ?? "Property not found" },
        { status: 400 }
      );
    }

    const status_at_submit = prop.status ?? null;

    // 4) Insert inquiry
    const { error: ie } = await supabaseAdmin.from("inquiries").insert([
      {
        property_id: body.property_id,
        inquiry_type: body.inquiry_type,
        visit_datetime: body.visit_datetime ?? null,

        company_name: body.company_name,
        company_phone: body.company_phone,

        person_name: body.person_name,
        person_mobile: body.person_mobile,
        person_gmail: body.person_gmail,

        other_text: body.other_text ?? "",
        business_card_url: body.business_card_url ?? null,
        purchase_file_url: body.purchase_file_url ?? null,

        status_at_submit,
        created_at: new Date().toISOString(),
      },
    ]);

    if (ie) {
      return NextResponse.json({ ok: false, error: ie.message }, { status: 400 });
    }

    // 5) Build message (KHÔNG dùng body.tanto_name vì schema bạn không có field này)
    const manager = prop.manager_email ?? "担当者不明";

    const msg = `【物件お問い合わせ】
物件: ${prop.property_code ?? "-"} / ${prop.building_name ?? "-"}
住所: ${prop.address ?? "-"}
内見方法: ${prop.view_method ?? "-"}
ステータス: ${prop.status ?? "-"}

種別: ${body.inquiry_type}
内見日時: ${body.visit_datetime ?? "-"}
購入資料: ${body.purchase_file_url ?? "-"}
名刺: ${body.business_card_url ?? "-"}
その他: ${body.other_text ?? "-"}

会社名: ${body.company_name}
会社TEL: ${body.company_phone}
担当者名: ${body.person_name}
携帯: ${body.person_mobile}
Gmail: ${body.person_gmail}

担当者: ${manager}
`;

    // 6) Teams notify
    await postTeams(msg);

    // 7) Email notify
    const from = process.env.MAIL_FROM || "Property <no-reply@example.com>";

    // gửi cho 담당자 nếu có email
    if (prop.manager_email) {
      await resend.emails.send({
        from,
        to: prop.manager_email,
        subject: `【Inquiry】${prop.property_code ?? ""} ${prop.building_name ?? ""} (${prop.status ?? ""})`,
        text: msg,
      });
    }

    // gửi confirm cho người gửi (khách)
    await resend.emails.send({
      from,
      to: body.person_gmail,
      subject: `受付完了：${prop.property_code ?? ""} ${prop.building_name ?? ""}`,
      text: `お問い合わせありがとうございます。受付完了しました。
物件: ${prop.property_code ?? "-"} ${prop.building_name ?? "-"}
種別: ${body.inquiry_type}
内見日時: ${body.visit_datetime ?? "-"}
`,
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? String(e) },
      { status: 400 }
    );
  }
}

