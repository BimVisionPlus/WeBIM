"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@atlas/ui";

type Tab = { href: string; label: string; group?: "common" | "general" | "aec" | "bid" };

// Universal tabs (everyone). Order matters — these come first.
const COMMON_TABS: Tab[] = [
  { href: "", label: "Tổng quan", group: "common" },
  { href: "/tinh-hinh", label: "Tình hình", group: "common" },
];
// General work tabs (most projects benefit: issues, crew log, daily log).
const GENERAL_TABS: Tab[] = [
  { href: "/site/issues", label: "Issues", group: "general" },
  { href: "/crews", label: "Crews", group: "general" },
  { href: "/site/change-orders", label: "Lệnh đổi", group: "general" },
  { href: "/site/daily-log", label: "Nhật ký", group: "general" },
];
// AEC construction-only tabs (irrelevant for non-construction depts).
const AEC_TABS: Tab[] = [
  { href: "/site/rfi", label: "RFI", group: "aec" },
  { href: "/site/submittals", label: "Submittal", group: "aec" },
  { href: "/site/ncr", label: "NCR", group: "aec" },
  { href: "/site/punch", label: "Punch", group: "aec" },
  { href: "/models", label: "Models", group: "aec" },
  { href: "/specs", label: "Specs", group: "aec" },
  { href: "/codeguard", label: "CodeGuard", group: "aec" },
  { href: "/drawbridge", label: "DrawBridge", group: "aec" },
  { href: "/siteeye", label: "SiteEye", group: "aec" },
  { href: "/costpulse", label: "CostPulse", group: "aec" },
  { href: "/handover", label: "Handover", group: "aec" },
];
// Tender / bidding subset (DAU_THAU).
const BID_TABS: Tab[] = [
  { href: "/specs", label: "Specs", group: "bid" },
  { href: "/costpulse", label: "CostPulse", group: "bid" },
];

function tabsFor(department: string | null | undefined): Tab[] {
  switch (department) {
    case "CONG_VIEC":
      // Construction-style project → full AEC stack.
      return [...COMMON_TABS, ...GENERAL_TABS, ...AEC_TABS];
    case "DAU_THAU":
      // Bidding pre-construction → general + bid-specific.
      return [...COMMON_TABS, ...GENERAL_TABS, ...BID_TABS];
    case "HANH_CHINH":
    case "TAI_CHINH_KE_TOAN":
    case "PHAT_TRIEN_THI_TRUONG":
    case "CONG_VIEC_KHAC":
      // Office / admin / market work → general tabs only, no construction.
      return [...COMMON_TABS, ...GENERAL_TABS];
    default:
      // Unknown / legacy → show everything to be safe.
      return [...COMMON_TABS, ...GENERAL_TABS, ...AEC_TABS];
  }
}

export function ProjectNav({ projectId, department }: { projectId: string; department?: string | null }) {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;
  const tabs = tabsFor(department);

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
