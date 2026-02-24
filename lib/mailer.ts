import { Resend } from "resend";

type SendMailInput = {
  to: string;
  subject: string;
  text: string;
};

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

async function sendWithResend(input: SendMailInput) {
  const resend = new Resend(getRequiredEnv("RESEND_API_KEY"));
  await resend.emails.send({
    from: getRequiredEnv("MAIL_FROM"),
    to: input.to,
    subject: input.subject,
    text: input.text,
  });
}

async function getGoogleAccessToken() {
  const body = new URLSearchParams({
    client_id: getRequiredEnv("GMAIL_OAUTH_CLIENT_ID"),
    client_secret: getRequiredEnv("GMAIL_OAUTH_CLIENT_SECRET"),
    refresh_token: getRequiredEnv("GMAIL_OAUTH_REFRESH_TOKEN"),
    grant_type: "refresh_token",
  });

  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`Google token exchange failed: ${r.status} ${t}`);
  }

  const json = (await r.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("Google token exchange returned empty access_token");
  return json.access_token;
}

function toBase64UrlUtf8(input: string) {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function sendWithGmailApi(input: SendMailInput) {
  const accessToken = await getGoogleAccessToken();
  const from = (process.env.MAIL_FROM ?? process.env.GMAIL_OAUTH_USER ?? "").trim();
  if (!from) throw new Error("Missing MAIL_FROM or GMAIL_OAUTH_USER");

  const rawMessage = [
    `From: ${from}`,
    `To: ${input.to}`,
    `Subject: ${input.subject}`,
    "Content-Type: text/plain; charset=UTF-8",
    "",
    input.text,
  ].join("\r\n");

  const r = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: toBase64UrlUtf8(rawMessage) }),
  });

  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`Gmail API send failed: ${r.status} ${t}`);
  }
}

export async function sendMail(input: SendMailInput) {
  if (process.env.RESEND_API_KEY?.trim()) {
    await sendWithResend(input);
    return;
  }

  await sendWithGmailApi(input);
}
