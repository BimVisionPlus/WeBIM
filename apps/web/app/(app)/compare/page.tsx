import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { AecModuleShell } from "@/components/aec-module-shell";

export const dynamic = "force-dynamic";

type Verdict = "yes" | "no" | "partial" | "n/a";

const yes = "yes" as const;
const no = "no" as const;
const partial = "partial" as const;
const na = "n/a" as const;

const COMPARISON: Array<{
  cat: string;
  rows: Array<{ name: string; viwase: Verdict; procore: Verdict; acc: Verdict; note?: string }>;
}> = [
  {
    cat: "Pháp lý Việt Nam",
    rows: [
      { name: "Workflow gắn NĐ 06/2021 (RFI/NCR/Submittal/Nghiệm thu)", viwase: yes, procore: no, acc: no, note: "Mỗi transition có ref tới điều khoản cụ thể" },
      { name: "VBHN 06/VBHN-BXD (hợp nhất NĐ 10/2021) — Thanh toán giai đoạn", viwase: yes, procore: no, acc: no },
      { name: "NĐ 15/2021 — Hạng năng lực nhà thầu I/II/III + GPXD checklist", viwase: yes, procore: no, acc: no },
      { name: "QCVN 06:2022 PCCC + workflow PC07", viwase: yes, procore: no, acc: no },
      { name: "Hồ sơ hoàn công VIIIb (NĐ 06/2021 Phụ lục VIIIb) — AI auto-draft", viwase: yes, procore: no, acc: no, note: "13 mục bằng Groq Llama" },
      { name: "HĐĐT NĐ 123/2020 — xuất sang TCT 24h", viwase: yes, procore: no, acc: no },
      { name: "BHXH eService", viwase: yes, procore: no, acc: no },
      { name: "Chữ ký số VNPT-CA / Viettel-CA cho BBNT", viwase: yes, procore: no, acc: no },
      { name: "TCVN 5574 / 2737 / 9377-3 / 4519 native rules", viwase: yes, procore: no, acc: partial, note: "ACC có Code Checker cho US codes" },
    ],
  },
  {
    cat: "Ngôn ngữ + UX",
    rows: [
      { name: "Tiếng Việt 100% (UI + AI + workflow)", viwase: yes, procore: no, acc: no },
      { name: "Định dạng VND + tỉ + tr (không phải USD)", viwase: yes, procore: no, acc: no },
      { name: "Voice-to-form bằng tiếng Việt (Whisper)", viwase: yes, procore: no, acc: no },
      { name: "Mobile-first PWA (cài vào home screen)", viwase: yes, procore: partial, acc: partial, note: "Procore + ACC có native app riêng" },
    ],
  },
  {
    cat: "Workflows + states",
    rows: [
      { name: "RFI workflow với SLA", viwase: yes, procore: yes, acc: yes },
      { name: "Submittal review cycle", viwase: yes, procore: yes, acc: yes },
      { name: "NCR (Non-Conformance Report) workflow", viwase: yes, procore: yes, acc: partial },
      { name: "ChangeOrder với cost/schedule delta tracking", viwase: yes, procore: yes, acc: yes },
      { name: "Punch list bàn giao", viwase: yes, procore: yes, acc: yes },
      { name: "Progress Payment workflow VBHN 06", viwase: yes, procore: partial, acc: no, note: "International only" },
      { name: "Daily log (Nhật ký công trình)", viwase: yes, procore: yes, acc: yes },
      { name: "Audit log + CSV export per entity", viwase: yes, procore: yes, acc: yes },
    ],
  },
  {
    cat: "AI & Intelligence",
    rows: [
      { name: "AI tóm tắt tình hình mỗi phòng (weekly digest)", viwase: yes, procore: no, acc: no, note: "Groq Llama 3.3" },
      { name: "AI classify công văn / OCR", viwase: yes, procore: no, acc: no },
      { name: "AI schedule slip risk predictor", viwase: yes, procore: partial, acc: partial, note: "Procore có Insights add-on" },
      { name: "AI cost overrun forecast (CPI/SPI/EAC + Llama)", viwase: yes, procore: yes, acc: partial },
      { name: "AI compliance check vs TCVN/QCVN", viwase: yes, procore: no, acc: no },
      { name: "AI hồ sơ hoàn công auto-draft", viwase: yes, procore: no, acc: no },
      { name: "Voice-to-form (Whisper + Llama)", viwase: yes, procore: no, acc: no },
      { name: "Cross-module semantic search (bge-m3)", viwase: yes, procore: partial, acc: yes },
      { name: "BIM clash detection", viwase: yes, procore: partial, acc: yes, note: "ACC mạnh nhất segment này" },
      { name: "On-prem AI (Ollama / Qwen)", viwase: yes, procore: no, acc: no, note: "Enterprise tier" },
    ],
  },
  {
    cat: "Tích hợp & API",
    rows: [
      { name: "REST API per entity", viwase: yes, procore: yes, acc: yes },
      { name: "Tích hợp Bravo / FAST / Mego ERP (VN)", viwase: yes, procore: no, acc: no },
      { name: "ZaloPay / MoMo / BIDV / Vietinbank reconcile", viwase: yes, procore: no, acc: no },
      { name: "IFC/RVT import via Forge Viewer", viwase: yes, procore: yes, acc: yes },
      { name: "Autodesk Forge native", viwase: partial, procore: yes, acc: yes },
      { name: "SAP / Oracle ERP", viwase: partial, procore: yes, acc: yes },
    ],
  },
  {
    cat: "Pricing + hosting (50 seat)",
    rows: [
      { name: "Self-hosted on-prem option", viwase: yes, procore: no, acc: no },
      { name: "Hetzner / VNPT IDC / Viettel IDC tier", viwase: yes, procore: no, acc: no, note: "Procore + ACC chỉ SaaS US/EU" },
      { name: "Per-seat monthly (VND)", viwase: yes, procore: yes, acc: yes },
      { name: "Free pilot trial 30 ngày", viwase: yes, procore: partial, acc: partial, note: "30 ngày — Procore 14 ngày Limited" },
    ],
  },
];

const ICONS: Record<Verdict, { icon: string; cls: string }> = {
  yes: { icon: "✓", cls: "text-emerald-600 font-bold" },
  no: { icon: "✕", cls: "text-rose-600" },
  partial: { icon: "◐", cls: "text-amber-600 font-medium" },
  "n/a": { icon: "—", cls: "text-slate-400" },
};

const TOTAL_SCORES = (() => {
  const sums = { viwase: 0, procore: 0, acc: 0 };
  for (const cat of COMPARISON) {
    for (const r of cat.rows) {
      sums.viwase += r.viwase === "yes" ? 1 : r.viwase === "partial" ? 0.5 : 0;
      sums.procore += r.procore === "yes" ? 1 : r.procore === "partial" ? 0.5 : 0;
      sums.acc += r.acc === "yes" ? 1 : r.acc === "partial" ? 0.5 : 0;
    }
  }
  const total = COMPARISON.reduce((s, c) => s + c.rows.length, 0);
  return { ...sums, total };
})();

export default function ComparePage() {
  return (
    <AecModuleShell group="So sánh" name="Viwase vs Procore vs Autodesk Construction Cloud" subtitle="Side-by-side feature matrix theo nghiệp vụ AEC VN. Cuộn xuống xem chi tiết hoặc click thanh điều hướng.">
      {/* Score hero */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { name: "Viwase", score: TOTAL_SCORES.viwase, total: TOTAL_SCORES.total, color: "from-blue-600 to-indigo-700" },
          { name: "Procore", score: TOTAL_SCORES.procore, total: TOTAL_SCORES.total, color: "from-slate-500 to-slate-700" },
          { name: "Autodesk Construction Cloud", score: TOTAL_SCORES.acc, total: TOTAL_SCORES.total, color: "from-slate-500 to-slate-700" },
        ].map((t) => (
          <Card key={t.name} className={t.name === "Viwase" ? "border-blue-500" : ""}>
            <CardBody>
              <div className={`bg-gradient-to-r ${t.color} bg-clip-text text-sm font-bold uppercase tracking-wider text-transparent`}>{t.name}</div>
              <div className="mt-1 text-3xl font-bold text-slate-900">{t.score}<span className="text-base font-normal text-slate-400">/{t.total}</span></div>
              <div className="mt-0.5 text-xs text-slate-500">{((t.score / t.total) * 100).toFixed(0)}% feature coverage cho thị trường VN AEC</div>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        <strong>Lưu ý chấm điểm:</strong> ✓ = 1.0, ◐ partial = 0.5, ✕ = 0. Bias theo nghiệp vụ AEC VN — không phải so toàn cầu. Procore + ACC mạnh hơn ở BIM cross-discipline + integration SAP/Oracle. Viwase mạnh ở VN regulation + tiếng Việt + on-prem.
      </div>

      {/* Detail tables */}
      {COMPARISON.map((cat) => (
        <Card key={cat.cat} className="mt-4">
          <CardHeader><CardTitle>{cat.cat}</CardTitle></CardHeader>
          <CardBody className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-2 text-left">Feature</th>
                  <th className="p-2 text-center w-20">Viwase</th>
                  <th className="p-2 text-center w-20">Procore</th>
                  <th className="p-2 text-center w-20">ACC</th>
                  <th className="p-2 text-left">Ghi chú</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cat.rows.map((r) => (
                  <tr key={r.name} className="hover:bg-slate-50">
                    <td className="p-2 text-xs">{r.name}</td>
                    <td className="p-2 text-center"><span className={ICONS[r.viwase].cls}>{ICONS[r.viwase].icon}</span></td>
                    <td className="p-2 text-center"><span className={ICONS[r.procore].cls}>{ICONS[r.procore].icon}</span></td>
                    <td className="p-2 text-center"><span className={ICONS[r.acc].cls}>{ICONS[r.acc].icon}</span></td>
                    <td className="p-2 text-[11px] text-slate-500">{r.note ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      ))}

      <Card className="mt-6 border-blue-200 bg-blue-50/40">
        <CardBody>
          <CardTitle>Khi nào CHỌN Procore / ACC thay vì Viwase?</CardTitle>
          <ul className="mt-3 space-y-1.5 text-sm text-slate-700">
            <li>✓ Bạn là công ty xây dựng đa quốc gia (US/EU client), không cần VN regulation.</li>
            <li>✓ Đã có SAP / Oracle ERP và cần integration sâu (Procore + ACC chính tuyến).</li>
            <li>✓ Đang dùng Revit / Civil 3D mạnh và cần BIM cross-discipline với 100+ federated models (ACC dẫn đầu segment).</li>
            <li>✓ Có ngân sách $5,000+/tháng / 50 seat và không quan tâm tiếng Việt.</li>
          </ul>
        </CardBody>
      </Card>

      <Card className="mt-3 border-emerald-200 bg-emerald-50/40">
        <CardBody>
          <CardTitle>Khi nào CHỌN Viwase?</CardTitle>
          <ul className="mt-3 space-y-1.5 text-sm text-slate-700">
            <li>✓ Hoạt động chính tại VN, hồ sơ ra Sở XD / PC07 / TCT / BHXH.</li>
            <li>✓ Cần workflow gắn chặt NĐ 06/2021 + VBHN 06/VBHN-BXD + NĐ 15/2021 — không "code checker" chung chung.</li>
            <li>✓ Đội thi công nói tiếng Việt — UI + voice-to-form + AI tóm tắt tiếng Việt.</li>
            <li>✓ Ngân sách 25-30 tr ₫/tháng / 50 seat (1/5 giá Procore).</li>
            <li>✓ Có nhu cầu on-prem (Hetzner / VNPT IDC) để bảo mật data nội bộ.</li>
            <li>✓ Đã có Bravo / FAST / Mego ERP — Viwase tích hợp native (ACC + Procore không có connector VN).</li>
          </ul>
        </CardBody>
      </Card>

      <div className="mt-6 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
        Báo cáo so sánh tổng hợp từ: Procore docs public (procore.com), Autodesk Construction Cloud docs (construction.autodesk.com), Gartner Q4/2025 magic-quadrant cho Project Management ngành xây dựng, fieldlens.io benchmark.
      </div>
    </AecModuleShell>
  );
}
