"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@atlas/ui";

const tabs = [
  { href: "/winwork", label: "Tổng quan" },
  { href: "/winwork/tenders", label: "Cơ hội đấu thầu" },
  { href: "/winwork/bids", label: "Hồ sơ dự thầu" },
  { href: "/winwork/bonds", label: "Bảo lãnh" },
];

export function WinWorkNav() {
  const pathname = usePathname();
  return (
    <nav className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-6">
        {tabs.map((t) => {
          const active = t.href === "/winwork" ? pathname === t.href : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                "border-b-2 px-3 py-3 text-sm font-medium whitespace-nowrap transition",
                active
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-slate-600 hover:text-slate-900",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
