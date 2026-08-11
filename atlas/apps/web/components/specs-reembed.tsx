"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@atlas/ui";

export function SpecsReembedButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setResult(null);
    const r = await fetch("/api/ai/spec/reembed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId }),
    });
    const j = await r.json();
    setBusy(false);
    if (!r.ok || !j.ok) {
      setResult(`Lỗi: ${j.reason ?? j.error ?? "không xác định"}`);
      return;
    }
    setResult(`${j.embedded} embed mới · ${j.skipped} bỏ qua · ${j.failed} lỗi (model ${j.model})`);
    router.refresh();
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={run} disabled={busy}>
        {busy ? "Đang embed…" : "Re-embed tất cả"}
      </Button>
      {result && <span className="ml-2 text-[10px] text-[rgb(var(--muted))]">{result}</span>}
    </>
  );
}
