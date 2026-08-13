// TRANG CHỦ — chọn việc trước, rồi mới tới các bước của việc đó.
//
// Phần tổng quan phía dưới chính là Dashboard cũ. Nó không nằm trong sơ đồ
// workflow như một nhánh riêng, và đúng ra là không nên: nó không phải một
// việc người ta định làm, nó là câu trả lời cho "dự án đang thế nào" — câu
// hỏi người ta hỏi ngay khi mở app.

import { DashboardModule } from "./Dashboard";
import { SECTIONS } from "./navigation";
import { store, useStoreVersion } from "../state/store";

export function HomeModule() {
  useStoreVersion();
  const project = store.project;

  return (
    <div className="module-host">
      <h2>{project.name}</h2>
      <p className="module-hint">
        {project.siteName} · {project.buildingName} — chọn việc cần làm.
      </p>

      <div className="home-grid">
        {SECTIONS.map((section) => (
          <button
            key={section.id}
            className="home-card"
            onClick={() => store.setSection(section.id)}
          >
            <span className="home-card-title">{section.label}</span>
            <span className="home-card-blurb">{section.blurb}</span>
            {section.panes.length > 1 && (
              <span className="home-card-panes">
                {section.panes.map((pane) => pane.label).join(" · ")}
              </span>
            )}
          </button>
        ))}
      </div>

      <DashboardModule embedded />
    </div>
  );
}
