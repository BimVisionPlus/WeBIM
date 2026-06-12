"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { CLAIM_STATE_LABEL, EVENT_KIND_LABEL, EVIDENCE_KIND_LABEL, NEXT_STATES } from "../labels";

// ─── Chuyển trạng thái ──────────────────────────────────────────────────────

export function TransitionControls({ claimId, state }: { claimId: string; state: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const nexts = NEXT_STATES[state] ?? [];
  if (nexts.length === 0) return null;

  async function go(next: string) {
    let note: string | undefined;
    if (["RESOLVED", "REJECTED", "WITHDRAWN"].includes(next)) {
      note = window.prompt("Ghi chú kết quả (tuỳ chọn):") ?? undefined;
    }
    setBusy(next);
    setErr(null);
    const r = await fetch(`/api/claims/${claimId}/transition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: next, note }),
    });
    setBusy(null);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setErr(typeof j.error === "string" ? j.error : "Không chuyển được trạng thái");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-2">
        {nexts.map((n) => (
          <Button key={n} size="sm" variant="outline" disabled={busy !== null} onClick={() => go(n)}>
            {busy === n ? "…" : `→ ${CLAIM_STATE_LABEL[n] ?? n}`}
          </Button>
        ))}
      </div>
      {err && <div className="text-xs text-rose-600">{err}</div>}
    </div>
  );
}

// ─── Thêm sự kiện ───────────────────────────────────────────────────────────

export function AddEventForm({ claimId }: { claimId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({
    occurredAt: new Date().toISOString().slice(0, 10),
    kind: "OTHER",
    title: "",
    detail: "",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const r = await fetch(`/api/claims/${claimId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, detail: form.detail || undefined }),
    });
    setBusy(false);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setErr(typeof j.error === "string" ? j.error : "Không lưu được");
      return;
    }
    setOpen(false);
    setForm({ ...form, title: "", detail: "" });
    router.refresh();
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>+ Sự kiện</Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
            <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-semibold">Thêm sự kiện vào diễn biến</h2>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </header>
            <form onSubmit={submit} className="space-y-3 px-4 py-4">
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-xs font-medium text-slate-700">Ngày xảy ra</span>
                  <input
                    type="date"
                    required
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    value={form.occurredAt}
                    onChange={(e) => setForm({ ...form, occurredAt: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="block text-xs font-medium text-slate-700">Loại</span>
                  <select
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    value={form.kind}
                    onChange={(e) => setForm({ ...form, kind: e.target.value })}
                  >
                    {Object.entries(EVENT_KIND_LABEL).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="block text-xs font-medium text-slate-700">Tiêu đề</span>
                <input
                  required
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  placeholder="VD: CĐT thông báo tạm dừng thi công Zone B"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-slate-700">Chi tiết</span>
                <textarea
                  rows={3}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={form.detail}
                  onChange={(e) => setForm({ ...form, detail: e.target.value })}
                />
              </label>
              {err && <div className="rounded bg-rose-50 px-3 py-2 text-xs text-rose-700">{err}</div>}
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Huỷ</Button>
                <Button type="submit" disabled={busy}>{busy ? "Đang lưu…" : "Thêm sự kiện"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Quét chứng cứ ──────────────────────────────────────────────────────────

type Candidate = {
  kind: string;
  refTable: string;
  refId: string;
  title: string;
  capturedAt: string | null;
  excerpt: string | null;
  alreadyAttached: boolean;
};

export function EvidenceScanner({ claimId }: { claimId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [attaching, setAttaching] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function scan() {
    setOpen(true);
    setLoading(true);
    setErr(null);
    const r = await fetch(`/api/claims/${claimId}/evidence/scan`);
    setLoading(false);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setErr(typeof j.error === "string" ? j.error : "Quét thất bại");
      return;
    }
    const j = await r.json();
    setCandidates(j.candidates);
  }

  async function attach(c: Candidate) {
    setAttaching(c.refId);
    setErr(null);
    const r = await fetch(`/api/claims/${claimId}/evidence`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: c.kind in EVIDENCE_KIND_LABEL ? c.kind : "OTHER",
        title: c.title,
        note: c.excerpt ?? undefined,
        refTable: c.refTable,
        refId: c.refId,
        capturedAt: c.capturedAt ?? undefined,
      }),
    });
    setAttaching(null);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setErr(typeof j.error === "string" ? j.error : "Không gắn được chứng cứ");
      return;
    }
    setCandidates((cs) => cs?.map((x) => (x.refId === c.refId ? { ...x, alreadyAttached: true } : x)) ?? null);
    router.refresh();
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={scan}>🔍 Quét chứng cứ</Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-lg bg-white shadow-xl">
            <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold">Quét chứng cứ trên nền tảng</h2>
                <p className="text-xs text-slate-500">
                  Nhật ký, sổ TVGS, RFI/CO/NCR, BBNT, thời tiết xấu trong cửa sổ thời gian của hồ sơ.
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </header>
            <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
              {loading && <p className="py-6 text-center text-sm text-slate-500">Đang quét…</p>}
              {err && <div className="rounded bg-rose-50 px-3 py-2 text-xs text-rose-700">{err}</div>}
              {candidates?.map((c) => (
                <div key={`${c.refTable}:${c.refId}`} className="flex items-start gap-3 rounded-md border border-slate-100 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Badge variant="info">{EVIDENCE_KIND_LABEL[c.kind] ?? c.kind}</Badge>
                      {c.capturedAt && <span className="text-slate-500">{c.capturedAt.slice(0, 10)}</span>}
                    </div>
                    <div className="mt-0.5 truncate text-sm text-slate-800">{c.title}</div>
                    {c.excerpt && <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{c.excerpt}</p>}
                  </div>
                  {c.alreadyAttached ? (
                    <Badge variant="success">Đã gắn</Badge>
                  ) : (
                    <Button size="sm" variant="outline" disabled={attaching === c.refId} onClick={() => attach(c)}>
                      {attaching === c.refId ? "…" : "+ Gắn"}
                    </Button>
                  )}
                </div>
              ))}
              {candidates && candidates.length === 0 && (
                <p className="py-6 text-center text-sm text-slate-500">
                  Không tìm thấy bản ghi nào trong cửa sổ thời gian. Kiểm tra lại "Sự kiện từ / đến" của hồ sơ.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Căn cứ pháp lý ─────────────────────────────────────────────────────────

type Basis = {
  id: string;
  regulationCode: string;
  regulationTitle: string;
  regulationUrl: string | null;
  articleRef: string;
  argument: string;
  source: string;
  aiConfidence: number | null;
};

type AiBasis = { regulationCode: string; articleRef: string; argument: string; confidence: number };

export function LegalBasisPanel({
  claimId,
  bases,
  regulations,
}: {
  claimId: string;
  bases: Basis[];
  regulations: { code: string; title: string }[];
}) {
  const router = useRouter();
  const [aiBusy, setAiBusy] = useState(false);
  const [aiErr, setAiErr] = useState<string | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<AiBasis[] | null>(null);
  const [aiGaps, setAiGaps] = useState<string | null>(null);
  const [suggestionId, setSuggestionId] = useState<string | null>(null);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [manual, setManual] = useState({ regulationCode: regulations[0]?.code ?? "", articleRef: "", argument: "" });
  const [manualBusy, setManualBusy] = useState(false);
  const [manualErr, setManualErr] = useState<string | null>(null);

  async function suggest() {
    setAiBusy(true);
    setAiErr(null);
    setAiSuggestions(null);
    const r = await fetch("/api/ai/claims/suggest-basis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ claimId }),
    });
    setAiBusy(false);
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) {
      setAiErr(j.reason ? `AI không khả dụng (${j.reason})` : j.error ?? "Lỗi không xác định");
      return;
    }
    setAiSuggestions(j.suggestion.bases);
    setAiGaps(j.suggestion.gapsNote);
    setSuggestionId(j.suggestionId);
  }

  async function acceptSuggestion(s: AiBasis) {
    setAccepting(s.regulationCode + s.articleRef);
    const r = await fetch(`/api/claims/${claimId}/legal-basis`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        regulationCode: s.regulationCode,
        articleRef: s.articleRef,
        argument: s.argument,
        source: "AI",
        aiConfidence: s.confidence,
        suggestionId: suggestionId ?? undefined,
      }),
    });
    setAccepting(null);
    if (r.ok) {
      setAiSuggestions((xs) => xs?.filter((x) => x !== s) ?? null);
      router.refresh();
    }
  }

  async function submitManual(e: React.FormEvent) {
    e.preventDefault();
    setManualBusy(true);
    setManualErr(null);
    const r = await fetch(`/api/claims/${claimId}/legal-basis`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...manual, source: "USER" }),
    });
    setManualBusy(false);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setManualErr(typeof j.error === "string" ? j.error : "Không thêm được");
      return;
    }
    setShowManual(false);
    setManual({ ...manual, articleRef: "", argument: "" });
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Căn cứ pháp lý ({bases.length})</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowManual(!showManual)}>+ Thêm thủ công</Button>
            <Button size="sm" variant="outline" disabled={aiBusy} onClick={suggest}>
              {aiBusy ? "AI đang phân tích…" : "✦ AI gợi ý căn cứ"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardBody className="space-y-3">
        {bases.map((b) => (
          <div key={b.id} className="rounded-md border border-slate-100 bg-slate-50/50 px-3 py-2">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="success">{b.regulationCode}</Badge>
              <span className="font-medium text-slate-700">{b.articleRef}</span>
              {b.source === "AI" && (
                <Badge variant="violet">
                  AI{b.aiConfidence != null ? ` ${(b.aiConfidence * 100).toFixed(0)}%` : ""} — đã duyệt
                </Badge>
              )}
              {b.regulationUrl && (
                <a href={b.regulationUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                  văn bản gốc ↗
                </a>
              )}
            </div>
            <div className="mt-0.5 text-xs text-slate-500">{b.regulationTitle}</div>
            <p className="mt-1 text-sm text-slate-700">{b.argument}</p>
          </div>
        ))}
        {bases.length === 0 && (
          <p className="text-sm text-slate-500">
            Chưa có căn cứ pháp lý. Dùng AI gợi ý từ thư viện văn bản (NĐ 37/2015, Luật Xây dựng…) hoặc thêm thủ công.
          </p>
        )}

        {showManual && (
          <form onSubmit={submitManual} className="space-y-2 rounded-md border border-slate-200 p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block">
                <span className="block text-xs font-medium text-slate-700">Văn bản</span>
                <select
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={manual.regulationCode}
                  onChange={(e) => setManual({ ...manual, regulationCode: e.target.value })}
                >
                  {regulations.map((r) => (
                    <option key={r.code} value={r.code}>{r.code} — {r.title.slice(0, 60)}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-slate-700">Điều / khoản</span>
                <input
                  required
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Điều 44 khoản 1"
                  value={manual.articleRef}
                  onChange={(e) => setManual({ ...manual, articleRef: e.target.value })}
                />
              </label>
            </div>
            <label className="block">
              <span className="block text-xs font-medium text-slate-700">Lập luận áp dụng</span>
              <textarea
                required
                rows={2}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={manual.argument}
                onChange={(e) => setManual({ ...manual, argument: e.target.value })}
              />
            </label>
            {manualErr && <div className="rounded bg-rose-50 px-3 py-1 text-xs text-rose-700">{manualErr}</div>}
            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={manualBusy}>{manualBusy ? "…" : "Thêm căn cứ"}</Button>
            </div>
          </form>
        )}

        {aiErr && <div className="rounded bg-rose-50 px-3 py-2 text-xs text-rose-700">{aiErr}</div>}
        {aiSuggestions && (
          <div className="space-y-2 rounded-md border border-violet-200 bg-violet-50/40 p-3">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span className="rounded bg-violet-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">AI</span>
              Gợi ý từ Qwen (OSS, chỉ trích từ thư viện văn bản) — duyệt từng căn cứ trước khi đưa vào hồ sơ.
            </div>
            {aiSuggestions.map((s, i) => (
              <div key={i} className="rounded-md bg-white px-3 py-2 ring-1 ring-violet-100">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="violet">{s.regulationCode}</Badge>
                  <span className="font-medium">{s.articleRef}</span>
                  <span className="text-slate-500">độ tin cậy {(s.confidence * 100).toFixed(0)}%</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-auto"
                    disabled={accepting === s.regulationCode + s.articleRef}
                    onClick={() => acceptSuggestion(s)}
                  >
                    {accepting === s.regulationCode + s.articleRef ? "…" : "✓ Duyệt"}
                  </Button>
                </div>
                <p className="mt-1 text-sm text-slate-700">{s.argument}</p>
              </div>
            ))}
            {aiSuggestions.length === 0 && (
              <p className="text-xs text-slate-500">Đã duyệt hết gợi ý.</p>
            )}
            {aiGaps && (
              <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-inset ring-amber-200">
                <span className="font-semibold">Điểm yếu cần lưu ý:</span> {aiGaps}
              </div>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// ─── Văn bản khiếu nại ──────────────────────────────────────────────────────

type Draft = {
  statementMd: string;
  missingItems: string[];
  strength: "weak" | "medium" | "strong";
  caveats: string | null;
};

const STRENGTH_LABEL: Record<string, { label: string; variant: "danger" | "warning" | "success" }> = {
  weak: { label: "Hồ sơ còn yếu", variant: "danger" },
  medium: { label: "Hồ sơ trung bình", variant: "warning" },
  strong: { label: "Hồ sơ chắc", variant: "success" },
};

export function StatementPanel({
  claimId,
  statementMd,
  hasBases,
}: {
  claimId: string;
  statementMd: string | null;
  hasBases: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [suggestionId, setSuggestionId] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  async function generate() {
    setBusy(true);
    setErr(null);
    const r = await fetch("/api/ai/claims/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ claimId }),
    });
    setBusy(false);
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) {
      setErr(j.reason ? `AI không khả dụng (${j.reason})` : j.error ?? "Lỗi không xác định");
      return;
    }
    setDraft(j.draft);
    setSuggestionId(j.suggestionId);
  }

  async function accept() {
    if (!suggestionId) return;
    setAccepting(true);
    const r = await fetch("/api/ai/claims/draft", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ claimId, suggestionId }),
    });
    setAccepting(false);
    if (r.ok) {
      setDraft(null);
      router.refresh();
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Văn bản khiếu nại</CardTitle>
          <Button size="sm" variant="outline" disabled={busy || !hasBases} onClick={generate}
                  title={!hasBases ? "Cần ít nhất một căn cứ pháp lý đã duyệt" : undefined}>
            {busy ? "AI đang soạn…" : "✦ AI soạn nháp"}
          </Button>
        </div>
        {!hasBases && (
          <p className="mt-1 text-xs text-slate-500">Duyệt ít nhất một căn cứ pháp lý trước khi soạn văn bản.</p>
        )}
      </CardHeader>
      <CardBody className="space-y-3">
        {err && <div className="rounded bg-rose-50 px-3 py-2 text-xs text-rose-700">{err}</div>}

        {draft && (
          <div className="space-y-2 rounded-md border border-violet-200 bg-violet-50/40 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-violet-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">AI NHÁP</span>
              <Badge variant={STRENGTH_LABEL[draft.strength]?.variant ?? "warning"}>
                {STRENGTH_LABEL[draft.strength]?.label ?? draft.strength}
              </Badge>
              <Button size="sm" className="ml-auto" disabled={accepting} onClick={accept}>
                {accepting ? "…" : "✓ Chấp nhận nháp này"}
              </Button>
            </div>
            {draft.missingItems.length > 0 && (
              <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-inset ring-amber-200">
                <div className="font-semibold">Còn thiếu:</div>
                <ul className="mt-0.5 list-disc pl-4">
                  {draft.missingItems.map((m, i) => <li key={i}>{m}</li>)}
                </ul>
              </div>
            )}
            {draft.caveats && <p className="text-xs text-slate-600">⚠ {draft.caveats}</p>}
            <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded-md bg-white p-3 text-xs text-slate-800 ring-1 ring-violet-100">
              {draft.statementMd}
            </pre>
          </div>
        )}

        {statementMd ? (
          <pre className="max-h-[32rem] overflow-y-auto whitespace-pre-wrap rounded-md bg-slate-50 p-4 text-sm text-slate-800 ring-1 ring-slate-200">
            {statementMd}
          </pre>
        ) : (
          !draft && (
            <p className="text-sm text-slate-500">
              Chưa có văn bản. AI sẽ soạn nháp theo cấu trúc 6 mục (thông tin chung → yêu cầu → diễn biến
              [dẫn chứng cứ CC-n] → căn cứ pháp lý → yêu cầu cụ thể → danh mục chứng cứ) từ dữ liệu hồ sơ.
            </p>
          )
        )}
      </CardBody>
    </Card>
  );
}
