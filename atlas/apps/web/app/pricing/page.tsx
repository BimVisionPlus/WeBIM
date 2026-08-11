import { prisma } from "@atlas/db";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { formatVnd } from "@atlas/lib";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const plans = await prisma.plan.findMany({ where: { isActive: true }, orderBy: { createdAt: "asc" } });

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-10">
      <header className="text-center">
        <h1 className="text-3xl font-bold">Bảng giá Atlas</h1>
        <p className="mt-2 text-sm text-[rgb(var(--muted))]">
          Self-serve. Không "liên hệ tư vấn". Pay-per-AI-action tách rời phí seat — bạn chỉ trả khi dùng.
        </p>
      </header>

      {plans.length === 0 ? (
        <Card>
          <CardBody className="p-8 text-center text-sm text-[rgb(var(--muted))]">
            Chưa có gói nào. Chạy <code className="rounded bg-[rgb(var(--raised))] px-1">pnpm db:seed</code>.
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {plans.map((p) => {
            const pricing = (p.pricingJson as any) ?? {};
            const features = (p.features as any) ?? {};
            return (
              <Card key={p.id} className={pricing.featured ? "ring-2 ring-blue-500" : ""}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{p.name}</span>
                    {pricing.featured && <Badge variant="info">Phổ biến</Badge>}
                  </CardTitle>
                </CardHeader>
                <CardBody className="space-y-3 text-sm">
                  <div>
                    <div className="text-2xl font-bold">
                      {pricing.priceMonthlyVnd ? formatVnd(BigInt(pricing.priceMonthlyVnd)) : "0đ"}
                    </div>
                    <div className="text-xs text-[rgb(var(--muted))]">/ user / tháng</div>
                  </div>
                  {pricing.aiActionVnd !== undefined && (
                    <div className="text-xs text-[rgb(var(--muted))]">
                      + {formatVnd(BigInt(pricing.aiActionVnd))} / hành động AI
                    </div>
                  )}
                  <ul className="space-y-1 text-xs text-[rgb(var(--ink-2))]">
                    {Array.isArray(features.bullets) &&
                      features.bullets.map((b: string) => (
                        <li key={b} className="flex items-start gap-1">
                          <span className="text-emerald-600">✓</span>
                          <span>{b}</span>
                        </li>
                      ))}
                  </ul>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      <div className="rounded-lg bg-[rgb(var(--raised))] p-6 text-sm">
        <h2 className="font-semibold">Vì sao Atlas khác MISA / Base</h2>
        <ul className="mt-2 space-y-1 text-[rgb(var(--ink-2))]">
          <li>· Tự host được (on-prem cho Enterprise), không khoá vendor.</li>
          <li>· AI 100% OSS, không gửi dữ liệu công trường ra cloud nước ngoài.</li>
          <li>· Bảng giá công khai, không "liên hệ tư vấn" cho mọi gói.</li>
          <li>· Tích hợp ngược với MISA + Base — bạn không cần bỏ hệ thống cũ.</li>
        </ul>
      </div>
    </div>
  );
}
