"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@atlas/ui";

type Workforce = { trade: string; count: number };

export function DailyLogForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    shift: "DAY",
    weather: "",
    workDone: "",
    workTomorrow: "",
    safetyNotes: "",
  });
  const [workforce, setWorkforce] = useState<Workforce[]>([]);

  // ─── Voice recording state ──────────────────────────────────────────────
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [recErr, setRecErr] = useState<string | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function startRecording() {
    setRecErr(null);
    if (typeof navigator === "undefined" || !navigator.mediaDevices) {
      setRecErr("Trình duyệt không hỗ trợ ghi âm");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: pickMime() });
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        await uploadAudio(new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" }));
      };
      mr.start();
      recRef.current = mr;
      setRecording(true);
    } catch (e: any) {
      setRecErr(e?.message ?? "Không truy cập được micro");
    }
  }

  function stopRecording() {
    recRef.current?.stop();
    recRef.current = null;
    setRecording(false);
  }

  async function uploadAudio(blob: Blob) {
    setTranscribing(true);
    setRecErr(null);
    try {
      const fd = new FormData();
      fd.append("file", blob, "voice.webm");
      fd.append("structured", "true");
      const r = await fetch("/api/ai/transcribe", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok || !j.ok) {
        setRecErr(`Phiên âm thất bại: ${j.reason ?? j.error ?? "lỗi không xác định"}`);
        return;
      }
      // Apply transcript (always) + structured (if available)
      const s = j.structured;
      if (s) {
        setForm((f) => ({
          ...f,
          weather: s.weather ?? f.weather,
          workDone: s.workDone ?? f.workDone,
          workTomorrow: s.workTomorrow ?? f.workTomorrow,
          safetyNotes: s.safetyNotes ?? f.safetyNotes,
        }));
        if (Array.isArray(s.workforce) && s.workforce.length > 0) setWorkforce(s.workforce);
      } else if (j.text) {
        setForm((f) => ({ ...f, workDone: f.workDone ? `${f.workDone}\n\n${j.text}` : j.text }));
      }
    } catch (e: any) {
      setRecErr(e?.message ?? "Lỗi gửi audio");
    } finally {
      setTranscribing(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const r = await fetch("/api/daily-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, ...form, workforce }),
    });
    setBusy(false);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setErr(typeof j.error === "string" ? j.error : "Không lưu được");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>+ Nhật ký hôm nay</Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
            <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-semibold">Ghi nhật ký công trình</h2>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </header>
            <form onSubmit={submit} className="space-y-3 px-4 py-4">

              {/* Voice → AI autofill */}
              <div className="flex items-center gap-2 rounded-md border border-violet-200 bg-violet-50/50 px-3 py-2">
                <span className="rounded bg-violet-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">AI</span>
                <span className="text-xs text-slate-700">Nói nhanh — AI điền form giúp bạn (whisper + LLM, OSS).</span>
                <div className="ml-auto">
                  {recording ? (
                    <Button type="button" size="sm" variant="danger" onClick={stopRecording}>
                      ⏹ Dừng & gửi
                    </Button>
                  ) : (
                    <Button type="button" size="sm" variant="outline"
                            onClick={startRecording} disabled={transcribing}>
                      {transcribing ? "Đang phiên âm…" : "🎙 Bắt đầu nói"}
                    </Button>
                  )}
                </div>
              </div>
              {recErr && <div className="rounded bg-rose-50 px-3 py-1 text-xs text-rose-700">{recErr}</div>}

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-xs font-medium text-slate-700">Ngày</span>
                  <input
                    type="date"
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="block text-xs font-medium text-slate-700">Ca</span>
                  <select
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    value={form.shift}
                    onChange={(e) => setForm({ ...form, shift: e.target.value })}
                  >
                    <option value="DAY">Ngày</option>
                    <option value="NIGHT">Đêm</option>
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="block text-xs font-medium text-slate-700">Thời tiết</span>
                <input
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Nắng 32°C"
                  value={form.weather}
                  onChange={(e) => setForm({ ...form, weather: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-slate-700">Công việc đã làm</span>
                <textarea
                  required
                  rows={3}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={form.workDone}
                  onChange={(e) => setForm({ ...form, workDone: e.target.value })}
                />
              </label>
              {workforce.length > 0 && (
                <div className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-700">
                  <div className="font-medium text-slate-600">Nhân lực (AI gợi ý):</div>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {workforce.map((w, i) => (
                      <span key={i} className="rounded-full bg-white px-2 py-0.5 ring-1 ring-slate-200">
                        {w.trade}: <strong>{w.count}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <label className="block">
                <span className="block text-xs font-medium text-slate-700">Kế hoạch ngày mai</span>
                <textarea
                  rows={2}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={form.workTomorrow}
                  onChange={(e) => setForm({ ...form, workTomorrow: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-slate-700">Ghi chú ATLĐ</span>
                <textarea
                  rows={2}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={form.safetyNotes}
                  onChange={(e) => setForm({ ...form, safetyNotes: e.target.value })}
                />
              </label>
              {err && <div className="rounded bg-rose-50 px-3 py-2 text-xs text-rose-700">{err}</div>}
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Huỷ</Button>
                <Button type="submit" disabled={busy}>{busy ? "Đang lưu…" : "Lưu nhật ký"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function pickMime(): string {
  if (typeof MediaRecorder === "undefined") return "audio/webm";
  for (const t of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"]) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return "audio/webm";
}
