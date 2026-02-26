"use client";

import { useEffect, useMemo, useState } from "react";

type InquiryType = "viewing" | "purchase" | "other";
const VIEWING_START_HOUR = 8;
const VIEWING_END_HOUR = 20;
const VIEWING_MINUTE_STEP = 30;
const HOUR_OPTIONS = Array.from(
  { length: VIEWING_END_HOUR - VIEWING_START_HOUR + 1 },
  (_, i) => String(VIEWING_START_HOUR + i).padStart(2, "0")
);
const MINUTE_OPTIONS = ["00", "30"] as const;
const statusLabelMap = {
  available: "募集中",
  pending: "申込有り",
  sold: "成約",
  rented: "賃貸中",
} as const;

function statusLabel(status: string | null | undefined) {
  if (!status) return "-";
  return statusLabelMap[status as keyof typeof statusLabelMap] ?? status;
}


function formatDateTimePart(n: string | number) {
  return String(n).padStart(2, "0");
}

function splitVisitDateTime(raw: string) {
  if (!raw || !raw.includes("T")) return { date: "", hour: "", minute: "" };

  const [date, time] = raw.split("T");
  const [hour = "", minute = ""] = time.split(":");
  return { date, hour: formatDateTimePart(hour), minute: formatDateTimePart(minute) };
}

function combineVisitDateTime(date: string, hour: string, minute: string) {
  if (!date || !hour || !minute) return "";
  return `${date}T${hour}:${minute}`;
}

function isValidViewingSlot(raw: string) {
  if (!raw) return false;

  const local = new Date(raw);
  if (Number.isNaN(local.getTime())) return false;

  const hours = local.getHours();
  const minutes = local.getMinutes();
  const isHalfHourSlot = minutes % VIEWING_MINUTE_STEP === 0;
  const isWithinHourRange =
    (hours > VIEWING_START_HOUR && hours < VIEWING_END_HOUR) ||
    (hours === VIEWING_START_HOUR && isHalfHourSlot) ||
    (hours === VIEWING_END_HOUR && minutes === 0);

  return isHalfHourSlot && isWithinHourRange;
}

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
  const [visitDate, setVisitDate] = useState("");
  const [visitHour, setVisitHour] = useState("");
  const [visitMinute, setVisitMinute] = useState("");

  // ✅ responsive an toàn (không dùng window.innerWidth trực tiếp trong render)
  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth < 760);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const parts = splitVisitDateTime(form.visit_datetime);
    setVisitDate(parts.date);
    setVisitHour(parts.hour);
    setVisitMinute(parts.minute);
  }, [form.visit_datetime]);

  useEffect(() => {
      if (!property_id) return;

    let stop = false;

    async function fetchProperty(silent = false) {
      const r = await fetch(`/api/property?property_id=${property_id}`, { cache: "no-store" });
      const j = await r.json();
       if (!j.ok) {
        if (!silent) setMsg("❌ " + formatInquiryError(j.error));
        return;
      }
      if (!stop) setP(j.property);
    }

    fetchProperty();
    const timer = window.setInterval(() => fetchProperty(true), 5000);

    return () => {
      stop = true;
      window.clearInterval(timer);
    };
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

  function onVisitDateChange(date: string) {
    setVisitDate(date);
    setForm((prev) => ({ ...prev, visit_datetime: combineVisitDateTime(date, visitHour, visitMinute) }));
  }

  function onVisitHourChange(hour: string) {
    const normalizedMinute = hour === String(VIEWING_END_HOUR).padStart(2, "0") ? "00" : visitMinute;

    setVisitHour(hour);
    setVisitMinute(normalizedMinute);
    setForm((prev) => ({
      ...prev,
      visit_datetime: combineVisitDateTime(visitDate, hour, normalizedMinute),
    }));
  }

  function onVisitMinuteChange(minute: string) {
    setVisitMinute(minute);
    setForm((prev) => ({ ...prev, visit_datetime: combineVisitDateTime(visitDate, visitHour, minute) }));
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
      if (type === "viewing" && !isValidViewingSlot(form.visit_datetime)) {
        throw new Error("内見時間は08:00〜20:00の30分刻みで選択してください。");
      }
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

    // Khách hàng chỉ cần thấy trạng thái gửi thành công.
      setMsg("✅ 送信完了しました。ありがとうございました。");
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
      setVisitDate("");
      setVisitHour("");
      setVisitMinute("");
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

  const shell: React.CSSProperties = {
    maxWidth: 980,
    margin: "0 auto",
  };

  const glass: React.CSSProperties = {
    background: "rgba(255,255,255,0.72)",
    border: "1px solid rgba(255,255,255,0.65)",
    borderRadius: 22,
    padding: 18,
    boxShadow: "0 18px 60px rgba(15,23,42,0.10)",
    backdropFilter: "blur(10px)",
  };

  
  const headerRow: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  };

  const logo: React.CSSProperties = {
    width: 52,
    height: 52,
    borderRadius: 14,
    boxShadow: "0 12px 30px rgba(59,130,246,0.25)",
    flex: "0 0 auto",
    objectFit: "cover",
    border: "1px solid rgba(148,163,184,0.3)",
    background: "#fff",
  };
  


  const title: React.CSSProperties = {
    fontSize: 24,
    fontWeight: 900,
    margin: 0,
    lineHeight: 1.15,
    color: "#0f172a",
  };

  const subtitle: React.CSSProperties = {
    marginTop: 4,
    fontSize: 13,
    color: "#475569",
    lineHeight: 1.4,
  };

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

  const sectionTitle: React.CSSProperties = {
    fontWeight: 900,
    marginBottom: 10,
    color: "#0f172a",
  };

  const radioWrap: React.CSSProperties = {
    display: "grid",
    gap: 8,
  };

  const radioRow: React.CSSProperties = {
    display: "flex",
    gap: 10,
    alignItems: "center",
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(148,163,184,0.22)",
    background: "rgba(255,255,255,0.70)",
  };

  const grid: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
    marginTop: 14,
  };

  const grid1: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 12,
    marginTop: 12,
  };

  const label: React.CSSProperties = {
    fontWeight: 900,
    color: "#0f172a",
    marginBottom: 6,
    fontSize: 13,
  };

  const inp: React.CSSProperties = {
    width: "100%",
    padding: "11px 12px",
    borderRadius: 14,
    border: "1px solid rgba(148,163,184,0.35)",
    background: "rgba(255,255,255,0.92)",
    boxSizing: "border-box",
    outline: "none",
  };

  const hint: React.CSSProperties = {
    marginTop: 6,
    fontSize: 12,
    color: "#64748b",
  };

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
    color: msg.startsWith("✅")
      ? "#16a34a"
      : msg.startsWith("❌")
        ? "#dc2626"
        : msg.startsWith("⚠️")
          ? "#d97706"
          : "#0f172a",
    whiteSpace: "pre-wrap",
  };


  if (!property_id) {
    return (
      <div style={page}>
        <div style={shell}>
          <div style={glass}>
            <div style={headerRow}>
               <img src="/powerway-house-logo.svg" alt="POWERWAY HOUSE" style={logo} />
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
@@ -393,51 +526,75 @@ export default function InquiryPage() {
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
                <div style={{ display: "grid", gridTemplateColumns: isNarrow ? "1fr" : "1.4fr 1fr 1fr", gap: 8 }}>
                  <input style={inp} type="date" value={visitDate} onChange={(e) => onVisitDateChange(e.target.value)} />
                  <select style={inp} value={visitHour} onChange={(e) => onVisitHourChange(e.target.value)}>
                    <option value="">時</option>
                    {HOUR_OPTIONS.map((hour) => (
                      <option key={hour} value={hour}>
                        {hour}
                      </option>
                    ))}
                  </select>
                  <select
                    style={inp}
                    value={visitMinute}
                    onChange={(e) => onVisitMinuteChange(e.target.value)}
                    disabled={!visitHour}
                  >
                    <option value="">分</option>
                    {MINUTE_OPTIONS.filter((minute) => !(visitHour === String(VIEWING_END_HOUR).padStart(2, "0") && minute !== "00")).map((minute) => (
                      <option key={minute} value={minute}>
                        {minute}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={hint}>※ 08:00〜20:00 / 30分刻みで選択してください</div>
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
