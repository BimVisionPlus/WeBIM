// Pane THÀNH VIÊN — nhân sự và phân quyền của CHÍNH DỰ ÁN NÀY.
//
// Khác pane "Nhân sự" (Atlas — hồ sơ nhân sự công ty): đây là câu hỏi "ai
// được chạm vào dự án này, với quyền gì". Câu trả lời nằm ở máy chủ nền
// tảng và được CƯỠNG CHẾ ở đó — sync, file, danh sách file đều chặn theo
// thành viên; pane này chỉ là chỗ nhìn và bấm.

import { useCallback, useEffect, useState } from "react";
import { apiBase } from "../config";
import { authHeaders, store, useStoreVersion } from "../state/store";

interface MembersInfo {
  registered: boolean;
  owner: string | null;
  members: Record<string, string>;
  you: { scope: "open" | "project"; role: string | null };
}

const ROLE_LABEL: Record<string, string> = {
  owner: "Chủ dự án",
  editor: "Editor — sửa mô hình, nộp file",
  viewer: "Viewer — chỉ xem",
};

export function MembersModule() {
  useStoreVersion();
  const projectId = store.project.id;
  const [info, setInfo] = useState<MembersInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newUser, setNewUser] = useState("");
  const [newRole, setNewRole] = useState("editor");

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch(
        `${apiBase()}/projects/${encodeURIComponent(projectId)}/members`,
        { headers: authHeaders() },
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Lỗi ${response.status}`);
      }
      setInfo((await response.json()) as MembersInfo);
      // Quyền của chính mình có thể vừa đổi (claim, bị hạ quyền…) — banner
      // và khoá công cụ phải đổi theo ngay, không chờ reload.
      void store.refreshProjectRole();
    } catch (err) {
      setInfo(null);
      setError(
        err instanceof Error && err.message !== "Failed to fetch"
          ? err.message
          : "Chưa kết nối được máy chủ nền tảng — chế độ độc lập không có phân quyền.",
      );
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const call = async (run: () => Promise<Response>) => {
    setBusy(true);
    setError(null);
    try {
      const response = await run();
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Lỗi ${response.status}`);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const claim = () =>
    call(() =>
      fetch(`${apiBase()}/projects/${encodeURIComponent(projectId)}/claim`, {
        method: "POST",
        headers: authHeaders(),
      }),
    );

  const setMember = (username: string, role: string) =>
    call(() =>
      fetch(`${apiBase()}/projects/${encodeURIComponent(projectId)}/members`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ username, role }),
      }),
    );

  const removeMember = (username: string) =>
    call(() =>
      fetch(
        `${apiBase()}/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(username)}`,
        { method: "DELETE", headers: authHeaders() },
      ),
    );

  const isOwner = info?.you.role === "owner";

  return (
    <div className="module-host">
      <h2>Thành viên dự án</h2>
      <p className="module-hint">
        Quyền theo TỪNG DỰ ÁN, cưỡng chế ở máy chủ: dự án đã đăng ký thì chỉ
        chủ dự án, thành viên được mời và admin hệ thống đồng bộ được mô hình
        hay chạm vào file — người ngoài có link cũng không tải nổi. Dự án
        chưa đăng ký chạy chế độ mở như trước (quyền toàn cục
        admin/editor/viewer).
      </p>

      {error && <p className="module-hint members-error">⚠ {error}</p>}

      {info && !info.registered && (
        <div className="module-form">
          <span>
            Dự án này đang ở <strong>chế độ mở</strong> — ai đăng nhập máy chủ
            cũng thao tác được theo quyền toàn cục của họ.
          </span>
          {store.auth && (
            <button disabled={busy} onClick={() => void claim()}>
              Đăng ký dự án riêng tư (bạn làm chủ)
            </button>
          )}
        </div>
      )}

      {info?.registered && (
        <>
          <p className="module-hint">
            Chủ dự án: <strong>{info.owner}</strong> · Bạn:{" "}
            <strong>{ROLE_LABEL[info.you.role ?? ""] ?? "không phải thành viên"}</strong>
          </p>
          <table className="data-table">
            <thead>
              <tr>
                <th>Tài khoản</th>
                <th>Quyền</th>
                {isOwner && <th />}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{info.owner}</td>
                <td>{ROLE_LABEL.owner}</td>
                {isOwner && <td />}
              </tr>
              {Object.entries(info.members).map(([username, role]) => (
                <tr key={username}>
                  <td>{username}</td>
                  <td>
                    {isOwner ? (
                      <select
                        value={role}
                        disabled={busy}
                        onChange={(event) => void setMember(username, event.target.value)}
                      >
                        <option value="editor">editor</option>
                        <option value="viewer">viewer</option>
                      </select>
                    ) : (
                      (ROLE_LABEL[role] ?? role)
                    )}
                  </td>
                  {isOwner && (
                    <td>
                      <button
                        className="mini"
                        disabled={busy}
                        onClick={() => void removeMember(username)}
                        title="Xoá khỏi dự án"
                      >
                        ×
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {isOwner && (
            <div className="module-form">
              <input
                placeholder="Tài khoản trên máy chủ"
                value={newUser}
                onChange={(event) => setNewUser(event.target.value)}
              />
              <select value={newRole} onChange={(event) => setNewRole(event.target.value)}>
                <option value="editor">editor</option>
                <option value="viewer">viewer</option>
              </select>
              <button
                disabled={busy || !newUser.trim()}
                onClick={() => {
                  void setMember(newUser.trim(), newRole).then(() => setNewUser(""));
                }}
              >
                Mời vào dự án
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
