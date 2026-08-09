import { useRef } from "react";
import { store, useStoreVersion } from "../state/store";

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
      <div className="tool-group">
        <button onClick={() => store.newProject()}>New</button>
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
    </header>
  );
}
