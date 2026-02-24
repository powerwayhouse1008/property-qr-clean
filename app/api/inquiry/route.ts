// app/api/inquiry/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { InquirySchema } from "@/lib/validators";
import { ZodError } from "zod";
import { sendMail } from "@/lib/mailer";

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
    // 1) Validate body
    const body = InquirySchema.parse(await req.json());
    const isViewing = body.inquiry_type === "viewing";
    const isPurchase = body.inquiry_type === "purchase";
   const visitDatetime = body.visit_datetime?.trim() ? body.visit_datetime : null;
    const purchaseFileUrl = body.purchase_file_url?.trim() ? body.purchase_file_url : null;
    // 3) Load property
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
    
    // 4) Insert inquiry
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

    // ===== 4) Build messages =====
    // Internal message (Teams + Manager): KHÔNG có 内見方法
        const inquiryTypeLabel =
      body.inquiry_type === "viewing" ? "viewing" : body.inquiry_type === "purchase" ? "purchase" : body.inquiry_type;
    const attachmentUrls = [purchaseFileUrl, body.business_card_url?.trim() ? body.business_card_url : null].filter(
      Boolean
    ) as string[];
    const attachmentText = attachmentUrls.length ? attachmentUrls.join("\n") : "-";

    // Internal message (Teams + Manager email)
    const msgInternal = `【物件お問い合わせ通知】

■ 物件情報
物件名：${prop.property_code ?? "-"} / ${prop.building_name ?? "-"}
所在地：${prop.address ?? "-"}
ステータス：${prop.status ?? "-"}
種別：${inquiryTypeLabel}
内見方法：${isViewing ? prop.view_method ?? "-" : "-"}
内見日時：${isViewing ? visitDatetime ?? "-" : "-"}

■ お客様情報
会社名：${body.company_name}
お名前：${body.person_name}
メールアドレス：${body.person_gmail}

■ 担当者情報
担当者名：${managerName}
担当者メール：${managerEmail}

■ 添付ファイル
${attachmentText}

お手数ですが、内容をご確認のうえご対応をお願いいたします。`;
 // Teams/Power Automate payload: wrap in code block to preserve line breaks reliably.
    const msgInternalForTeams = `\`\`\`\r\n${msgInternal.replace(/\n/g, "\r\n")}\r\n\`\`\``;

    // Customer confirmation email: CHỈ khi viewing mới có 内見方法 + 内見日時
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

    // ===== 5) Notify with debug flags =====
    let teamsOk = false;
    let managerMailOk = false;
    let customerMailOk = false;
    const notifyErrors: Record<string, string> = {};
    const toErrMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

    // Teams
    try {
       const teamsWebhookUrl = (process.env.TEAMS_WEBHOOK_URL ?? "").trim();
      if (!teamsWebhookUrl) {
        notifyErrors.teams = "TEAMS_WEBHOOK_URL is missing";
         } else if (!isLikelyTeamsWebhookUrl(teamsWebhookUrl)) {
        notifyErrors.teams = "TEAMS_WEBHOOK_URL is not a valid incoming webhook URL";
      } else {
        await postTeams(msgInternalForTeams);
        teamsOk = true;
      }
    } catch (e) {
        notifyErrors.teams = toErrMsg(e);
      console.error("Teams send failed:", e);
    }

    // Mail to manager (if exists)
    try {
        const managerTo = (prop.manager_email ?? "").trim();
      if (!managerTo) {
        notifyErrors.managerMail = "manager_email is empty on this property";
      } else {
        await sendMail({
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

    // Mail to customer (always)
    try {
      await sendMail({
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
