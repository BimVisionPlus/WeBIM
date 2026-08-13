import { useEffect, useRef, useState } from "react";
import { store, useStoreVersion } from "../state/store";
import { AtlasPublishDialog } from "./AtlasPublish";

function AuthControls() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  useEffect(() => {
    if (store.authRequired === null) void store.probeAuthMode();
  }, []);
  if (!store.authRequired) return null;
  if (store.auth) {
    return (
      <span className="auth-controls">
        <span className="auth-user">
          {store.auth.username} <em>({store.auth.role})</em>
        </span>
        <button onClick={() => store.logout()}>Sign out</button>
      </span>
    );
  }
  return (
    <span className="auth-controls">
      <input
        placeholder="user"
        value={username}
        onChange={(event) => setUsername(event.target.value)}
      />
      <input
        placeholder="password"
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      <button
        onClick={() => {
          void store.login(username, password);
          setPassword("");
        }}
      >
        Sign in
      </button>
    </span>
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

  const openProject = async (file: File | undefined) => {
    if (!file) return;
    try {
      store.loadProjectJson(await file.text());
    } catch (error) {
      store.setStatus(`Could not load project: ${(error as Error).message}`);
    }
  };

  return (
    <header className="toolbar">
      <span className="brand">WeBIM Web</span>
      <input
        className="project-name"
        value={store.project.name}
        onChange={(event) => store.renameProject(event.target.value)}
        title="Project name"
      />
      <div className="tool-group">
        <button
          className={store.activeTool === "SELECT" ? "active" : ""}
          onClick={() => store.setTool("SELECT")}
          title="Select (Esc)"
        >
          Select
        </button>
        <button
          className={store.activeTool === "GRID" ? "active" : ""}
          onClick={() => store.setTool("GRID")}
          title="Draw grid axes (G)"
        >
          Grid
        </button>
        <button
          className={store.activeTool === "WALL" ? "active" : ""}
          onClick={() => store.setTool("WALL")}
          title="Draw walls (W)"
        >
          Wall
        </button>
        <button
          className={store.activeTool === "DOOR" ? "active" : ""}
          onClick={() => store.setTool("DOOR")}
          title="Place doors (D)"
        >
          Door
        </button>
        <button
          className={store.activeTool === "WINDOW" ? "active" : ""}
          onClick={() => store.setTool("WINDOW")}
          title="Place windows (O)"
        >
          Window
        </button>
        <button
          className={store.activeTool === "ROOM" ? "active" : ""}
          onClick={() => store.setTool("ROOM")}
          title="Khoanh phòng — hai góc đối diện"
        >
          Room
        </button>
        <button
          className={store.activeTool === "MASS" ? "active" : ""}
          onClick={() => store.setTool("MASS")}
          title="Box khối nghiên cứu — hai góc đối diện"
        >
          Mass
        </button>
        <button
          className={store.activeTool === "FLOOR" ? "active" : ""}
          onClick={() => store.setTool("FLOOR")}
          title="Draw floor slabs (F)"
        >
          Floor
        </button>
        <button
          className={store.activeTool === "ROOF" ? "active" : ""}
          onClick={() => store.setTool("ROOF")}
          title="Draw roof slabs (R)"
        >
          Roof
        </button>
        <button
          className={store.activeTool === "DIM" ? "active" : ""}
          onClick={() => store.setTool("DIM")}
          title="Place dimensions (M)"
        >
          Dim
        </button>
      </div>
      <label className="field">
        Snap
        <select
          value={store.snapIncrement}
          onChange={(event) => store.setSnapIncrement(Number(event.target.value))}
        >
          {[0.01, 0.05, 0.1, 0.25, 0.5, 1].map((value) => (
            <option key={value} value={value}>
              {value} m
            </option>
          ))}
        </select>
      </label>
      <div className="spacer" />
      <AuthControls />
      <div className="presence">
        <span
          className={`relay-dot ${store.relayConnected ? "on" : ""}`}
          title={
            store.relayConnected
              ? "Relay connected"
              : store.standalone
                ? "Chế độ độc lập — không có máy chủ nền tảng"
                : "Relay offline — tab sync only"
          }
        />
        {store.peers.map((peer) => (
          <span
            key={peer.clientId}
            className="peer-chip"
            style={{ borderColor: peer.color }}
            title={`${peer.name} — ${peer.tool.toLowerCase()} tool`}
          >
            <span className="peer-dot" style={{ background: peer.color }} />
            {peer.name}
          </span>
        ))}
      </div>
      <div className="tool-group">
        <button onClick={() => store.newProject()}>New</button>
        <button
          onClick={() => store.loadDemoProject()}
          title="Nhà phố demo 12×8 — grid, tường, cửa, sàn, sheet, schedule, CDE, kế hoạch"
        >
          Demo
        </button>
        <button onClick={() => fileInput.current?.click()}>Open JSON</button>
        <button
          onClick={() =>
            download(`${store.project.name}.webim.json`, store.serializeProject(), "application/json")
          }
          title="Native project JSON — loadable by the WeBIM Blender add-on"
        >
          Save JSON
        </button>
        <button
          onClick={() => {
            try {
              download(`${store.project.name}.ifc`, store.exportIfc(), "application/x-step");
              store.setStatus("IFC exported");
            } catch (error) {
              store.setStatus(`IFC export failed: ${(error as Error).message}`);
            }
          }}
        >
          Export IFC
        </button>
        <button
          onClick={() => setPublishing(true)}
          title="Xuất IFC và đăng vào Models của một dự án Atlas"
        >
          Đẩy sang Atlas
        </button>
      </div>
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
