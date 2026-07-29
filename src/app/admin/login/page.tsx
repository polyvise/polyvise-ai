import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import type { Route } from "next";
import { AdminLogin } from "@/components/admin-login";
import { adminEnabled, isAdmin } from "@/server/admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin | Polyvise",
  robots: { index: false, follow: false }
};

export default async function AdminLoginPage() {
  if (!adminEnabled()) {
    notFound();
  }
  if (await isAdmin()) {
    redirect("/admin/runs" as Route);
  }

  return (
    <section className="page narrow">
      <span className="eyebrow">Admin</span>
      <h2 className="display d2 mt10">Sign in</h2>
      <p className="lede mt10 mw640">The admin view lists every visitor&apos;s run, so it sits behind a token.</p>
      <AdminLogin />
    </section>
  );
}
