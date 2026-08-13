import "./App.css";
import { ProjectBrowser } from "./ui/ProjectBrowser";
import { PropertiesPanel } from "./ui/PropertiesPanel";
import { ScheduleTable } from "./ui/ScheduleTable";
import { DashboardModule } from "./ui/Dashboard";
import { IfcDataModule } from "./ui/IfcData";
import { FourDModule } from "./ui/FourD";
import { PcccModule } from "./ui/Pccc";
import {
  AtlasModule,
  CdeModule,
  ClimateModule,
  DrawingsModule,
  PlanModule,
  StandardsModule,
  ViewerModule,
} from "./ui/Modules";
import type { ModuleId } from "./state/store";
import { Toolbar } from "./ui/Toolbar";
import { Viewport } from "./ui/Viewport";
import { store, useStoreVersion } from "./state/store";

const MODULES: Array<[ModuleId, string]> = [
  ["MODEL", "Model"],
  ["VIEWER", "3D Viewer"],
  ["CDE", "CDE"],
  ["PLAN", "Plan"],
  ["STANDARDS", "Standards"],
  ["DRAWINGS", "Drawings"],
  ["CLIMATE", "Climate"],
  ["DASHBOARD", "Dashboard"],
  ["IFCDATA", "IFC Data"],
  ["FOURD", "4D"],
  ["PCCC", "PCCC"],
  ["ATLAS", "Atlas"],
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
          ) : module === "VIEWER" ? (
            <ViewerModule />
          ) : module === "DASHBOARD" ? (
            <DashboardModule />
          ) : module === "IFCDATA" ? (
            <IfcDataModule />
          ) : module === "FOURD" ? (
            <FourDModule />
          ) : module === "PCCC" ? (
            <PcccModule />
          ) : module === "ATLAS" ? (
            <AtlasModule />
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
