"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function VerifyEmailPage({
  searchParams,
}: {
  searchParams: { token?: string; email?: string };
}) {
  const [state, setState] = useState<"pending" | "ok" | "fail">("pending");
  const [msg, setMsg] = useState<string>("Đang xác minh…");

  useEffect(() => {
    const { token, email } = searchParams;
    if (!token || !email) {
      setState("fail");
      setMsg("Thiếu thông tin xác minh — liên kết không hợp lệ.");
      return;
    }
    (async () => {
      try {
        const r = await fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`);
        const j = await r.json().catch(() => ({}));
        if (r.ok && j.verified) {
          setState("ok");
          setMsg("Email của bạn đã được xác minh. Bạn có thể đăng nhập ngay.");
        } else {
          setState("fail");
          setMsg(j.error ?? "Xác minh thất bại.");
        }
      } catch (e: any) {
        setState("fail");
        setMsg(e?.message ?? "Lỗi mạng.");
      }
    })();
  }, [searchParams]);

  return (
    <div className="mx-auto mt-20 max-w-md rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-8 shadow-sm">
      <h1 className="text-xl font-semibold">Xác minh email</h1>
      <p
        className={
          "mt-3 text-sm " +
          (state === "ok" ? "text-emerald-700" : state === "fail" ? "text-rose-700" : "text-[rgb(var(--muted))]")
        }
      >
        {msg}
      </p>
      <div className="mt-6 flex gap-3 text-sm">
        <Link href="/signin" className="rounded-md bg-blue-600 px-3 py-2 font-medium text-[rgb(var(--inverse-ink))] hover:bg-blue-700">
          Đăng nhập
        </Link>
        <Link href="/" className="rounded-md border border-[rgb(var(--line-2))] px-3 py-2 hover:bg-[rgb(var(--raised))]">
          Về trang chủ
        </Link>
      </div>
    </div>
  );
}
