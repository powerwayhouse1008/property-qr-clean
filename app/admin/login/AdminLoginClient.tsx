"use client";

import { useState } from "react";

export default function AdminLoginClient({ nextUrl }: { nextUrl: string }) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [msg, setMsg] = useState("");

  async function onLogin() {
    setMsg("");
    const r = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ user, pass }),
    });

    const j = await r.json();
    if (!j.ok) return setMsg("❌ " + j.error);

    // reload thật để middleware đọc cookie mới
    window.location.href = nextUrl || "/admin";
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "linear-gradient(135deg, #f6f7fb, #eef2ff)",
        padding: 16,
        fontFamily: "system-ui",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#fff",
          border: "1px solid #eee",
          borderRadius: 18,
          padding: 22,
          boxShadow: "0 12px 30px rgba(0,0,0,0.08)",
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 6 }}>
          Admin Login
        </div>
        <div style={{ color: "#666", fontSize: 13, marginBottom: 14 }}>
          物件管理にログインしてください
        </div>

        <label style={{ fontSize: 12, fontWeight: 700 }}>User</label>
        <input
          value={user}
          onChange={(e) => setUser(e.target.value)}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid #ddd",
            marginTop: 6,
            marginBottom: 12,
          }}
          placeholder="admin user"
        />

        <label style={{ fontSize: 12, fontWeight: 700 }}>Password</label>
        <input
          type="password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid #ddd",
            marginTop: 6,
            marginBottom: 14,
          }}
          placeholder="********"
          onKeyDown={(e) => e.key === "Enter" && onLogin()}
        />

        <button
          onClick={onLogin}
          style={{
            width: "100%",
            padding: "11px 14px",
            borderRadius: 12,
            border: 0,
            background: "#111",
            color: "#fff",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          Sign in
        </button>

        {msg && <div style={{ marginTop: 12, fontWeight: 800 }}>{msg}</div>}
      </div>
    </div>
  );
}
