import * as React from "react";
import { cn } from "./cn";

/** Empty-state placeholder for tables and lists. */
export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("p-10 text-center", className)}>
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[rgb(var(--raised))] text-[rgb(var(--muted-2))]">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 4v16M4 12h16" />
        </svg>
      </div>
      <div className="text-sm font-medium text-[rgb(var(--ink))]">{title}</div>
      {description && <div className="mt-1 text-xs text-[rgb(var(--muted))]">{description}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Skeleton placeholder for table rows. */
export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="divide-y divide-[rgb(var(--line))]">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-3">
          {Array.from({ length: cols }).map((_, j) => (
            <div
              key={j}
              className="h-3 animate-pulse rounded bg-[rgb(var(--raised))]"
              style={{ width: `${15 + ((i + j) % 4) * 12}%` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Inline error display for forms (paired with API friendly-error envelope). */
export function FormErrorList({
  error,
}: {
  error: { message?: string; fields?: Record<string, string> } | null | undefined;
}) {
  if (!error) return null;
  const fields = error.fields ?? {};
  const keys = Object.keys(fields);
  return (
    <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
      {error.message && <div className="font-medium">{error.message}</div>}
      {keys.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {keys.map((k) => (
            <li key={k}>
              <span className="font-mono">{k}</span>: {fields[k]}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
