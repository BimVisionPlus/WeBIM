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
import { ApiAccessModule } from "./ui/ApiAccess";
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
    case "APIACCESS":
      return <ApiAccessModule />;
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
  const [mode, setMode] = useState<"LOGIN" | "REGISTER">("LOGIN");
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
        <span className="view-toggle">
          <button
            className={mode === "LOGIN" ? "active" : ""}
            onClick={() => setMode("LOGIN")}
          >
            Đăng nhập
          </button>
          <button
            className={mode === "REGISTER" ? "active" : ""}
            onClick={() => setMode("REGISTER")}
          >
            Tạo tài khoản
          </button>
        </span>
      </div>
      <div className="module-form">
        <input
          placeholder={mode === "REGISTER" ? "Tên đăng nhập (a-z, số, chấm, gạch)" : "Tên đăng nhập"}
          autoComplete="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
        />
        <input
          type="password"
          placeholder={mode === "REGISTER" ? "Mật khẩu (≥ 8 ký tự)" : "Mật khẩu"}
          autoComplete={mode === "REGISTER" ? "new-password" : "current-password"}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            if (mode === "LOGIN") void store.login(username, password);
            else void store.register(username.trim(), password);
          }}
        />
        <button
          disabled={!username.trim() || !password}
          onClick={() =>
            mode === "LOGIN"
              ? void store.login(username, password)
              : void store.register(username.trim(), password)
          }
        >
          {mode === "LOGIN" ? "Đăng nhập" : "Tạo tài khoản & vào ngay"}
        </button>
      </div>
      <p className="module-hint">
        {mode === "REGISTER"
          ? "Tài khoản mới tạo được dự án riêng tư của mình ngay; máy chủ đóng đăng ký sẽ báo tại đây."
          : "Chưa có tài khoản? Bấm Tạo tài khoản — hoặc liên hệ quản trị viên nếu máy chủ đóng đăng ký."}
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

      <div className="app-main">
        {/* Nav DỌC bên trái thay cho hai hàng tab ngang: nhánh là mục cấp
            một, nhánh đang mở xoè các bước con ngay bên dưới (dạng cây).
            Ở màn hẹp sidebar thu thành drawer (nút ☰ trên toolbar) — cùng
            một cấu trúc, chỉ đổi cách hiện, nên mobile không cần nav riêng. */}
        <nav className={`side-nav${store.navOpen ? " open" : ""}`}>
          <button
            className={store.activeSection === "HOME" ? "active" : ""}
            onClick={() => {
              store.setSection("HOME");
              store.closeNav();
            }}
          >
            ⌂ {HOME.label}
          </button>
          {SECTIONS.map((entry) => {
            const locked =
              entry.requiresAuth && !store.auth && store.authRequired !== false;
            const current = store.activeSection === entry.id;
            return (
              <div key={entry.id} className="side-nav-group">
                <button
                  className={current ? "active" : ""}
                  onClick={() => {
                    store.setSection(entry.id);
                    // Nhánh một bước thì chọn xong là xong; nhánh nhiều bước
                    // giữ drawer mở để chọn tiếp bước con.
                    if (entry.panes.length <= 1) store.closeNav();
                  }}
                  title={locked ? "Cần tài khoản — bấm để đăng nhập" : undefined}
                >
                  {locked ? `🔒 ${entry.label}` : entry.label}
                </button>
                {current && entry.panes.length > 1 && (
                  <div className="side-nav-panes">
                    {entry.panes.map((sub) => (
                      <button
                        key={sub.id}
                        className={pane === sub.id ? "active" : ""}
                        onClick={() => {
                          store.setPane(sub.id);
                          store.closeNav();
                        }}
                      >
                        {sub.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        {store.navOpen && (
          <div className="nav-backdrop" onClick={() => store.closeNav()} />
        )}

        <div className="app-body">
          {railed && !gated && <ProjectBrowser />}
          <main className="viewport-host">
            {gated ? <LoginGate /> : <Pane id={pane} />}
          </main>
          {railed && !gated && <PropertiesPanel />}
        </div>
      </div>

      <footer className="status-bar">{store.statusMessage}</footer>
    </div>
  );
}
