"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DossierSeedButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true);
    try {
      await fetch(`/api/codeguard/dossier/${projectId}/seed`, { method: "POST" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={go}
      disabled={busy}
      className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
    >
      {busy ? "Đang khởi tạo…" : "Khởi tạo theo NĐ 15/2021"}
    </button>
  );
}
