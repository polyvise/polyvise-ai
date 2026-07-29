"use client";

import { useRouter } from "next/navigation";
import type { Route } from "next";
import { FormEvent, useState } from "react";

export function AdminLogin() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token })
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "That token was not accepted.");
      }
      setToken("");
      router.replace("/admin/runs" as Route);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That token was not accepted.");
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card card-pad mt24" style={{ maxWidth: 420 }}>
      <label htmlFor="admin-token" className="card-title">
        Admin token
      </label>
      <p className="meta mt6">Set as POLYVISE_ADMIN_TOKEN in the deployment environment.</p>
      <input
        id="admin-token"
        type="password"
        autoComplete="current-password"
        className="select mt10"
        style={{ fontFamily: "var(--ui)", fontSize: "12.5px", padding: "8px 10px" }}
        value={token}
        onChange={(event) => setToken(event.target.value)}
      />
      <button type="submit" className="btn btn-primary btn-sm mt14" disabled={!token.trim() || isSubmitting}>
        {isSubmitting ? <span className="spin sm" /> : null}
        Sign in
      </button>
      {error ? <p className="small mt14" style={{ color: "var(--alert)" }}>{error}</p> : null}
    </form>
  );
}
