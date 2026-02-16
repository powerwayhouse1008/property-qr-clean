// app/admin/login/page.tsx
import AdminLoginClient from "./AdminLoginClient";

export default function AdminLoginPage({
  searchParams,
}: {
  searchParams?: { next?: string };
}) {
  const next = searchParams?.next || "/admin";
  return <AdminLoginClient nextUrl={next} />;
}
