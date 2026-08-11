const tiers = [
  {
    name: "Standard",
    target: "Nhà thầu nhỏ — 1-3 dự án",
    price: "4.9tr",
    seats: "10 user",
    features: [
      "Site (RFI, NCR, Punch, Daily Log)",
      "Models (BIM viewer + drawing sets)",
      "Specs wiki",
      "Storage 100GB",
      "Email support",
    ],
  },
  {
    name: "Pro",
    target: "Nhà thầu vừa — 4-20 dự án",
    price: "9.9tr",
    seats: "50 user",
    badge: "Phổ biến",
    features: [
      "Tất cả Standard",
      "Nghiệm thu NĐ 06/2021 (CV/GĐ/HT)",
      "Hồ sơ hoàn công auto-assembly",
      "Chữ ký số VNPT-CA/Viettel-CA",
      "HĐĐT NĐ 123/2020",
      "Storage 1TB",
      "Hỗ trợ Zalo 8h-22h",
    ],
  },
  {
    name: "Enterprise",
    target: "Tập đoàn — 20+ dự án, đa CTCP",
    price: "Liên hệ",
    seats: "Không giới hạn",
    features: [
      "Tất cả Pro",
      "Triển khai on-prem / private cloud",
      "SSO + AD/LDAP",
      "Custom workflow",
      "Storage tùy chọn",
      "SLA 99.9% + Account Manager riêng",
    ],
  },
];

export function Pricing() {
  return (
    <section className="bg-[rgb(var(--inverse-bg))]/30 py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-[rgb(var(--inverse-ink))] sm:text-4xl">Giá Việt Nam, giá trị Việt Nam</h2>
          <p className="mt-3 text-[rgb(var(--muted-2))]">
            VND. Không charge per-doc như Procore. Không charge per-API-call như Autodesk.
          </p>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={`relative rounded-lg border bg-[rgb(var(--inverse-bg))]/60 p-6 ${
                t.badge ? "border-blue-500" : "border-[rgb(var(--inverse-bg))]"
              }`}
            >
              {t.badge && (
                <div className="absolute -top-3 right-4 rounded-full bg-blue-600 px-3 py-0.5 text-xs font-medium text-[rgb(var(--inverse-ink))]">
                  {t.badge}
                </div>
              )}
              <div className="text-lg font-semibold text-[rgb(var(--inverse-ink))]">{t.name}</div>
              <div className="text-xs text-[rgb(var(--muted-2))]">{t.target}</div>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-[rgb(var(--inverse-ink))]">{t.price}</span>
                <span className="text-sm text-[rgb(var(--muted-2))]">VND/tháng</span>
              </div>
              <div className="text-xs text-[rgb(var(--muted))]">{t.seats}</div>
              <ul className="mt-4 space-y-2 text-sm text-[rgb(var(--inverse-ink))]">
                {t.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="text-blue-400">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
