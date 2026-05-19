"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@atlas/ui";

export function InviteForm({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("ENGINEER");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const r = await fetch("/api/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId, email, role }),
    });
    setBusy(false);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setMsg({ kind: "err", text: j.error ?? "Không mời được" });
      return;
    }
    setMsg({ kind: "ok", text: `Đã gửi lời mời tới ${email}` });
    setEmail("");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <label className="flex-1 min-w-[200px]">
        <span className="block text-xs font-medium text-slate-700">Email</span>
        <input
          type="email"
          required
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label>
        <span className="block text-xs font-medium text-slate-700">Vai trò</span>
        <select
          className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          <option value="ADMIN">ADMIN</option>
          <option value="PROJECT_MGR">Chỉ huy trưởng</option>
          <option value="ENGINEER">Kỹ sư</option>
          <option value="SUPERVISOR">Giám sát</option>
          <option value="FIELD">Hiện trường</option>
          <option value="VIEWER">Chỉ xem</option>
        </select>
      </label>
      <Button type="submit" disabled={busy}>{busy ? "Đang gửi…" : "Mời"}</Button>
      {msg && (
        <div
          className={`basis-full text-xs ${msg.kind === "ok" ? "text-emerald-700" : "text-rose-700"}`}
        >
          {msg.text}
        </div>
      )}
    </form>
  );
}
