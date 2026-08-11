"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@atlas/ui";

export function CommentForm({ issueKey }: { issueKey: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setErr(null);
    const r = await fetch("/api/issues/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ issueKey, body }),
    });
    setBusy(false);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setErr(typeof j.error === "string" ? j.error : "Không gửi được");
      return;
    }
    setBody("");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <textarea
        rows={3}
        placeholder="Viết bình luận…"
        className="w-full rounded-md border border-[rgb(var(--line-2))] px-3 py-2 text-sm"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      {err && <div className="rounded bg-rose-50 px-3 py-2 text-xs text-rose-700">{err}</div>}
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={busy || !body.trim()}>
          {busy ? "Đang gửi…" : "Gửi"}
        </Button>
      </div>
    </form>
  );
}
