"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export type ProjectOpt = { id: string; key: string; name: string };
export type UserOpt = { id: string; name: string | null; email: string };

export function StartRun({
  templateId,
  projects,
}: {
  templateId: string;
  projects: ProjectOpt[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [err, setErr] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/processes/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId, projectId: projectId || undefined }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErr(typeof body.error === "string" ? body.error : "Không áp dụng được");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={projectId}
        onChange={(event) => setProjectId(event.target.value)}
        className="rounded border border-[rgb(var(--line-2))] px-2 py-1 text-xs"
      >
        <option value="">Không gắn dự án</option>
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.key}
          </option>
        ))}
      </select>
      <button
        onClick={start}
        disabled={busy}
        className="rounded bg-blue-600 px-2.5 py-1 text-xs font-medium text-[rgb(var(--inverse-ink))]"
        data-testid={`start-run-${templateId}`}
      >
        {busy ? "Đang áp dụng…" : "Áp dụng"}
      </button>
      {err && <span className="text-xs text-rose-700">{err}</span>}
    </div>
  );
}

export function TaskRow({
  taskId,
  assigneeUserId,
  progress,
  status,
  users,
}: {
  taskId: string;
  assigneeUserId: string | null;
  progress: number;
  status: string;
  users: UserOpt[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    await fetch("/api/processes/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, ...body }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={assigneeUserId ?? ""}
        disabled={busy}
        onChange={(event) => patch({ assigneeUserId: event.target.value || null })}
        className="rounded border border-[rgb(var(--line-2))] px-2 py-1 text-xs"
        data-testid={`assignee-${taskId}`}
      >
        <option value="">Chưa giao</option>
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name ?? user.email}
          </option>
        ))}
      </select>
      <select
        value={status}
        disabled={busy}
        onChange={(event) => patch({ status: event.target.value })}
        className="rounded border border-[rgb(var(--line-2))] px-2 py-1 text-xs"
        data-testid={`status-${taskId}`}
      >
        <option value="PENDING">Chưa bắt đầu</option>
        <option value="IN_PROGRESS">Đang làm</option>
        <option value="DONE">Xong</option>
        <option value="BLOCKED">Tắc</option>
      </select>
      <input
        type="number"
        min={0}
        max={100}
        defaultValue={progress}
        disabled={busy}
        onBlur={(event) => {
          const value = Number(event.target.value);
          if (value !== progress) patch({ progress: Math.max(0, Math.min(100, value)) });
        }}
        className="w-16 rounded border border-[rgb(var(--line-2))] px-2 py-1 text-xs"
        data-testid={`progress-${taskId}`}
      />
      <span className="text-xs text-[rgb(var(--muted))]">%</span>
    </div>
  );
}
