import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@atlas/auth";

export const dynamic = "force-dynamic";

export default async function CatalogLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/signin?callbackUrl=/catalog");

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-3">
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <a href="https://aecplatform.vn" className="hover:text-slate-900">AEC Platform</a>
            <span>/</span>
            <Link href="/" className="hover:text-slate-900">Viwase Quản lý công việc</Link>
            <span>/</span>
            <span className="font-semibold text-slate-900">Catalog</span>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Cấu kiện · vật tư · supplier registry (share giữa các dự án)
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-6">{children}</main>
    </div>
  );
}
