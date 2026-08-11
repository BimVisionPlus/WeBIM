"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Card, CardBody, CardHeader, CardTitle } from "@atlas/ui";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await fetch("/api/auth/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setBusy(false);
    setDone(true);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quên mật khẩu</CardTitle>
      </CardHeader>
      <CardBody>
        {done ? (
          <div className="space-y-3 text-sm text-[rgb(var(--ink-2))]">
            <p>Nếu email tồn tại, chúng tôi đã gửi liên kết đặt lại trong vài phút tới.</p>
            <Link href="/signin" className="text-blue-600 text-sm">← Quay lại đăng nhập</Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <label className="block">
              <span className="block text-xs font-medium text-[rgb(var(--ink-2))]">Email</span>
              <input
                className="mt-1 w-full rounded-md border border-[rgb(var(--line-2))] px-3 py-2 text-sm"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Đang gửi…" : "Gửi liên kết đặt lại"}
            </Button>
          </form>
        )}
      </CardBody>
    </Card>
  );
}
