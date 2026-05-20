"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@atlas/ui";

const tabs = [
  { href: "", label: "Tổng quan" },
  { href: "/site/issues", label: "Issues" },
  { href: "/site/rfi", label: "RFI" },
  { href: "/site/submittals", label: "Submittal" },
  { href: "/site/ncr", label: "NCR" },
  { href: "/site/punch", label: "Punch" },
  { href: "/site/change-orders", label: "Lệnh đổi" },
  { href: "/site/daily-log", label: "Nhật ký" },
  { href: "/models", label: "Models" },
  { href: "/specs", label: "Specs" },
  { href: "/crews", label: "Crews" },
  { href: "/codeguard", label: "CodeGuard" },
  { href: "/drawbridge", label: "DrawBridge" },
  { href: "/siteeye", label: "SiteEye" },
  { href: "/costpulse", label: "CostPulse" },
  { href: "/handover", label: "Handover" },
];

export function ProjectNav({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;

  return (
    <nav className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-6">
        {tabs.map((t) => {
          const href = base + t.href;
          const active =
            t.href === ""
              ? pathname === base
              : pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={t.href}
              href={href}
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
