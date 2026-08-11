"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button, Card, CardBody, CardHeader, CardTitle } from "@atlas/ui";

function ResetInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const token = sp.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const r = await fetch("/api/auth/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    setBusy(false);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setErr(j.error ?? "Đặt lại không thành công");
      return;
    }
    setDone(true);
    setTimeout(() => router.push("/signin"), 1500);
  }

  if (!token) {
    return (
      <Card>
        <CardBody className="text-sm text-rose-700">Liên kết không hợp lệ.</CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Đặt lại mật khẩu</CardTitle>
      </CardHeader>
      <CardBody>
        {done ? (
          <div className="text-sm text-emerald-700">
            Đã đặt lại mật khẩu. Đang chuyển sang trang đăng nhập…
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <label className="block">
              <span className="block text-xs font-medium text-[rgb(var(--ink-2))]">Mật khẩu mới</span>
              <input
                className="mt-1 w-full rounded-md border border-[rgb(var(--line-2))] px-3 py-2 text-sm"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <p className="text-xs text-[rgb(var(--muted))]">Tối thiểu 8 ký tự, gồm chữ và số.</p>
            {err && <div className="rounded bg-rose-50 px-3 py-2 text-xs text-rose-700">{err}</div>}
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Đang đặt lại…" : "Đặt lại mật khẩu"}
            </Button>
            <div className="text-center text-xs">
              <Link href="/signin" className="text-blue-600">Quay lại đăng nhập</Link>
            </div>
          </form>
        )}
      </CardBody>
    </Card>
  );
}

export default function ResetPage() {
  return (
    <Suspense fallback={null}>
      <ResetInner />
    </Suspense>
  );
}
