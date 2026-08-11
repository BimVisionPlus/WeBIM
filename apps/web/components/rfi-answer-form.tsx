"use client";

// RFI answer form. Visible only when state ∈ {OPEN, ANSWERED}.
// The textarea is named "rfi-answer" so AiRfiPanel can pre-fill it.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@atlas/ui";

export function RfiAnswerForm({
  issueKey,
  initialAnswer,
}: {
  issueKey: string;
  initialAnswer: string;
}) {
  const router = useRouter();
  const [answer, setAnswer] = useState(initialAnswer);
  const [scheduleImpactDays, setScheduleImpactDays] = useState<string>("");
  const [costImpactVnd, setCostImpactVnd] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!answer.trim()) return;
    setBusy(true);
    setErr(null);
    const r = await fetch("/api/rfi/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        issueKey,
        answer,
        scheduleImpactDays: scheduleImpactDays ? parseInt(scheduleImpactDays, 10) : undefined,
        costImpactVnd: costImpactVnd || undefined,
      }),
    });
    setBusy(false);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setErr(typeof j.error === "string" ? j.error : "Không lưu được câu trả lời");
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <textarea
        name="rfi-answer"
        rows={5}
        required
        placeholder="Soạn câu trả lời RFI (có thể nhận nháp từ AI ở khung trên)…"
        className="w-full rounded-md border border-[rgb(var(--line-2))] px-3 py-2 text-sm"
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
      />
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="block text-xs font-medium text-[rgb(var(--ink-2))]">Δ Tiến độ (ngày)</span>
          <input
            type="number"
            min={0}
            className="mt-1 w-full rounded-md border border-[rgb(var(--line-2))] px-3 py-2 text-sm"
            value={scheduleImpactDays}
            onChange={(e) => setScheduleImpactDays(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-[rgb(var(--ink-2))]">Δ Chi phí (VND)</span>
          <input
            type="number"
            min={0}
            className="mt-1 w-full rounded-md border border-[rgb(var(--line-2))] px-3 py-2 text-sm"
            value={costImpactVnd}
            onChange={(e) => setCostImpactVnd(e.target.value)}
          />
        </label>
      </div>
      {err && <div className="rounded bg-rose-50 px-3 py-2 text-xs text-rose-700">{err}</div>}
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={busy || !answer.trim()}>
          {busy ? "Đang lưu…" : "Lưu & chuyển ANSWERED"}
        </Button>
      </div>
    </form>
  );
}
