/**
 * Daily Log row controls: Edit + CDT/GS sign + status.
 *
 * Sits in the header of each DailyLog card. Three concerns in one component
 * because they share the same row state and need to coordinate (you can't
 * edit a signed log; signing locks edit).
 *
 * Sign UX is two-step because NĐ 06/2021 Điều 10 requires *two* signatures
 * (giám sát thi công CĐT + TVGS). The component renders one button per role
 * with separate handlers; the API returns `signedAt` set when both are in.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Badge } from "@atlas/ui";

export type DailyLogRow = {
  id: string;
  weather: string | null;
  workforce: { trade: string; count: number }[];
  workDone: string;
  workTomorrow: string | null;
  safetyNotes: string | null;
  signoffByCdtId: string | null;
  signoffByGsId: string | null;
  signedAt: string | null; // ISO when fully signed
};

export function DailyLogControls({ log }: { log: DailyLogRow }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<null | "save" | "sign-cdt" | "sign-gs">(null);
  const [err, setErr] = useState<string | null>(null);

  const [weather, setWeather] = useState(log.weather ?? "");
  const [workforceText, setWorkforceText] = useState(
    log.workforce.map((w) => `${w.trade}:${w.count}`).join(", "),
  );
  const [workDone, setWorkDone] = useState(log.workDone);
  const [workTomorrow, setWorkTomorrow] = useState(log.workTomorrow ?? "");
  const [safetyNotes, setSafetyNotes] = useState(log.safetyNotes ?? "");

  function parseWorkforce(s: string): { trade: string; count: number }[] {
    return s
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => {
        const [trade, count] = p.split(":").map((x) => x.trim());
        return { trade: trade ?? "", count: Number(count) || 0 };
      })
      .filter((w) => w.trade);
  }

  async function save() {
    setBusy("save");
    setErr(null);
    const body = {
      weather: weather || null,
      workforce: parseWorkforce(workforceText),
      workDone,
      workTomorrow: workTomorrow || null,
      safetyNotes: safetyNotes || null,
    };
    const r = await fetch(`/api/daily-log/${log.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(null);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setErr(typeof j.error === "string" ? j.error : "Lưu không thành công");
      return;
    }
    setEditing(false);
    router.refresh();
  }

  async function sign(role: "CDT" | "GS") {
    setBusy(role === "CDT" ? "sign-cdt" : "sign-gs");
    setErr(null);
    const r = await fetch(`/api/daily-log/${log.id}/sign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    setBusy(null);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setErr(typeof j.error === "string" ? j.error : "Ký không thành công");
      return;
    }
    router.refresh();
  }

  const isSigned = !!log.signedAt;

  // ─── View mode ─────────────────────────────────────────────────────────
  if (!editing) {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <SignStatus log={log} />
          {!isSigned && (
            <>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy !== null}
                onClick={() => sign("CDT")}
              >
                {busy === "sign-cdt" ? "…" : log.signoffByCdtId ? "✓ Đã ký GSCĐT" : "Ký GSCĐT"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy !== null}
                onClick={() => sign("GS")}
              >
                {busy === "sign-gs" ? "…" : log.signoffByGsId ? "✓ Đã ký TVGS" : "Ký TVGS"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                Sửa
              </Button>
            </>
          )}
        </div>
        {err && (
          <div className="rounded bg-rose-50 px-3 py-2 text-xs text-rose-700">{err}</div>
        )}
      </div>
    );
  }

  // ─── Edit mode ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-2 rounded-md border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-[10px] font-medium uppercase tracking-wide text-[rgb(var(--muted))]">
            Thời tiết
          </span>
          <input
            className="w-full rounded-md border border-[rgb(var(--line-2))] px-2 py-1.5 text-sm"
            value={weather}
            onChange={(e) => setWeather(e.target.value)}
            placeholder="VD: Nắng 32°C"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-[10px] font-medium uppercase tracking-wide text-[rgb(var(--muted))]">
            Nhân lực (trade:count, ngăn cách bởi dấu phẩy)
          </span>
          <input
            className="w-full rounded-md border border-[rgb(var(--line-2))] px-2 py-1.5 text-sm"
            value={workforceText}
            onChange={(e) => setWorkforceText(e.target.value)}
            placeholder="thợ sắt:12, thợ hồ:8"
          />
        </label>
      </div>
      <label className="block space-y-1">
        <span className="text-[10px] font-medium uppercase tracking-wide text-[rgb(var(--muted))]">
          Công việc đã làm
        </span>
        <textarea
          rows={3}
          className="w-full rounded-md border border-[rgb(var(--line-2))] px-2 py-1.5 text-sm"
          value={workDone}
          onChange={(e) => setWorkDone(e.target.value)}
        />
      </label>
      <label className="block space-y-1">
        <span className="text-[10px] font-medium uppercase tracking-wide text-[rgb(var(--muted))]">
          Kế hoạch ngày mai
        </span>
        <textarea
          rows={2}
          className="w-full rounded-md border border-[rgb(var(--line-2))] px-2 py-1.5 text-sm"
          value={workTomorrow}
          onChange={(e) => setWorkTomorrow(e.target.value)}
        />
      </label>
      <label className="block space-y-1">
        <span className="text-[10px] font-medium uppercase tracking-wide text-[rgb(var(--muted))]">
          An toàn / Ghi chú
        </span>
        <textarea
          rows={2}
          className="w-full rounded-md border border-[rgb(var(--line-2))] px-2 py-1.5 text-sm"
          value={safetyNotes}
          onChange={(e) => setSafetyNotes(e.target.value)}
        />
      </label>
      {err && (
        <div className="rounded bg-rose-50 px-3 py-2 text-xs text-rose-700">{err}</div>
      )}
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
          Hủy
        </Button>
        <Button size="sm" onClick={save} disabled={busy !== null}>
          {busy === "save" ? "Đang lưu…" : "Lưu"}
        </Button>
      </div>
    </div>
  );
}

function SignStatus({ log }: { log: DailyLogRow }) {
  if (log.signedAt) {
    return <Badge variant="success">Đã ký đủ 2 bên</Badge>;
  }
  const cdt = !!log.signoffByCdtId;
  const gs = !!log.signoffByGsId;
  if (cdt && !gs) return <Badge variant="warning">CĐT ký · chờ TVGS</Badge>;
  if (!cdt && gs) return <Badge variant="warning">TVGS ký · chờ CĐT</Badge>;
  return <Badge variant="warning">Chưa ký</Badge>;
}
