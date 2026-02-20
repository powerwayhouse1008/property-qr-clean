"use client";

import { useEffect, useMemo, useState } from "react";

type InquiryType = "viewing" | "purchase" | "other";

// ✅ giới hạn để tránh Vercel 413 (Request Entity Too Large)
const MAX_UPLOAD_MB = 4;
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
function formatInquiryError(raw: unknown) {
  if (!raw) return "送信に失敗しました。入力内容をご確認ください。";

  if (typeof raw === "string") {
    if (raw.includes("Invalid email") || raw.includes("person_gmail")) return "メールアドレスの形式が正しくありません。";
    if (raw.includes("visit_datetime required")) return "内見日時を入力してください。";
    if (raw.includes("purchase file required")) return "購入資料ファイルをアップロードしてください。";
    return raw;
  }

  if (Array.isArray(raw)) {
    const hasMailError = raw.some((x: any) => String(x?.path?.[0] ?? "") === "person_gmail");
    if (hasMailError) return "メールアドレスの形式が正しくありません。";
  }

  return "送信に失敗しました。入力内容をご確認ください。";
}

export default function InquiryPage() {
  const [p, setP] = useState<any>(null);
  const [msg, setMsg] = useState("");
  const [type, setType] = useState<InquiryType>("viewing");

  const [businessCard, setBusinessCard] = useState<File | null>(null);
  const [purchaseFile, setPurchaseFile] = useState<File | null>(null);

  const sp = useMemo(
    () => (typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null),
    []
  );
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

  // ✅ responsive an toàn (không dùng window.innerWidth trực tiếp trong render)
  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth < 760);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    (async () => {
      if (!property_id) return;
      const r = await fetch(`/api/property?property_id=${property_id}`, { cache: "no-store" });
      const j = await r.json();
       if (!j.ok) return setMsg("❌ " + formatInquiryError(j.error));
      setP(j.property);
    })();
  }, [property_id]);

  async function uploadOne(file: File) {
    // ✅ chặn trước để khỏi dính 413
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new Error(`ファイル容量が大きすぎます（最大 ${MAX_UPLOAD_MB}MB）`);
    }

    const fd = new FormData();
    fd.append("file", file);

    const r = await fetch("/api/upload", { method: "POST", body: fd });

    // ✅ Vercel 413 có thể trả text/html => không parse json được
    const text = await r.text();
    let j: any;
    try {
      j = JSON.parse(text);
    } catch {
      throw new Error(`Upload failed (${r.status}): ${text.slice(0, 120)}`);
    }

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
      if (!j.ok) return setMsg("❌ " + formatInquiryError(j.error));

            const notify = j?.notify as { teamsOk?: boolean; managerMailOk?: boolean; customerMailOk?: boolean } | undefined;
      const failed: string[] = [];
      if (notify) {
        if (!notify.teamsOk) failed.push("Teams");
        if (!notify.managerMailOk) failed.push("担当者メール");
        if (!notify.customerMailOk) failed.push("お客様メール");
      }

      if (failed.length > 0) {
        const details = typeof j?.notifyErrors === "object" ? JSON.stringify(j.notifyErrors) : "";
        setMsg(`⚠️ 送信は完了しましたが、通知に失敗しました: ${failed.join(" / ")}
${details}`);
      } else {
        setMsg("✅ 送信完了しました。ありがとうございました。");
      }
      setForm({
        company_name: "",
        company_phone: "",
        person_name: "",
        person_mobile: "",
        person_gmail: "",
        visit_datetime: "",
        other_text: "",
      });
      setBusinessCard(null);
      setPurchaseFile(null);
    } catch (e: any) {
          setMsg("❌ " + formatInquiryError(e?.message ?? String(e)));
    }
  }

  // ===== Styles =====
  const page: React.CSSProperties = {
    minHeight: "100vh",
    padding: "34px 14px",
    fontFamily: "system-ui",
    background:
      "radial-gradient(1200px 600px at 10% 10%, rgba(99,102,241,0.18), transparent 60%)," +
      "radial-gradient(900px 500px at 90% 20%, rgba(56,189,248,0.18), transparent 55%)," +
      "radial-gradient(800px 500px at 50% 95%, rgba(34,211,238,0.16), transparent 55%)," +
      "linear-gradient(135deg, #eef2ff 0%, #f8fafc 45%, #ecfeff 100%)",
  };

  const shell: React.CSSProperties = { maxWidth: 980, margin: "0 auto" };

  const glass: React.CSSProperties = {
    background: "rgba(255,255,255,0.72)",
    border: "1px solid rgba(255,255,255,0.65)",
    borderRadius: 22,
    padding: 18,
    boxShadow: "0 18px 60px rgba(15,23,42,0.10)",
    backdropFilter: "blur(10px)",
  };

  const headerRow: React.CSSProperties = { display: "flex", alignItems: "center", gap: 12, marginBottom: 12 };

  const logo: React.CSSProperties = {
    width: 44,
    height: 44,
    borderRadius: 14,
    background: "linear-gradient(135deg, rgba(59,130,246,0.95), rgba(34,211,238,0.85))",
    display: "grid",
    placeItems: "center",
    color: "#fff",
    fontWeight: 900,
    letterSpacing: 0.5,
    boxShadow: "0 12px 30px rgba(59,130,246,0.25)",
    flex: "0 0 auto",
  };

  const title: React.CSSProperties = { fontSize: 24, fontWeight: 900, margin: 0, lineHeight: 1.15, color: "#0f172a" };
  const subtitle: React.CSSProperties = { marginTop: 4, fontSize: 13, color: "#475569", lineHeight: 1.4 };

  const infoCard: React.CSSProperties = {
    marginTop: 10,
    padding: 14,
    borderRadius: 18,
    border: "1px solid rgba(148,163,184,0.25)",
    background: "rgba(255,255,255,0.65)",
  };

  const section: React.CSSProperties = {
    marginTop: 14,
    padding: 14,
    borderRadius: 18,
    border: "1px solid rgba(148,163,184,0.22)",
    background: "rgba(255,255,255,0.60)",
  };

  const sectionTitle: React.CSSProperties = { fontWeight: 900, marginBottom: 10, color: "#0f172a" };

  const radioWrap: React.CSSProperties = { display: "grid", gap: 8 };

  const radioRow: React.CSSProperties = {
    display: "flex",
    gap: 10,
    alignItems: "center",
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(148,163,184,0.22)",
    background: "rgba(255,255,255,0.70)",
  };

  const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 };
  const grid1: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr", gap: 12, marginTop: 12 };

  const label: React.CSSProperties = { fontWeight: 900, color: "#0f172a", marginBottom: 6, fontSize: 13 };

  const inp: React.CSSProperties = {
    width: "100%",
    padding: "11px 12px",
    borderRadius: 14,
    border: "1px solid rgba(148,163,184,0.35)",
    background: "rgba(255,255,255,0.92)",
    boxSizing: "border-box",
    outline: "none",
  };

  const hint: React.CSSProperties = { marginTop: 6, fontSize: 12, color: "#64748b" };

  const button: React.CSSProperties = {
    marginTop: 14,
    padding: "13px 14px",
    borderRadius: 16,
    border: 0,
    background: "linear-gradient(135deg, rgba(59,130,246,0.95), rgba(34,211,238,0.90))",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
    width: "100%",
    boxShadow: "0 14px 30px rgba(59,130,246,0.25)",
    letterSpacing: 0.5,
  };

  const msgStyle: React.CSSProperties = {
    marginTop: 12,
    fontWeight: 900,
       color: msg.startsWith("✅") ? "#16a34a" : msg.startsWith("❌") ? "#dc2626" : msg.startsWith("⚠️") ? "#d97706" : "#0f172a",
    whiteSpace: "pre-wrap",
  };

  if (!property_id) {
    return (
      <div style={page}>
        <div style={shell}>
          <div style={glass}>
            <div style={headerRow}>
              <div style={logo}>PH</div>
              <div>
                <h2 style={title}>物件お問い合わせ</h2>
                <div style={subtitle}>POWERWAY HOUSE</div>
              </div>
            </div>
            <div style={infoCard}>
              <div style={{ color: "#dc2626", fontWeight: 900 }}>❌ property_id がありません（QRリンクが不正）</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={page}>
      <div style={shell}>
        <div style={glass}>
          {/* Header */}
          <div style={headerRow}>
            <div style={logo}>PH</div>
            <div style={{ flex: 1 }}>
              <h2 style={title}>物件お問い合わせフォーム</h2>
              <div style={subtitle}>POWERWAY HOUSE / お問い合わせ内容をご入力ください</div>
            </div>
          </div>

          {/* Property summary */}
          {p && (
            <div style={infoCard}>
              <div style={{ fontWeight: 900, color: "#0f172a" }}>
                {p.property_code} / {p.building_name}
              </div>
              <div style={{ marginTop: 6, color: "#475569", lineHeight: 1.55 }}>
                <div>住所: {p.address}</div>
                <div>
                  ステータス: <b>{p.status}</b>
                </div>
              </div>
            </div>
          )}

          {/* Type */}
          <div style={section}>
            <div style={sectionTitle}>お問い合わせ種別（任意の分岐）</div>
            <div style={radioWrap}>
              <label style={radioRow}>
                <input type="radio" name="type" checked={type === "viewing"} onChange={() => setType("viewing")} />
                <div>
                  <div style={{ fontWeight: 900 }}>内見</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>内見日時を選択して送信</div>
                </div>
              </label>

              <label style={radioRow}>
                <input type="radio" name="type" checked={type === "purchase"} onChange={() => setType("purchase")} />
                <div>
                  <div style={{ fontWeight: 900 }}>購入</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>資料ファイルを添付</div>
                </div>
              </label>

              <label style={radioRow}>
                <input type="radio" name="type" checked={type === "other"} onChange={() => setType("other")} />
                <div>
                  <div style={{ fontWeight: 900 }}>その他</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>内容を入力して送信</div>
                </div>
              </label>
            </div>
          </div>

          {/* Form inputs */}
          <div style={section}>
            <div style={sectionTitle}>お客様情報</div>

            <div style={isNarrow ? grid1 : grid}>
              <div>
                <div style={label}>会社名（必須）</div>
                <input style={inp} value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
              </div>

              <div>
                <div style={label}>会社TEL（必須）</div>
                <input style={inp} value={form.company_phone} onChange={(e) => setForm({ ...form, company_phone: e.target.value })} />
              </div>

              <div>
                <div style={label}>担当者名（必須）</div>
                <input style={inp} value={form.person_name} onChange={(e) => setForm({ ...form, person_name: e.target.value })} />
              </div>

              <div>
                <div style={label}>携帯（必須）</div>
                <input style={inp} value={form.person_mobile} onChange={(e) => setForm({ ...form, person_mobile: e.target.value })} />
              </div>

              <div>
                <div style={label}>Gmail（必須）</div>
                <input
                  style={inp}
                  type="email"
                  value={form.person_gmail}
                  onChange={(e) => setForm({ ...form, person_gmail: e.target.value })}
                />
                <div style={hint}>※ 確認メールを送信します</div>
              </div>

              <div>
                <div style={label}>名刺（必須：PDF/JPG/PNG）</div>
                <input
                  style={inp}
                  type="file"
                  accept="application/pdf,image/jpeg,image/png"
                  onChange={(e) => setBusinessCard(e.target.files?.[0] || null)}
                />
                <div style={hint}>※ 最大 {MAX_UPLOAD_MB}MB</div>
              </div>
            </div>

            {/* viewing */}
            {type === "viewing" && (
              <div style={{ marginTop: 12 }}>
                <div style={label}>内見日時（必須）</div>
                <input style={inp} type="datetime-local" value={form.visit_datetime} onChange={(e) => setForm({ ...form, visit_datetime: e.target.value })} />
              </div>
            )}

            {/* purchase */}
            {type === "purchase" && (
              <div style={{ marginTop: 12 }}>
                <div style={label}>購入資料（必須：PDF/JPG/PNG）</div>
                <input
                  style={inp}
                  type="file"
                  accept="application/pdf,image/jpeg,image/png"
                  onChange={(e) => setPurchaseFile(e.target.files?.[0] || null)}
                />
                <div style={hint}>※ 最大 {MAX_UPLOAD_MB}MB</div>
              </div>
            )}

            {/* other */}
            {type === "other" && (
              <div style={{ marginTop: 12 }}>
                <div style={label}>その他内容</div>
                <textarea
                  style={{ ...inp, minHeight: 120, resize: "vertical" }}
                  value={form.other_text}
                  onChange={(e) => setForm({ ...form, other_text: e.target.value })}
                  placeholder="ご要望・質問など"
                />
              </div>
            )}

            <button onClick={submit} style={button}>
              送信する
            </button>

            {!!msg && <div style={msgStyle}>{msg}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
