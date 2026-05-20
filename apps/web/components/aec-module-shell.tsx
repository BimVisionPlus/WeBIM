/**
 * Shared chrome for the 13 aec-platform PM modules listed on the landing.
 * Renders the consistent "AEC Platform / aec-platform / <module>" breadcrumb
 * + title row so the org-level pages feel like one product rather than 13
 * disconnected screens.
 */

import Link from "next/link";

export function AecModuleShell({
  group,
  name,
  subtitle,
  children,
}: {
  group: string; // "Pháp lý" / "Thiết kế" / "Đấu thầu" / "Thi công" / "Bàn giao"
  name: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-3">
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <a href="https://aecplatform.vn" className="hover:text-slate-900">AEC Platform</a>
            <span>/</span>
            <Link href="/" className="hover:text-slate-900">aec-platform</Link>
            <span>/</span>
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700">{group}</span>
            <span>/</span>
            <span className="font-semibold text-slate-900">{name}</span>
          </div>
          <div className="mt-1 text-xs text-slate-500">{subtitle}</div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-6">{children}</main>
    </div>
  );
}
