"use client";

import { useEffect, useMemo, useState } from "react";

type InquiryType = "viewing" | "purchase" | "other";

export default function InquiryPage() {
  const [p, setP] = useState<any>(null);
  const [msg, setMsg] = useState("");
  const [type, setType] = useState<InquiryType>("viewing");

  const [businessCard, setBusinessCard] = useState<File | null>(null);
  const [purchaseFile, setPurchaseFile] = useState<File | null>(null);

  const sp = useMemo(() => (typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null), []);
  const property_id = sp?.get("property_id") || "";
  const via = sp?.get("via") || "";

  const [form, setForm] = useState({
    company_name: "",
    company_phone: "",
    person_name: "",
    person_mobile: "",
    person_gmail: "",
    visit_datetime: "",
    other_text: "",
  });

  useEffect(() => {
    (async () => {
      if (!property_id) return;
      const r = await fetch(`/api/property?property_id=${property_id}`);
      const j = await r.json();
      if (!j.ok) return setMsg("❌ " + j.error);
      setP(j.property);
    })();
  }, [property_id]);

  async function uploadOne(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    const r = await fetch("/api/upload", { method: "POST", body: fd });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error);
    return j.url as string;
  }

  async function submit() {
    setMsg("送信中…");
    try {
      if (!property_id) throw new Error("property_id is missing");

      if (!form.company_name || !form.company_phone || !form.person_name || !form.person_mobile || !form.person_gmail) {
        throw new Error("必須項目を入力してください。");
      }
      if (!businessCard) throw new Error("名刺ファイルは必須です。");

      if (type === "viewing" && !form.visit_datetime) throw new Error("内見日時を選択してください。");
      if (type === "purchase" && !purchaseFile) throw new Error("購入資料ファイルをアップロードしてください。");

      const business_card_url = await uploadOne(businessCard);
      const purchase_file_url = purchaseFile ? await uploadOne(purchaseFile) : "";

      const visitISO = form.visit_datetime ? new Date(form.visit_datetime).toISOString() : "";

      const r = await fetch("/api/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property_id,
          via,
          inquiry_type: type,
          company_name: form.company_name,
          company_phone: form.company_phone,
          person_name: form.person_name,
          person_mobile: form.person_mobile,
          person_gmail: form.person_gmail,
          visit_datetime: visitISO,
          other_text: form.other_text,
          business_card_url,
          purchase_file_url,
        }),
      });

      const j = await r.json();
      if (!j.ok) return setMsg("❌ " + j.error);

      setMsg("✅ 送信完了しました。ありがとうございました。");
      setForm({ company_name: "", company_phone: "", person_name: "", person_mobile: "", person_gmail: "", visit_datetime: "", other_text: "" });
      setBusinessCard(null);
      setPurchaseFile(null);
    } catch (e: any) {
      setMsg("❌ " + (e?.message ?? String(e)));
    }
  }

  const card: React.CSSProperties = { maxWidth: 920, margin: "20px auto", padding: 14, fontFamily: "system-ui" };
  const box: React.CSSProperties = { background: "#fff", border: "1px solid #eee", borderRadius: 16, padding: 18 };
  const inp: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd", boxSizing: "border-box" };

  if (!property_id) {
    return (
      <div style={card}>
        <div style={box}>
          <h2 style={{ marginTop: 0 }}>物件お問い合わせ</h2>
          <p style={{ color: "#d11", fontWeight: 800 }}>❌ property_id がありません（QRリンクが不正）</p>
        </div>
      </div>
    );
  }

  return (
    <div style={card}>
      <div style={box}>
        <h2 style={{ marginTop: 0 }}>物件お問い合わせフォーム</h2>

        {p && (
          <div style={{ marginTop: 6, color: "#555", lineHeight: 1.6 }}>
            <div style={{ fontWeight: 900 }}>
              {p.property_code} / {p.building_name}
            </div>
            <div>住所: {p.address}</div>
            <div>
              ステータス: <b>{p.status}</b>
            </div>
          </div>
        )}

        <div style={{ marginTop: 14, padding: 12, border: "1px solid #eee", borderRadius: 14, background: "#fafafa" }}>
          <div style={{ fontWeight: 900, marginBottom: 6 }}>お問い合わせ種別（任意の分岐）</div>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="radio" name="type" checked={type === "viewing"} onChange={() => setType("viewing")} />
            内見（内見日時を選択）
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
            <input type="radio" name="type" checked={type === "purchase"} onChange={() => setType("purchase")} />
            購入（資料ファイルを添付）
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
            <input type="radio" name="type" checked={type === "other"} onChange={() => setType("other")} />
            その他（内容入力）
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
          <div>
            <div style={{ fontWeight: 900 }}>会社名（必須）</div>
            <input style={inp} value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
          </div>
          <div>
            <div style={{ fontWeight: 900 }}>会社TEL（必須）</div>
            <input style={inp} value={form.company_phone} onChange={(e) => setForm({ ...form, company_phone: e.target.value })} />
          </div>
          <div>
            <div style={{ fontWeight: 900 }}>担当者名（必須）</div>
            <input style={inp} value={form.person_name} onChange={(e) => setForm({ ...form, person_name: e.target.value })} />
          </div>
          <div>
            <div style={{ fontWeight: 900 }}>携帯（必須）</div>
            <input style={inp} value={form.person_mobile} onChange={(e) => setForm({ ...form, person_mobile: e.target.value })} />
          </div>
          <div>
            <div style={{ fontWeight: 900 }}>Gmail（必須）</div>
            <input style={inp} type="email" value={form.person_gmail} onChange={(e) => setForm({ ...form, person_gmail: e.target.value })} />
          </div>
          <div>
            <div style={{ fontWeight: 900 }}>名刺（必須：PDF/JPG/PNG）</div>
            <input style={inp} type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => setBusinessCard(e.target.files?.[0] || null)} />
          </div>
        </div>

        {type === "viewing" && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 900 }}>内見日時（必須）</div>
            <input style={inp} type="datetime-local" value={form.visit_datetime} onChange={(e) => setForm({ ...form, visit_datetime: e.target.value })} />
          </div>
        )}

        {type === "purchase" && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 900 }}>購入資料（必須：PDF/JPG/PNG）</div>
            <input style={inp} type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => setPurchaseFile(e.target.files?.[0] || null)} />
          </div>
        )}

        {type === "other" && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 900 }}>その他内容</div>
            <textarea
              style={{ ...inp, minHeight: 120 }}
              value={form.other_text}
              onChange={(e) => setForm({ ...form, other_text: e.target.value })}
              placeholder="ご要望・質問など"
            />
          </div>
        )}

        <button
          onClick={submit}
          style={{
            marginTop: 14,
            padding: "12px 14px",
            borderRadius: 14,
            border: 0,
            background: "#111",
            color: "#fff",
            fontWeight: 900,
            cursor: "pointer",
            width: "100%",
          }}
        >
          送信する
        </button>

        <div style={{ marginTop: 10, fontWeight: 900 }}>{msg}</div>
      </div>
    </div>
  );
}
