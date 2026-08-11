"use client";

import { useState } from "react";

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, company, role }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? "Lỗi không xác định");
      }
      setDone(true);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-md rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-emerald-300">
        ✓ Đã ghi nhận. Hẹn gặp lại khi Atlas AEC v1 sẵn sàng.
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex w-full max-w-md flex-col gap-2 sm:flex-row">
      <input
        type="email"
        required
        placeholder="email@cong-ty.vn"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="flex-1 rounded-md border border-[rgb(var(--inverse-bg))] bg-[rgb(var(--inverse-bg))] px-4 py-2.5 text-sm text-[rgb(var(--inverse-ink))] placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      <input type="hidden" value={name} onChange={(e) => setName(e.target.value)} />
      <input type="hidden" value={company} onChange={(e) => setCompany(e.target.value)} />
      <input type="hidden" value={role} onChange={(e) => setRole(e.target.value)} />
      <button
        type="submit"
        disabled={busy}
        className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-[rgb(var(--inverse-ink))] hover:bg-blue-500 disabled:opacity-50"
      >
        {busy ? "Đang gửi…" : "Đăng ký dùng thử"}
      </button>
      {err && <div className="text-xs text-rose-400">{err}</div>}
    </form>
  );
}
