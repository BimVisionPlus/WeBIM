"use client";
import { useEffect, useRef, useState } from "react";

type Project = { id: string; key: string; name: string };
type LatestAttendance = { id: string; workerName: string; workerCode: string; projectKey: string; checkInAt: string; checkOutAt: string | null };
type Mode = "home" | "voice" | "checkin" | "result";

const fmtTime = (iso: string) => new Date(iso).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });

export function FieldApp({ projects, latestAttendance }: { projects: Project[]; latestAttendance: LatestAttendance | null }) {
  const [mode, setMode] = useState<Mode>("home");
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [online, setOnline] = useState<boolean>(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setOnline(typeof navigator !== "undefined" ? navigator.onLine : true);
    const goOnline = () => { setOnline(true); flushQueue(); };
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/field-sw.js").catch(() => {});
    }
    // Read pending queue from localStorage
    refreshQueue();
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  function refreshQueue() {
    try {
      const q = JSON.parse(localStorage.getItem("field-queue") ?? "[]");
      setPendingCount(Array.isArray(q) ? q.length : 0);
    } catch { setPendingCount(0); }
  }

  function enqueue(item: any) {
    const q = JSON.parse(localStorage.getItem("field-queue") ?? "[]");
    q.push({ ...item, queuedAt: Date.now() });
    localStorage.setItem("field-queue", JSON.stringify(q));
    refreshQueue();
  }

  async function flushQueue() {
    const q = JSON.parse(localStorage.getItem("field-queue") ?? "[]");
    if (!Array.isArray(q) || q.length === 0) return;
    const remaining: any[] = [];
    for (const item of q) {
      try {
        const r = await fetch(item.url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(item.body) });
        if (!r.ok) remaining.push(item);
      } catch { remaining.push(item); }
    }
    localStorage.setItem("field-queue", JSON.stringify(remaining));
    refreshQueue();
  }

  async function doCheckin(mode: "in" | "out") {
    setErr(null);
    if (!navigator.geolocation) { setErr("Thiết bị không hỗ trợ GPS"); return; }
    if (!projectId) { setErr("Chưa chọn dự án"); return; }
    setMode("checkin");
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const body = { projectId, lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: pos.coords.accuracy, mode };
      if (!online) {
        enqueue({ url: "/api/field/checkin", body });
        setResult({ ok: true, queued: true, mode });
        setMode("result");
        return;
      }
      const r = await fetch("/api/field/checkin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) { setErr(j.error ?? "Không chấm công được"); setMode("home"); return; }
      setResult(j);
      setMode("result");
    }, (geoErr) => {
      setErr(`Không lấy được GPS: ${geoErr.message}`);
      setMode("home");
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  }

  return (
    <div className="mx-auto max-w-md min-h-screen pb-12">
      {/* Top bar */}
      <header className="sticky top-0 z-10 bg-blue-700 px-4 py-3 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-bold tracking-tight">Viwase Field</div>
            <div className="text-[11px] opacity-80">Báo cáo hiện trường — tiếng Việt</div>
          </div>
          <div className="text-right text-[10px]">
            <div className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${online ? "bg-emerald-500/30" : "bg-amber-500/30"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${online ? "bg-emerald-300" : "bg-amber-300"}`} /> {online ? "Online" : "Offline"}
            </div>
            {pendingCount > 0 && (
              <div className="mt-0.5 text-[10px] text-amber-200">{pendingCount} đợi sync</div>
            )}
          </div>
        </div>
      </header>

      {/* Project picker */}
      <div className="border-b border-slate-700 bg-slate-800 px-4 py-2">
        <label className="block text-[11px] uppercase tracking-wide text-slate-400">Dự án đang ở</label>
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="mt-1 w-full rounded-md bg-slate-700 px-3 py-2 text-sm text-white" data-testid="field-project">
          {projects.map((p) => <option key={p.id} value={p.id}>{p.key} — {p.name}</option>)}
        </select>
      </div>

      {/* Latest attendance summary */}
      {latestAttendance && (
        <div className="border-b border-slate-700 bg-slate-800/40 px-4 py-2 text-xs">
          <span className="text-slate-400">Lần chấm gần nhất:</span> {latestAttendance.workerName} ({latestAttendance.workerCode})
          <div className="text-slate-300">Vào {fmtTime(latestAttendance.checkInAt)} {latestAttendance.checkOutAt ? `· Ra ${fmtTime(latestAttendance.checkOutAt)}` : <span className="text-emerald-400">· Đang trong ca</span>}</div>
        </div>
      )}

      {err && <div className="m-3 rounded-md border border-amber-400 bg-amber-500/10 p-3 text-sm text-amber-200">{err}</div>}

      {mode === "home" && (
        <main className="px-4 py-4">
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => doCheckin("in")} className="aspect-square rounded-2xl bg-emerald-600 p-4 text-left shadow-lg active:scale-95" data-testid="btn-checkin">
              <div className="text-3xl">📍</div>
              <div className="mt-2 text-lg font-bold">Chấm công vào</div>
              <div className="text-[11px] opacity-80">GPS xác thực vị trí</div>
            </button>
            <button onClick={() => doCheckin("out")} className="aspect-square rounded-2xl bg-amber-600 p-4 text-left shadow-lg active:scale-95">
              <div className="text-3xl">🚪</div>
              <div className="mt-2 text-lg font-bold">Chấm công ra</div>
              <div className="text-[11px] opacity-80">Đóng ca làm</div>
            </button>
            <button onClick={() => setMode("voice")} className="aspect-square rounded-2xl bg-blue-600 p-4 text-left shadow-lg active:scale-95" data-testid="btn-voice">
              <div className="text-3xl">🎙️</div>
              <div className="mt-2 text-lg font-bold">Báo cáo bằng giọng nói</div>
              <div className="text-[11px] opacity-80">AI tự điền form</div>
            </button>
            <button onClick={() => setErr("Tính năng đang phát triển — sẽ có ở bản kế tiếp.")} className="aspect-square rounded-2xl bg-rose-600 p-4 text-left shadow-lg active:scale-95">
              <div className="text-3xl">📸</div>
              <div className="mt-2 text-lg font-bold">Báo sự cố</div>
              <div className="text-[11px] opacity-80">Chụp ảnh + GPS</div>
            </button>
            <button onClick={() => setErr("Tính năng đang phát triển — sẽ có ở bản kế tiếp.")} className="aspect-square rounded-2xl bg-violet-600 p-4 text-left shadow-lg active:scale-95">
              <div className="text-3xl">📋</div>
              <div className="mt-2 text-lg font-bold">Ghi nhật ký nhanh</div>
              <div className="text-[11px] opacity-80">Mẫu giản tiện</div>
            </button>
            <button onClick={() => setErr("Tính năng đang phát triển — sẽ có ở bản kế tiếp.")} className="aspect-square rounded-2xl bg-slate-600 p-4 text-left shadow-lg active:scale-95">
              <div className="text-3xl">🦺</div>
              <div className="mt-2 text-lg font-bold">PPE selfie</div>
              <div className="text-[11px] opacity-80">YOLO kiểm tra mũ + áo</div>
            </button>
          </div>

          <div className="mt-4 rounded-xl border border-slate-700 bg-slate-800/60 p-3 text-xs text-slate-300">
            <div className="font-medium text-white">Atlas Field — Q3/2027</div>
            <p className="mt-1 opacity-80">PWA mobile-first: cài vào màn hình chính. Offline-first: làm việc khi mất sóng, tự sync khi có lại mạng. Voice-to-form bằng tiếng Việt qua Whisper + Llama-3.3.</p>
          </div>
        </main>
      )}

      {mode === "voice" && <VoicePanel onBack={() => setMode("home")} online={online} enqueue={enqueue} onResult={(r) => { setResult(r); setMode("result"); }} />}

      {mode === "checkin" && (
        <main className="px-4 py-12 text-center">
          <div className="animate-pulse text-5xl">📡</div>
          <div className="mt-4 text-base">Đang lấy GPS…</div>
          <div className="mt-1 text-xs text-slate-400">Vui lòng cho phép quyền vị trí</div>
        </main>
      )}

      {mode === "result" && result && (
        <main className="px-4 py-6">
          {result.queued ? (
            <div className="rounded-xl border border-amber-500 bg-amber-500/10 p-4 text-sm">
              <div className="text-2xl">💾</div>
              <div className="mt-2 font-bold">Đã lưu offline</div>
              <div className="mt-1 text-amber-200">Báo cáo sẽ tự gửi khi có mạng. Bạn có thể tiếp tục làm việc.</div>
            </div>
          ) : result.mode === "in" ? (
            <div className="rounded-xl border border-emerald-500 bg-emerald-500/10 p-4 text-sm">
              <div className="text-2xl">✅</div>
              <div className="mt-2 font-bold">Đã chấm công vào</div>
              <div className="mt-1 text-emerald-200">{result.worker?.fullName ?? "—"} · {fmtTime(result.attendance.checkInAt)}</div>
            </div>
          ) : result.mode === "out" ? (
            <div className="rounded-xl border border-amber-500 bg-amber-500/10 p-4 text-sm">
              <div className="text-2xl">🚪</div>
              <div className="mt-2 font-bold">Đã chấm công ra</div>
              <div className="mt-1 text-amber-200">{result.worker?.fullName ?? "—"} · {fmtTime(result.attendance.checkOutAt)}</div>
            </div>
          ) : result.form ? (
            <VoiceResultCard r={result} />
          ) : (
            <pre className="overflow-auto rounded bg-slate-800 p-3 text-xs">{JSON.stringify(result, null, 2)}</pre>
          )}
          <button onClick={() => { setResult(null); setMode("home"); }} className="mt-6 w-full rounded-xl bg-blue-600 py-3 text-base font-bold shadow-lg active:scale-95">Quay về</button>
        </main>
      )}
    </div>
  );
}

function VoicePanel({ onBack, online, enqueue, onResult }: { onBack: () => void; online: boolean; enqueue: (i: any) => void; onResult: (r: any) => void }) {
  const [state, setState] = useState<"idle" | "recording" | "transcribing">("idle");
  const [err, setErr] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const tickRef = useRef<number | null>(null);

  async function start() {
    setErr(null); setSeconds(0); chunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: pickMime() });
      recorderRef.current = mr;
      mr.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        await upload(blob);
      };
      mr.start();
      setState("recording");
      tickRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (e: any) {
      setErr(`Không truy cập được mic: ${e.message ?? e}`);
    }
  }

  function stop() {
    recorderRef.current?.stop();
    if (tickRef.current) clearInterval(tickRef.current);
    setState("transcribing");
  }

  async function upload(blob: Blob) {
    if (!online) {
      // We can't queue audio in localStorage easily — just inform the user.
      setErr("Voice cần mạng để gửi. Hãy thử khi có sóng.");
      setState("idle");
      return;
    }
    try {
      const fd = new FormData();
      fd.append("file", blob, `field-${Date.now()}.webm`);
      const r = await fetch("/api/ai/field/voice-form", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) { setErr(j.error ?? "Lỗi server"); setState("idle"); return; }
      onResult(j);
    } catch (e: any) {
      setErr(`Lỗi gửi: ${e.message ?? e}`);
      setState("idle");
    }
  }

  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-8">
      <button onClick={onBack} className="self-start text-xs text-slate-400">← Quay về</button>
      {err && <div className="mt-3 self-stretch rounded-md border border-amber-400 bg-amber-500/10 p-3 text-sm text-amber-200">{err}</div>}
      <div className="mt-6 text-center">
        <div className="text-7xl">{state === "recording" ? "🔴" : state === "transcribing" ? "⏳" : "🎙️"}</div>
        <div className="mt-4 text-xl font-bold">
          {state === "idle" ? "Bấm để ghi âm" : state === "recording" ? `Đang ghi ${seconds}s` : "AI đang phân tích…"}
        </div>
        <div className="mt-2 text-xs text-slate-400">
          {state === "idle" ? "Whisper + Llama 3.3 tự phân loại + điền form" : state === "recording" ? "Bấm Dừng khi xong" : "Khoảng 2-5 giây"}
        </div>
      </div>
      <div className="mt-8 flex gap-3">
        {state === "idle" && <button onClick={start} className="rounded-full bg-rose-600 px-8 py-4 text-lg font-bold shadow-lg active:scale-95">Bắt đầu ghi</button>}
        {state === "recording" && <button onClick={stop} className="rounded-full bg-amber-600 px-8 py-4 text-lg font-bold shadow-lg active:scale-95">Dừng</button>}
      </div>

      <div className="mt-10 max-w-xs text-center text-[11px] text-slate-500">
        <div className="font-medium text-slate-300">Gợi ý nói:</div>
        <ul className="mt-1 space-y-0.5">
          <li>"Hôm nay đã đổ bê tông cột tầng 5 trục A đến F, tiến độ khoảng 60%."</li>
          <li>"Phát hiện vi phạm: hai công nhân không đội mũ ở khu vực cẩu tháp."</li>
          <li>"Có sự cố trượt ngã giàn giáo tầng 3, công nhân bị xước nhẹ tay."</li>
        </ul>
      </div>
    </main>
  );
}

function pickMime(): string {
  if (typeof MediaRecorder === "undefined") return "audio/webm";
  for (const m of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return "audio/webm";
}

function VoiceResultCard({ r }: { r: any }) {
  const intentLabel: Record<string, { vn: string; emoji: string; cls: string }> = {
    DAILY_LOG: { vn: "Nhật ký công trường", emoji: "📋", cls: "bg-violet-500/20 border-violet-400" },
    INCIDENT: { vn: "Sự cố ATLĐ", emoji: "⚠️", cls: "bg-rose-500/20 border-rose-400" },
    NCR: { vn: "NCR chất lượng", emoji: "🔧", cls: "bg-amber-500/20 border-amber-400" },
    PPE_REPORT: { vn: "Vi phạm PPE", emoji: "🦺", cls: "bg-orange-500/20 border-orange-400" },
    PROGRESS: { vn: "Cập nhật tiến độ", emoji: "📈", cls: "bg-emerald-500/20 border-emerald-400" },
    UNKNOWN: { vn: "Chưa phân loại", emoji: "❓", cls: "bg-slate-500/20 border-slate-400" },
  };
  const m = intentLabel[r.form.intent] ?? intentLabel.UNKNOWN!;
  const fields: Array<[string, any]> = [];
  for (const k of ["zone", "workDone", "workforce", "safetyNotes", "category", "severity", "injured", "immediateAction", "ncrTitle", "qcvnRef", "rootCause", "workerCount", "taskCode", "taskName", "pctComplete"]) {
    const v = (r.form as any)[k];
    if (v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0)) fields.push([k, v]);
  }
  if (Array.isArray(r.form.ppeMissing) && r.form.ppeMissing.length) fields.push(["ppeMissing", r.form.ppeMissing.join(", ")]);

  return (
    <div className={`rounded-xl border ${m.cls} p-4 text-sm`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl">{m.emoji}</div>
          <div className="mt-1 font-bold">{m.vn}</div>
          <div className="text-[11px] opacity-70">độ tin cậy {Math.round((r.form.confidence ?? 0) * 100)}% · {r.source}</div>
        </div>
      </div>
      <div className="mt-3 rounded bg-slate-900/40 p-2 text-xs italic">"{r.transcript}"</div>
      {fields.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs">
          {fields.map(([k, v]) => (
            <li key={k}><span className="text-slate-400">{labelForField(k)}:</span> <span className="font-medium">{String(v)}</span></li>
          ))}
        </ul>
      )}
      {fields.length === 0 && <div className="mt-3 text-xs text-slate-300">AI chưa rút trích được field nào — hãy nói rõ hơn về vị trí, công việc, % hoàn thành.</div>}
    </div>
  );
}

function labelForField(k: string): string {
  return ({
    zone: "Khu vực",
    workDone: "Công việc đã làm",
    workforce: "Nhân lực",
    safetyNotes: "Ghi chú ATLĐ",
    category: "Loại sự cố",
    severity: "Mức độ",
    injured: "Số người thương",
    immediateAction: "Hành động ngay",
    ncrTitle: "Tiêu đề NCR",
    qcvnRef: "TCVN/QCVN tham chiếu",
    rootCause: "Nguyên nhân",
    ppeMissing: "PPE thiếu",
    workerCount: "Số công nhân",
    taskCode: "Mã hạng mục",
    taskName: "Tên hạng mục",
    pctComplete: "% hoàn thành",
  } as Record<string, string>)[k] ?? k;
}
