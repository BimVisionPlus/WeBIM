import Link from "next/link";

/**
 * Tiny "🕒" link → /audit?entityId=X (+ optional entity type filter).
 * Use anywhere a record is displayed to jump to its full audit history.
 */
export function AuditHistoryLink({ entityId, entityType, className }: { entityId: string; entityType?: string; className?: string }) {
  const qs = new URLSearchParams();
  qs.set("entityId", entityId);
  if (entityType) qs.set("entity", entityType);
  qs.set("days", "365");
  return (
    <Link
      href={`/audit?${qs.toString()}`}
      className={className ?? "text-[10px] text-slate-400 hover:text-blue-600"}
      title="Lịch sử thao tác trên bản ghi này"
      data-testid={`audit-history-${entityId}`}
    >🕒</Link>
  );
}
