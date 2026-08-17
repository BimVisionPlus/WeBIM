// Pane API & WEBHOOK — cửa cho MÁY vào dự án.
//
// Hai thứ, hai phạm vi:
//   - API key: CỦA BẠN (mọi dự án bạn có quyền) — CI/script gọi API bằng
//     key này, enforcement đi đúng đường của tài khoản bạn.
//   - Webhook: CỦA DỰ ÁN hiện tại (owner quản lý) — sự kiện file.put /
//     state.push bắn sang hệ thống ngoài, ký HMAC.
//
// Key và secret hiển thị ĐÚNG MỘT LẦN lúc tạo — UI phải nói to điều đó
// thay vì để người dùng phát hiện ra khi quay lại tìm.

import { useCallback, useEffect, useState } from "react";
import { apiBase } from "../config";
import { authHeaders, store, useStoreVersion } from "../state/store";

interface ApiKeyRow {
  id: string;
  label: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}

interface WebhookRow {
  id: string;
  url: string;
  events: string[];
  createdAt: string;
  lastStatus: number | string | null;
  lastAt: string | null;
}

const day = (iso: string | null) => (iso ? iso.slice(0, 10) : "—");

function ApiKeysSection() {
  const [keys, setKeys] = useState<ApiKeyRow[] | null>(null);
  const [label, setLabel] = useState("");
  const [fresh, setFresh] = useState<{ key: string; label: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`${apiBase()}/apikeys`, { headers: authHeaders() });
      const body = await response.json();
      if (response.ok) setKeys(body.keys);
      else setError(body.error);
    } catch (cause) {
      setError((cause as Error).message);
    }
  }, []);
  useEffect(() => void load(), [load]);

  const create = async () => {
    setError(null);
    const response = await fetch(`${apiBase()}/apikeys`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ label }),
    });
    const body = await response.json();
    if (!response.ok) return setError(body.error);
    setFresh({ key: body.key, label: body.label });
    setLabel("");
    void load();
  };

  const revoke = async (id: string) => {
    await fetch(`${apiBase()}/apikeys/${id}`, { method: "DELETE", headers: authHeaders() });
    void load();
  };

  return (
    <section>
      <h3>API key của tôi</h3>
      <p className="module-hint">
        Danh tính dài hạn cho máy (CI, script): gọi API bằng{" "}
        <code>Authorization: Bearer wbk_…</code>, quyền y hệt tài khoản bạn.
        Cách dùng: xem <code>docs/API.md</code> trong repo.
      </p>
      <div className="module-form">
        <input
          placeholder="Nhãn, vd: CI pipeline"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
        />
        <button onClick={() => void create()}>Tạo key</button>
      </div>
      {fresh && (
        <p className="module-hint fresh-secret">
          Key “{fresh.label || "không nhãn"}”: <code>{fresh.key}</code>
          <br />⚠ Lưu NGAY — đóng panel này là không hiển thị lại (máy chủ chỉ
          giữ bản băm).
        </p>
      )}
      {error && <p className="module-hint members-error">⚠ {error}</p>}
      {keys && keys.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Nhãn</th>
              <th>Prefix</th>
              <th>Tạo</th>
              <th>Dùng gần nhất</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {keys.map((row) => (
              <tr key={row.id}>
                <td>{row.label || "—"}</td>
                <td>
                  <code>{row.prefix}…</code>
                </td>
                <td>{day(row.createdAt)}</td>
                <td>{day(row.lastUsedAt)}</td>
                <td>
                  <button onClick={() => void revoke(row.id)}>Thu hồi</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function WebhooksSection({ projectId }: { projectId: string }) {
  const [hooks, setHooks] = useState<WebhookRow[] | null>(null);
  const [events, setEvents] = useState<string[]>([]);
  const [url, setUrl] = useState("");
  const [fresh, setFresh] = useState<{ url: string; secret: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch(
        `${apiBase()}/projects/${encodeURIComponent(projectId)}/webhooks`,
        { headers: authHeaders() },
      );
      const body = await response.json();
      if (response.ok) {
        setHooks(body.webhooks);
        setEvents(body.events);
      } else {
        setHooks(null);
        setError(body.error);
      }
    } catch (cause) {
      setError((cause as Error).message);
    }
  }, [projectId]);
  useEffect(() => void load(), [load]);

  const add = async () => {
    setError(null);
    const response = await fetch(
      `${apiBase()}/projects/${encodeURIComponent(projectId)}/webhooks`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ url }),
      },
    );
    const body = await response.json();
    if (!response.ok) return setError(body.error);
    setFresh({ url: body.url, secret: body.secret });
    setUrl("");
    void load();
  };

  const remove = async (id: string) => {
    await fetch(`${apiBase()}/projects/${encodeURIComponent(projectId)}/webhooks/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    void load();
  };

  return (
    <section>
      <h3>Webhook của dự án này</h3>
      <p className="module-hint">
        Sự kiện {events.length ? events.join(", ") : "file.put, state.push"} POST
        tới URL của bạn, ký HMAC-SHA256 (header <code>X-WeBIM-Signature</code>).
        Chỉ owner dự án quản lý được. URL phải là địa chỉ công cộng.
      </p>
      <div className="module-form">
        <input
          placeholder="https://hooks.cua-ban.vn/webim"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          style={{ minWidth: 300 }}
        />
        <button disabled={!url.trim()} onClick={() => void add()}>
          Đăng ký webhook
        </button>
      </div>
      {fresh && (
        <p className="module-hint fresh-secret">
          Secret cho {fresh.url}: <code>{fresh.secret}</code>
          <br />⚠ Lưu NGAY — không hiển thị lại. Bên nhận dùng nó verify chữ ký.
        </p>
      )}
      {error && <p className="module-hint members-error">⚠ {error}</p>}
      {hooks && hooks.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>URL</th>
              <th>Sự kiện</th>
              <th>Lần gọi gần nhất</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {hooks.map((hook) => (
              <tr key={hook.id}>
                <td>{hook.url}</td>
                <td>{hook.events.join(", ")}</td>
                <td>
                  {hook.lastAt
                    ? `${day(hook.lastAt)} → ${hook.lastStatus}`
                    : "chưa bắn lần nào"}
                </td>
                <td>
                  <button onClick={() => void remove(hook.id)}>Xoá</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export function ApiAccessModule() {
  useStoreVersion();
  if (store.authRequired && !store.auth) {
    return (
      <div className="module-host">
        <h2>API &amp; Webhook</h2>
        <p className="module-hint">
          Cần đăng nhập — API key gắn với tài khoản, webhook gắn với quyền owner
          dự án.
        </p>
      </div>
    );
  }
  return (
    <div className="module-host">
      <h2>API &amp; Webhook</h2>
      <ApiKeysSection />
      <WebhooksSection projectId={store.project.id} />
    </div>
  );
}
