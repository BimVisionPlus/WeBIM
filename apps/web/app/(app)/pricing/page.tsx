import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { AecModuleShell } from "@/components/aec-module-shell";

export const dynamic = "force-dynamic";

const TIERS: Array<{
  key: string;
  name: string;
  badge?: string;
  highlight?: boolean;
  priceVnd: string;
  priceSub: string;
  seats: string;
  cta: string;
  features: string[];
}> = [
  {
    key: "trial",
    name: "Pilot trial",
    badge: "30 ngày miễn phí",
    priceVnd: "0₫",
    priceSub: "30 ngày · 5 seat / 1 dự án",
    seats: "5 user",
    cta: "Đăng ký",
    features: [
      "1 dự án (≤ 50 tỉ giá trị HĐ)",
      "Tất cả 38 module + 5 Atlas Suite",
      "Tất cả 11 tính năng AI",
      "Lưu trữ S3/MinIO 50 GB",
      "Hỗ trợ email (24h SLA)",
    ],
  },
  {
    key: "pro",
    name: "Pro",
    highlight: true,
    badge: "Recommended cho NT vừa-lớn",
    priceVnd: "490.000₫",
    priceSub: "/seat/tháng · billed năm",
    seats: "10-100 user",
    cta: "Liên hệ sales",
    features: [
      "Không giới hạn dự án",
      "Tất cả 38 module + 5 Atlas Suite + roadmap 06+",
      "Tất cả 11 AI features (Groq 100k token/ngày)",
      "Lưu trữ S3/MinIO 500 GB",
      "Audit log + CSV export NĐ 06/2021",
      "Email transactional (Resend domain riêng)",
      "Hỗ trợ chat 8h SLA",
      "BHXH eService + HĐĐT NĐ 123/2020",
    ],
  },
  {
    key: "enterprise",
    name: "Enterprise (on-prem)",
    badge: "VPS riêng / on-prem",
    priceVnd: "Tùy quy mô",
    priceSub: "Báo giá theo dự án",
    seats: "Không giới hạn",
    cta: "Liên hệ sales",
    features: [
      "Tất cả Pro tier",
      "On-prem Ollama (Qwen 32B + Whisper) — không gửi data ra ngoài",
      "Lưu trữ S3/MinIO không giới hạn",
      "VPS riêng (Hetzner / Viettel IDC / VNPT IDC)",
      "Tích hợp Bravo / FAST / Mego ERP",
      "VNPT-CA / Viettel-CA chữ ký số native",
      "Hỗ trợ phone 4h SLA + on-site quarterly",
      "Custom workflow + custom module 50h/năm",
      "DPA + ISO 27001 compliance package",
    ],
  },
];

const COMPARE_TIERS = [
  { tier: "Pilot trial", monthly: "0₫", users: 5, projects: 1, ai: "✓", oss: "✕", onprem: "✕", erp: "✕" },
  { tier: "Pro", monthly: "490k₫/seat", users: "10-100", projects: "∞", ai: "✓", oss: "✕", onprem: "✕", erp: "✓ Bravo/FAST" },
  { tier: "Enterprise", monthly: "Báo giá", users: "∞", projects: "∞", ai: "✓", oss: "✓ Ollama", onprem: "✓", erp: "✓ Custom" },
];

export default function PricingPage() {
  return (
    <AecModuleShell group="Giá" name="Báo giá Viwase Quản lý công việc" subtitle="3 gói — Pilot miễn phí 30 ngày · Pro per-seat · Enterprise on-prem. VAT 8% chưa bao gồm.">
      {/* Hero */}
      <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-blue-700">Reference benchmark</div>
            <h3 className="mt-1 text-base font-semibold text-slate-900">Procore Pro cho công ty 50 seat tại VN: ~$5,000/tháng (≈ 120 tr ₫/tháng).</h3>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Viwase Pro 50 seat = <strong className="text-blue-700">24,5 triệu ₫/tháng</strong> — bằng <strong className="text-blue-700">20%</strong> giá Procore, có sẵn NĐ 06/2021 + VBHN 06/VBHN-BXD + NĐ 15/2021 + BHXH + PCCC + HĐĐT NĐ 123/2020 + tiếng Việt + 11 AI features OSS-only.
            </p>
          </div>
          <a href="mailto:sales@aecplatform.vn" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            sales@aecplatform.vn →
          </a>
        </div>
      </div>

      {/* Three tier cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        {TIERS.map((t) => (
          <Card key={t.key} className={t.highlight ? "border-blue-500 shadow-lg" : ""}>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle>{t.name}</CardTitle>
                {t.badge && <Badge variant={t.highlight ? "info" : "neutral"}>{t.badge}</Badge>}
              </div>
            </CardHeader>
            <CardBody>
              <div className="text-3xl font-bold text-slate-900">{t.priceVnd}</div>
              <div className="mt-0.5 text-xs text-slate-500">{t.priceSub}</div>
              <div className="mt-1 text-[11px] uppercase tracking-wide text-slate-400">{t.seats}</div>
              <a href="mailto:sales@aecplatform.vn?subject=Pricing inquiry — Viwase Quản lý công việc" className={`mt-3 inline-flex w-full justify-center rounded-md px-4 py-2 text-sm font-semibold ${t.highlight ? "bg-blue-600 text-white hover:bg-blue-700" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}>
                {t.cta} →
              </a>
              <ul className="mt-4 space-y-1.5 text-sm">
                {t.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-slate-700">
                    <span className="mt-0.5 text-emerald-600">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Quick compare table */}
      <Card className="mt-6">
        <CardHeader><CardTitle>So sánh nhanh</CardTitle></CardHeader>
        <CardBody className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="p-3 text-left">Gói</th>
                <th className="p-3 text-right">Giá/tháng</th>
                <th className="p-3 text-right">Users</th>
                <th className="p-3 text-right">Projects</th>
                <th className="p-3 text-center">AI features</th>
                <th className="p-3 text-center">OSS / Ollama local</th>
                <th className="p-3 text-center">On-prem deploy</th>
                <th className="p-3 text-center">ERP integration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {COMPARE_TIERS.map((t) => (
                <tr key={t.tier}>
                  <td className="p-3 font-medium">{t.tier}</td>
                  <td className="p-3 text-right">{t.monthly}</td>
                  <td className="p-3 text-right">{t.users}</td>
                  <td className="p-3 text-right">{t.projects}</td>
                  <td className="p-3 text-center">{t.ai}</td>
                  <td className="p-3 text-center">{t.oss}</td>
                  <td className="p-3 text-center">{t.onprem}</td>
                  <td className="p-3 text-center">{t.erp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>

      {/* FAQ */}
      <Card className="mt-6">
        <CardHeader><CardTitle>Câu hỏi hay gặp</CardTitle></CardHeader>
        <CardBody>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="font-medium text-slate-900">Có hợp đồng tối thiểu không?</dt>
              <dd className="mt-0.5 text-slate-600">Pro: cam kết 12 tháng, billed năm. Enterprise: 24 tháng. Pilot trial: 30 ngày không cam kết, sau 30 ngày tự đóng nếu không upgrade.</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-900">VAT 8% / 10%?</dt>
              <dd className="mt-0.5 text-slate-600">VAT 8% (theo NQ 41/2025/QH15 giảm tạm tới 30/6/2026). Sau đó về 10%. HĐ Đ T xuất qua TCT 24h theo NĐ 123/2020.</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-900">Có giảm giá theo số seat không?</dt>
              <dd className="mt-0.5 text-slate-600">Pro: 100+ seat giảm 15%, 200+ seat giảm 25%. Enterprise: báo giá thiết kế riêng.</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-900">On-prem deploy mất bao lâu?</dt>
              <dd className="mt-0.5 text-slate-600">Docker compose 1 lệnh. Cần VPS / IDC: 4 vCPU, 16 GB RAM, 200 GB SSD, 100 Mbps. Setup + training: 5-7 ngày làm việc.</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-900">AI gửi data ra Groq / Cloudflare có an toàn không?</dt>
              <dd className="mt-0.5 text-slate-600">Pro tier: dùng Groq + Cloudflare Workers AI (OSS models, không train data theo TOS). Enterprise tier: 100% on-prem Ollama, không 1 byte ra ngoài.</dd>
            </div>
          </dl>
        </CardBody>
      </Card>

      <div className="mt-6 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
        Báo giá tham khảo, có thể thay đổi theo từng thương vụ. Liên hệ <a href="mailto:sales@aecplatform.vn" className="text-blue-600 underline">sales@aecplatform.vn</a> hoặc xem trang <a href="/compare" className="text-blue-600 underline">/compare</a> để so sánh chi tiết với Procore / Autodesk Construction Cloud.
      </div>
    </AecModuleShell>
  );
}
