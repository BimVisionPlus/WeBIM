/**
 * Atlas AEC — 21-slide demo deck builder.
 *
 * Usage:
 *   node scripts/build-pptx.js
 *
 * Output: docs/Atlas-AEC-Demo.pptx
 */

const pptxgen = require("pptxgenjs");
const path = require("path");
const fs = require("fs");

const ROOT = path.resolve(__dirname, "..");
const SHOT = (n) => path.join(ROOT, "docs", "demo-screens", n);
const OUT = path.join(ROOT, "docs", "Atlas-AEC-Demo.pptx");

// ── Palette: Midnight Executive (dark, premium) ─────────────────────────────
const C = {
  bg: "0B1220",          // deep navy
  panel: "111A30",       // raised panel
  border: "1F2A44",      // hairline divider
  text: "F1F5F9",        // primary
  muted: "8B9BB4",       // secondary
  dim: "475569",         // tertiary
  accent: "3B82F6",      // brand blue (matches the running app)
  accentSoft: "60A5FA",
  success: "10B981",
  warn: "F59E0B",
  danger: "EF4444",
};

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";          // 13.3 × 7.5 — roomy for screenshots
pres.author = "Atlas AEC";
pres.title = "Atlas AEC — v2 Demo";
pres.subject = "Live walkthrough of Layer 1 (6 modules) + Trust + Pricing";

const W = 13.3, H = 7.5;

// ── helpers ─────────────────────────────────────────────────────────────────
function darkBackground(slide) {
  slide.background = { color: C.bg };
}

function header(slide, sectionLabel, slideNum) {
  // small brand mark top-left
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.5, y: 0.35, w: 0.32, h: 0.32,
    fill: { color: C.accent },
    line: { color: C.accent, width: 0 },
  });
  slide.addText("A", {
    x: 0.5, y: 0.35, w: 0.32, h: 0.32,
    fontSize: 16, bold: true, color: "FFFFFF", align: "center", valign: "middle",
    fontFace: "Calibri", margin: 0,
  });
  slide.addText("Atlas AEC", {
    x: 0.9, y: 0.35, w: 3, h: 0.32,
    fontSize: 13, bold: true, color: C.text,
    fontFace: "Calibri", margin: 0, valign: "middle",
  });
  if (sectionLabel) {
    slide.addText(sectionLabel, {
      x: 3.9, y: 0.39, w: 6, h: 0.28,
      fontSize: 11, color: C.muted, fontFace: "Calibri", margin: 0,
    });
  }
  if (slideNum != null) {
    slide.addText(`${slideNum} / 21`, {
      x: W - 1.4, y: 0.35, w: 0.9, h: 0.32,
      fontSize: 11, color: C.muted, align: "right", fontFace: "Calibri", margin: 0, valign: "middle",
    });
  }
}

function footer(slide, note) {
  slide.addText(note ?? "atlas-aec · v2 · live demo", {
    x: 0.5, y: H - 0.45, w: W - 1, h: 0.3,
    fontSize: 10, color: C.dim, fontFace: "Calibri", margin: 0,
  });
}

// Screenshot slide: image takes the bulk of the slide, caption + bullets at bottom.
function screenshotSlide({ section, num, file, title, subtitle, bullets }) {
  const slide = pres.addSlide();
  darkBackground(slide);
  header(slide, section, num);

  // Title above the screenshot
  slide.addText(title, {
    x: 0.5, y: 0.9, w: W - 1, h: 0.55,
    fontSize: 26, bold: true, color: C.text, fontFace: "Calibri", margin: 0,
  });

  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.5, y: 1.45, w: W - 1, h: 0.32,
      fontSize: 14, color: C.muted, fontFace: "Calibri", margin: 0, italic: true,
    });
  }

  // Screenshot frame — keep aspect ratio (1280×1800-ish full-page captures)
  const frameX = 0.7, frameY = 1.95, frameW = 8.5, frameH = 5.0;
  // Subtle panel behind the image
  slide.addShape(pres.shapes.RECTANGLE, {
    x: frameX - 0.05, y: frameY - 0.05, w: frameW + 0.1, h: frameH + 0.1,
    fill: { color: C.panel },
    line: { color: C.border, width: 1 },
  });
  slide.addImage({
    path: file,
    x: frameX, y: frameY, w: frameW, h: frameH,
    sizing: { type: "contain", w: frameW, h: frameH },
  });

  // Right-side bullets
  if (bullets && bullets.length) {
    const bx = frameX + frameW + 0.4;
    slide.addText(
      bullets.map((b, i) => ({
        text: b,
        options: { bullet: { type: "bullet" }, breakLine: i < bullets.length - 1, color: C.text },
      })),
      {
        x: bx, y: frameY, w: W - bx - 0.5, h: frameH,
        fontSize: 13, color: C.text, fontFace: "Calibri",
        paraSpaceAfter: 6, valign: "top", margin: 0,
      },
    );
  }

  footer(slide);
}

// ── Slide 1: Title ─────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  darkBackground(s);
  // Big brand mark
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.9, y: 2.5, w: 1.0, h: 1.0,
    fill: { color: C.accent }, line: { color: C.accent, width: 0 },
  });
  s.addText("A", {
    x: 0.9, y: 2.5, w: 1.0, h: 1.0,
    fontSize: 56, bold: true, color: "FFFFFF", align: "center", valign: "middle",
    fontFace: "Calibri", margin: 0,
  });

  s.addText("Atlas AEC", {
    x: 2.2, y: 2.45, w: 10, h: 1.1,
    fontSize: 72, bold: true, color: C.text, fontFace: "Calibri", margin: 0,
  });
  s.addText("v2 — Demo deck · 19/05/2026", {
    x: 2.25, y: 3.45, w: 10, h: 0.5,
    fontSize: 16, color: C.muted, fontFace: "Calibri", margin: 0,
  });

  // Tagline
  s.addText("Atlassian-style PM cho Kiến trúc · Xây dựng — gắn chặt NĐ 06/2021", {
    x: 0.9, y: 4.4, w: W - 1.8, h: 0.6,
    fontSize: 22, color: C.accentSoft, fontFace: "Calibri", margin: 0,
  });
  s.addText("100% OSS AI · self-host · VN-grounded · 8-layer architecture", {
    x: 0.9, y: 5.0, w: W - 1.8, h: 0.4,
    fontSize: 14, italic: true, color: C.muted, fontFace: "Calibri", margin: 0,
  });

  // Footer band
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: H - 0.6, w: W, h: 0.6,
    fill: { color: C.panel }, line: { color: C.panel, width: 0 },
  });
  s.addText("Cofico · Vinhomes · Apave · AA Corp — pilot deployment", {
    x: 0.9, y: H - 0.55, w: W - 1.8, h: 0.5,
    fontSize: 12, color: C.muted, fontFace: "Calibri", margin: 0, valign: "middle",
  });
}

// ── Slide 2: The problem ───────────────────────────────────────────────────
{
  const s = pres.addSlide();
  darkBackground(s);
  header(s, "Why now", 2);

  s.addText("Vấn đề thực tế của PM xây dựng Việt Nam", {
    x: 0.6, y: 1.0, w: W - 1.2, h: 0.7,
    fontSize: 32, bold: true, color: C.text, fontFace: "Calibri", margin: 0,
  });
  s.addText("4 nỗi đau hằng ngày — chưa có ai giải đúng", {
    x: 0.6, y: 1.65, w: W - 1.2, h: 0.4,
    fontSize: 14, italic: true, color: C.muted, fontFace: "Calibri", margin: 0,
  });

  const pains = [
    {
      stat: "120tr",
      unit: "/tháng",
      title: "Procore / ACC",
      body: "Quá đắt cho công ty 50 seat tại VN, UX tiếng Anh, không tuân Luật Xây dựng 50/2014 sđ 62/2020 + NĐ 06/2021.",
      color: C.danger,
    },
    {
      stat: "0đ",
      unit: "",
      title: "Excel + Zalo",
      body: "Miễn phí nhưng phá mọi audit của Sở Xây dựng. Không có audit log, không có FSM transitions, mất hồ sơ là mất hợp đồng.",
      color: C.warn,
    },
    {
      stat: "≠ AEC",
      unit: "",
      title: "MISA / Base",
      body: "Workflow generic — không biết RFI / Submittal / NCR / BBNT là gì. Không tích hợp BIM. Không TCVN / QCVN library.",
      color: C.accentSoft,
    },
    {
      stat: "manual",
      unit: "",
      title: "Hồ sơ hoàn công",
      body: "Lắp bằng tay, 2–4 tuần / dự án. Chữ ký số rời. NĐ 15/2021 Phụ lục I không có ai check tự động.",
      color: C.success,
    },
  ];

  const colW = 2.9, gap = 0.25;
  const startX = (W - (colW * 4 + gap * 3)) / 2;
  pains.forEach((p, i) => {
    const x = startX + i * (colW + gap);
    // Card
    s.addShape(pres.shapes.RECTANGLE, {
      x, y: 2.3, w: colW, h: 4.4,
      fill: { color: C.panel }, line: { color: C.border, width: 1 },
    });
    // Accent stripe
    s.addShape(pres.shapes.RECTANGLE, {
      x, y: 2.3, w: 0.08, h: 4.4,
      fill: { color: p.color }, line: { color: p.color, width: 0 },
    });
    // Big stat
    s.addText(p.stat, {
      x: x + 0.3, y: 2.55, w: colW - 0.4, h: 1.1,
      fontSize: 44, bold: true, color: p.color, fontFace: "Calibri", margin: 0,
    });
    if (p.unit) {
      s.addText(p.unit, {
        x: x + 0.3, y: 3.65, w: colW - 0.4, h: 0.3,
        fontSize: 12, color: C.muted, fontFace: "Calibri", margin: 0,
      });
    }
    s.addText(p.title, {
      x: x + 0.3, y: 4.05, w: colW - 0.4, h: 0.5,
      fontSize: 18, bold: true, color: C.text, fontFace: "Calibri", margin: 0,
    });
    s.addText(p.body, {
      x: x + 0.3, y: 4.55, w: colW - 0.4, h: 2.0,
      fontSize: 12, color: C.muted, fontFace: "Calibri", margin: 0,
      paraSpaceAfter: 4,
    });
  });

  footer(s, "Atlas AEC tấn công đúng 4 nỗi đau này — bằng một codebase, một stack OSS, gắn chặt luật VN.");
}

// ── Slide 3: Architecture ──────────────────────────────────────────────────
{
  const s = pres.addSlide();
  darkBackground(s);
  header(s, "Architecture", 3);

  s.addText("Kiến trúc 8 lớp", {
    x: 0.6, y: 1.0, w: W - 1.2, h: 0.7,
    fontSize: 32, bold: true, color: C.text, fontFace: "Calibri", margin: 0,
  });
  s.addText("Tầng dưới ổn định ⇒ tầng trên di chuyển nhanh. v2 này ship Layer 1 đầy đủ + Layer 4/8 mặt người dùng.", {
    x: 0.6, y: 1.65, w: W - 1.2, h: 0.4,
    fontSize: 13, italic: true, color: C.muted, fontFace: "Calibri", margin: 0,
  });

  const layers = [
    { n: "1", name: "Core AEC Modules", desc: "WinWork · CodeGuard · DrawBridge · SiteEye · CostPulse · ProjectPulse", color: C.accent, ship: "✓ schema + API + UI + seed" },
    { n: "2", name: "Operational Backbone", desc: "WorkflowTemplate · RecurringTask · ChatChannel · SlaBreach", color: C.accent, ship: "✓ schema" },
    { n: "3", name: "Agentic Layer", desc: "Agent · AgentRun · AgentMemory · escalation tiers", color: C.accentSoft, ship: "✓ schema" },
    { n: "4", name: "MLOps & Trust", desc: "ModelCard · DriftSnapshot · DataLineage · BiasAudit · ExplanationRequest", color: C.success, ship: "✓ schema + /trust page" },
    { n: "5", name: "VN-Native", desc: "Zalo OA · E-invoice TT 78/2021 · FengShui · CCCD OCR · LunarEvent", color: C.success, ship: "✓ schema" },
    { n: "6", name: "Integrations & Ecosystem", desc: "ApiKey · Webhook · Connector (MISA/Base/BIM360/M365)", color: C.warn, ship: "✓ schema" },
    { n: "7", name: "UX / Mobile / Offline", desc: "DevicePushToken · OfflineSyncOp · service-worker (planned)", color: C.warn, ship: "✓ schema" },
    { n: "8", name: "GTM / Pricing", desc: "Plan · Subscription · NpsResponse · Referral · TemplateListing", color: C.danger, ship: "✓ schema + /pricing page" },
  ];

  // 2 columns × 4 rows
  const colW2 = 6.0, rowH = 1.05, gap = 0.18;
  const startX = 0.6, startY = 2.25;
  layers.forEach((L, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = startX + col * (colW2 + 0.3);
    const y = startY + row * (rowH + gap);

    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: colW2, h: rowH,
      fill: { color: C.panel }, line: { color: C.border, width: 1 },
    });
    // Layer number badge
    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 0.06, h: rowH,
      fill: { color: L.color }, line: { color: L.color, width: 0 },
    });
    s.addText(`Layer ${L.n}`, {
      x: x + 0.25, y: y + 0.08, w: 1.4, h: 0.35,
      fontSize: 11, bold: true, color: L.color, charSpacing: 2, fontFace: "Calibri", margin: 0,
    });
    s.addText(L.name, {
      x: x + 0.25, y: y + 0.35, w: colW2 - 0.5, h: 0.4,
      fontSize: 16, bold: true, color: C.text, fontFace: "Calibri", margin: 0,
    });
    s.addText(L.desc, {
      x: x + 0.25, y: y + 0.7, w: colW2 - 1.8, h: 0.35,
      fontSize: 11, color: C.muted, fontFace: "Calibri", margin: 0,
    });
    s.addText(L.ship, {
      x: x + colW2 - 1.75, y: y + 0.7, w: 1.6, h: 0.3,
      fontSize: 10, color: C.success, align: "right", fontFace: "Calibri", margin: 0,
    });
  });

  footer(s, "Mỗi lớp shippable độc lập — UI cho P1/P2/P3 sẽ phủ tiếp ở các vertical slice kế tiếp.");
}

// ── Slides 4–15: screenshots ───────────────────────────────────────────────
const shots = [
  {
    num: 4, section: "Auth", file: "01-signin.png",
    title: "Đăng nhập",
    subtitle: "Vietnamese-first UX · brute-force lockout · NextAuth sessions · password reset",
    bullets: [
      "Demo login:",
      "  anh.nguyen@cofico.vn",
      "  demo1234!",
      "",
      "Đăng nhập 1 lần,",
      "duyệt 6 module mới.",
    ],
  },
  {
    num: 5, section: "Home", file: "02-home.png",
    title: "Dashboard — 6 mô-đun trên top nav",
    subtitle: "WinWork · Portfolio · Trust · Giá — bên cạnh Dự án / Tổ chức gốc",
    bullets: [
      "2 dự án trực tiếp truy cập:",
      "  · Vinhomes Grand Park S9",
      "    (1.85 nghìn tỉ HĐ)",
      "  · FPT Tower Cầu Giấy",
      "    (218 tỉ HĐ)",
      "",
      "Cổng vào WinWork +",
      "Portfolio ngay từ header.",
    ],
  },
  {
    num: 6, section: "Layer 1.1 — WinWork", file: "03-winwork.png",
    title: "WinWork — Bidding Intelligence overview",
    subtitle: "Bộ não đấu thầu: cơ hội · hồ sơ · bảo lãnh · tuân thủ Luật ĐT 22/2023",
    bullets: [
      "10 tender opportunities",
      "(3 nguồn auto-scrape)",
      "",
      "7 hồ sơ dự thầu",
      "  · 1 AWARDED",
      "  · 1 OPENED · 1 SUBMITTED",
      "  · 1 LOST · 2 active",
      "  · 1 ESTIMATING",
      "",
      "4 active bonds",
      "1 đã RELEASED",
    ],
  },
  {
    num: 7, section: "Layer 1.1 — WinWork", file: "04-winwork-tenders.png",
    title: "Cơ hội đấu thầu · multi-source crawl",
    subtitle: "muasamcong.mpi.gov.vn + dauthau.asia + báo đấu thầu · de-dupe theo content hash",
    bullets: [
      "10 cơ hội · 90 ngày",
      "",
      "Giá gói từ 14.2 tỉ →",
      "985 tỉ (Gamuda Yên Sở)",
      "",
      "5 tỉnh/thành: HN · HCM",
      "Hưng Yên · Bình Phước",
      "Sơn La · Quảng Ngãi",
      "",
      "Mỗi cơ hội deep-link",
      "về source gốc.",
    ],
  },
  {
    num: 8, section: "Layer 1.1 — WinWork", file: "06-winwork-bid-detail.png",
    title: "Luật ĐT 22/2023 compliance engine",
    subtitle: "9 quy tắc · server-side enforced · transition guard chặn nộp HSDT khi chưa đạt",
    bullets: [
      "Engine chạy <100ms",
      "9 rules đánh giá:",
      "",
      "  ✓ PASS: bond Điều 14,",
      "    MST Điều 5, conflict",
      "    Điều 6, margin sanity",
      "",
      "  ✗ FAIL × 2 BLOCKING:",
      "    Điều 9 (năng lực)",
      "    Điều 9 k.2 (kỹ thuật)",
      "",
      "→ submit bị chặn",
      "đến khi đính kèm.",
    ],
  },
  {
    num: 9, section: "Layer 1.2 — CodeGuard", file: "08-codeguard.png",
    title: "CodeGuard · TCVN/QCVN + NĐ 15/2021 dossier",
    subtitle: "Hồ sơ chất lượng tự động · thư viện tiêu chuẩn IN_FORCE · cập nhật khi luật thay đổi",
    bullets: [
      "Dossier 19 mục",
      "(NĐ 15/2021 Phụ lục I)",
      "  3 ACCEPTED",
      "  3 SUBMITTED",
      "  13 MISSING",
      "",
      "10+ tiêu chuẩn IN_FORCE",
      "TCVN 5574 · 2737 · 4453",
      "7888 · 9362",
      "QCVN 04 · 06 · 10",
      "NĐ 06 · 15/2021",
      "",
      "Mỗi tiêu chuẩn có",
      "rule count machine-checkable.",
    ],
  },
  {
    num: 10, section: "Layer 1.3 — DrawBridge", file: "09-drawbridge.png",
    title: "DrawBridge · BIM clash detection chạy thật",
    subtitle: "AABB detector cross-discipline · ngày mai swap sang Forge / IfcOpenShell mà UI không đổi",
    bullets: [
      "8 BIM elements",
      "→ 8 clashes detected",
      "",
      "3 high-severity:",
      "  Dầm B-3 × HVAC Φ400",
      "  Dầm B-3 × PCCC DN150",
      "  HVAC × PCCC nhánh 1",
      "",
      "5 low-severity (sàn tiếp",
      "xúc cấu kiện trên đó)",
      "",
      "Severity 0-100 theo",
      "volume overlap.",
    ],
  },
  {
    num: 11, section: "Layer 1.4 — SiteEye", file: "10-siteeye.png",
    title: "SiteEye · CV + thời tiết + sự cố ATLĐ",
    subtitle: "PPE detection (Qwen2.5-VL) · open-meteo live · Luật ATVSLĐ 84/2015 compliant",
    bullets: [
      "Weather live 27.1°C",
      "90% RH · 0 mm/h · 6.6 kph",
      "Nguồn: open-meteo",
      "",
      "4 sự cố ATLĐ ghi nhận",
      "  · 1 MAJOR (điện giật)",
      "  · 1 MINOR · 2 NEAR_MISS",
      "",
      "5 vi phạm PPE chưa xử lý",
      "(hard hat · vest · harness",
      "· boots) — từ 3 camera",
      "",
      "1-tap incident report",
      "trên mobile.",
    ],
  },
  {
    num: 12, section: "Layer 1.5 — CostPulse", file: "11-costpulse.png",
    title: "CostPulse · EVM math trên BoQ thật",
    subtitle: "BAC · EV · AC · CPI · SPI · EAC · VAC — pure function · swappable engine",
    bullets: [
      "BAC  122.5 tỉ",
      "EV    69.9 tỉ",
      "AC    48.7 tỉ",
      "",
      "CPI 1.44 (over-performing)",
      "EAC 85.3 tỉ",
      "VAC 37.2 tỉ projected profit",
      "",
      "9 BoQ lines với % xong",
      "Bê tông móng 96%",
      "Cốt thép phần thân 59%",
      "",
      "Chỉ số giá vật liệu",
      "Sở XD TP.HCM 04/2026",
    ],
  },
  {
    num: 13, section: "Layer 1.6 — ProjectPulse", file: "12-portfolio.png",
    title: "ProjectPulse · 5-dim risk heatmap",
    subtitle: "Cross-project portfolio cho CEO/COO · cost · schedule · safety · quality · compliance",
    bullets: [
      "2 dự án trong portfolio",
      "1.85 nghìn tỉ HĐ tổng",
      "1.76 nghìn tỉ lãi dự phóng",
      "",
      "VHGP-S9 (Vinhomes):",
      "  COST LOW · CPI 1.44",
      "  COMPLIANCE HIGH",
      "  (dossier 16% xong)",
      "",
      "FPT-CG-A1 (FPT Tower):",
      "  giai đoạn đầu, đang load",
      "",
      "Heatmap cập nhật real-time",
      "khi seed thay đổi.",
    ],
  },
  {
    num: 14, section: "Layer 4 — Trust", file: "13-trust.png",
    title: "Trust · public model cards",
    subtitle: "Mọi AI feature công khai model · dataset · limitation · acceptance rate · drift",
    bullets: [
      "5 model cards published:",
      "  daily_log.transcribe",
      "    faster-whisper-medium",
      "  ncr.assess_photo",
      "    qwen2.5-vl:7b",
      "  rfi.classify",
      "    qwen2.5:7b-instruct",
      "  siteeye.ppe",
      "    qwen2.5-vl:7b",
      "  spec.embed",
      "    bge-m3",
      "",
      "100% OSS · self-host",
      "Drift snapshots ghi nhận",
      "siteeye.ppe DEGRADED",
    ],
  },
  {
    num: 15, section: "Layer 8 — Pricing", file: "14-pricing.png",
    title: "Pricing · self-serve 4-tier",
    subtitle: "Không 'liên hệ tư vấn' · pay-per-AI-action tách rời per-seat · on-prem cho Enterprise",
    bullets: [
      "Free: 0đ + 500đ/AI",
      "  5 user · 1 dự án",
      "  Site + Models + Specs",
      "",
      "Pro: 290k + 300đ/AI",
      "  WinWork + CodeGuard",
      "  DrawBridge + SiteEye",
      "  Zalo + e-invoice",
      "",
      "Business: 690k + 200đ",
      "  CostPulse + Portfolio",
      "  Agent + drift detection",
      "",
      "Enterprise: báo giá",
      "  on-prem VN · ISO 27001",
    ],
  },
  {
    num: 16, section: "Catalog", file: "15-catalog.png",
    title: "Catalog · Cấu kiện · vật tư · NCC",
    subtitle: "Thư viện chuẩn hoá cho công ty — link Submittal (vật liệu) + BoQ (giá đơn vị) · form Thêm cấu kiện mở sẵn",
    bullets: [
      "Cấu kiện chia 12 nhóm:",
      "  Bê tông · Cốt thép",
      "  Gạch đá · Xi măng",
      "  Sơn · M&E · PCCC",
      "  Cửa kính · Thiết bị",
      "",
      "Form CRUD:",
      "  + Thêm cấu kiện",
      "  + Thêm NCC (MST)",
      "  + Quan hệ giá",
      "",
      "Mỗi cấu kiện có giá",
      "baseline · qty NCC · đơn vị.",
    ],
  },
  {
    num: 17, section: "Thi công — Schedule", file: "16-schedule.png",
    title: "Schedule · Tiến độ + đường găng (CPM)",
    subtitle: "Gantt-ready · AI rủi ro chậm từ daily log + thời tiết · form Thêm công việc mở sẵn",
    bullets: [
      "KPI cấp công ty:",
      "  Tổng task · Đang thi công",
      "  Quá hạn · Đường găng",
      "",
      "Form CRUD:",
      "  + Thêm công việc (task)",
      "  WBS · Discipline · Zone",
      "  Plan start/end · % xong",
      "",
      "Critical Path đánh dấu",
      "tím — chậm 1 ngày =",
      "dự án chậm 1 ngày.",
    ],
  },
  {
    num: 18, section: "Pháp lý — PermitFlow", file: "17-permitflow.png",
    title: "PermitFlow · Xin GPXD NĐ 15/2021",
    subtitle: "Tự sinh checklist Phụ lục I từ profile dự án · 6 loại GPXD · form Tạo hồ sơ mở sẵn",
    bullets: [
      "6 loại GPXD:",
      "  Mới · Điều chỉnh",
      "  Sửa chữa · Tạm",
      "  Hạ tầng · Thông báo",
      "",
      "Form CRUD:",
      "  + Tạo hồ sơ xin GPXD",
      "  Dự án · Đơn vị nộp",
      "  Cơ quan cấp (Sở XD)",
      "",
      "Auto-checklist 8 mục",
      "PL-I.A.1 → PL-I.A.8",
      "(GCN đất · bản vẽ · PCCC).",
    ],
  },
  {
    num: 19, section: "Pháp lý — PCCC", file: "18-pccc.png",
    title: "PCCC · Thẩm duyệt NĐ 136/2020",
    subtitle: "QCVN 06:2022/BXD · TCVN 5738 · 3 giai đoạn từ thẩm duyệt → cấp Giấy đủ điều kiện · form mở sẵn",
    bullets: [
      "3 giai đoạn:",
      "  Thẩm duyệt thiết kế",
      "  Nghiệm thu PCCC",
      "  Cấp Giấy đủ điều kiện",
      "",
      "Form CRUD:",
      "  + Tạo hồ sơ PCCC",
      "  Cấp PC07 / C06",
      "",
      "Checklist PC-1 → PC-8",
      "(bản vẽ · tính nước",
      "thuyết minh · thí nghiệm",
      "vật liệu chống cháy).",
    ],
  },
  {
    num: 20, section: "Đấu thầu — BidRadar", file: "19-bidradar.png",
    title: "BidRadar · Săn gói thầu nhà nước",
    subtitle: "muasamcong.mpi.gov.vn + dauthau.asia · alert email theo NACE · reuses TenderCreateButton",
    bullets: [
      "Top-level cho org:",
      "  Tổng gói · Đóng 7d",
      "  Ngân sách top 30",
      "  Watchlist (sắp tới)",
      "",
      "Form CRUD (reuse):",
      "  + Thêm cơ hội",
      "  Bên mời · MST",
      "  Giá gói · Nguồn vốn",
      "  Tỉnh · Hình thức",
      "",
      "Sắp đóng thầu hiện",
      "bảng cảnh báo vàng.",
    ],
  },
];

for (const sc of shots) {
  screenshotSlide({
    section: sc.section,
    num: sc.num,
    file: SHOT(sc.file),
    title: sc.title,
    subtitle: sc.subtitle,
    bullets: sc.bullets,
  });
}

// ── Slide 21: Closing ──────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  darkBackground(s);
  header(s, "Shipping evidence", 21);

  s.addText("Atlas AEC · v2 shipped 19/05/2026", {
    x: 0.6, y: 1.0, w: W - 1.2, h: 0.7,
    fontSize: 36, bold: true, color: C.text, fontFace: "Calibri", margin: 0,
  });
  s.addText("Mỗi gate đều tự re-run được — không phải lời hứa, là làm rồi.", {
    x: 0.6, y: 1.7, w: W - 1.2, h: 0.4,
    fontSize: 14, italic: true, color: C.muted, fontFace: "Calibri", margin: 0,
  });

  const gates = [
    { stat: "9 / 9", label: "Packages typecheck", cmd: "pnpm typecheck", color: C.success },
    { stat: "2 / 2", label: "Next apps lint clean", cmd: "pnpm lint", color: C.success },
    { stat: "10 / 10", label: "Vitest FSM tests pass", cmd: "pnpm test", color: C.success },
    { stat: "58 routes", label: "Production build OK", cmd: "pnpm build", color: C.success },
    { stat: "35+ models", label: "Prisma schema applied", cmd: "pnpm db:push", color: C.accentSoft },
    { stat: "19 PNGs", label: "Live screenshots regenerated", cmd: "tsx scripts/capture-demo.ts", color: C.accentSoft },
  ];

  const cardW = 4.0, cardH = 1.4, gap = 0.2;
  const startX = (W - (cardW * 3 + gap * 2)) / 2;
  gates.forEach((g, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = startX + col * (cardW + gap);
    const y = 2.4 + row * (cardH + gap);

    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: cardW, h: cardH,
      fill: { color: C.panel }, line: { color: C.border, width: 1 },
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 0.08, h: cardH,
      fill: { color: g.color }, line: { color: g.color, width: 0 },
    });
    s.addText(g.stat, {
      x: x + 0.25, y: y + 0.15, w: cardW - 0.5, h: 0.5,
      fontSize: 26, bold: true, color: g.color, fontFace: "Calibri", margin: 0,
    });
    s.addText(g.label, {
      x: x + 0.25, y: y + 0.65, w: cardW - 0.5, h: 0.32,
      fontSize: 13, bold: true, color: C.text, fontFace: "Calibri", margin: 0,
    });
    s.addText(g.cmd, {
      x: x + 0.25, y: y + 0.95, w: cardW - 0.5, h: 0.35,
      fontSize: 11, color: C.muted, fontFace: "Consolas", margin: 0,
    });
  });

  // Demo URL panel
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.6, y: 5.5, w: W - 1.2, h: 1.0,
    fill: { color: C.panel }, line: { color: C.accent, width: 2 },
  });
  s.addText("Replay demo bất kỳ lúc nào", {
    x: 0.85, y: 5.55, w: 6, h: 0.4,
    fontSize: 13, bold: true, color: C.muted, charSpacing: 1, fontFace: "Calibri", margin: 0,
  });
  s.addText("http://localhost:3000/demo.html  ·  docs/DEMO.md  ·  docs/Atlas-AEC-Demo.pptx", {
    x: 0.85, y: 5.9, w: W - 1.7, h: 0.5,
    fontSize: 18, color: C.accentSoft, fontFace: "Consolas", margin: 0,
  });

  footer(s, "Demo credentials: anh.nguyen@cofico.vn / demo1234! — đăng nhập, click 6 tabs, mọi thứ là live data từ Postgres.");
}

pres.writeFile({ fileName: OUT }).then((p) => {
  console.log("✅ Wrote", p);
});
