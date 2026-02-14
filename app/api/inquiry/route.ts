import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { InquirySchema } from "@/lib/validators";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

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
    const body = InquirySchema.parse(await req.json());

    const { data: prop, error: pe } = await supabaseAdmin
      .from("properties")
      .select("*")
      .eq("id", body.property_id)
      .single();

    if (pe) return NextResponse.json({ ok: false, error: pe.message }, { status: 400 });

    const status_at_submit = prop.status;

    const { error } = await supabaseAdmin.from("inquiries").insert([{
      property_id: body.property_id,
      company_name: body.company_name,
      company_phone: body.company_phone,
      person_name: body.person_name,
      person_mobile: body.person_mobile,
      person_gmail: body.person_gmail,
      inquiry_type: body.inquiry_type,
      visit_datetime: body.visit_datetime ? body.visit_datetime : null,
      other_text: body.other_text || "",
      business_card_url: body.business_card_url,
      purchase_file_url: body.purchase_file_url || "",
      status_at_submit,
      created_at: new Date().toISOString()
    }]);

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    const 담당者 = prop.manager_email ? prop.manager_email : "担当者不明";

    const msg =
`【物件お問い合わせ】
物件: ${prop.property_code} / ${prop.building_name}
住所: ${prop.address}
内見方法: ${prop.view_method}
ステータス: ${prop.status}

種別: ${body.inquiry_type}
内見日時: ${body.visit_datetime || "-"}
購入資料: ${body.purchase_file_url || "-"}
名刺: ${body.business_card_url || "-"}
その他: ${body.other_text || "-"}

会社名: ${body.company_name}
会社TEL: ${body.company_phone}
担当者名: ${body.person_name}
携帯: ${body.person_mobile}
Gmail: ${body.person_gmail}

担当者: ${tanto}
`;

    await postTeams(msg);

    const from = process.env.MAIL_FROM || "Property <no-reply@example.com>";

    if (prop.manager_email) {
      await resend.emails.send({
        from,
        to: prop.manager_email,
        subject: `【Inquiry】${prop.property_code} ${prop.building_name} (${prop.status})`,
        text: msg
      });
    } else {
      // manager unknown: only Teams gets 担当者不明
    }

    await resend.emails.send({
      from,
      to: body.person_gmail,
      subject: `受付完了：${prop.property_code} ${prop.building_name}`,
      text:
`お問い合わせありがとうございます。受付完了しました。
物件: ${prop.property_code} ${prop.building_name}
種別: ${body.inquiry_type}
内見日時: ${body.visit_datetime || "-"}
`
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 400 });
  }
}