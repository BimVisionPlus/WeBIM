"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CanvasMarkup, CanvasPresence, CanvasSheet } from "./types";

type Tool = "SELECT" | "PIN" | "RECT" | "CLOUD" | "ARROW" | "MEASURE";
type Props = { sheet: CanvasSheet; initialMarkups: CanvasMarkup[]; createEndpoint: string; presenceEndpoint: string; canComment: boolean; guest?: boolean };

const tools: { id: Tool; icon: string; label: string }[] = [
  { id: "SELECT", icon: "↖", label: "Chọn" }, { id: "PIN", icon: "●", label: "Ghim" },
  { id: "RECT", icon: "□", label: "Khung" }, { id: "CLOUD", icon: "☁", label: "Mây revision" },
  { id: "ARROW", icon: "↗", label: "Mũi tên" }, { id: "MEASURE", icon: "↔", label: "Đo" },
];

export function SheetCanvas({ sheet, initialMarkups, createEndpoint, presenceEndpoint, canComment, guest = false }: Props) {
  const [markups, setMarkups] = useState(initialMarkups);
  const [tool, setTool] = useState<Tool>(canComment ? "PIN" : "SELECT");
  const [selected, setSelected] = useState<string | null>(initialMarkups[0]?.id ?? null);
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [guestName, setGuestName] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [imageFailed, setImageFailed] = useState(false);
  const [presence, setPresence] = useState<CanvasPresence[]>([]);
  const [compare, setCompare] = useState(false);
  const [compareOpacity, setCompareOpacity] = useState(55);
  const stage = useRef<HTMLDivElement>(null);
  const presenceSession = useRef("");
  const selectedMarkup = markups.find((m) => m.id === selected) ?? null;

  const imageUrl = sheet.rasterUrl || sheet.thumbnailUrl;
  const openCount = useMemo(() => markups.filter((m) => m.status === "OPEN").length, [markups]);

  useEffect(() => {
    if (!presenceSession.current) presenceSession.current = window.crypto.randomUUID();
    let stopped = false;

    async function heartbeat() {
      const identified = !guest || guestName.trim().length >= 2;
      const response = await fetch(presenceEndpoint, identified ? {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionKey: presenceSession.current, ...(guest ? { guestName: guestName.trim() } : {}) }),
      } : undefined).catch(() => null);
      if (!response?.ok || stopped) return;
      const data = await response.json().catch(() => null);
      if (Array.isArray(data?.presence)) setPresence(data.presence);
    }

    void heartbeat();
    const timer = window.setInterval(() => void heartbeat(), 15_000);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [guest, guestName, presenceEndpoint]);

  function point(event: React.PointerEvent) {
    const rect = stage.current!.getBoundingClientRect();
    return { x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) };
  }

  async function createMarkup(geometry: any) {
    if (!canComment || tool === "SELECT") return;
    if (guest && guestName.trim().length < 2) { setError("Nhập tên của bạn trước khi đánh dấu."); return; }
    setBusy(true); setError("");
    const body = guest ? { action: "markup", guestName, kind: tool, geometry, color: "#ef4444" } : { kind: tool, geometry, color: "#ef4444", pageNumber: 1 };
    const response = await fetch(createEndpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) { setError(typeof data.error === "string" ? data.error : "Không thể lưu markup"); return; }
    setMarkups((current) => [...current, data]); setSelected(data.id); setTool("SELECT");
  }

  function onPointerDown(event: React.PointerEvent) {
    if (!canComment || tool === "SELECT") return;
    const p = point(event);
    if (tool === "PIN") void createMarkup({ kind: "PIN", point: p }); else setStart(p);
  }

  function onPointerUp(event: React.PointerEvent) {
    if (!start || tool === "SELECT" || tool === "PIN") return;
    const end = point(event); const x = Math.min(start.x, end.x); const y = Math.min(start.y, end.y);
    const width = Math.max(0.01, Math.abs(end.x - start.x)); const height = Math.max(0.01, Math.abs(end.y - start.y));
    const geometry = tool === "RECT" || tool === "CLOUD" ? { kind: tool, x, y, width, height } : { kind: tool, start, end };
    setStart(null); void createMarkup(geometry);
  }

  async function addComment() {
    if (!selectedMarkup || !comment.trim()) return;
    if (guest && guestName.trim().length < 2) { setError("Nhập tên của bạn trước khi bình luận."); return; }
    setBusy(true); setError("");
    const endpoint = guest ? createEndpoint : `/api/canvas/markups/${selectedMarkup.id}/comments`;
    const body = guest ? { action: "comment", guestName, markupId: selectedMarkup.id, body: comment } : { body: comment };
    const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json(); setBusy(false);
    if (!response.ok) { setError(typeof data.error === "string" ? data.error : "Không thể gửi bình luận"); return; }
    setMarkups((items) => items.map((m) => m.id === selectedMarkup.id ? { ...m, comments: [...m.comments, data] } : m)); setComment("");
  }

  async function toggleResolved() {
    if (!selectedMarkup || guest) return;
    const status = selectedMarkup.status === "OPEN" ? "RESOLVED" : "OPEN";
    const response = await fetch(`/api/canvas/markups/${selectedMarkup.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) });
    if (response.ok) setMarkups((items) => items.map((m) => m.id === selectedMarkup.id ? { ...m, status } : m));
  }

  return (
    <div className="flex min-h-[680px] overflow-hidden rounded-xl border border-[rgb(var(--inverse-ink))] bg-[rgb(var(--inverse-bg))] text-[rgb(var(--inverse-ink))] shadow-2xl">
      <aside className="flex w-16 shrink-0 flex-col items-center gap-2 border-r border-[rgb(var(--inverse-ink))] bg-[rgb(var(--inverse-bg))] py-4">
        {tools.map((item) => <button key={item.id} disabled={!canComment && item.id !== "SELECT"} onClick={() => setTool(item.id)} title={item.label} className={`h-10 w-10 rounded-lg text-lg transition ${tool === item.id ? "bg-blue-600 text-[rgb(var(--inverse-ink))]" : "text-[rgb(var(--inverse-ink))] hover:bg-[rgb(var(--inverse-bg))] disabled:opacity-30"}`}>{item.icon}</button>)}
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-4 border-b border-[rgb(var(--inverse-ink))] bg-[rgb(var(--inverse-bg))] px-5 py-3">
          <div><div className="text-xs text-[rgb(var(--muted-2))]">{sheet.drawingSetName} · {sheet.revision}</div><h1 className="font-semibold">{sheet.sheetNumber} — {sheet.title}</h1></div>
          <div className="ml-auto flex items-center -space-x-2" aria-label={`${presence.length} người đang xem`}>
            {presence.slice(0, 5).map((person) => <span key={person.sessionKey} title={person.displayName} className="grid h-8 w-8 place-items-center rounded-full border-2 border-[rgb(var(--inverse-ink))] text-xs font-semibold text-[rgb(var(--inverse-ink))]" style={{ backgroundColor: person.color }}>{person.displayName.slice(0, 1).toLocaleUpperCase()}</span>)}
            {presence.length > 5 && <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-[rgb(var(--inverse-ink))] bg-[rgb(var(--inverse-bg))] text-[10px]">+{presence.length - 5}</span>}
          </div>
          <div className="rounded-full bg-amber-400/10 px-3 py-1 text-xs text-amber-300">{openCount} đang mở</div>
          <div className="text-xs text-[rgb(var(--muted-2))]">Tỉ lệ {sheet.scale ?? "—"}</div>
          {sheet.compareRasterUrl && <button onClick={() => setCompare((value) => !value)} className={`rounded px-3 py-1.5 text-xs font-medium ${compare ? "bg-violet-600 text-[rgb(var(--inverse-ink))]" : "bg-[rgb(var(--inverse-bg))] text-[rgb(var(--inverse-ink))]"}`}>So sánh {sheet.compareRevision}</button>}
          {compare && <label className="flex items-center gap-2 text-xs text-[rgb(var(--muted-2))]"><span>Hiện tại</span><input type="range" min="0" max="100" value={compareOpacity} onChange={(event) => setCompareOpacity(Number(event.target.value))} className="w-20 accent-violet-500" /></label>}
        </header>
        {guest && canComment && <div className="border-b border-[rgb(var(--inverse-ink))] bg-[rgb(var(--inverse-bg))]/80 px-5 py-2"><input value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Tên của bạn để bình luận" className="w-64 rounded border border-[rgb(var(--inverse-ink))] bg-[rgb(var(--inverse-bg))] px-3 py-1.5 text-sm outline-none focus:border-blue-500" /></div>}
        <div className="flex flex-1 items-center justify-center overflow-auto bg-[radial-gradient(circle_at_center,_#334155_0,_#0f172a_75%)] p-8">
          <div ref={stage} onPointerDown={onPointerDown} onPointerUp={onPointerUp} className="relative aspect-[1.414/1] w-full max-w-5xl select-none overflow-hidden bg-[rgb(var(--surface))] shadow-2xl touch-none">
            {compare && sheet.compareRasterUrl && <img src={sheet.compareRasterUrl} alt={`Revision ${sheet.compareRevision}`} draggable={false} className="absolute inset-0 h-full w-full object-contain grayscale" />}
            {imageUrl && !imageFailed ? <img src={imageUrl} alt={`${sheet.sheetNumber} ${sheet.title}`} draggable={false} onError={() => setImageFailed(true)} className="absolute inset-0 h-full w-full object-contain" style={{ opacity: compare ? compareOpacity / 100 : 1, mixBlendMode: compare ? "multiply" : "normal" }} /> : <BlueprintPlaceholder sheet={sheet} />}
            <svg viewBox="0 0 1000 707" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
              <defs><marker id="arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#ef4444" /></marker></defs>
              {markups.map((m) => <MarkupShape key={m.id} markup={m} sheet={sheet} selected={m.id === selected} onSelect={() => { setSelected(m.id); setTool("SELECT"); }} />)}
            </svg>
            {busy && <div className="absolute inset-0 grid place-items-center bg-[rgb(var(--inverse-bg))]/15"><span className="rounded bg-[rgb(var(--inverse-bg))]/80 px-3 py-2 text-xs">Đang lưu…</span></div>}
          </div>
        </div>
      </section>

      <aside className="w-80 shrink-0 border-l border-[rgb(var(--inverse-ink))] bg-[rgb(var(--inverse-bg))]">
        <div className="border-b border-[rgb(var(--inverse-ink))] px-4 py-4"><h2 className="font-semibold">Markup & thảo luận</h2><p className="mt-1 text-xs text-[rgb(var(--muted-2))]">Tọa độ được giữ theo bản vẽ, không phụ thuộc zoom.</p></div>
        <div className="max-h-[590px] overflow-y-auto p-3">
          {markups.map((m, i) => <button key={m.id} onClick={() => setSelected(m.id)} className={`mb-2 w-full rounded-lg border p-3 text-left ${selected === m.id ? "border-blue-500 bg-blue-500/10" : "border-[rgb(var(--inverse-ink))] bg-[rgb(var(--inverse-bg))]/60"}`}><div className="flex items-center gap-2 text-sm"><span style={{ color: m.color }}>●</span><strong>#{i + 1} {m.kind}</strong><span className={`ml-auto text-[10px] ${m.status === "OPEN" ? "text-amber-300" : "text-emerald-300"}`}>{m.status}</span></div><div className="mt-1 text-xs text-[rgb(var(--muted-2))]">{m.authorName} · {m.comments.length} bình luận</div></button>)}
          {!markups.length && <p className="p-5 text-center text-sm text-[rgb(var(--muted-2))]">Chưa có đánh dấu. Chọn công cụ bên trái để bắt đầu.</p>}
        </div>
        {selectedMarkup && <div className="border-t border-[rgb(var(--inverse-ink))] p-4"><div className="space-y-2">{selectedMarkup.comments.map((c) => <div key={c.id} className="rounded bg-[rgb(var(--inverse-bg))] p-2 text-sm"><strong className="text-xs text-blue-300">{c.authorName}</strong><p className="mt-1 whitespace-pre-wrap text-[rgb(var(--inverse-ink))]">{c.body}</p></div>)}</div>{canComment && <><textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Thêm bình luận…" className="mt-3 h-20 w-full resize-none rounded border border-[rgb(var(--inverse-ink))] bg-[rgb(var(--inverse-bg))] p-2 text-sm outline-none focus:border-blue-500" /><div className="mt-2 flex gap-2"><button onClick={addComment} disabled={busy || !comment.trim()} className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium disabled:opacity-40">Gửi</button>{!guest && <button onClick={toggleResolved} className="rounded border border-[rgb(var(--inverse-ink))] px-3 py-1.5 text-xs">{selectedMarkup.status === "OPEN" ? "Đánh dấu đã xử lý" : "Mở lại"}</button>}</div></>}{error && <p className="mt-2 text-xs text-red-400">{error}</p>}</div>}
      </aside>
    </div>
  );
}

function BlueprintPlaceholder({ sheet }: { sheet: CanvasSheet }) {
  return <div className="absolute inset-0 bg-[#f8fafc] text-[rgb(var(--muted))]"><div className="absolute inset-8 border-2 border-[rgb(var(--line-2))]" /><div className="absolute left-[8%] top-[14%] h-[56%] w-[70%] border-2 border-[rgb(var(--line-2))]"><div className="absolute left-1/3 top-0 h-full border-l border-[rgb(var(--line-2))]"/><div className="absolute left-2/3 top-0 h-full border-l border-[rgb(var(--line-2))]"/><div className="absolute left-0 top-1/2 w-full border-t border-[rgb(var(--line-2))]"/></div><div className="absolute bottom-9 right-9 w-64 border-2 border-[rgb(var(--line-2))] bg-[rgb(var(--surface))] p-3"><div className="text-xs uppercase">Atlas AEC · Browser canvas</div><div className="mt-3 font-mono text-xl font-bold text-[rgb(var(--ink-2))]">{sheet.sheetNumber}</div><div className="text-sm">{sheet.title}</div><div className="mt-2 text-xs">Revision {sheet.revision} · {sheet.scale ?? "NTS"}</div></div></div>;
}

function MarkupShape({ markup: m, sheet, selected, onSelect }: { markup: CanvasMarkup; sheet: CanvasSheet; selected: boolean; onSelect: () => void }) {
  const g = m.geometry; const stroke = m.status === "RESOLVED" ? "#10b981" : m.color; const width = selected ? 5 : 3;
  const common = { stroke, strokeWidth: width, fill: "transparent", onPointerDown: (e: any) => e.stopPropagation(), onPointerUp: (e: any) => e.stopPropagation(), onClick: (e: any) => { e.stopPropagation(); onSelect(); }, className: "cursor-pointer" };
  if (m.kind === "PIN") return <g onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onSelect(); }} className="cursor-pointer"><circle cx={g.point.x * 1000} cy={g.point.y * 707} r={selected ? 14 : 11} fill={stroke} stroke="white" strokeWidth="3"/><text x={g.point.x * 1000} y={g.point.y * 707 + 4} textAnchor="middle" fontSize="12" fill="white">!</text></g>;
  if (m.kind === "RECT" || m.kind === "CLOUD") return <rect x={g.x * 1000} y={g.y * 707} width={g.width * 1000} height={g.height * 707} rx={m.kind === "CLOUD" ? 18 : 0} strokeDasharray={m.kind === "CLOUD" ? "10 7" : undefined} {...common}/>;
  if (m.kind === "ARROW") return <line x1={g.start.x * 1000} y1={g.start.y * 707} x2={g.end.x * 1000} y2={g.end.y * 707} markerEnd="url(#arrowhead)" {...common}/>;
  if (m.kind === "MEASURE") {
    const x1 = g.start.x * 1000; const y1 = g.start.y * 707; const x2 = g.end.x * 1000; const y2 = g.end.y * 707;
    return <g onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onSelect(); }} className="cursor-pointer"><line x1={x1} y1={y1} x2={x2} y2={y2} strokeDasharray="5 4" {...common}/><rect x={(x1 + x2) / 2 - 38} y={(y1 + y2) / 2 - 20} width="76" height="20" rx="4" fill="#0f172a" opacity="0.88"/><text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 6} textAnchor="middle" fontSize="12" fontWeight="600" fill="white">{measurementLabel(g.start, g.end, sheet)}</text></g>;
  }
  if (m.kind === "POLYLINE") return <polyline points={g.points.map((p: any) => `${p.x * 1000},${p.y * 707}`).join(" ")} {...common}/>;
  return <text x={g.point.x * 1000} y={g.point.y * 707} fill={stroke} fontSize="18" onClick={onSelect}>{g.text}</text>;
}

function measurementLabel(start: { x: number; y: number }, end: { x: number; y: number }, sheet: CanvasSheet) {
  if (!sheet.paperWidthMm || !sheet.paperHeightMm || !sheet.scale) return "NTS";
  const width = sheet.paperWidthMm; const height = sheet.paperHeightMm;
  const paperMm = Math.hypot((end.x - start.x) * width, (end.y - start.y) * height);
  const scaleMatch = sheet.scale.trim().match(/^1\s*:\s*(\d+(?:[.,]\d+)?)$/);
  if (!scaleMatch) return "NTS";
  const denominator = Number(scaleMatch[1]!.replace(",", "."));
  const metres = paperMm * denominator / 1000;
  return metres < 1 ? `${Math.round(metres * 1000)} mm` : `${metres.toFixed(metres < 10 ? 2 : 1)} m`;
}
