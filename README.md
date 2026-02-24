# Property Inquiry (Option A) — Azure App Service + Supabase + Resend + Teams

## What you get
- Admin: 登録（物件コード/建物/住所/内見方法/ステータス/担当者メール）→ QR 自動生成
- Customer: QRからアクセス → 分岐フォーム
  - ① 内見（選択した時だけ）: 内見日時 必須
  - ② 購入（選択した時だけ）: 購入資料(PDF/JPG/PNG) 必須
  - ③ その他: 内容入力
- 常に必須: 会社名 / 会社TEL / 担当者名 / 携帯 / Gmail / 名刺(PDF/JPG/PNG)
- 保存: Supabase DB + Supabase Storage (uploads bucket)
- 通知: Teams (Incoming Webhook) + Resendメール
  - 物件の担当者メールが無い場合: Teamsに **担当者不明** を表示し、担当者メール送信はスキップ

---

## 1) Supabase setup

### SQL (Supabase SQL Editor)
```sql
create table properties (
  id uuid primary key default gen_random_uuid(),
  property_code text unique not null,
  building_name text not null,
  address text not null,
  view_method text not null,
  status text not null default 'available',
  manager_name text,
  manager_email text not null,
  created_at timestamptz not null default now()
);

create table inquiries (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,

  company_name text not null,
  company_phone text not null,
  person_name text not null,
  person_mobile text not null,
  person_gmail text not null,

  inquiry_type text not null, -- viewing|purchase|other
  visit_datetime timestamptz,
  other_text text,
  business_card_url text not null,
  purchase_file_url text,
  status_at_submit text not null,

  created_at timestamptz not null default now()
);
```

### Storage
Create a bucket named `uploads` (public easiest).

---

## 2) Teams Incoming Webhook
Teams channel:
- Add **Incoming Webhook** (or Workflows/Connector depending on tenant)
- Copy URL → put into `TEAMS_WEBHOOK_URL`

---
## 3.1) Gmail OAuth2 (if you do not use Resend)
If `RESEND_API_KEY` is empty, the app sends mail via Gmail API using OAuth2 refresh token.

Set these env vars:
- `GMAIL_OAUTH_USER`
- `GMAIL_OAUTH_CLIENT_ID`
- `GMAIL_OAUTH_CLIENT_SECRET`
- `GMAIL_OAUTH_REFRESH_TOKEN`

Google Cloud OAuth screen (Web application) values:
- **Authorized JavaScript origins**: your app origin (example `http://localhost:3000`, `https://your-app.vercel.app`)
- **Authorized redirect URI**: use `https://developers.google.com/oauthplayground` to generate refresh token quickly

Keep `MAIL_FROM` as your Gmail address (or `Name <your-gmail@gmail.com>`).

## 3) Local run
Copy `.env.local.example` -> `.env.local` and fill.

```bash
npm install
npm run dev
```
Admin: http://localhost:3000/admin

---

## 4) Deploy to Azure App Service (Option A)

### A) Create App Service
- App Service (Linux) runtime **Node 20**
- App settings:
  - `SCM_DO_BUILD_DURING_DEPLOYMENT=true`

### B) Set startup
General settings -> Startup Command:
- `npm start`

### C) Environment variables
Configuration -> Application settings:
- Add all variables from `.env.local`

### D) Deploy (Zip deploy)
Zip the project folder (without node_modules) and deploy using portal or Azure CLI.

After deploy:
- `NEXT_PUBLIC_SITE_URL` = `https://<your-app>.azurewebsites.net` (or your custom domain)

### E) Custom domain (.com/.jp)
- App Service -> Custom domains -> Add domain
- Update DNS (CNAME/A)
- Enable TLS/SSL

---

## Notes
- Admin authentication is not included (fastest). If you want, I can add password login or Microsoft Entra ID login.
