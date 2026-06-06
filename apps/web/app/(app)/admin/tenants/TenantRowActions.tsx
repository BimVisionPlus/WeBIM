"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function TenantRowActions({ tenantId, slug, status }: { tenantId: string; slug: string; status: string }) {
  const r = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function action(verb: "extend" | "archive" | "convert" | "expire") {
    if (verb === "archive" && !confirm(`Archive tenant ${slug}? Dữ liệu sẽ bị xoá vĩnh viễn sau 7 ngày.`)) return;
    setBusy(verb);
    const res = await fetch(`/api/tenant/${tenantId}/${verb}`, { method: "POST" });
    setBusy(null);
    if (!res.ok) { const j = await res.json().catch(() => ({})); alert(j.error ?? "Không thực hiện được"); return; }
    r.refresh();
  }

  return (
    <div className="flex flex-wrap gap-1 text-xs">
      {status === "ACTIVE" && (
        <button onClick={() => action("extend")} disabled={busy !== null} className="rounded border border-emerald-300 px-2 py-0.5 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50">
          {busy === "extend" ? "..." : "+7 ngày"}
        </button>
      )}
      {(status === "ACTIVE" || status === "EXPIRED") && (
        <button onClick={() => action("convert")} disabled={busy !== null} className="rounded border border-blue-300 px-2 py-0.5 text-blue-700 hover:bg-blue-50 disabled:opacity-50">
          {busy === "convert" ? "..." : "→ Pro"}
        </button>
      )}
      {status === "ACTIVE" && (
        <button onClick={() => action("expire")} disabled={busy !== null} className="rounded border border-amber-300 px-2 py-0.5 text-amber-700 hover:bg-amber-50 disabled:opacity-50">
          {busy === "expire" ? "..." : "Hết hạn"}
        </button>
      )}
      {status !== "ARCHIVED" && (
        <button onClick={() => action("archive")} disabled={busy !== null} className="rounded border border-rose-300 px-2 py-0.5 text-rose-700 hover:bg-rose-50 disabled:opacity-50">
          {busy === "archive" ? "..." : "Archive"}
        </button>
      )}
    </div>
  );
}
