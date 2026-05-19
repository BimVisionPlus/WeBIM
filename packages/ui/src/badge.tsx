import * as React from "react";
import { cn } from "./cn";

type Variant = "default" | "neutral" | "info" | "success" | "warning" | "danger" | "violet" | "amber";

const variants: Record<Variant, string> = {
  default: "bg-slate-100 text-slate-700 ring-slate-200",
  neutral: "bg-slate-100 text-slate-700 ring-slate-200",
  info: "bg-blue-50 text-blue-700 ring-blue-200",
  success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  warning: "bg-amber-50 text-amber-800 ring-amber-200",
  danger: "bg-rose-50 text-rose-700 ring-rose-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}

/** Map workflow state names → badge variants. Used in issue lists. */
export function stateBadgeVariant(state: string): Variant {
  const s = state.toUpperCase();
  if (["CLOSED", "FINALIZED", "PAID", "ACCEPTED", "APPROVED", "VERIFIED", "SUCCESS", "SIGNED"].includes(s))
    return "success";
  if (["REJECTED", "FAILED", "CRITICAL"].includes(s)) return "danger";
  if (["DRAFT", "REWORK", "RETURNED"].includes(s)) return "neutral";
  if (["OPEN", "SUBMITTED", "SCHEDULED", "ESTIMATING", "PENDING", "INPROGRESS"].includes(s)) return "info";
  if (
    ["IN_PROGRESS", "UNDER_REVIEW", "CDT_REVIEW", "ROOT_CAUSE", "CAR_PROPOSED", "CAR_APPROVED", "RECTIFIED", "READY_FOR_INSPECTION"].includes(s)
  )
    return "warning";
  return "violet";
}
