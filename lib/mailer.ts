import { Resend } from "resend";

type SendMailInput = {
  to: string;
  subject: string;
  text: string;
};

function readEnv(...names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return "";
}

function getRequiredEnv(...names: string[]) {
  const value = readEnv(...names);
  if (!value) {
    throw new Error(`Missing ${names.join(" or ")}`);
  }
  return value;
}

function hasGmailConfig() {
  return Boolean(
    readEnv("GMAIL_OAUTH_CLIENT_ID", "GMAIL_CLIENT_ID") &&
      readEnv("GMAIL_OAUTH_CLIENT_SECRET", "GMAIL_CLIENT_SECRET") &&
      readEnv("GMAIL_OAUTH_REFRESH_TOKEN", "GMAIL_REFRESH_TOKEN")
  );
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
    client_id: getRequiredEnv("GMAIL_OAUTH_CLIENT_ID", "GMAIL_CLIENT_ID"),
    client_secret: getRequiredEnv("GMAIL_OAUTH_CLIENT_SECRET", "GMAIL_CLIENT_SECRET"),
    refresh_token: getRequiredEnv("GMAIL_OAUTH_REFRESH_TOKEN", "GMAIL_REFRESH_TOKEN"),
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
  const from = readEnv("MAIL_FROM", "GMAIL_OAUTH_USER", "GMAIL_SENDER");
  if (!from) throw new Error("Missing MAIL_FROM or GMAIL_OAUTH_USER or GMAIL_SENDER");

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
      const hints = [
      "Check OAuth client ID/secret/refresh token and ensure Gmail API is enabled in Google Cloud.",
      "Refresh token must be created with Gmail send scope (https://www.googleapis.com/auth/gmail.send).",
      `MAIL_FROM (${from}) should be the same Gmail account used to issue the refresh token or a verified Gmail Send-As alias.`,
    ];
    throw new Error(`Gmail API send failed: ${r.status} ${t} | Hints: ${hints.join(" ")}`);
  }
}

export async function sendMail(input: SendMailInput) {
  const resendKey = readEnv("RESEND_API_KEY");

  if (resendKey) {
    try {
      await sendWithResend(input);
      return;
    } catch (resendError) {
      if (!hasGmailConfig()) {
        throw resendError;
      }
      console.error("Resend send failed, fallback to Gmail API:", resendError);
    }
  }

  await sendWithGmailApi(input);
}
