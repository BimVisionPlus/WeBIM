"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@atlas/ui";

type Kind = "RFI" | "SUBMITTAL" | "NCR" | "PUNCH" | "CHANGE_ORDER" | "TASK" | "DAILY_LOG";

type StakeholderOpt = { id: string; name: string; role: string };

export function CreateIssueDialog({
  kind,
  projectId,
  stakeholders,
}: {
  kind: Kind;
  projectId: string;
  stakeholders: StakeholderOpt[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>+ Tạo {LABEL[kind]}</Button>
      {open && <Modal kind={kind} projectId={projectId} stakeholders={stakeholders} onClose={() => setOpen(false)} />}
    </>
  );
}

const LABEL: Record<Kind, string> = {
  RFI: "RFI",
  SUBMITTAL: "Submittal",
  NCR: "NCR",
  PUNCH: "Punch",
  CHANGE_ORDER: "Lệnh đổi",
  TASK: "Công việc",
  DAILY_LOG: "Nhật ký",
};

function Modal({ kind, projectId, stakeholders, onClose }: { kind: Kind; projectId: string; stakeholders: StakeholderOpt[]; onClose: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});

  function set<K extends string>(k: K, v: any) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const { url, body } = buildPayload(kind, projectId, form);
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setErr(typeof j.error === "string" ? j.error : "Không tạo được");
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
        <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold">Tạo {LABEL[kind]} mới</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">✕</button>
        </header>
        <form onSubmit={submit} className="space-y-3 px-4 py-4">
          <Field label="Tiêu đề" required value={form.title ?? ""} onChange={(v) => set("title", v)} />

          {kind === "RFI" && (
            <>
              <Textarea label="Câu hỏi" required value={form.question ?? ""} onChange={(v) => set("question", v)} />
              <Field label="Danh mục" value={form.category ?? ""} onChange={(v) => set("category", v)} placeholder="Kiến trúc / Kết cấu / MEP" />
              <OrgSelect label="Đơn vị yêu cầu" stakeholders={stakeholders} value={form.requestedById} onChange={(v) => set("requestedById", v)} required />
              <OrgSelect label="Đơn vị trả lời" stakeholders={stakeholders} value={form.respondedById} onChange={(v) => set("respondedById", v)} />
              <Field label="Hạn cần trả lời" type="date" value={form.needBy ?? ""} onChange={(v) => set("needBy", v)} />
            </>
          )}

          {kind === "SUBMITTAL" && (
            <>
              <Field label="Mục spec" value={form.specSection ?? ""} onChange={(v) => set("specSection", v)} placeholder="03 30 00 — Cast-in-Place Concrete" />
              <Field label="Vật liệu" required value={form.materialName ?? ""} onChange={(v) => set("materialName", v)} />
              <Field label="Nhà sản xuất" value={form.manufacturer ?? ""} onChange={(v) => set("manufacturer", v)} />
              <OrgSelect label="Đơn vị đệ trình" stakeholders={stakeholders} value={form.submitterOrgId} onChange={(v) => set("submitterOrgId", v)} required />
              <OrgSelect label="Đơn vị thẩm tra" stakeholders={stakeholders} value={form.reviewerOrgId} onChange={(v) => set("reviewerOrgId", v)} />
            </>
          )}

          {kind === "NCR" && (
            <>
              <Textarea label="Mô tả sai khác" value={form.description ?? ""} onChange={(v) => set("description", v)} />
              <Select label="Mức độ" required value={form.severity ?? "MAJOR"} onChange={(v) => set("severity", v)}
                options={[["MINOR", "Nhẹ"], ["MAJOR", "Trung bình"], ["CRITICAL", "Nghiêm trọng"]]} />
              <OrgSelect label="Đơn vị phát hiện" stakeholders={stakeholders} value={form.raisedByOrgId} onChange={(v) => set("raisedByOrgId", v)} required />
              <OrgSelect label="Đơn vị chịu trách nhiệm" stakeholders={stakeholders} value={form.responsibleOrgId} onChange={(v) => set("responsibleOrgId", v)} required />
              <Field label="Tham chiếu QCVN/TCVN" value={form.qcvnRef ?? ""} onChange={(v) => set("qcvnRef", v)} placeholder="QCVN 06:2022/BXD §3.2.1" />
              <Field label="Vị trí" value={form.locationZone ?? ""} onChange={(v) => set("locationZone", v)} placeholder="Tầng 12 — Khu A" />
            </>
          )}

          {kind === "PUNCH" && (
            <>
              <Field label="Hạng mục" required value={form.trade ?? ""} onChange={(v) => set("trade", v)} placeholder="Sơn / Thạch cao / ME" />
              <Field label="Khu vực" required value={form.zone ?? ""} onChange={(v) => set("zone", v)} placeholder="Căn 12A-05" />
            </>
          )}

          {kind === "CHANGE_ORDER" && (
            <>
              <Textarea label="Lý do" required value={form.reason ?? ""} onChange={(v) => set("reason", v)} />
              <Textarea label="Phạm vi thay đổi" required value={form.scopeChange ?? ""} onChange={(v) => set("scopeChange", v)} />
              <Field label="Δ Chi phí (VND, có thể âm)" type="number" required value={form.costDeltaVnd ?? ""} onChange={(v) => set("costDeltaVnd", v)} />
              <Field label="Δ Tiến độ (ngày)" type="number" value={form.scheduleDeltaDays ?? "0"} onChange={(v) => set("scheduleDeltaDays", v)} />
            </>
          )}

          {kind === "TASK" && (
            <Textarea label="Mô tả" value={form.description ?? ""} onChange={(v) => set("description", v)} />
          )}

          {err && <div className="rounded bg-rose-50 px-3 py-2 text-xs text-rose-700">{err}</div>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>Huỷ</Button>
            <Button type="submit" disabled={busy}>{busy ? "Đang tạo…" : "Tạo"}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function buildPayload(kind: Kind, projectId: string, form: Record<string, any>) {
  switch (kind) {
    case "RFI":
      return {
        url: "/api/rfi",
        body: {
          projectId,
          title: form.title,
          question: form.question,
          category: form.category || undefined,
          requestedById: form.requestedById,
          respondedById: form.respondedById || undefined,
          needBy: form.needBy || undefined,
        },
      };
    case "SUBMITTAL":
      return {
        url: "/api/submittals",
        body: {
          projectId,
          title: form.title,
          specSection: form.specSection || undefined,
          materialName: form.materialName,
          manufacturer: form.manufacturer || undefined,
          submitterOrgId: form.submitterOrgId,
          reviewerOrgId: form.reviewerOrgId || undefined,
        },
      };
    case "NCR":
      return {
        url: "/api/ncr",
        body: {
          projectId,
          title: form.title,
          description: form.description || undefined,
          severity: form.severity ?? "MAJOR",
          raisedByOrgId: form.raisedByOrgId,
          responsibleOrgId: form.responsibleOrgId,
          qcvnRef: form.qcvnRef || undefined,
          locationZone: form.locationZone || undefined,
        },
      };
    case "PUNCH":
      return {
        url: "/api/punch",
        body: { projectId, title: form.title, trade: form.trade, zone: form.zone },
      };
    case "CHANGE_ORDER":
      return {
        url: "/api/change-orders",
        body: {
          projectId,
          title: form.title,
          reason: form.reason,
          scopeChange: form.scopeChange,
          costDeltaVnd: form.costDeltaVnd,
          scheduleDeltaDays: Number(form.scheduleDeltaDays ?? 0),
        },
      };
    case "TASK":
      return {
        url: "/api/issues",
        body: { projectId, type: "TASK", title: form.title, description: form.description || undefined },
      };
    default:
      return { url: "/api/issues", body: { projectId, type: "TASK", title: form.title } };
  }
}

function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-700">{props.label}</span>
      <input
        type={props.type ?? "text"}
        required={props.required}
        placeholder={props.placeholder}
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </label>
  );
}

function Textarea(props: { label: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-700">{props.label}</span>
      <textarea
        required={props.required}
        rows={3}
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </label>
  );
}

function Select(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-700">{props.label}</span>
      <select
        required={props.required}
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      >
        {props.options.map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>
    </label>
  );
}

function OrgSelect(props: {
  label: string;
  stakeholders: StakeholderOpt[];
  value?: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-700">{props.label}</span>
      <select
        required={props.required}
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        value={props.value ?? ""}
        onChange={(e) => props.onChange(e.target.value)}
      >
        <option value="">— chọn —</option>
        {props.stakeholders.map((s) => (
          <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
        ))}
      </select>
    </label>
  );
}
