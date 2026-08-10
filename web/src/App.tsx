import "./App.css";
import { ProjectBrowser } from "./ui/ProjectBrowser";
import { PropertiesPanel } from "./ui/PropertiesPanel";
import { ScheduleTable } from "./ui/ScheduleTable";
import {
  CdeModule,
  ClimateModule,
  DrawingsModule,
  PlanModule,
  StandardsModule,
} from "./ui/Modules";
import type { ModuleId } from "./state/store";
import { Toolbar } from "./ui/Toolbar";
import { Viewport } from "./ui/Viewport";
import { store, useStoreVersion } from "./state/store";

const MODULES: Array<[ModuleId, string]> = [
  ["MODEL", "Model"],
  ["CDE", "CDE"],
  ["PLAN", "Plan"],
  ["STANDARDS", "Standards"],
  ["DRAWINGS", "Drawings"],
  ["CLIMATE", "Climate"],
];

export default function App() {
  useStoreVersion();
  const activeView = store.activeView;
  const activeSheet = store.activeSheet;
  const activeSchedule = store.activeSchedule;
  const module = store.activeModule;
  return (
    <div className="app-shell">
      <Toolbar />
      <nav className="module-bar">
        {MODULES.map(([id, label]) => (
          <button
            key={id}
            className={module === id ? "active" : ""}
            onClick={() => store.setModule(id)}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="app-body">
        {module === "MODEL" && <ProjectBrowser />}
        <main className="viewport-host">
          {module === "CDE" ? (
            <CdeModule />
          ) : module === "PLAN" ? (
            <PlanModule />
          ) : module === "STANDARDS" ? (
            <StandardsModule />
          ) : module === "DRAWINGS" ? (
            <DrawingsModule />
          ) : module === "CLIMATE" ? (
            <ClimateModule />
          ) : activeSchedule ? (
            <ScheduleTable schedule={activeSchedule} />
          ) : (
            <>
              <Viewport />
              <div className="viewport-hud">
                {activeSheet
                  ? `Sheet ${activeSheet.name} — ${activeSheet.title}`
                  : activeView
                    ? `${activeView.name} · 1:${activeView.scale}`
                    : "No active view"}
              </div>
            </>
          )}
        </main>
        {module === "MODEL" && <PropertiesPanel />}
      </div>
      <footer className="status-bar">{store.statusMessage}</footer>
    </div>
  );
}
