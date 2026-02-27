"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode.react";

type Status = "available" | "pending" | "sold" | "rented";
const statusLabelMap: Record<Status, string> = {
  available: "募集中",
  pending: "申込有り",
  sold: "成約",
  rented: "賃貸中",
};

const inquiryTypeLabelMap: Record<string, string> = {
  viewing: "内見予約",
  purchase: "購入相談",
  other: "その他",
};

type Property = {
  id: string;
  property_code: string;
  building_name: string;
  address: string;
  view_method: string;
  status: Status;
  manager_name?: string | null;
  manager_email?: string | null;
  form_url?: string | null;
  created_at?: string;
};

type InquiryHistory = {
  id: string;
  inquiry_type: string;
  company_name: string;
  person_name: string;
  person_mobile: string;
  person_gmail: string;
  visit_datetime?: string | null;
  created_at?: string | null;
};

function buildInquiryUrl(propertyId: string, savedFormUrl?: string | null) {
  if (typeof window === "undefined") return savedFormUrl ?? "";

  const origin = window.location.origin.replace(/\/+$/, "");

  if (!savedFormUrl) {
    return `${origin}/inquiry?property_id=${propertyId}&via=qrcode`;
  }

  try {
    const parsed = new URL(savedFormUrl, origin);
    const via = parsed.searchParams.get("via") || "qrcode";
    return `${origin}/inquiry?property_id=${propertyId}&via=${encodeURIComponent(via)}`;
  } catch {
    return `${origin}/inquiry?property_id=${propertyId}&via=qrcode`;
  }
}

function nextPropertyCode(properties: Property[]) {
  const maxNumber = properties.reduce((max, item) => {
    const matched = (item.property_code || "").match(/(\d+)/g);
    if (!matched?.length) return max;
    const value = Number(matched[matched.length - 1]);
    if (Number.isNaN(value)) return max;
    return Math.max(max, value);
  }, 0);

  return `P${String(maxNumber + 1).padStart(4, "0")}`;
}

function toDisplayCode(propertyCode: string, fallbackIndex: number) {
  const matched = (propertyCode || "").match(/(\d+)/g);
  if (!matched?.length) return `C${String(fallbackIndex + 1).padStart(3, "0")}`;

  const value = Number(matched[matched.length - 1]);
  if (Number.isNaN(value)) return `C${String(fallbackIndex + 1).padStart(3, "0")}`;
  return `C${String(value).padStart(3, "0")}`;
}

function formatDate(raw?: string | null) {
  if (!raw) return "-";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export default function AdminPage() {
  const [props, setProps] = useState<Property[]>([]);
  const [msg, setMsg] = useState<string>("");
  const [created, setCreated] = useState<{ formUrl: string; id: string } | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [expandedPropertyId, setExpandedPropertyId] = useState<string | null>(null);
  const [historyLoadingId, setHistoryLoadingId] = useState<string>("");
  const [historyMap, setHistoryMap] = useState<Record<string, InquiryHistory[]>>({});

  const selectedCount = selectedIds.length;

  const [form, setForm] = useState({
    building_name: "",
    address: "",
    view_method: "",
    status: "available" as Status,
    manager_name: "",
    manager_email: "",
  });

  async function load() {
    try {
      const r = await fetch("/api/admin/properties", { cache: "no-store" });
      const j = await r.json();
      if (!j.ok) return setMsg("❌ " + j.error);
      const nextProps = j.properties as Property[];
      setProps(nextProps);
      setSelectedIds((prev) => prev.filter((id) => nextProps.some((item) => item.id === id)));
      setMsg(`✅ loaded ${j.properties.length} properties`);
    } catch (e: any) {
      setMsg("❌ " + (e?.message ?? String(e)));
    }
  }

  useEffect(() => {
    load();
  }, []);

  const generatedPropertyCode = useMemo(() => nextPropertyCode(props), [props]);

  async function create() {
    setMsg("...");
    setCreated(null);

    const r = await fetch("/api/admin/property", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, property_code: generatedPropertyCode }),
    });

    const j = await r.json();
    if (!j.ok) return setMsg("❌ " + j.error);

    setCreated({ formUrl: j.formUrl, id: j.property.id });
    setMsg("✅ created " + j.property.property_code);
    await load();
  }

  async function updateStatus(id: string, status: Status) {
    const r = await fetch("/api/admin/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ property_id: id, status }),
    });
    const j = await r.json();
    if (!j.ok) return alert(j.error);
    await load();
  }

  function toggleOne(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((x) => x !== id);
    });
  }

  function toggleAll(checked: boolean) {
    if (checked) {
      setSelectedIds(props.map((p) => p.id));
      return;
    }
    setSelectedIds([]);
  }

  async function deleteSelected() {
    if (selectedIds.length === 0) return;
    const ok = window.confirm(
      `選択した ${selectedIds.length} 件の物件データを削除します。関連する問い合わせデータも削除されます。よろしいですか？`
    );
    if (!ok) return;

    setMsg("...");
    const r = await fetch("/api/admin/properties", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ property_ids: selectedIds }),
    });

    const j = await r.json();
    if (!j.ok) return setMsg("❌ " + j.error);

    setMsg(`✅ deleted ${j.deleted?.properties ?? selectedIds.length} properties / ${j.deleted?.inquiries ?? 0} inquiries`);
    setSelectedIds([]);
    await load();
  }

  async function toggleHistory(propertyId: string) {
    if (expandedPropertyId === propertyId) {
      setExpandedPropertyId(null);
      return;
    }

    setExpandedPropertyId(propertyId);
    if (historyMap[propertyId]) return;

    try {
      setHistoryLoadingId(propertyId);
      const r = await fetch(`/api/admin/inquiries?property_id=${propertyId}`, { cache: "no-store" });
      const j = await r.json();
      if (!j.ok) {
        setMsg("❌ " + j.error);
        return;
      }
      setHistoryMap((prev) => ({ ...prev, [propertyId]: j.inquiries as InquiryHistory[] }));
    } catch (e: any) {
      setMsg("❌ " + (e?.message ?? String(e)));
    } finally {
      setHistoryLoadingId("");
    }
  }

  const card: React.CSSProperties = {
    background: "#fff",
    border: "1px solid #eee",
    borderRadius: 14,
    padding: 16,
    marginTop: 12,
  };

  const inp: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #ddd",
    boxSizing: "border-box",
  };

  const th: React.CSSProperties = {
    textAlign: "left",
    padding: "10px 8px",
    borderBottom: "1px solid #eee",
    whiteSpace: "nowrap",
    fontWeight: 800,
  };

  const td: React.CSSProperties = {
    padding: "10px 8px",
    borderBottom: "1px solid #f1f1f1",
    verticalAlign: "middle",
    whiteSpace: "nowrap",
  };

  const allSelected = props.length > 0 && selectedIds.length === props.length;
  const createdOpenUrl = created ? buildInquiryUrl(created.id, created.formUrl) : "";

  return (
    <div style={{ maxWidth: 1100, margin: "20px auto", padding: 14, fontFamily: "system-ui" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0 }}>Admin - 物件管理</h2>
      </div>

      <div style={card}>
        <h3 style={{ marginTop: 0 }}>物件登録 + QR</h3>

        <div style={{ marginBottom: 12, fontWeight: 700, color: "#334155" }}>
          次のコード: {generatedPropertyCode}（自動採番）
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <input
            style={inp}
            placeholder="建物名 (building_name) *"
            value={form.building_name}
            onChange={(e) => setForm({ ...form, building_name: e.target.value })}
          />
          <input
            style={inp}
            placeholder="住所 (address) *"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
          <input
            style={inp}
            placeholder="内見方法 (view_method) *"
            value={form.view_method}
            onChange={(e) => setForm({ ...form, view_method: e.target.value })}
          />

          <select style={inp} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Status })}>
            <option value="available">{statusLabelMap.available} (available)</option>
            <option value="pending">{statusLabelMap.pending} (pending)</option>
            <option value="sold">{statusLabelMap.sold} (sold)</option>
            <option value="rented">{statusLabelMap.rented} (rented)</option>
          </select>

          <input
            style={inp}
            placeholder="担当者名 (manager_name)"
            value={form.manager_name}
            onChange={(e) => setForm({ ...form, manager_name: e.target.value })}
          />

          <input
            style={inp}
            placeholder="担当者メール (manager_email) *"
            value={form.manager_email}
            onChange={(e) => setForm({ ...form, manager_email: e.target.value })}
          />
        </div>

        <button
          onClick={create}
          style={{
            marginTop: 12,
            padding: "10px 14px",
            borderRadius: 12,
            border: 0,
            background: "#111",
            color: "#fff",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          Create + QR
        </button>

        {created && (
          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "center" }}>
            <div>
              <div>
                <b>Form URL</b>
              </div>
              <div style={{ fontSize: 13, wordBreak: "break-all" }}>
                <a href={createdOpenUrl || created.formUrl} target="_blank" rel="noreferrer">
                  {createdOpenUrl || created.formUrl}
                </a>
              </div>
            </div>

            <div style={{ background: "#fafafa", border: "1px solid #eee", borderRadius: 12, padding: 10 }}>
              <a href={createdOpenUrl || created.formUrl} target="_blank" rel="noreferrer" title="Open form">
                <QRCode value={createdOpenUrl || created.formUrl} size={160} />
              </a>
            </div>
          </div>
        )}

        <div style={{ marginTop: 10, fontWeight: 700 }}>{msg}</div>
      </div>

      <div style={card}>
        <h3 style={{ marginTop: 0 }}>物件一覧（ステータス変更）</h3>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={load}
            style={{
              padding: "8px 12px",
              borderRadius: 12,
              border: "1px solid #ddd",
              background: "#f5f5f5",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Reload
          </button>

          <button
            onClick={deleteSelected}
            disabled={selectedCount === 0}
            style={{
              padding: "8px 12px",
              borderRadius: 12,
              border: "1px solid #ef4444",
              background: selectedCount === 0 ? "#fee2e2" : "#ef4444",
              color: selectedCount === 0 ? "#991b1b" : "#fff",
              cursor: selectedCount === 0 ? "not-allowed" : "pointer",
              fontWeight: 700,
              opacity: selectedCount === 0 ? 0.6 : 1,
            }}
          >
            選択した項目を削除 ({selectedCount})
          </button>
        </div>

        <div style={{ overflow: "auto", marginTop: 10 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>
                  <input type="checkbox" checked={allSelected} onChange={(e) => toggleAll(e.target.checked)} aria-label="select all" />
                </th>
                <th style={th}>コード</th>
                <th style={th}>建物</th>
                <th style={th}>住所</th>
                <th style={th}>内見方法</th>
                <th style={th}>ステータス</th>
                <th style={th}>担当者メール</th>
                <th style={th}>担当者</th>
                <th style={th}>QR</th>
                <th style={th}>Link</th>
              </tr>
            </thead>

            <tbody>
              {props.map((p, index) => {
                const inquiryUrl = buildInquiryUrl(p.id, p.form_url);
                const serialCode = toDisplayCode(p.property_code, index);
                const isExpanded = expandedPropertyId === p.id;
                const history = historyMap[p.id] ?? [];

                return (
                  <Fragment key={p.id}>
                    <tr>
                      <td style={td}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(p.id)}
                          onChange={(e) => toggleOne(p.id, e.target.checked)}
                          aria-label={`select-${p.property_code}`}
                        />
                      </td>
                      <td style={td}>
                        <button
                          onClick={() => toggleHistory(p.id)}
                          style={{
                            border: "none",
                            background: "transparent",
                            color: "#2563eb",
                            cursor: "pointer",
                            fontWeight: 700,
                            textDecoration: "underline",
                            padding: 0,
                          }}
                        >
                          {serialCode}
                        </button>
                      </td>
                      <td style={td}>{p.building_name}</td>
                      <td style={td}>{p.address}</td>
                      <td style={td}>{p.view_method ?? "-"}</td>

                      <td style={td}>
                        <select value={p.status} onChange={(e) => updateStatus(p.id, e.target.value as Status)}>
                          <option value="available">{statusLabelMap.available} (available)</option>
                          <option value="pending">{statusLabelMap.pending} (pending)</option>
                          <option value="rented">{statusLabelMap.rented} (rented)</option>
                          <option value="sold">{statusLabelMap.sold} (sold)</option>
                        </select>
                      </td>

                      <td style={td}>{p.manager_email ?? "-"}</td>
                      <td style={td}>{p.manager_name ?? "担当不明"}</td>

                      <td style={td}>
                        {inquiryUrl ? (
                          <a href={inquiryUrl} target="_blank" rel="noreferrer" title="Open form">
                            <div
                              style={{
                                background: "#fafafa",
                                border: "1px solid #eee",
                                borderRadius: 10,
                                padding: 6,
                                display: "inline-block",
                              }}
                            >
                              <QRCode value={inquiryUrl} size={80} />
                            </div>
                          </a>
                        ) : (
                          "-"
                        )}
                      </td>

                      <td style={td}>
                        {inquiryUrl ? (
                          <a href={inquiryUrl} target="_blank" rel="noreferrer">
                            Open form
                          </a>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr>
                        <td colSpan={10} style={{ ...td, whiteSpace: "normal", background: "#f8fafc" }}>
                          <div style={{ fontWeight: 700, marginBottom: 8 }}>顧客登録履歴 ({serialCode})</div>
                          {historyLoadingId === p.id ? (
                            <div>Loading...</div>
                          ) : history.length === 0 ? (
                            <div>まだ問い合わせ履歴がありません。</div>
                          ) : (
                            <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff" }}>
                              <thead>
                                <tr>
                                  <th style={th}>受付日時</th>
                                  <th style={th}>種別</th>
                                  <th style={th}>会社名</th>
                                  <th style={th}>氏名</th>
                                  <th style={th}>携帯</th>
                                  <th style={th}>メール</th>
                                  <th style={th}>内見日時</th>
                                </tr>
                              </thead>
                              <tbody>
                                {history.map((h) => (
                                  <tr key={h.id}>
                                    <td style={td}>{formatDate(h.created_at)}</td>
                                    <td style={td}>{inquiryTypeLabelMap[h.inquiry_type] ?? h.inquiry_type}</td>
                                    <td style={td}>{h.company_name || "-"}</td>
                                    <td style={td}>{h.person_name || "-"}</td>
                                    <td style={td}>{h.person_mobile || "-"}</td>
                                    <td style={td}>{h.person_gmail || "-"}</td>
                                    <td style={td}>{formatDate(h.visit_datetime)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}

              {props.length === 0 && (
                <tr>
                  <td style={td} colSpan={10}>
                    (no data)
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
