/**
 * Crew CRUD: create (modal), edit (inline form per row), deactivate.
 *
 * Two components exported:
 *   - <CrewCreateButton projectId=…/>   header-level "+ Thêm tổ" button
 *   - <CrewRowEdit crew=… />            per-row pencil button + drawer
 *
 * Lookahead assignments are NOT edited here — they have their own PATCH
 * endpoint at /api/crews/assignments (already exists in the codebase).
 * This file only covers the crew master-data table.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@atlas/ui";

const TRADES = [
  "Thợ sắt",
  "Thợ hồ",
  "Thợ điện",
  "Thợ nước",
  "Thợ sơn",
  "Thợ mộc",
  "Thợ hàn",
  "Lao động phổ thông",
  "Tổ hỗn hợp",
];

type CrewLite = {
  id: string;
  name: string;
  trade: string;
  foremanName: string | null;
  headcount: number;
  active: boolean;
};

export function CrewCreateButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [trade, setTrade] = useState(TRADES[0]);
  const [foreman, setForeman] = useState("");
  const [headcount, setHeadcount] = useState(0);

  async function submit() {
    setBusy(true);
    setErr(null);
    const r = await fetch("/api/crews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        name,
        trade,
        foremanName: foreman || undefined,
        headcount,
      }),
    });
    setBusy(false);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setErr(typeof j.error === "string" ? j.error : "Tạo tổ không thành công");
      return;
    }
    setOpen(false);
    setName("");
    setForeman("");
    setHeadcount(0);
    router.refresh();
  }

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        + Thêm tổ
      </Button>
    );
  }

  return (
    <div className="rounded-md border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-3 shadow-sm">
      <div className="mb-2 text-sm font-semibold text-[rgb(var(--ink))]">Thêm tổ đội mới</div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Field label="Tên tổ">
          <input
            className="w-full rounded-md border border-[rgb(var(--line-2))] px-2 py-1.5 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tổ thợ sắt #1"
          />
        </Field>
        <Field label="Nghề">
          <select
            className="w-full rounded-md border border-[rgb(var(--line-2))] px-2 py-1.5 text-sm"
            value={trade}
            onChange={(e) => setTrade(e.target.value)}
          >
            {TRADES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Tổ trưởng">
          <input
            className="w-full rounded-md border border-[rgb(var(--line-2))] px-2 py-1.5 text-sm"
            value={foreman}
            onChange={(e) => setForeman(e.target.value)}
            placeholder="Nguyễn Văn A"
          />
        </Field>
        <Field label="Số người">
          <input
            type="number"
            min={0}
            className="w-full rounded-md border border-[rgb(var(--line-2))] px-2 py-1.5 text-sm"
            value={headcount}
            onChange={(e) => setHeadcount(Number(e.target.value))}
          />
        </Field>
      </div>
      {err && <div className="mt-2 rounded bg-rose-50 px-3 py-2 text-xs text-rose-700">{err}</div>}
      <div className="mt-3 flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Hủy
        </Button>
        <Button size="sm" onClick={submit} disabled={busy || !name.trim()}>
          {busy ? "Đang tạo…" : "Tạo tổ"}
        </Button>
      </div>
    </div>
  );
}

export function CrewRowEdit({ crew }: { crew: CrewLite }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [name, setName] = useState(crew.name);
  const [trade, setTrade] = useState(crew.trade);
  const [foreman, setForeman] = useState(crew.foremanName ?? "");
  const [headcount, setHeadcount] = useState(crew.headcount);

  async function save() {
    setBusy("save");
    setErr(null);
    const body: Record<string, unknown> = {};
    if (name !== crew.name) body.name = name;
    if (trade !== crew.trade) body.trade = trade;
    if (foreman !== (crew.foremanName ?? "")) body.foremanName = foreman || null;
    if (headcount !== crew.headcount) body.headcount = headcount;

    if (Object.keys(body).length === 0) {
      setEditing(false);
      setBusy(null);
      return;
    }
    const r = await fetch(`/api/crews/${crew.id}`, {
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

  async function remove() {
    if (!confirm(`Đánh dấu "${crew.name}" là ngừng hoạt động? Lịch sử ca/việc vẫn lưu.`)) return;
    setBusy("delete");
    setErr(null);
    const r = await fetch(`/api/crews/${crew.id}`, { method: "DELETE" });
    setBusy(null);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setErr(typeof j.error === "string" ? j.error : "Xóa không thành công");
      return;
    }
    router.refresh();
  }

  if (!editing) {
    return (
      <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
        Sửa
      </Button>
    );
  }

  return (
    <div className="mt-2 rounded-md border border-[rgb(var(--line))] bg-[rgb(var(--raised))] p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Field label="Tên tổ">
          <input
            className="w-full rounded-md border border-[rgb(var(--line-2))] px-2 py-1.5 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Nghề">
          <select
            className="w-full rounded-md border border-[rgb(var(--line-2))] px-2 py-1.5 text-sm"
            value={trade}
            onChange={(e) => setTrade(e.target.value)}
          >
            {TRADES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Tổ trưởng">
          <input
            className="w-full rounded-md border border-[rgb(var(--line-2))] px-2 py-1.5 text-sm"
            value={foreman}
            onChange={(e) => setForeman(e.target.value)}
          />
        </Field>
        <Field label="Số người">
          <input
            type="number"
            min={0}
            className="w-full rounded-md border border-[rgb(var(--line-2))] px-2 py-1.5 text-sm"
            value={headcount}
            onChange={(e) => setHeadcount(Number(e.target.value))}
          />
        </Field>
      </div>
      {err && <div className="mt-2 rounded bg-rose-50 px-3 py-2 text-xs text-rose-700">{err}</div>}
      <div className="mt-3 flex justify-between gap-2">
        <Button size="sm" variant="ghost" onClick={remove} disabled={busy !== null}>
          {busy === "delete" ? "…" : "Ngừng hoạt động"}
        </Button>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Hủy
          </Button>
          <Button size="sm" onClick={save} disabled={busy !== null}>
            {busy === "save" ? "Đang lưu…" : "Lưu"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] font-medium uppercase tracking-wide text-[rgb(var(--muted))]">{label}</span>
      {children}
    </label>
  );
}
