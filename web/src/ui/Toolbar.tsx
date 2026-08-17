// Thanh trên cùng: tên dự án bên trái, người dùng và cài đặt bên phải.
//
// Công cụ vẽ đã chuyển vào khung dựng hình của BIM (ui/DrawingTools.tsx) —
// chúng chỉ có nghĩa ở đó, và để chúng nằm đây khiến mọi màn hình khác mang
// theo mười cái nút bấm vào không xảy ra gì.
//
// Những gì còn lại đúng là việc của cả app: đang là ai, ai đang cùng mở, và
// các thao tác cấp dự án. Nhóm cuối nằm trong một menu chứ không bày ra, vì
// trong một buổi làm việc người ta bấm chúng vài lần, còn nhìn thanh này thì
// suốt buổi.

import { useEffect, useRef, useState } from "react";
import { store, useStoreVersion } from "../state/store";
import { AtlasPublishDialog } from "./AtlasPublish";

function AuthControls() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (store.authRequired === null) void store.probeAuthMode();
  }, []);

  if (!store.authRequired) return null;

  if (store.auth) {
    return (
      <details
        className="top-menu"
        open={open}
        onToggle={(event) => setOpen((event.target as HTMLDetailsElement).open)}
      >
        <summary title={`Đang đăng nhập — vai trò ${store.auth.role}`}>
          <span className="avatar">{store.auth.username.slice(0, 1).toUpperCase()}</span>
          {store.auth.username}
        </summary>
        <div className="top-menu-panel">
          <div className="menu-heading">
            {store.auth.username} <em>({store.auth.role})</em>
          </div>
          <button
            onClick={() => {
              store.logout();
              setOpen(false);
            }}
          >
            Đăng xuất
          </button>
        </div>
      </details>
    );
  }

  const signIn = () => {
    void store.login(username, password);
    setPassword("");
    setOpen(false);
  };

  return (
    <details
      className="top-menu"
      open={open}
      onToggle={(event) => setOpen((event.target as HTMLDetailsElement).open)}
    >
      <summary>Đăng nhập</summary>
      <div className="top-menu-panel">
        <div className="menu-heading">Đăng nhập</div>
        <input
          placeholder="Tài khoản"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
        />
        <input
          placeholder="Mật khẩu"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") signIn();
          }}
        />
        <button onClick={signIn}>Đăng nhập</button>
        <p className="menu-note">
          Chưa đăng nhập vẫn dựng mô hình được — nó lưu trong máy này. Đồng bộ
          nhiều máy và kho file thì cần tài khoản.
        </p>
      </div>
    </details>
  );
}

function download(fileName: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function Toolbar() {
  useStoreVersion();
  const fileInput = useRef<HTMLInputElement>(null);
  const [publishing, setPublishing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const close = () => setSettingsOpen(false);

  const openProject = async (file: File | undefined) => {
    if (!file) return;
    try {
      store.loadProjectJson(await file.text());
    } catch (error) {
      store.setStatus(`Không mở được dự án: ${(error as Error).message}`);
    }
  };

  return (
    <header className="toolbar">
      <span className="brand">WeBIM Web</span>
      <input
        className="project-name"
        value={store.project.name}
        onChange={(event) => store.renameProject(event.target.value)}
        title="Tên dự án"
      />

      <div className="tool-group">
        <button
          onClick={() => store.undo()}
          disabled={!store.canUndo}
          title="Hoàn tác (Ctrl/Cmd+Z) — chỉ thao tác của chính bạn; phần tử đồng nghiệp đã sửa tiếp sẽ được giữ nguyên"
        >
          ↺
        </button>
        <button
          onClick={() => store.redo()}
          disabled={!store.canRedo}
          title="Làm lại (Ctrl/Cmd+Shift+Z)"
        >
          ↻
        </button>
      </div>

      <details className="top-menu">
        <summary title="Lịch sử phiên này">Lịch sử</summary>
        <div className="top-menu-panel history-panel">
          <div className="menu-heading">Phiên này ({store.history.length} bước)</div>
          {store.history.length === 0 && (
            <p className="menu-note">Chưa có thao tác nào trong phiên.</p>
          )}
          {[...store.history]
            .reverse()
            .slice(0, 30)
            .map((item, index) => (
              <div key={index} className={`history-row history-${item.kind}`}>
                <span className="history-time">
                  {new Date(item.at).toLocaleTimeString("vi-VN", { hour12: false })}
                </span>
                <span className="history-label">{item.label}</span>
                <span className="history-count">{item.count}</span>
              </div>
            ))}
          <p className="menu-note">
            Lịch sử sống trong phiên này. Hoàn tác theo từng phần tử: bước có
            phần tử đã bị người khác sửa tiếp sẽ giữ nguyên phần tử đó và báo
            lại — Ctrl+Z của bạn không đè lên việc của đồng nghiệp.
          </p>
        </div>
      </details>

      <div className="spacer" />

      <div className="presence">
        <span
          className={`relay-dot ${store.relayConnected ? "on" : ""}`}
          title={
            store.relayConnected
              ? "Đang đồng bộ với máy chủ"
              : store.standalone
                ? "Chế độ độc lập — không có máy chủ nền tảng"
                : store.authRequired && !store.auth
                  ? "Cần đăng nhập để đồng bộ"
                  : "Mất kết nối máy chủ — chỉ đồng bộ giữa các tab"
          }
        />
        {store.peers.map((peer) => (
          <span
            key={peer.clientId}
            className="peer-chip"
            style={{ borderColor: peer.color }}
            title={`${peer.name} — công cụ ${peer.tool.toLowerCase()}`}
          >
            <span className="peer-dot" style={{ background: peer.color }} />
            {peer.name}
          </span>
        ))}
      </div>

      <AuthControls />

      <details
        className="top-menu"
        open={settingsOpen}
        onToggle={(event) => setSettingsOpen((event.target as HTMLDetailsElement).open)}
      >
        <summary title="Cài đặt & dự án">⚙</summary>
        <div className="top-menu-panel">
          <div className="menu-heading">Dự án</div>
          {/* Thay dự án là thao tác MẤT DỮ LIỆU nếu chưa lưu: undo không cứu
              được (stack xoá khi đổi dự án). Một câu hỏi rẻ hơn một mô hình. */}
          <button
            onClick={() => {
              if (
                window.confirm(
                  `Tạo dự án mới sẽ thay "${store.projectLabel}" đang mở. Chưa lưu JSON thì các chỉnh sửa cục bộ sẽ mất. Tiếp tục?`,
                )
              ) {
                store.newProject();
              }
              close();
            }}
          >
            Tạo mới
          </button>
          <button
            onClick={() => {
              if (
                window.confirm(
                  `Nạp demo sẽ thay "${store.projectLabel}" đang mở. Chưa lưu JSON thì các chỉnh sửa cục bộ sẽ mất. Tiếp tục?`,
                )
              ) {
                store.loadDemoProject();
              }
              close();
            }}
            title="Nhà phố demo 12×8 — trục, tường, cửa, sàn, sheet, schedule, CDE, kế hoạch"
          >
            Nạp dự án demo
          </button>
          <button onClick={() => { fileInput.current?.click(); close(); }}>
            Mở file JSON…
          </button>
          <button
            onClick={() => {
              close();
              void (async () => {
                try {
                  const projects = await store.listServerProjects();
                  if (projects.length === 0) {
                    store.setStatus("Máy chủ chưa có snapshot dự án nào bạn xem được.");
                    return;
                  }
                  const menu = projects
                    .map((project, index) => `${index + 1}. ${project.name}`)
                    .join("\n");
                  const picked = window.prompt(
                    `Mở dự án nào từ máy chủ?\n${menu}\n\nNhập số thứ tự:`,
                    "1",
                  );
                  const index = Number(picked) - 1;
                  const target = projects[index];
                  if (!target) return;
                  if (
                    !window.confirm(
                      `Mở "${target.name}" sẽ thay "${store.projectLabel}" đang mở. Tiếp tục?`,
                    )
                  ) {
                    return;
                  }
                  await store.openServerProject(target.id);
                } catch (error) {
                  store.setStatus(
                    error instanceof Error ? error.message : String(error),
                  );
                }
              })();
            }}
            title="Dự án đã đồng bộ snapshot lên máy chủ nền tảng — mở được từ bất kỳ máy nào"
          >
            Mở từ máy chủ…
          </button>
          <button
            onClick={() => {
              download(
                `${store.projectLabel}.webim.json`,
                store.serializeProject(),
                "application/json",
              );
              close();
            }}
            title="JSON native — add-on WeBIM cho Blender đọc được"
          >
            Lưu file JSON
          </button>

          <div className="menu-heading">Xuất</div>
          <button
            onClick={() => {
              try {
                download(`${store.projectLabel}.ifc`, store.exportIfc(), "application/x-step");
                store.setStatus("Đã xuất IFC");
              } catch (error) {
                store.setStatus(`Xuất IFC lỗi: ${(error as Error).message}`);
              }
              close();
            }}
          >
            Xuất IFC
          </button>
          <button
            onClick={() => { setPublishing(true); close(); }}
            title="Xuất IFC rồi đăng vào Models của một dự án Atlas"
          >
            Đẩy sang Atlas…
          </button>
        </div>
      </details>

      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        style={{ display: "none" }}
        onChange={(event) => {
          void openProject(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      {publishing && <AtlasPublishDialog onClose={() => setPublishing(false)} />}
    </header>
  );
}
