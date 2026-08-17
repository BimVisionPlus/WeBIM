// TRANG CHỦ — chọn việc trước, rồi mới tới các bước của việc đó.
//
// Thẻ được nhóm theo TẦNG SẢN PHẨM chứ không xếp phẳng: PDF và tiêu chuẩn
// là công cụ miễn phí kéo người dùng; CDE + view IFC + check va chạm là cốt
// lõi giai đoạn 1 xoay quanh dự án; quản lý dự án và các bảng tính là giá
// trị gia tăng; còn dựng hình BIM — phần khó nhất — nằm cuối, là đích đến
// chứ không phải cửa vào. Trang chủ phải nói đúng thứ tự đó với người mới.
//
// Phần tổng quan phía dưới chính là Dashboard cũ. Nó không nằm trong sơ đồ
// workflow như một nhánh riêng, và đúng ra là không nên: nó không phải một
// việc người ta định làm, nó là câu trả lời cho "dự án đang thế nào" — câu
// hỏi người ta hỏi ngay khi mở app.

import { DashboardModule } from "./Dashboard";
import { assessFlow } from "../application/flow";
import { useEffect, useState } from "react";
import { sectionById, type PaneId, type SectionId } from "./navigation";
import { store, useStoreVersion } from "../state/store";

interface HomeCard {
  /** Bấm vào mở section (đủ nhánh) hay nhảy thẳng một pane. */
  target: { section: SectionId } | { pane: PaneId };
  label: string;
  blurb: string;
  panes?: string;
}

interface HomeTier {
  title: string;
  note: string;
  cards: HomeCard[];
}

function sectionCard(id: SectionId): HomeCard {
  const section = sectionById(id);
  return {
    target: { section: id },
    label: section.label,
    blurb: section.blurb,
    panes:
      section.panes.length > 1
        ? section.panes.map((pane) => pane.label).join(" · ")
        : undefined,
  };
}

const TIERS: HomeTier[] = [
  {
    title: "Công cụ miễn phí",
    note: "Dùng ngay, không cần tài khoản — đọc bản vẽ và tra văn bản.",
    cards: [
      {
        target: { pane: "PDF" },
        label: "Đọc & chỉnh sửa PDF",
        blurb: "Mở bản vẽ PDF, ghi chú và đánh dấu ngay trên trang.",
      },
      {
        target: { pane: "STANDARDS" },
        label: "Tra cứu tiêu chuẩn",
        blurb: "QCVN / TCVN, tình trạng hiệu lực, chuỗi thay thế và xung đột.",
      },
    ],
  },
  {
    title: "Cốt lõi dự án",
    note: "Hồ sơ, mô hình và va chạm — trục chính của giai đoạn 1.",
    cards: [
      {
        target: { pane: "CDE" },
        label: "CDE — hồ sơ dự án",
        blurb: "Tài liệu theo mã ISO, phiên bản, trạng thái WIP → PUBLISHED.",
      },
      {
        target: { pane: "VIEWER" },
        label: "View mô hình",
        blurb: "Xem 3D model native + IFC link, hình học đầy đủ qua web-ifc.",
      },
      sectionCard("CLASH"),
    ],
  },
  {
    title: "Giá trị gia tăng",
    note: "Chạy trên dữ liệu dự án đã có — quản lý, khối lượng, mô phỏng.",
    cards: [
      sectionCard("PROJECT"),
      sectionCard("QTO"),
      sectionCard("RENDER"),
      sectionCard("SIM"),
    ],
  },
  {
    title: "Dựng hình BIM",
    note: "Phần khó nhất, đang hoàn thiện dần — mặt bằng, cấu kiện, box khối, import IFC.",
    cards: [sectionCard("BIM")],
  },
];

function ServerProjects() {
  useStoreVersion();
  const [projects, setProjects] = useState<{ id: string; name: string }[] | null>(null);
  useEffect(() => {
    if (store.standalone || !store.relayConnected) return;
    void store
      .listServerProjects()
      .then(setProjects)
      .catch(() => setProjects(null));
  }, [store.relayConnected]);
  if (!projects || projects.length === 0) return null;
  const others = projects.filter((project) => project.id !== store.project.id);
  if (others.length === 0) return null;
  return (
    <p className="module-hint server-projects">
      Dự án khác của bạn trên máy chủ:{" "}
      {others.slice(0, 6).map((project, index) => (
        <span key={project.id}>
          {index > 0 && " · "}
          <button
            className="link-button"
            onClick={() => {
              if (
                window.confirm(
                  `Mở "${project.name}" sẽ thay "${store.projectLabel}" đang mở. Tiếp tục?`,
                )
              ) {
                void store.openServerProject(project.id);
              }
            }}
          >
            {project.name}
          </button>
        </span>
      ))}
    </p>
  );
}

const FLOW_ICON: Record<string, string> = { OK: "✓", ATTENTION: "⚠", EMPTY: "○" };

function FlowStrip() {
  useStoreVersion();
  const steps = assessFlow(store.flowInput());
  return (
    <div className="flow-strip">
      {steps.map((step, index) => (
        <button
          key={step.id}
          className={`flow-step flow-${step.state.toLowerCase()}`}
          onClick={() => store.setPane(step.pane)}
          title={step.nextAction ?? step.summary}
        >
          <span className="flow-step-head">
            <span className="flow-step-icon">{FLOW_ICON[step.state]}</span>
            <span className="flow-step-label">
              {index + 1}. {step.label}
            </span>
          </span>
          <span className="flow-step-summary">{step.summary}</span>
          {step.nextAction && (
            <span className="flow-step-next">→ {step.nextAction}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export function HomeModule() {
  useStoreVersion();
  const project = store.project;

  return (
    <div className="module-host">
      <h2>{store.projectLabel}</h2>
      <p className="module-hint">
        {project.siteName} · {project.buildingName} — chọn việc cần làm.
      </p>

      {/* Luồng xương sống: 5 bước tự soi dữ liệu thật — người mở app thấy
          ngay mình đứng ở đâu và việc kế tiếp là gì. */}
      <FlowStrip />

      {/* Toàn cảnh: các dự án khác của tôi trên máy chủ — đổi dự án không
          cần biết trước id, và thấy được mình đang giữ bao nhiêu dự án. */}
      <ServerProjects />

      {TIERS.map((tier) => (
        <div key={tier.title} className="home-tier">
          <div className="home-tier-head">
            <span className="home-tier-title">{tier.title}</span>
            <span className="home-tier-note">{tier.note}</span>
          </div>
          <div className="home-grid">
            {tier.cards.map((card) => (
              <button
                key={card.label}
                className="home-card"
                onClick={() =>
                  "section" in card.target
                    ? store.setSection(card.target.section)
                    : store.setPane(card.target.pane)
                }
              >
                <span className="home-card-title">{card.label}</span>
                <span className="home-card-blurb">{card.blurb}</span>
                {card.panes && <span className="home-card-panes">{card.panes}</span>}
              </button>
            ))}
          </div>
        </div>
      ))}

      <DashboardModule embedded />
    </div>
  );
}
