"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@atlas/ui";

export function SpecCreateForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const slug = title
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !body || !slug) return;
    setBusy(true);
    setErr(null);
    const r = await fetch("/api/specs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, slug, title, body }),
    });
    setBusy(false);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setErr(typeof j.error === "string" ? j.error : JSON.stringify(j.error ?? j));
      return;
    }
    setTitle("");
    setBody("");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block">
        <span className="block text-xs font-medium text-slate-700">Tiêu đề</span>
        <input
          required
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="Biện pháp thi công cọc nhồi"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        {slug && <p className="mt-1 font-mono text-[10px] text-slate-500">/{slug}</p>}
      </label>
      <label className="block">
        <span className="block text-xs font-medium text-slate-700">Nội dung (markdown)</span>
        <textarea
          required
          rows={8}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs"
          placeholder={"## Phạm vi\n...\n\n## Quy trình\n1. ...\n\n## Tham chiếu\n- QCVN ...\n- TCVN ..."}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </label>
      {err && <div className="rounded bg-rose-50 px-3 py-2 text-xs text-rose-700">{err}</div>}
      <Button type="submit" size="sm" className="w-full" disabled={busy || !title || !body}>
        {busy ? "Đang lưu…" : "Lưu & embed"}
      </Button>
      <p className="text-[10px] text-slate-500">
        Sau khi lưu, AI tự sinh embedding (bge-m3) trong nền — có thể tìm kiếm ngay.
      </p>
    </form>
  );
}
