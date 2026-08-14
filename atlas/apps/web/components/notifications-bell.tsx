"use client";
/**
 * Chuông thông báo — nằm trong header của mọi module (AecModuleShell) và
 * trang danh sách dự án.
 *
 * Poll 60 s thay vì socket: thông báo ở đây là "dự án chờ bước của bạn",
 * không phải chat — trễ nửa phút không đổi hành động của ai, còn một đường
 * WebSocket riêng cho việc này là hạ tầng phải nuôi mãi.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

interface NotificationItem {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

const KIND_ICON: Record<string, string> = {
  STAGE_BLOCKED: "⛔",
  STAGE_CHANGED: "🏁",
  GATE_TASK_ASSIGNED: "📌",
  GATE_READY: "✅",
};

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = (await res.json()) as { items: NotificationItem[]; unread: number };
      setItems(data.items);
      setUnread(data.unread);
    } catch {
      // Mất mạng thoáng qua thì giữ danh sách cũ — chuông sai còn tệ hơn chuông trễ.
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 60_000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const markAllRead = async () => {
    setUnread(0);
    setItems((rows) => rows.map((row) => ({ ...row, readAt: row.readAt ?? new Date().toISOString() })));
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    }).catch(() => undefined);
  };

  return (
    <div className="relative" ref={rootRef} data-testid="notifications-bell">
      <button
        onClick={() => setOpen((value) => !value)}
        className="relative rounded p-1 text-[rgb(var(--muted))] hover:text-[rgb(var(--ink))]"
        title="Thông báo"
        aria-label={`Thông báo${unread > 0 ? ` (${unread} chưa đọc)` : ""}`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-96 max-w-[90vw] rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--surface))] shadow-2xl">
          <div className="flex items-center justify-between border-b border-[rgb(var(--line))] px-3 py-2">
            <span className="text-sm font-semibold">Thông báo</span>
            {unread > 0 && (
              <button onClick={() => void markAllRead()} className="text-xs text-blue-600 hover:underline">
                Đánh dấu đã đọc hết
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <div className="p-6 text-center text-sm text-[rgb(var(--muted))]">Chưa có thông báo nào.</div>
            ) : (
              items.map((item) => {
                const inner = (
                  <div className={`flex gap-2 px-3 py-2 text-sm ${item.readAt ? "opacity-60" : ""}`}>
                    <span aria-hidden>{KIND_ICON[item.kind] ?? "🔔"}</span>
                    <span className="min-w-0">
                      <span className="block font-medium">{item.title}</span>
                      {item.body && (
                        <span className="block text-xs text-[rgb(var(--muted))]">{item.body}</span>
                      )}
                      <span className="block text-[11px] text-[rgb(var(--muted))]">
                        {new Date(item.createdAt).toLocaleString("vi-VN", { hour12: false })}
                      </span>
                    </span>
                  </div>
                );
                return item.link ? (
                  <Link key={item.id} href={item.link} className="block border-b border-[rgb(var(--line))] last:border-b-0 hover:bg-[rgb(var(--raised))]" onClick={() => setOpen(false)}>
                    {inner}
                  </Link>
                ) : (
                  <div key={item.id} className="border-b border-[rgb(var(--line))] last:border-b-0">{inner}</div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
