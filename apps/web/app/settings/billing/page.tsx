import { prisma } from "@atlas/db";
import { getSession } from "@atlas/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { formatVnd, formatVndShort, planFeatures, aiActionPriceVnd, formatDateVn } from "@atlas/lib";

export const dynamic = "force-dynamic";

const FEATURE_LABEL: Record<string, string> = {
  winwork: "WinWork — Bidding",
  drawbridge: "DrawBridge — BIM",
  siteeye: "SiteEye — CV + safety",
  costpulse: "CostPulse — EVM",
  portfolio: "ProjectPulse — Portfolio",
  "trust.drift": "Trust drift > 30d",
  integrations: "API · Webhook · Connectors",
  on_prem: "On-prem deployment",
};

export default async function BillingPage() {
  const session = await getSession();
  if (!session) redirect("/signin?callbackUrl=/settings/billing");

  const memberships = await prisma.membership.findMany({
    where: { userId: session.userId },
    include: { org: true },
  });
  if (memberships.length === 0) redirect("/onboarding/org");

  // For now operate on the first org. Org switcher (separate task) will let user pick.
  const org = memberships[0]!.org;

  const [sub, plans] = await Promise.all([
    prisma.subscription.findUnique({ where: { orgId: org.id } }),
    prisma.plan.findMany({ where: { isActive: true }, orderBy: { createdAt: "asc" } }),
  ]);
  const plan = sub ? plans.find((p) => p.id === sub.planId) : plans.find((p) => p.code === "free");
  const planCode = plan?.code ?? "free";

  // 30-day AI cost rollup
  const since = new Date(Date.now() - 30 * 86_400_000);
  const events = await prisma.aiCostEvent.findMany({ where: { occurredAt: { gte: since } } });
  const totalCostVnd = events.reduce((s, e) => s + e.costVnd, 0n);

  const enabled = new Set<string>(planFeatures(planCode));
  const allFeatures: readonly string[] = [
    "winwork",
    "drawbridge",
    "siteeye",
    "costpulse",
    "portfolio",
    "trust.drift",
    "integrations",
    "on_prem",
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold">Gói dịch vụ &amp; Thanh toán</h1>
        <p className="mt-1 text-sm text-[rgb(var(--muted))]">{org.name} ({org.slug})</p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardBody className="py-3">
            <div className="text-xs text-[rgb(var(--muted))]">Gói hiện tại</div>
            <div className="mt-1 text-2xl font-bold capitalize">{plan?.name ?? "Free"}</div>
            <Badge variant={sub?.status === "ACTIVE" ? "success" : "neutral"}>
              {sub?.status ?? "FREE"}
            </Badge>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-3">
            <div className="text-xs text-[rgb(var(--muted))]">Tín dụng AI còn lại</div>
            <div className="mt-1 text-2xl font-bold">
              {sub ? formatVnd(sub.aiCreditVnd) : "—"}
            </div>
            <div className="text-[11px] text-[rgb(var(--muted))]">
              Giá hành động: {formatVnd(aiActionPriceVnd(planCode))}
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-3">
            <div className="text-xs text-[rgb(var(--muted))]">Chi phí AI 30 ngày</div>
            <div className="mt-1 text-2xl font-bold">{formatVndShort(totalCostVnd)}</div>
            <div className="text-[11px] text-[rgb(var(--muted))]">{events.length} hành động</div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tính năng được mở</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {allFeatures.map((f) => {
              const on = enabled.has(f);
              return (
                <div
                  key={f}
                  className={`rounded-md border p-3 text-sm ${
                    on
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-[rgb(var(--line))] bg-[rgb(var(--raised))] text-[rgb(var(--muted-2))]"
                  }`}
                >
                  <div className="font-medium">{FEATURE_LABEL[f] ?? f}</div>
                  <div className="mt-1 text-xs">{on ? "✓ Đã mở" : "Cần nâng cấp"}</div>
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Nâng cấp</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3 text-sm">
          <p className="text-[rgb(var(--ink-2))]">
            Atlas hiện hỗ trợ thanh toán <strong>chuyển khoản ngân hàng</strong> (gửi đề nghị,
            đội kế toán phát hành hóa đơn VAT theo TT 78/2021 và kích hoạt gói trong 1 ngày làm việc).
            Tích hợp VNPAY / MoMo / Stripe đang chờ kết nối nhà cung cấp.
          </p>
          <div className="rounded-md border border-[rgb(var(--line))] bg-[rgb(var(--raised))] p-3 text-xs text-[rgb(var(--muted))]">
            <div className="font-medium text-[rgb(var(--ink-2))]">Chuyển khoản:</div>
            <div className="mt-1">
              {process.env.BANK_NAME ?? "Vietcombank"} · {process.env.BANK_ACCOUNT ?? "0011 002 345 678"} · {process.env.BANK_HOLDER ?? "CTCP Atlas"}
            </div>
            <div>Nội dung: ATLAS-UPGRADE-{org.slug.toUpperCase()}-{plan?.code === "free" ? "PRO" : "BUSINESS"}</div>
          </div>
          <div className="flex gap-2">
            <Link
              href="/pricing"
              className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-[rgb(var(--inverse-ink))] hover:bg-blue-700"
            >
              Xem bảng giá
            </Link>
            <Link
              href={`mailto:billing@atlas-aec.vn?subject=Nâng cấp ${org.slug}`}
              className="rounded-md border border-[rgb(var(--line-2))] px-3 py-2 text-sm hover:bg-[rgb(var(--raised))]"
            >
              Gửi yêu cầu nâng cấp
            </Link>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hóa đơn &amp; thanh toán</CardTitle>
        </CardHeader>
        <CardBody className="text-sm text-[rgb(var(--muted))]">
          {sub ? (
            <>
              Phương thức: <strong>{sub.paymentMethod ?? "Chưa thiết lập"}</strong>
              {sub.renewsAt && (
                <> · Kỳ tiếp: <strong>{formatDateVn(sub.renewsAt)}</strong></>
              )}
            </>
          ) : (
            <>Bạn đang dùng gói Free. Khi nâng cấp, hóa đơn điện tử (TT 78/2021) sẽ gửi đến email tổ chức.</>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
