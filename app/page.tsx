export default function Home() {
  return (
    <main style={{ maxWidth: 900, margin: "24px auto", padding: 14 }}>
      <div style={{ background: "#fff", border: "1px solid #eee", borderRadius: 14, padding: 16 }}>
        <h2 style={{ marginTop: 0 }}>Property Inquiry</h2>
        <p>Admin: <a href="/admin">/admin</a></p>
        <p>Customer: <code>/inquiry?property_id=...&via=qrcode</code></p>
      </div>
    </main>
  );
}
