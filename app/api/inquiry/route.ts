import { NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabase";
import { InquirySchema } from "@/lib/validators";
import { ZodError } from "zod";

function isLikelyTeamsWebhookUrl(url: string) {
  return /^https:\/\//.test(url) && /webhook|logic\.azure|powerautomate|office\.com/i.test(url);
}

async function postTeams(message: string) {
  const url = process.env.TEAMS_WEBHOOK_URL;
  if (!url) return;

  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: message }),
  });

  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`Teams webhook failed: ${r.status} ${t}`);
  }
}

export async function POST(req: Request) {
  try {
    const RESEND_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_KEY) {
      return NextResponse.json({ ok: false, error: "Missing RESEND_API_KEY" }, { status: 500 });
    }

    const from = process.env.MAIL_FROM;
    if (!from) {
      return NextResponse.json({ ok: false, error: "Missing MAIL_FROM (must be a verified sender in Resend)" }, { status: 500 });
    }

    const resend = new Resend(RESEND_KEY);

    const body = InquirySchema.parse(await req.json());
    const isViewing = body.inquiry_type === "viewing";
    const isPurchase = body.inquiry_type === "purchase";
    const visitDatetime = body.visit_datetime?.trim() ? body.visit_datetime : null;
    const purchaseFileUrl = body.purchase_file_url?.trim() ? body.purchase_file_url : null;

    const { data: prop, error: pe } = await supabaseAdmin
      .from("properties")
      .select("*")
      .eq("id", body.property_id)
      .single();

    if (pe || !prop) {
      return NextResponse.json({ ok: false, error: pe?.message ?? "Property not found" }, { status: 400 });
    }

    const managerName = prop.manager_name ?? "担当者不明";
    const managerEmail = prop.manager_email ?? "-";
    const statusAtSubmit = prop.status ?? null;

    const { error: ie } = await supabaseAdmin.from("inquiries").insert([
      {
        property_id: body.property_id,
        inquiry_type: body.inquiry_type,
        visit_datetime: visitDatetime,

        company_name: body.company_name,
        company_phone: body.company_phone,

        person_name: body.person_name,
        person_mobile: body.person_mobile,
        person_gmail: body.person_gmail,

        other_text: body.other_text ?? "",
        business_card_url: body.business_card_url ?? null,
        purchase_file_url: purchaseFileUrl,

        status_at_submit: statusAtSubmit,
        created_at: new Date().toISOString(),
      },
    ]);

    if (ie) {
      return NextResponse.json({ ok: false, error: ie.message }, { status: 400 });
    }

    const msgInternal = `【物件お問い合わせ】

物件: ${prop.property_code ?? "-"} / ${prop.building_name ?? "-"}
住所: ${prop.address ?? "-"}
ステータス: ${prop.status ?? "-"}

種別: ${body.inquiry_type}
${
  isViewing
    ? `内見方法: ${prop.view_method ?? "-"}
内見日時: ${visitDatetime ?? "-"}
`
    : ""
}${isPurchase ? `購入資料: ${purchaseFileUrl ?? "-"}\n` : ""}名刺: ${body.business_card_url ?? "-"}
その他: ${body.other_text ?? "-"}

会社名: ${body.company_name}
会社TEL: ${body.company_phone}
担当者名: ${body.person_name}
携帯: ${body.person_mobile}
Gmail: ${body.person_gmail}

担当者: ${managerName}
担当者メール: ${managerEmail}
`;

    const msgCustomer = `お問い合わせありがとうございます。受付完了しました。

物件: ${prop.property_code ?? "-"} ${prop.building_name ?? "-"}
住所: ${prop.address ?? "-"}
ステータス: ${prop.status ?? "-"}
種別: ${body.inquiry_type}

${
  isViewing
    ? `内見方法: ${prop.view_method ?? "-"}
内見日時: ${visitDatetime ?? "-"}`
    : isPurchase
    ? `購入資料: ${purchaseFileUrl ?? "-"}`
    : ""
}
`;

    let teamsOk = false;
    let managerMailOk = false;
    let customerMailOk = false;
    const notifyErrors: Record<string, string> = {};
    const toErrMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

    try {
      const teamsWebhookUrl = (process.env.TEAMS_WEBHOOK_URL ?? "").trim();
      if (!teamsWebhookUrl) {
        notifyErrors.teams = "TEAMS_WEBHOOK_URL is missing";
      } else if (!isLikelyTeamsWebhookUrl(teamsWebhookUrl)) {
        notifyErrors.teams = "TEAMS_WEBHOOK_URL is not a valid incoming webhook URL";
      } else {
        await postTeams(msgInternal);
        teamsOk = true;
      }
    } catch (e) {
      notifyErrors.teams = toErrMsg(e);
      console.error("Teams send failed:", e);
    }

    try {
      const managerTo = (prop.manager_email ?? "").trim();
      if (!managerTo) {
        notifyErrors.managerMail = "manager_email is empty on this property";
      } else {
        await resend.emails.send({
          from,
          to: managerTo,
          subject: `【Inquiry】${prop.property_code ?? ""} ${prop.building_name ?? ""} (${prop.status ?? ""})`,
          text: msgInternal,
        });
        managerMailOk = true;
      }
    } catch (e) {
      notifyErrors.managerMail = toErrMsg(e);
      console.error("Manager email send failed:", e);
    }

    try {
      await resend.emails.send({
        from,
        to: body.person_gmail,
        subject: `受付完了：${prop.property_code ?? ""} ${prop.building_name ?? ""}`,
        text: msgCustomer,
      });
      customerMailOk = true;
    } catch (e) {
      notifyErrors.customerMail = toErrMsg(e);
      console.error("Customer email send failed:", e);
    }

    return NextResponse.json({
      ok: true,
      notify: { teamsOk, managerMailOk, customerMailOk },
      notifyErrors,
      warning: Object.keys(notifyErrors).length ? "Inquiry was saved, but some notifications failed." : "",
    });
  } catch (e: unknown) {
    if (e instanceof ZodError) {
      const hasMailError = e.issues.some((issue) => issue.path[0] === "person_gmail");
      const message = hasMailError ? "メールアドレスの形式が正しくありません。" : "入力内容をご確認ください。";
      return NextResponse.json({ ok: false, error: message }, { status: 400 });
    }

    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
