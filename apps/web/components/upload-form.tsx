"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@atlas/ui";

export function UploadForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [discipline, setDiscipline] = useState("KIEN_TRUC");
  const [revision, setRevision] = useState("v1");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return setErr("Chọn file trước");
    setBusy(true);
    setErr(null);
    try {
      // 1. Ask server for a presigned PUT URL
      const presign = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          kind: "models",
          filename: file.name,
          contentType: file.type || "application/octet-stream",
        }),
      });
      if (!presign.ok) throw new Error("Không lấy được presigned URL");
      const { uploadUrl, key } = await presign.json();

      // 2. PUT to S3/MinIO (browser-direct)
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (ev) =>
          ev.lengthComputable && setProgress(Math.round((ev.loaded / ev.total) * 100));
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("S3 upload failed")));
        xhr.onerror = () => reject(new Error("Network error"));
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
        xhr.send(file);
      });

      // 3. Create Model row + enqueue APS translation
      const create = await fetch("/api/drawings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          name: name || file.name,
          discipline,
          revision,
          fileKey: key,
          fileSizeBytes: file.size,
          fileName: file.name,
        }),
      });
      if (!create.ok) throw new Error("Không tạo được record");

      router.push(`/projects/${projectId}/models`);
      router.refresh();
    } catch (e: any) {
      setErr(e.message ?? "Lỗi không xác định");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Tên hiển thị">
        <input
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="VHGP-S9_Federated_v13.nwd"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Bộ môn">
          <select
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={discipline}
            onChange={(e) => setDiscipline(e.target.value)}
          >
            <option value="KIEN_TRUC">Kiến trúc</option>
            <option value="KET_CAU">Kết cấu</option>
            <option value="CO_DIEN_M">Cơ điện (M)</option>
            <option value="CO_DIEN_E">Cơ điện (E)</option>
            <option value="CO_DIEN_P">Cơ điện (P)</option>
            <option value="PCCC">PCCC</option>
            <option value="HA_TANG">Hạ tầng</option>
          </select>
        </Field>
        <Field label="Revision">
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={revision}
            onChange={(e) => setRevision(e.target.value)}
          />
        </Field>
      </div>
      <Field label="Tệp">
        <input
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          accept=".ifc,.rvt,.rfa,.nwd,.nwc,.dwg,.dxf,.pdf"
          className="w-full text-sm"
        />
      </Field>
      {file && (
        <div className="text-xs text-slate-500">
          {file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB
        </div>
      )}
      {busy && (
        <div>
          <div className="h-2 w-full rounded bg-slate-100">
            <div className="h-2 rounded bg-blue-500" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-1 text-xs text-slate-500">{progress}%</div>
        </div>
      )}
      {err && <div className="text-xs text-rose-600">{err}</div>}
      <Button type="submit" disabled={busy || !file}>
        {busy ? "Đang tải lên…" : "Tải lên"}
      </Button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-700">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
