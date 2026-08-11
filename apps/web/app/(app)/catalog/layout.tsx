import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@atlas/auth";

export const dynamic = "force-dynamic";

export default async function CatalogLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/signin?callbackUrl=/catalog");

  return (
    <div className="min-h-screen bg-[rgb(var(--raised))]">
      <header className="border-b border-[rgb(var(--line))] bg-[rgb(var(--surface))]">
        <div className="mx-auto max-w-7xl px-6 py-3">
          <div className="flex items-center gap-3 text-sm text-[rgb(var(--muted))]">
            <a href="https://aecplatform.vn" className="hover:text-[rgb(var(--ink))]">AEC Platform</a>
            <span>/</span>
            <Link href="/" className="hover:text-[rgb(var(--ink))]">Atlas</Link>
            <span>/</span>
            <span className="font-semibold text-[rgb(var(--ink))]">Catalog</span>
          </div>
          <div className="mt-1 text-xs text-[rgb(var(--muted))]">
            Cấu kiện · vật tư · supplier registry (share giữa các dự án)
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-6">{children}</main>
    </div>
  );
}
