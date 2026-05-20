"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardBody, CardHeader, CardTitle } from "@atlas/ui";

export default function CreateOrgPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    slug: "",
    type: "NHA_THAU_CHINH",
    mst: "",
    address: "",
    phone: "",
    email: "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Strip diacritics + non-[a-z0-9-] for slug field. Also handles URL paste
  // (cuts off https://, trailing slashes, paths).
  function cleanSlug(v: string) {
    return v
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "")
      .replace(/\.[a-z]{2,}$/, "")           // strip .vn/.com/.com.vn tail
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50);
  }

  function update<K extends keyof typeof form>(k: K, v: string) {
    if (k === "slug") {
      setForm((f) => ({ ...f, slug: cleanSlug(v) }));
      return;
    }
    setForm((f) => ({ ...f, [k]: v }));
    if (k === "name" && !form.slug) {
      setForm((f) => ({ ...f, slug: cleanSlug(v) }));
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const r = await fetch("/api/orgs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setBusy(false);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      // Pull the first field-level message out of Zod's flatten() if present
      const fields = j?.details?.fieldErrors as Record<string, string[]> | undefined;
      if (fields) {
        const fieldLabels: Record<string, string> = {
          name: "Tên tổ chức",
          slug: "Slug (URL)",
          type: "Vai trò",
          mst: "Mã số thuế",
          address: "Địa chỉ",
          phone: "Điện thoại",
          email: "Email",
        };
        const firstField = Object.keys(fields).find((k) => fields[k]?.length);
        if (firstField) {
          setErr(`${fieldLabels[firstField] ?? firstField}: ${fields[firstField]![0]}`);
          return;
        }
      }
      setErr(j.error ?? "Không tạo được tổ chức");
      return;
    }
    const j = await r.json();
    router.push(`/onboarding/project?orgId=${j.org.id}`);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tạo tổ chức của bạn</CardTitle>
      </CardHeader>
      <CardBody>
        <form onSubmit={submit} className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="Tên tổ chức" value={form.name} onChange={(v) => update("name", v)} required />
          <Field
            label="Slug (URL)"
            value={form.slug}
            onChange={(v) => update("slug", v)}
            required
            placeholder="viwase"
            hint="Chỉ chữ thường, số, dấu gạch. Dùng cho đường dẫn nội bộ — KHÔNG nhập https://"
          />
          <Select label="Vai trò trong ngành" value={form.type} onChange={(v) => update("type", v)} options={[
            ["CHU_DAU_TU", "Chủ đầu tư"],
            ["TU_VAN_GIAM_SAT", "Tư vấn giám sát"],
            ["TU_VAN_THIET_KE", "Tư vấn thiết kế"],
            ["NHA_THAU_CHINH", "Nhà thầu chính"],
            ["NHA_THAU_PHU", "Nhà thầu phụ"],
            ["NHA_CUNG_CAP", "Nhà cung cấp"],
          ]} />
          <Field label="Mã số thuế" value={form.mst} onChange={(v) => update("mst", v)} placeholder="0301165620" />
          <Field label="Email tổ chức" value={form.email} onChange={(v) => update("email", v)} type="email" />
          <Field label="Điện thoại" value={form.phone} onChange={(v) => update("phone", v)} />
          <div className="md:col-span-2">
            <Field label="Địa chỉ" value={form.address} onChange={(v) => update("address", v)} />
          </div>
          {err && <div className="md:col-span-2 rounded bg-rose-50 px-3 py-2 text-xs text-rose-700">{err}</div>}
          <div className="md:col-span-2">
            <Button type="submit" disabled={busy}>{busy ? "Đang tạo…" : "Tiếp theo"}</Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  hint?: string;
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
      {props.hint && <span className="mt-1 block text-[11px] text-slate-500">{props.hint}</span>}
    </label>
  );
}

function Select(props: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-700">{props.label}</span>
      <select
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
