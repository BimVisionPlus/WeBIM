import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { AecModuleShell } from "@/components/aec-module-shell";

export const dynamic = "force-dynamic";

/**
 * 07 — Atlas Connect (integrations marketplace).
 *
 * This page is the catalog. Each integration links to its detail/install
 * page (TBD). Phase 1: show the catalog + which ones are in-progress vs
 * production-ready.
 */

const INTEGRATIONS: Array<{
  group: string;
  items: Array<{ icon: string; name: string; vendor: string; what: string; status: "live" | "beta" | "planned" | "wip"; oauth?: boolean }>;
}> = [
  {
    group: "ERP (Vietnam)",
    items: [
      { icon: "📒", name: "Bravo ERP", vendor: "Bravo Solutions", what: "Đẩy chứng từ kế toán + đối chiếu công nợ định kỳ", status: "live" },
      { icon: "💼", name: "FAST Accounting", vendor: "FAST Software", what: "Tạm ứng + Thanh toán + Hoá đơn → FAST", status: "beta" },
      { icon: "📊", name: "Mego ERP", vendor: "Mego", what: "Bilateral sync: project list + BoQ + payment", status: "planned" },
      { icon: "📑", name: "MISA AMIS", vendor: "MISA", what: "Hoá đơn điện tử + sổ kế toán doanh nghiệp", status: "wip" },
    ],
  },
  {
    group: "Banking + Payments",
    items: [
      { icon: "🏦", name: "BIDV iBank", vendor: "BIDV", what: "Xem số dư + lệnh chi tự động (Open Banking)", status: "beta" },
      { icon: "🏛️", name: "Vietinbank eFAST", vendor: "Vietinbank", what: "Đối chiếu công nợ tự động cuối ngày", status: "wip" },
      { icon: "📱", name: "ZaloPay", vendor: "VNG ZaloPay", what: "Thanh toán nhanh cho thầu phụ + công nhân", status: "beta", oauth: true },
      { icon: "🪙", name: "MoMo Business", vendor: "M_Service", what: "Tạm ứng + thanh toán + chứng từ tự động", status: "planned", oauth: true },
      { icon: "💳", name: "VietQR / VNPay QR", vendor: "VNPay", what: "QR thanh toán tại quầy thu công nợ", status: "beta" },
    ],
  },
  {
    group: "Government / e-Gov VN",
    items: [
      { icon: "📜", name: "Tổng cục Thuế (e-Invoice)", vendor: "TCT", what: "Xuất HĐĐT NĐ 123/2020 trong 24h", status: "live" },
      { icon: "🪪", name: "Cổng DVCQG", vendor: "Chính phủ điện tử", what: "Đẩy hồ sơ giấy phép XD + nghiệm thu PCCC", status: "beta" },
      { icon: "🛂", name: "BHXH eService", vendor: "BHXH Việt Nam", what: "Đẩy mã số NLĐ + chứng từ đóng BHXH/BHYT/BHTN", status: "beta" },
      { icon: "🌳", name: "eFootprint", vendor: "Bộ TN&MT", what: "Đẩy báo cáo quan trắc môi trường theo NĐ 08/2022", status: "planned" },
    ],
  },
  {
    group: "Communication",
    items: [
      { icon: "💬", name: "Zalo Notification Service", vendor: "VNG", what: "Push notification chính thức tới Zalo OA của công ty", status: "live" },
      { icon: "📞", name: "Stringee Voice API", vendor: "Stringee", what: "Voice call vào số NLĐ khi có sự cố quan trọng", status: "planned" },
      { icon: "📧", name: "Resend (Transactional)", vendor: "Resend", what: "Email transactional với domain riêng (aecplatform.vn đã verified)", status: "live" },
      { icon: "💼", name: "Microsoft Teams / Slack", vendor: "Microsoft / Slack", what: "Notification channel + actionable cards", status: "wip" },
    ],
  },
  {
    group: "BIM & Design",
    items: [
      { icon: "🏗️", name: "Autodesk Construction Cloud", vendor: "Autodesk", what: "Sync 2-way RVT/IFC + clash detection", status: "beta" },
      { icon: "📐", name: "Autodesk Forge Viewer", vendor: "Autodesk", what: "Embed BIM viewer + markup", status: "live" },
      { icon: "🎯", name: "Trimble Connect", vendor: "Trimble", what: "Import Tekla model files", status: "planned" },
      { icon: "📑", name: "Bluebeam Revu", vendor: "Bluebeam", what: "PDF takeoff + markup sync", status: "wip" },
    ],
  },
  {
    group: "Compliance & QA",
    items: [
      { icon: "🔥", name: "Cảnh sát PCCC PC07 portal", vendor: "Bộ CA", what: "Đẩy hồ sơ thẩm duyệt PCCC + lịch nghiệm thu", status: "planned" },
      { icon: "📊", name: "Cổng Sở XD", vendor: "Sở XD các tỉnh", what: "Đẩy hồ sơ GPXD + Nghiệm thu giai đoạn", status: "planned" },
      { icon: "📐", name: "Vinacomin / Bộ XD chỉ số giá", vendor: "Bộ XD", what: "Tự động cập nhật NormPrice mỗi quý", status: "wip" },
    ],
  },
];

const STATUS_META: Record<string, { vn: string; cls: string }> = {
  live: { vn: "Production", cls: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  beta: { vn: "Beta", cls: "bg-blue-100 text-blue-800 border-blue-300" },
  wip: { vn: "Đang xây", cls: "bg-amber-100 text-amber-800 border-amber-300" },
  planned: { vn: "Sắp có", cls: "bg-slate-100 text-slate-700 border-slate-300" },
};

export default function ConnectPage() {
  const total = INTEGRATIONS.reduce((s, g) => s + g.items.length, 0);
  const live = INTEGRATIONS.reduce((s, g) => s + g.items.filter((i) => i.status === "live").length, 0);

  return (
    <AecModuleShell group="Connect" name="Atlas Connect — Integrations marketplace" subtitle={`${total} tích hợp với ERP VN (Bravo/FAST/Mego/MISA), banking (BIDV/Vietinbank/ZaloPay/MoMo), e-Gov (TCT/BHXH/DVCQG), BIM (ACC/Forge/Trimble), comm (Zalo OA/Stringee/Resend). ${live} đã live.`}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Tổng integration</div><div className="mt-1 text-2xl font-bold">{total}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Production-ready</div><div className="mt-1 text-2xl font-bold text-emerald-700">{live}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Beta</div><div className="mt-1 text-2xl font-bold text-blue-700">{INTEGRATIONS.reduce((s, g) => s + g.items.filter((i) => i.status === "beta").length, 0)}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Đang xây / sắp có</div><div className="mt-1 text-2xl font-bold text-amber-700">{INTEGRATIONS.reduce((s, g) => s + g.items.filter((i) => i.status === "wip" || i.status === "planned").length, 0)}</div></CardBody></Card>
      </div>

      {INTEGRATIONS.map((g) => (
        <Card key={g.group} className="mt-4">
          <CardHeader><CardTitle>{g.group} <span className="text-sm font-normal text-slate-400">({g.items.length})</span></CardTitle></CardHeader>
          <CardBody className="p-0">
            <div className="grid grid-cols-1 divide-y divide-slate-100 md:grid-cols-2 md:divide-y-0 md:divide-x">
              {g.items.map((i) => {
                const m = STATUS_META[i.status] ?? STATUS_META.planned!;
                return (
                  <div key={i.name} className="flex items-start gap-3 p-4">
                    <div className="text-3xl">{i.icon}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-semibold text-slate-900">{i.name}</div>
                        <span className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-medium ${m.cls}`}>{m.vn}</span>
                        {i.oauth && <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">OAuth</span>}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500">{i.vendor}</div>
                      <div className="mt-1 text-xs text-slate-700">{i.what}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>
      ))}

      <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50/40 p-4">
        <CardTitle>Yêu cầu integration mới?</CardTitle>
        <p className="mt-2 text-sm text-slate-700">
          Liên hệ <a href="mailto:partners@aecplatform.vn" className="text-blue-600 underline">partners@aecplatform.vn</a> để propose integration mới. SDK + webhook docs có sẵn cho partner build extension. Enterprise tier có custom connector 50h/năm bundled.
        </p>
      </div>
    </AecModuleShell>
  );
}
