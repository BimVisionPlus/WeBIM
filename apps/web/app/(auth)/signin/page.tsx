"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button, Card, CardBody, CardHeader, CardTitle } from "@atlas/ui";

function SigninInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const callbackUrl = sp.get("callbackUrl") ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const r = await signIn("credentials", { email, password, redirect: false, callbackUrl });
    setBusy(false);
    if (r?.error) {
      setErr(r.error === "LOCKED_OUT" ? "Tài khoản tạm khoá do nhập sai nhiều lần. Vui lòng thử lại sau 15 phút." : "Email hoặc mật khẩu không đúng.");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Đăng nhập</CardTitle>
      </CardHeader>
      <CardBody>
        <form className="space-y-3" onSubmit={submit}>
          <label className="block">
            <span className="block text-xs font-medium text-[rgb(var(--ink-2))]">Email</span>
            <input
              className="mt-1 w-full rounded-md border border-[rgb(var(--line-2))] px-3 py-2 text-sm"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-[rgb(var(--ink-2))]">Mật khẩu</span>
            <input
              className="mt-1 w-full rounded-md border border-[rgb(var(--line-2))] px-3 py-2 text-sm"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {err && <div className="rounded bg-rose-50 px-3 py-2 text-xs text-rose-700">{err}</div>}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Đang đăng nhập…" : "Đăng nhập"}
          </Button>
          <div className="flex justify-between text-xs text-[rgb(var(--muted))]">
            <Link href="/forgot" className="hover:text-[rgb(var(--ink))]">Quên mật khẩu?</Link>
            <Link href="/signup" className="hover:text-[rgb(var(--ink))]">Tạo tài khoản</Link>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SigninInner />
    </Suspense>
  );
}
