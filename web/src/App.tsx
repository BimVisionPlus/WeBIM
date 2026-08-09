import "./App.css";
import { ProjectBrowser } from "./ui/ProjectBrowser";
import { PropertiesPanel } from "./ui/PropertiesPanel";
import { ScheduleTable } from "./ui/ScheduleTable";
import { Toolbar } from "./ui/Toolbar";
import { Viewport } from "./ui/Viewport";
import { store, useStoreVersion } from "./state/store";

export default function App() {
  useStoreVersion();
  const activeView = store.activeView;
  const activeSheet = store.activeSheet;
  const activeSchedule = store.activeSchedule;
  return (
    <div className="app-shell">
      <Toolbar />
      <div className="app-body">
        <ProjectBrowser />
        <main className="viewport-host">
          {activeSchedule ? (
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
        <PropertiesPanel />
      </div>
      <footer className="status-bar">{store.statusMessage}</footer>
    </div>
  );
}
