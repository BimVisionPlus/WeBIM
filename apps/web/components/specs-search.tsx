"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Badge } from "@atlas/ui";

type Hit = { id: string; title: string; snippet: string; score: number };

export function SpecsSearch({ projectId }: { projectId: string }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ corpusSize: number; latencyMs: number; model: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim().length < 2) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/ai/spec/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, query: q, topK: 5 }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) {
        setErr(j.message || j.reason || j.error || "Không tìm được");
        setHits([]);
        return;
      }
      setHits(j.hits);
      setMeta({ corpusSize: j.corpusSize, latencyMs: j.latencyMs, model: j.model });
    } catch (e: any) {
      setErr(e?.message ?? "Lỗi mạng");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <form onSubmit={submit} className="flex gap-2">
        <input
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder='VD: "biện pháp thi công cốt thép tầng cao", "QCVN PCCC hành lang"…'
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Button type="submit" disabled={busy || q.trim().length < 2}>
          {busy ? "Đang tìm…" : "Tìm"}
        </Button>
      </form>

      {err && <div className="rounded bg-rose-50 px-3 py-2 text-xs text-rose-700">{err}</div>}

      {hits && hits.length === 0 && !err && (
        <p className="text-xs text-slate-500">Không có kết quả phù hợp.</p>
      )}

      {hits && hits.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] text-slate-500">
            {hits.length} kết quả trong {meta?.corpusSize ?? "?"} trang · {meta?.latencyMs ?? 0}ms · {meta?.model}
          </div>
          {hits.map((h) => (
            <Link
              key={h.id}
              href={`./specs/${h.id}`}
              className="block rounded border border-slate-200 px-3 py-2 hover:bg-slate-50"
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-slate-800">{h.title}</div>
                <Badge variant={h.score > 0.7 ? "success" : h.score > 0.5 ? "info" : "neutral"}>
                  {(h.score * 100).toFixed(0)}%
                </Badge>
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-slate-600">{h.snippet}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
