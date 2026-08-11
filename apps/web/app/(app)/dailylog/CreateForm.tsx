"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type ProjectOpt = { id: string; key: string };
const today = () => new Date().toISOString().slice(0, 10);

export function CreateForm({ projects }: { projects: ProjectOpt[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({ projectId: projects[0]?.id ?? "", date: today(), shift: "DAY", weather: "", workDone: "", workTomorrow: "", safetyNotes: "" });
  const [rec, setRec] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function startRec() {
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      mr.ondataavailable = (e) => chunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setTranscribing(true);
        const fd = new FormData(); fd.append("file", blob, "recording.webm");
        const res = await fetch("/api/ai/transcribe", { method: "POST", body: fd });
        setTranscribing(false);
        if (!res.ok) { setErr("Không transcribe được — thử lại"); return; }
        const j = await res.json();
        if (j.ok && j.text) {
          setF((s) => ({ ...s, workDone: s.workDone ? `${s.workDone}\n${j.text}` : j.text }));
        } else {
          setErr("AI không nhận diện được tiếng nói");
        }
      };
      mr.start();
      recorderRef.current = mr;
      setRec(true);
    } catch (e) {
      setErr("Không truy cập được mic — kiểm tra quyền trình duyệt");
    }
  }
  function stopRec() {
    recorderRef.current?.stop();
    setRec(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    const payload = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== ""));
    const res = await fetch("/api/daily-log", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(typeof j.error === "string" ? j.error : "Lỗi"); return; }
    setOpen(false); setF({ ...f, workDone: "", workTomorrow: "", safetyNotes: "" }); router.refresh();
  }

  if (!open) return <button onClick={() => setOpen(true)} className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-[rgb(var(--inverse-ink))]" data-testid="open-create-form">+ Ghi nhật ký hôm nay</button>;

  return (
    <form onSubmit={submit} className="rounded-lg border border-blue-200 bg-blue-50/50 p-4" data-testid="dailylog-create-form">
      <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">Nhật ký thi công mới</h3>
        <div className="flex items-center gap-3">
          {!rec ? (
            <button type="button" onClick={startRec} disabled={transcribing} className="rounded-full border border-rose-300 bg-rose-50 px-2.5 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50" data-testid="voice-start" title="Đọc nhật ký, AI sẽ ghi lại vào ô Công việc hôm nay">
              {transcribing ? "AI đang nghe…" : "🎤 Đọc nhật ký"}
            </button>
          ) : (
            <button type="button" onClick={stopRec} className="rounded-full border border-rose-600 bg-rose-600 px-2.5 py-1 text-[11px] font-medium text-[rgb(var(--inverse-ink))] animate-pulse" data-testid="voice-stop">
              ⏹ Dừng & gửi
            </button>
          )}
          <button type="button" onClick={() => setOpen(false)} className="text-xs">Hủy</button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Dự án</span><select required value={f.projectId} onChange={(e) => setF({ ...f, projectId: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" name="projectId">{projects.map((p) => <option key={p.id} value={p.id}>{p.key}</option>)}</select></label>
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Ngày</span><input required type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" name="date" /></label>
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Ca</span><select value={f.shift} onChange={(e) => setF({ ...f, shift: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" name="shift"><option value="DAY">Ngày</option><option value="NIGHT">Đêm</option></select></label>
        <label className="text-xs md:col-span-3"><span className="block text-[rgb(var(--muted))]">Thời tiết</span><input value={f.weather} onChange={(e) => setF({ ...f, weather: e.target.value })} placeholder="Nắng, 32°C" className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" name="weather" /></label>
        <label className="text-xs md:col-span-3"><span className="block text-[rgb(var(--muted))]">Công việc hôm nay</span><textarea required value={f.workDone} onChange={(e) => setF({ ...f, workDone: e.target.value })} rows={2} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" name="workDone" /></label>
        <label className="text-xs md:col-span-3"><span className="block text-[rgb(var(--muted))]">Kế hoạch ngày mai</span><textarea value={f.workTomorrow} onChange={(e) => setF({ ...f, workTomorrow: e.target.value })} rows={2} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" name="workTomorrow" /></label>
        <label className="text-xs md:col-span-3"><span className="block text-[rgb(var(--muted))]">Ghi chú ATLĐ</span><textarea value={f.safetyNotes} onChange={(e) => setF({ ...f, safetyNotes: e.target.value })} rows={2} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" name="safetyNotes" /></label>
      </div>
      {err && <div className="mt-3 rounded border border-rose-300 bg-rose-50 p-2 text-xs text-rose-800" data-testid="create-error">{err}</div>}
      <div className="mt-3 flex justify-end"><button type="submit" disabled={busy} className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-[rgb(var(--inverse-ink))] disabled:opacity-50" data-testid="submit-create">{busy ? "…" : "Lưu nhật ký"}</button></div>
    </form>
  );
}
