"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Org = { id: string; name: string; slug: string };

export function OrgSwitcher({ orgs, activeSlug }: { orgs: Org[]; activeSlug: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Hook must be called unconditionally (rules-of-hooks)
  useEffect(() => {
    if (!open) return;
    function close() { setOpen(false); }
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);

  const active = orgs.find((o) => o.slug === activeSlug) ?? orgs[0];
  if (!active) return null;

  async function pick(o: Org) {
    document.cookie = `atlas_active_org=${o.slug}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded-md px-2 py-1 text-sm hover:bg-slate-100"
      >
        <span className="font-medium">{active.name}</span>
        <svg className="h-3 w-3 text-slate-500" viewBox="0 0 12 12" fill="currentColor">
          <path d="M3 4l3 3 3-3" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-56 rounded-md border border-slate-200 bg-white shadow-md">
          {orgs.map((o) => (
            <button
              key={o.id}
              onClick={() => pick(o)}
              className={`block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                o.slug === active.slug ? "bg-blue-50 font-medium text-blue-700" : "text-slate-700"
              }`}
            >
              <div>{o.name}</div>
              <div className="text-[10px] text-slate-400">{o.slug}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
