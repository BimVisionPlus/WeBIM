/**
 * Inline edit for an Issue's mutable scalar fields.
 *
 * Render path: lives on the issue detail page beside the "Hành động" /
 * "Thông tin" sidebar cards. Click "Sửa" to flip into edit mode — fields
 * become inputs, save submits a single PATCH, cancel restores props.
 *
 * Why not a modal? The whole right-column "Thông tin" panel IS the canonical
 * view of these fields; an in-place edit reuses the user's visual anchor
 * (no context switch to a popover that obscures the issue body).
 *
 * Status moves stay on the dedicated TransitionButtons component (workflow-
 * gated). This form intentionally omits `state` to avoid bypassing the
 * workflow guards.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Badge } from "@atlas/ui";

export type IssueEditable = {
  key: string;
  title: string;
  description: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  assigneeId: string | null;
  assigneeName: string | null;
  dueDate: string | null; // ISO
  locationZone: string | null;
};

const PRIORITIES: IssueEditable["priority"][] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export function IssueEditForm({ issue, members }: { issue: IssueEditable; members: { id: string; name: string }[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [title, setTitle] = useState(issue.title);
  const [description, setDescription] = useState(issue.description ?? "");
  const [priority, setPriority] = useState(issue.priority);
  const [assigneeId, setAssigneeId] = useState(issue.assigneeId ?? "");
  const [dueDate, setDueDate] = useState(issue.dueDate ? issue.dueDate.slice(0, 10) : "");
  const [locationZone, setLocationZone] = useState(issue.locationZone ?? "");

  function reset() {
    setTitle(issue.title);
    setDescription(issue.description ?? "");
    setPriority(issue.priority);
    setAssigneeId(issue.assigneeId ?? "");
    setDueDate(issue.dueDate ? issue.dueDate.slice(0, 10) : "");
    setLocationZone(issue.locationZone ?? "");
    setErr(null);
  }

  async function save() {
    setBusy(true);
    setErr(null);
    const body: Record<string, unknown> = {};
    if (title !== issue.title) body.title = title;
    if (description !== (issue.description ?? "")) body.description = description || null;
    if (priority !== issue.priority) body.priority = priority;
    if (assigneeId !== (issue.assigneeId ?? "")) body.assigneeId = assigneeId || null;
    if (dueDate !== (issue.dueDate ? issue.dueDate.slice(0, 10) : "")) body.dueDate = dueDate || null;
    if (locationZone !== (issue.locationZone ?? "")) body.locationZone = locationZone || null;

    if (Object.keys(body).length === 0) {
      setEditing(false);
      setBusy(false);
      return;
    }
    const r = await fetch(`/api/issues/${encodeURIComponent(issue.key)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setErr(typeof j.error === "string" ? j.error : "Lưu không thành công");
      return;
    }
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <div className="flex items-center justify-between border-t border-[rgb(var(--line))] pt-2">
        <span className="text-xs text-[rgb(var(--muted))]">Sửa tiêu đề, mô tả, ưu tiên, phụ trách, vị trí, hạn xử lý</span>
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
          Sửa
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 border-t border-[rgb(var(--line))] pt-3">
      <Field label="Tiêu đề">
        <input
          className="w-full rounded-md border border-[rgb(var(--line-2))] px-2 py-1.5 text-sm"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </Field>
      <Field label="Mô tả">
        <textarea
          rows={4}
          className="w-full rounded-md border border-[rgb(var(--line-2))] px-2 py-1.5 text-sm"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>
      <Field label="Ưu tiên">
        <select
          className="w-full rounded-md border border-[rgb(var(--line-2))] px-2 py-1.5 text-sm"
          value={priority}
          onChange={(e) => setPriority(e.target.value as IssueEditable["priority"])}
        >
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Phụ trách">
        <select
          className="w-full rounded-md border border-[rgb(var(--line-2))] px-2 py-1.5 text-sm"
          value={assigneeId}
          onChange={(e) => setAssigneeId(e.target.value)}
        >
          <option value="">— Chưa phân —</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Vị trí">
        <input
          className="w-full rounded-md border border-[rgb(var(--line-2))] px-2 py-1.5 text-sm"
          value={locationZone}
          onChange={(e) => setLocationZone(e.target.value)}
          placeholder="VD: Tầng 5 - Trục A-C"
        />
      </Field>
      <Field label="Hạn xử lý">
        <input
          type="date"
          className="w-full rounded-md border border-[rgb(var(--line-2))] px-2 py-1.5 text-sm"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
      </Field>
      {err && (
        <div className="rounded bg-rose-50 px-3 py-2 text-xs text-rose-700">{err}</div>
      )}
      <div className="flex justify-end gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            reset();
            setEditing(false);
          }}
        >
          Hủy
        </Button>
        <Button size="sm" onClick={save} disabled={busy}>
          {busy ? "Đang lưu…" : "Lưu"}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-[rgb(var(--muted))]">{label}</span>
      {children}
    </label>
  );
}
