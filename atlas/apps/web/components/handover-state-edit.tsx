/**
 * Handover ticket row: state transition + edit drawer.
 *
 * State moves are exposed as one-click buttons mapped to the legal next
 * state (mirrors the API's lifecycle logic). For edits to title/severity
 * the user opens an inline drawer with text inputs.
 *
 * Allowed transitions table (matches the API's side-effects):
 *   NEW            → TRIAGED · REJECTED
 *   TRIAGED        → IN_PROGRESS · REJECTED
 *   IN_PROGRESS    → AWAITING_PARTS · RECTIFIED · REJECTED
 *   AWAITING_PARTS → IN_PROGRESS · RECTIFIED · REJECTED
 *   RECTIFIED      → VERIFIED · IN_PROGRESS (rework) · REJECTED
 *   VERIFIED       → CLOSED
 *   REJECTED       → (terminal)
 *   CLOSED         → (terminal — API will 409)
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@atlas/ui";

type State =
  | "NEW"
  | "TRIAGED"
  | "IN_PROGRESS"
  | "AWAITING_PARTS"
  | "RECTIFIED"
  | "VERIFIED"
  | "REJECTED"
  | "CLOSED";

const NEXT: Record<State, { state: State; label: string; tone: "primary" | "ghost" | "danger" }[]> = {
  NEW: [
    { state: "TRIAGED", label: "Phân loại", tone: "primary" },
    { state: "REJECTED", label: "Từ chối", tone: "danger" },
  ],
  TRIAGED: [
    { state: "IN_PROGRESS", label: "Bắt đầu xử lý", tone: "primary" },
    { state: "REJECTED", label: "Từ chối", tone: "danger" },
  ],
  IN_PROGRESS: [
    { state: "AWAITING_PARTS", label: "Đợi vật tư", tone: "ghost" },
    { state: "RECTIFIED", label: "Đã khắc phục", tone: "primary" },
    { state: "REJECTED", label: "Từ chối", tone: "danger" },
  ],
  AWAITING_PARTS: [
    { state: "IN_PROGRESS", label: "Vật tư đến, tiếp tục", tone: "primary" },
    { state: "RECTIFIED", label: "Đã khắc phục", tone: "primary" },
    { state: "REJECTED", label: "Từ chối", tone: "danger" },
  ],
  RECTIFIED: [
    { state: "VERIFIED", label: "CĐT/cư dân xác nhận", tone: "primary" },
    { state: "IN_PROGRESS", label: "Cần sửa lại", tone: "ghost" },
    { state: "REJECTED", label: "Từ chối", tone: "danger" },
  ],
  VERIFIED: [{ state: "CLOSED", label: "Đóng ticket", tone: "primary" }],
  REJECTED: [],
  CLOSED: [],
};

type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type HandoverTicketLite = {
  id: string;
  ticketNumber: string;
  state: State;
  severity: Severity;
  title: string;
  description: string | null;
};

export function HandoverStateEdit({ ticket }: { ticket: HandoverTicketLite }) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "move" | "edit">(null);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(ticket.title);
  const [description, setDescription] = useState(ticket.description ?? "");
  const [severity, setSeverity] = useState(ticket.severity);

  const moves = NEXT[ticket.state] ?? [];

  async function move(to: State) {
    setBusy("move");
    setErr(null);
    const r = await fetch(`/api/handover/${ticket.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: to }),
    });
    setBusy(null);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setErr(typeof j.error === "string" ? j.error : "Chuyển trạng thái không thành công");
      return;
    }
    router.refresh();
  }

  async function saveEdit() {
    setBusy("edit");
    setErr(null);
    const body: Record<string, unknown> = {};
    if (title !== ticket.title) body.title = title;
    if (description !== (ticket.description ?? "")) body.description = description || null;
    if (severity !== ticket.severity) body.severity = severity;
    if (Object.keys(body).length === 0) {
      setEditing(false);
      setBusy(null);
      return;
    }
    const r = await fetch(`/api/handover/${ticket.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(null);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setErr(typeof j.error === "string" ? j.error : "Sửa không thành công");
      return;
    }
    setEditing(false);
    router.refresh();
  }

  return (
    <div className="space-y-2 py-1">
      {!editing && (
        <div className="flex flex-wrap items-center gap-1">
          {moves.map((m) => (
            <Button
              key={m.state}
              size="sm"
              variant={m.tone === "primary" ? "primary" : m.tone === "danger" ? "danger" : "ghost"}
              disabled={busy !== null}
              onClick={() => move(m.state)}
            >
              {m.label}
            </Button>
          ))}
          {ticket.state !== "CLOSED" && ticket.state !== "REJECTED" && (
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              Sửa nội dung
            </Button>
          )}
          {moves.length === 0 && (
            <span className="text-[11px] text-[rgb(var(--muted))]">Trạng thái kết thúc</span>
          )}
        </div>
      )}

      {editing && (
        <div className="space-y-2 rounded-md border border-[rgb(var(--line))] bg-[rgb(var(--raised))] p-3">
          <label className="block space-y-1">
            <span className="text-[10px] font-medium uppercase tracking-wide text-[rgb(var(--muted))]">
              Tiêu đề
            </span>
            <input
              className="w-full rounded-md border border-[rgb(var(--line-2))] px-2 py-1.5 text-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[10px] font-medium uppercase tracking-wide text-[rgb(var(--muted))]">
              Mô tả
            </span>
            <textarea
              rows={3}
              className="w-full rounded-md border border-[rgb(var(--line-2))] px-2 py-1.5 text-sm"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[10px] font-medium uppercase tracking-wide text-[rgb(var(--muted))]">
              Mức độ
            </span>
            <select
              className="rounded-md border border-[rgb(var(--line-2))] px-2 py-1.5 text-sm"
              value={severity}
              onChange={(e) => setSeverity(e.target.value as Severity)}
            >
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
              <option value="CRITICAL">CRITICAL</option>
            </select>
          </label>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Hủy
            </Button>
            <Button size="sm" onClick={saveEdit} disabled={busy !== null}>
              {busy === "edit" ? "Đang lưu…" : "Lưu"}
            </Button>
          </div>
        </div>
      )}

      {err && (
        <div className="rounded bg-rose-50 px-2 py-1.5 text-[11px] text-rose-700">{err}</div>
      )}
    </div>
  );
}
