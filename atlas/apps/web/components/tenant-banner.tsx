/**
 * Tenant banner — shown only on `<slug>.aecplatform.vn` subdomains.
 *
 * Rendered as a sticky top-of-page strip. States:
 *   - ACTIVE  → "Sandbox của <Company> · X ngày còn lại · Upgrade ngay →"
 *   - EXPIRED → "Sandbox đã hết hạn · Đọc-only · Upgrade ngay →"
 *   - ARCHIVED → "Sandbox đã đóng" (route shouldn't reach here, but defensive)
 *
 * Server component — reads x-tenant-slug header via getTenantContext().
 */
import { getTenantContext } from "@/lib/tenant";

export async function TenantBanner() {
  const ctx = await getTenantContext();
  if (!ctx.org) return null;
  if (!ctx.org.isTenantDemo) return null;

  const status = ctx.org.tenantStatus;
  const expiresAt = ctx.org.tenantExpiresAt;
  const daysLeft = expiresAt ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 86_400_000)) : null;
  const company = ctx.org.prospectCompany ?? ctx.org.name;

  if (status === "ACTIVE" && daysLeft !== null && daysLeft > 0) {
    return (
      <div className="sticky top-0 z-50 flex items-center justify-between border-b border-blue-700 bg-gradient-to-r from-blue-600 to-indigo-700 px-4 py-2 text-xs text-[rgb(var(--inverse-ink))] shadow-sm">
        <div className="flex items-center gap-2">
          <span className="rounded bg-[rgb(var(--surface))]/20 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider">Sandbox</span>
          <span>
            <strong>{company}</strong>
            <span className="opacity-80"> · còn {daysLeft} ngày dùng thử</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <a href="https://app.aecplatform.vn/pricing" target="_blank" rel="noopener" className="rounded bg-[rgb(var(--surface))] px-2 py-0.5 text-[11px] font-medium text-blue-700 hover:bg-blue-50">
            Upgrade ngay →
          </a>
        </div>
      </div>
    );
  }

  if (status === "EXPIRED") {
    return (
      <div className="sticky top-0 z-50 flex items-center justify-between border-b border-amber-700 bg-gradient-to-r from-amber-600 to-orange-700 px-4 py-2 text-xs text-[rgb(var(--inverse-ink))] shadow-sm">
        <div className="flex items-center gap-2">
          <span className="rounded bg-[rgb(var(--surface))]/20 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider">Hết hạn</span>
          <span>
            <strong>{company}</strong>
            <span className="opacity-80"> · Sandbox đã hết hạn pilot · chế độ đọc-only · 7 ngày nữa sẽ đóng</span>
          </span>
        </div>
        <a href="https://app.aecplatform.vn/pricing" target="_blank" rel="noopener" className="rounded bg-[rgb(var(--surface))] px-2 py-0.5 text-[11px] font-medium text-amber-700 hover:bg-amber-50">
          Giữ dữ liệu · Upgrade →
        </a>
      </div>
    );
  }

  if (status === "ARCHIVED") {
    return (
      <div className="sticky top-0 z-50 flex items-center justify-between border-b border-rose-700 bg-gradient-to-r from-rose-700 to-red-800 px-4 py-2 text-xs text-[rgb(var(--inverse-ink))] shadow-sm">
        <span><strong>{company}</strong> · Sandbox đã đóng · liên hệ <a href="mailto:sales@aecplatform.vn" className="underline">sales@aecplatform.vn</a></span>
      </div>
    );
  }

  return null;
}
