import "./App.css";
import { useEffect, useState } from "react";
import { ProjectBrowser } from "./ui/ProjectBrowser";
import { PropertiesPanel } from "./ui/PropertiesPanel";
import { ScheduleTable, QtoTable } from "./ui/ScheduleTable";
import { IfcDataModule } from "./ui/IfcData";
import { FourDModule } from "./ui/FourD";
import { PcccModule } from "./ui/Pccc";
import { HomeModule } from "./ui/Home";
import { ClashMatrixModule, ClashReportModule } from "./ui/ClashModules";
import { MassingModule } from "./ui/Massing";
import { IfcImportModule } from "./ui/IfcImport";
import { PricingModule } from "./ui/Pricing";
import { RenderModule } from "./ui/Render";
import {
  AtlasModule,
  CdeModule,
  ClimateModule,
  DrawingsModule,
  PlanModule,
  StandardsModule,
  ViewerModule,
} from "./ui/Modules";
import { NamingModule } from "./ui/Naming";
import { MembersModule } from "./ui/Members";
import { HOME, SECTIONS, sectionById, type PaneId } from "./ui/navigation";
import { DrawingTools } from "./ui/DrawingTools";
import { Toolbar } from "./ui/Toolbar";
import { Viewport } from "./ui/Viewport";
import { store, useStoreVersion } from "./state/store";

/** The plan editor is the only pane that wants the browser and properties rails. */
const RAILED: PaneId[] = ["PLANVIEW", "MASSING"];

function Pane({ id }: { id: PaneId }) {
  const activeSchedule = store.activeSchedule;
  const activeSheet = store.activeSheet;
  const activeView = store.activeView;

  switch (id) {
    case "HOME":
      return <HomeModule />;
    case "PDF":
      return <DrawingsModule />;
    case "STANDARDS":
      return <StandardsModule />;
    case "CDE":
      return <CdeModule />;
    case "NAMING":
      return <NamingModule />;
    case "MEMBERS":
      return <MembersModule />;
    case "PLAN":
      return <PlanModule />;
    case "ATLASPROCESS":
      return <AtlasModule target="processes" />;
    case "ATLASPEOPLE":
      return <AtlasModule target="people" />;
    case "ATLASSITE":
      return <AtlasModule target="site" />;
    case "ATLAS":
      return <AtlasModule />;
    case "MASSING":
      return <MassingModule />;
    case "PLANVIEW":
      // A schedule opened from the browser replaces the plan; the drawing
      // tools go with it, because there is nothing to draw on a table.
      return activeSchedule ? (
        <ScheduleTable schedule={activeSchedule} />
      ) : (
        <>
          <DrawingTools />
          <Viewport />
          <div className="viewport-hud">
            {activeSheet
              ? `Sheet ${activeSheet.name} — ${activeSheet.title}`
              : activeView
                ? `${activeView.name} · 1:${activeView.scale}`
                : "No active view"}
          </div>
        </>
      );
    case "IFCIMPORT":
      return <IfcImportModule />;
    case "VIEWER":
      return <ViewerModule />;
    case "IFCDATA":
      return <IfcDataModule />;
    case "CLASHMATRIX":
      return <ClashMatrixModule />;
    case "CLASHREPORT":
      return <ClashReportModule />;
    case "QTOTABLE":
      return (
        <div className="module-host">
          <h2>Bảng thống kê khối lượng</h2>
          <QtoTable />
        </div>
      );
    case "PRICING":
      return <PricingModule />;
    case "RENDER":
      return <RenderModule />;
    case "FOURD":
      return <FourDModule />;
    case "PCCC":
      return <PcccModule />;
    case "CLIMATE":
      return <ClimateModule />;
  }
}

/** Màn chặn nhánh dự án khi chưa đăng nhập — form tại chỗ, không bắt đi tìm. */
function LoginGate() {
  useStoreVersion();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  if (store.standalone) {
    return (
      <div className="module-host login-gate">
        <h2>Nhánh dự án cần máy chủ nền tảng</h2>
        <p className="module-hint">
          CDE, hồ sơ, phân quyền và cộng tác sống trên máy chủ nền tảng — bản
          demo độc lập này chưa kết nối máy chủ nào nên nhánh Quản lý dự án
          chưa dùng được. Các công cụ miễn phí (PDF, tra cứu tiêu chuẩn) và
          BIM vẫn hoạt động bình thường.
        </p>
      </div>
    );
  }
  return (
    <div className="module-host login-gate">
      <h2>Đăng nhập để vào Quản lý dự án</h2>
      <p className="module-hint">
        CDE, hồ sơ theo hạng mục, thành viên và tiến độ thuộc về dự án của
        đội bạn — cần tài khoản trên máy chủ nền tảng để truy cập. Công cụ
        miễn phí (PDF, tra cứu tiêu chuẩn) không cần đăng nhập.
      </p>
      <div className="module-form">
        <input
          placeholder="Tên đăng nhập"
          autoComplete="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
        />
        <input
          type="password"
          placeholder="Mật khẩu"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void store.login(username, password);
          }}
        />
        <button
          disabled={!username.trim() || !password}
          onClick={() => void store.login(username, password)}
        >
          Đăng nhập
        </button>
      </div>
      <p className="module-hint">
        Chưa có tài khoản? Liên hệ quản trị viên máy chủ của công ty bạn.
      </p>
    </div>
  );
}

export default function App() {
  useStoreVersion();

  // Ctrl/Cmd+Z toàn app — trừ khi đang gõ trong ô nhập, nơi phím đó thuộc về
  // trình soạn thảo văn bản chứ không phải mô hình.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "z" || !(event.metaKey || event.ctrlKey)) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      if (event.shiftKey) store.redo();
      else store.undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const pane = store.activePane;
  const section = sectionById(store.activeSection);
  const railed = RAILED.includes(pane);

  // "Phải có tài khoản mới truy cập được": nhánh dự án chặn ở đây. Ba trạng
  // thái server ba câu trả lời — auth bật + chưa đăng nhập → form đăng nhập;
  // standalone → nói cần máy chủ; auth tắt (dev open mode) → cho qua, vì
  // "tài khoản" không tồn tại trên một máy chủ không bật đăng nhập.
  const gated =
    section.requiresAuth &&
    !store.auth &&
    store.authRequired !== false;

  return (
    <div className="app-shell">
      <Toolbar />
      {store.roleBanner && <div className="role-banner">👁 {store.roleBanner}</div>}

      <nav className="module-bar">
        <button
          className={store.activeSection === "HOME" ? "active" : ""}
          onClick={() => store.setSection("HOME")}
          title={HOME.label}
        >
          ⌂
        </button>
        {SECTIONS.map((entry) => (
          <button
            key={entry.id}
            className={store.activeSection === entry.id ? "active" : ""}
            onClick={() => store.setSection(entry.id)}
            title={
              entry.requiresAuth && !store.auth && store.authRequired !== false
                ? "Cần tài khoản — bấm để đăng nhập"
                : undefined
            }
          >
            {entry.requiresAuth && !store.auth && store.authRequired !== false
              ? `🔒 ${entry.label}`
              : entry.label}
          </button>
        ))}
      </nav>

      {/* Sub-tabs only when the branch has more than one step. */}
      {section.panes.length > 1 && (
        <nav className="pane-bar">
          {section.panes.map((entry) => (
            <button
              key={entry.id}
              className={pane === entry.id ? "active" : ""}
              onClick={() => store.setPane(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </nav>
      )}

      <div className="app-body">
        {railed && !gated && <ProjectBrowser />}
        <main className="viewport-host">
          {gated ? <LoginGate /> : <Pane id={pane} />}
        </main>
        {railed && !gated && <PropertiesPanel />}
      </div>

      <footer className="status-bar">{store.statusMessage}</footer>
    </div>
  );
}
