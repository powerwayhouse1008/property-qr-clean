import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Property Inquiry",
  description: "Admin + Inquiry with QR, Upload, Email, Teams",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body style={{ margin: 0, background: "#f7f7f7", fontFamily: "system-ui" }}>
        {children}
      </body>
    </html>
  );
}
