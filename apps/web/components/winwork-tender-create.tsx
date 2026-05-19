"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function TenderCreateButton() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const fd = new FormData(e.currentTarget);
    const body: any = {};
    fd.forEach((v, k) => {
      if (typeof v === "string" && v) body[k] = v;
    });
    if (body.budgetVnd) body.budgetVnd = body.budgetVnd;
    try {
      const r = await fetch("/api/winwork/tenders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error?.formErrors?.join(", ") ?? "Tạo cơ hội thất bại");
      }
      setOpen(false);
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Lỗi");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        + Thêm cơ hội
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold">Thêm cơ hội đấu thầu</h3>
            <p className="mt-1 text-xs text-slate-500">
              Nhập thủ công khi scraper chưa kéo về.
            </p>
            <form className="mt-4 space-y-3" onSubmit={onSubmit}>
              <Field label="Tên gói thầu *" name="title" required />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Bên mời thầu" name="invitor" />
                <Field label="MST bên mời thầu" name="invitorMst" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Giá gói thầu (VND)" name="budgetVnd" type="number" />
                <Field label="Nguồn vốn" name="fundingSource" placeholder="Vốn ngân sách / ODA / Tư nhân" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tỉnh/TP" name="province" />
                <Field label="Hình thức" name="bidMethod" placeholder="Đấu thầu rộng rãi" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Ngày đóng thầu" name="closingAt" type="datetime-local" />
                <Field label="URL nguồn" name="sourceUrl" type="url" />
              </div>
              {err && <div className="rounded bg-rose-50 p-2 text-xs text-rose-700">{err}</div>}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
                >
                  Huỷ
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {busy ? "Đang lưu…" : "Lưu"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-700">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        // datetime-local needs ISO; we forward as-is and the API tolerates both forms
        className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
      />
    </label>
  );
}
