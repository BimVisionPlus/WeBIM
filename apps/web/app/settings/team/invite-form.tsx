"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@atlas/ui";

type FormMsg =
  | { kind: "ok"; text: string }
  | { kind: "warn"; text: string; link: string }
  | { kind: "err"; text: string };

export function InviteForm({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("ENGINEER");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<FormMsg | null>(null);
  const [copied, setCopied] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setCopied(false);
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
    const j = await r.json().catch(() => ({} as any));
    if (j.emailDelivered) {
      setMsg({ kind: "ok", text: `Đã gửi email mời tới ${email}` });
    } else if (j.link) {
      // Invite created, but email transport unavailable. Surface the link so
      // the user can copy + share it directly (Zalo, Telegram, in-person).
      setMsg({
        kind: "warn",
        text: `Đã tạo lời mời cho ${email} nhưng email chưa cấu hình. Sao chép link mời bên dưới và gửi trực tiếp.`,
        link: j.link,
      });
    } else {
      setMsg({ kind: "ok", text: `Đã gửi lời mời tới ${email}` });
    }
    setEmail("");
    router.refresh();
  }

  async function copyLink(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Sao chép link mời:", link);
    }
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
      {msg && msg.kind === "ok" && (
        <div className="basis-full text-xs text-emerald-700">{msg.text}</div>
      )}
      {msg && msg.kind === "err" && (
        <div className="basis-full text-xs text-rose-700">{msg.text}</div>
      )}
      {msg && msg.kind === "warn" && (
        <div className="basis-full rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
          <div className="font-medium">{msg.text}</div>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={msg.link}
              onFocus={(e) => e.currentTarget.select()}
              className="flex-1 rounded border border-amber-300 bg-white px-2 py-1 font-mono text-[11px]"
            />
            <button
              type="button"
              onClick={() => copyLink(msg.link)}
              className="rounded bg-amber-700 px-2 py-1 text-[11px] font-medium text-white hover:bg-amber-800"
            >
              {copied ? "Đã sao chép ✓" : "Sao chép"}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
