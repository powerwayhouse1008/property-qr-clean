"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode.react";

type Status = "available" | "sold" | "rented";

type Property = {
  id: string;
  property_code: string;
  building_name: string;
  address: string;
  view_method: string;
  status: Status;

  manager_name?: string | null;
  manager_email?: string | null;

  form_url?: string | null; // ✅ dùng form_url để render QR + Link
  created_at?: string;
};

export default function AdminPage() {
  const [props, setProps] = useState<Property[]>([]);
  const [msg, setMsg] = useState<string>("");
  const [created, setCreated] = useState<{ formUrl: string; code: string } | null>(null);

  const [form, setForm] = useState({
    property_code: "",
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
      setProps(j.properties as Property[]);
      setMsg(`✅ loaded ${j.properties.length} properties`);
    } catch (e: any) {
      setMsg("❌ " + (e?.message ?? String(e)));
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    setMsg("...");
    setCreated(null);

    const r = await fetch("/api/admin/property", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const j = await r.json();
    if (!j.ok) return setMsg("❌ " + j.error);

    setCreated({ formUrl: j.formUrl, code: j.property.property_code });
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

  return (
    <div style={{ maxWidth: 1100, margin: "20px auto", padding: 14, fontFamily: "system-ui" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0 }}>Admin - 物件管理</h2>
      </div>

      {/* Create */}
      <div style={card}>
        <h3 style={{ marginTop: 0 }}>物件登録 + QR</h3>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <input
            style={inp}
            placeholder="物件コード (property_code) *"
            value={form.property_code}
            onChange={(e) => setForm({ ...form, property_code: e.target.value })}
          />
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

          <select
            style={inp}
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as Status })}
          >
            <option value="available">募集中 (available)</option>
            <option value="sold">成約 (sold)</option>
            <option value="rented">賃貸中 (rented)</option>
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
                <a href={created.formUrl} target="_blank" rel="noreferrer">
                  {created.formUrl}
                </a>
              </div>
            </div>

            <div style={{ background: "#fafafa", border: "1px solid #eee", borderRadius: 12, padding: 10 }}>
              <a href={created.formUrl} target="_blank" rel="noreferrer" title="Open form">
                <QRCode value={created.formUrl} size={160} />
              </a>
            </div>
          </div>
        )}

        <div style={{ marginTop: 10, fontWeight: 700 }}>{msg}</div>
      </div>

      {/* List */}
      <div style={card}>
        <h3 style={{ marginTop: 0 }}>物件一覧（ステータス変更）</h3>

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

        <div style={{ overflow: "auto", marginTop: 10 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>コード</th>
                <th style={th}>建物</th>
                <th style={th}>住所</th>
                <th style={th}>内見方法</th>
                <th style={th}>Status</th>
                <th style={th}>担当者メール</th>
                <th style={th}>担当者</th>
                <th style={th}>QR</th>
                <th style={th}>Link</th>
              </tr>
            </thead>

            <tbody>
              {props.map((p) => (
                <tr key={p.id}>
                  <td style={td}>{p.property_code}</td>
                  <td style={td}>{p.building_name}</td>
                  <td style={td}>{p.address}</td>
                  <td style={td}>{p.view_method ?? "-"}</td>

                  <td style={td}>
                    <select value={p.status} onChange={(e) => updateStatus(p.id, e.target.value as Status)}>
                      <option value="available">available</option>
                      <option value="rented">rented</option>
                      <option value="sold">sold</option>
                    </select>
                  </td>

                  <td style={td}>{p.manager_email ?? "-"}</td>
                  <td style={td}>{p.manager_name ?? "担当者不明"}</td>

                  {/* ✅ QR đúng cột QR */}
                  <td style={td}>
                    {p.form_url ? (
                      <a href={p.form_url} target="_blank" rel="noreferrer" title="Open form">
                        <div
                          style={{
                            background: "#fafafa",
                            border: "1px solid #eee",
                            borderRadius: 10,
                            padding: 6,
                            display: "inline-block",
                          }}
                        >
                          <QRCode value={p.form_url} size={80} />
                        </div>
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>

                  {/* ✅ Link đúng cột Link */}
                  <td style={td}>
                    {p.form_url ? (
                      <a href={p.form_url} target="_blank" rel="noreferrer">
                        Open form
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              ))}

              {props.length === 0 && (
                <tr>
                  <td style={td} colSpan={9}>
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
