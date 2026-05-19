"use client";

// AI vision panel on NCR detail.
// - User picks a site photo from disk.
// - Browser reads → base64 → POST /api/ai/ncr/assess.
// - Qwen2.5-VL proposes severity + defect description + CAR draft.
// - Saved suggestion appears on next refresh (server-side latestSuggestion).

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button } from "@atlas/ui";

type Assessment = {
  severity: "MINOR" | "MAJOR" | "CRITICAL";
  defectDescription: string;
  rootCauseHypothesis: string | null;
  correctiveActionDraft: string | null;
  qcvnRef: string | null;
  confidence: "low" | "medium" | "high";
};

type SavedAssessment = (Assessment & { id: string; accepted: boolean; model: string; latencyMs: number }) | null;

const MAX_BYTES = 4 * 1024 * 1024;       // 4MB — VLM context budget

export function AiNcrPanel({
  issueId,
  saved,
  currentSeverity,
}: {
  issueId: string;
  saved: SavedAssessment;
  currentSeverity: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<Assessment | null>(saved);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setErr(null);
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_BYTES) {
      setErr(`Ảnh quá lớn (${(f.size / 1024 / 1024).toFixed(1)}MB) — tối đa 4MB.`);
      return;
    }
    if (!f.type.startsWith("image/")) {
      setErr("File không phải ảnh.");
      return;
    }

    const buf = await f.arrayBuffer();
    const b64 = arrayBufferToBase64(buf);
    setPreview(`data:${f.type};base64,${b64}`);
    setBusy(true);
    try {
      const r = await fetch("/api/ai/ncr/assess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueId, imageBase64: b64 }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) {
        setErr(`AI không khả dụng: ${j.reason ?? j.error ?? "lỗi không xác định"}`);
        return;
      }
      setResult(j.assessment);
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Lỗi mạng");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50/40 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="rounded bg-violet-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">AI</span>
          <span className="text-sm font-semibold text-slate-800">Gợi ý đánh giá NCR từ ảnh hiện trường</span>
        </div>
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onFile}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            {busy ? "Đang phân tích…" : result ? "Phân tích ảnh khác" : "📷 Tải ảnh hiện trường"}
          </Button>
        </div>
      </div>

      {err && <div className="mt-2 rounded bg-rose-50 px-2 py-1 text-xs text-rose-700">{err}</div>}

      {!result && !preview && !err && (
        <p className="mt-2 text-xs text-slate-500">
          Chụp/chọn ảnh sai khác hiện trường — mô hình thị giác OSS (Qwen2.5-VL) sẽ đề xuất
          mức độ, mô tả lỗi, và biện pháp khắc phục (CAR) sơ bộ. TVGS quyết định cuối cùng.
        </p>
      )}

      {preview && (
        <div className="mt-3 flex gap-3">
          <img src={preview} alt="evidence" className="h-32 w-32 rounded border border-slate-200 object-cover" />
          {busy && <span className="self-center text-xs text-slate-500">VLM đang phân tích ảnh…</span>}
        </div>
      )}

      {result && (
        <div className="mt-3 space-y-2 border-t border-violet-200 pt-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500">Đề xuất mức độ:</span>
            <Badge variant={severityVariant(result.severity)}>{result.severity}</Badge>
            {result.severity !== currentSeverity && (
              <Badge variant="warning">khác mức hiện tại: {currentSeverity}</Badge>
            )}
            <Badge variant="default">độ tin {result.confidence}</Badge>
            {result.qcvnRef && <Badge variant="info">{result.qcvnRef}</Badge>}
          </div>
          <Field label="Mô tả lỗi (AI)" value={result.defectDescription} />
          {result.rootCauseHypothesis && (
            <Field label="Nguyên nhân giả định" value={result.rootCauseHypothesis} />
          )}
          {result.correctiveActionDraft && (
            <Field label="CAR sơ bộ (cần TVGS duyệt)" value={result.correctiveActionDraft} />
          )}
        </div>
      )}

      <div className="mt-3 border-t border-violet-200 pt-2 text-[10px] text-slate-500">
        Engineer-in-loop: TVGS xác nhận mức độ chính thức trong workflow. Ảnh được phân tích cục bộ — không gửi ra ngoài.
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      <div className="col-span-1 text-xs text-slate-500">{label}</div>
      <div className="col-span-3 whitespace-pre-wrap text-sm text-slate-700">{value}</div>
    </div>
  );
}

function severityVariant(s: string) {
  if (s === "CRITICAL") return "danger" as const;
  if (s === "MAJOR") return "warning" as const;
  return "default" as const;
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk) as unknown as number[]);
  }
  return btoa(bin);
}
