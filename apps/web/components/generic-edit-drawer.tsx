"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export type EditField =
  | { key: string; label: string; type: "text" | "number" | "date" | "datetime-local" | "textarea"; initial: string | number; required?: boolean; placeholder?: string; colSpan?: 1 | 2 | 3 }
  | { key: string; label: string; type: "select"; initial: string; options: { value: string; label: string }[]; required?: boolean; colSpan?: 1 | 2 | 3 }
  | { key: string; label: string; type: "money"; initial: string; required?: boolean; placeholder?: string; colSpan?: 1 | 2 | 3 };

/**
 * Reusable PATCH-drawer. Pass:
 *   url        — PATCH endpoint (`/api/<m>/<id>`)
 *   fields     — array of field descriptors with `initial` values
 *   triggerLabel — button text (default "Sửa chi tiết")
 *
 * Sends JSON of only fields that changed. Money fields strip non-digits.
 */
export function GenericEditDrawer({ url, fields, triggerLabel, title, testId }: { url: string; fields: EditField[]; triggerLabel?: string; title: string; testId?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const initial = Object.fromEntries(fields.map((f) => [f.key, String(f.initial)]));
  const [vals, setVals] = useState<Record<string, string>>(initial);

  function set(k: string, v: string) { setVals((s) => ({ ...s, [k]: v })); }

  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    // Send only changed fields
    const body: Record<string, unknown> = {};
    for (const f of fields) {
      const v = vals[f.key];
      const i = initial[f.key];
      if (v === i) continue;
      if (f.type === "number") body[f.key] = Number(v) || 0;
      else if (f.type === "money") body[f.key] = (v ?? "").replace(/\D/g, "") || "0";
      else if (v === "") body[f.key] = null;
      else body[f.key] = v;
    }
    if (Object.keys(body).length === 0) { setBusy(false); setOpen(false); return; }

    const res = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(typeof j.error === "string" ? j.error : "Lỗi"); return; }
    setOpen(false); router.refresh();
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="text-xs text-blue-600 hover:underline" data-testid={testId ?? "open-edit-drawer"} title="Sửa chi tiết">{triggerLabel ?? "Sửa"}</button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[rgb(var(--inverse-bg))]/40 p-4" onClick={() => setOpen(false)}>
          <form onSubmit={save} onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl rounded-lg bg-[rgb(var(--surface))] p-5 shadow-2xl" data-testid="edit-drawer">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">{title}</h3>
              <button type="button" onClick={() => setOpen(false)} className="text-xs">Hủy</button>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {fields.map((f) => {
                const cs = f.colSpan === 3 ? "md:col-span-3" : f.colSpan === 2 ? "md:col-span-2" : "";
                const common = "mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5 text-xs";
                if (f.type === "select") {
                  return (
                    <label key={f.key} className={`text-xs ${cs}`}><span className="block text-[rgb(var(--muted))]">{f.label}</span>
                      <select required={f.required} value={vals[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} className={common} name={f.key}>
                        {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </label>
                  );
                }
                if (f.type === "textarea") {
                  return (
                    <label key={f.key} className={`text-xs ${cs || "md:col-span-3"}`}><span className="block text-[rgb(var(--muted))]">{f.label}</span>
                      <textarea required={f.required} value={vals[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} rows={3} placeholder={f.placeholder} className={common} name={f.key} />
                    </label>
                  );
                }
                if (f.type === "money") {
                  return (
                    <label key={f.key} className={`text-xs ${cs}`}><span className="block text-[rgb(var(--muted))]">{f.label} (VND)</span>
                      <input required={f.required} value={vals[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder={f.placeholder} className={common} name={f.key} />
                    </label>
                  );
                }
                return (
                  <label key={f.key} className={`text-xs ${cs}`}><span className="block text-[rgb(var(--muted))]">{f.label}</span>
                    <input type={f.type} required={f.required} value={vals[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} placeholder={f.placeholder} className={common} name={f.key} />
                  </label>
                );
              })}
            </div>
            {err && <div className="mt-3 rounded border border-rose-300 bg-rose-50 p-2 text-xs text-rose-800" data-testid="edit-error">{err}</div>}
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded border border-[rgb(var(--line-2))] px-3 py-1 text-xs">Huỷ</button>
              <button type="submit" disabled={busy} className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-[rgb(var(--inverse-ink))] disabled:opacity-50" data-testid="edit-save">{busy ? "…" : "Lưu"}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
