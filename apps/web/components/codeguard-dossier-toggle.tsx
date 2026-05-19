"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Status = "MISSING" | "DRAFT" | "SUBMITTED" | "ACCEPTED" | "REJECTED";

const order: Status[] = ["MISSING", "DRAFT", "SUBMITTED", "ACCEPTED", "REJECTED"];

const variantClass: Record<Status, string> = {
  MISSING: "bg-rose-50 text-rose-700 ring-rose-200",
  DRAFT: "bg-slate-100 text-slate-700 ring-slate-200",
  SUBMITTED: "bg-blue-50 text-blue-700 ring-blue-200",
  ACCEPTED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  REJECTED: "bg-amber-50 text-amber-700 ring-amber-200",
};

export function DossierStatusToggle({
  projectId,
  itemCode,
  status,
}: {
  projectId: string;
  itemCode: string;
  status: Status;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [cur, setCur] = useState<Status>(status);

  async function go(next: Status) {
    setBusy(true);
    setCur(next);
    try {
      await fetch(`/api/codeguard/dossier/${projectId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ itemCode, status: next }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <select
      disabled={busy}
      value={cur}
      onChange={(e) => go(e.target.value as Status)}
      className={`rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${variantClass[cur]} focus:outline-none disabled:opacity-50`}
    >
      {order.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}
