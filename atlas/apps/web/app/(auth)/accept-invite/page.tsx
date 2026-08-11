"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { Button, Card, CardBody, CardHeader, CardTitle } from "@atlas/ui";

function AcceptInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const token = sp.get("token") ?? "";
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [signedIn, setSignedIn] = useState<"unknown" | "yes" | "no">("unknown");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function accept(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const body: any = { token };
    if (signedIn === "no") {
      body.name = name;
      body.password = password;
    }
    const r = await fetch("/api/invites/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      if (r.status === 401 && signedIn === "unknown") {
        setSignedIn("no");
        return;
      }
      setErr(j.error ?? "Không thể chấp nhận lời mời");
      return;
    }
    // Auto-signin if we just created the account
    if (signedIn === "no") {
      // We need the email — get from invite check
      const me = await fetch("/api/me");
      if (!me.ok) await signIn("credentials", { redirect: false, callbackUrl: "/" });
    }
    router.push("/");
    router.refresh();
  }

  if (!token) {
    return <Card><CardBody className="text-sm text-rose-700">Liên kết không hợp lệ.</CardBody></Card>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Chấp nhận lời mời</CardTitle>
      </CardHeader>
      <CardBody>
        <form onSubmit={accept} className="space-y-3">
          {signedIn === "no" && (
            <>
              <p className="text-xs text-[rgb(var(--muted))]">Tạo tài khoản để tham gia tổ chức:</p>
              <label className="block">
                <span className="block text-xs font-medium text-[rgb(var(--ink-2))]">Họ và tên</span>
                <input
                  className="mt-1 w-full rounded-md border border-[rgb(var(--line-2))] px-3 py-2 text-sm"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-[rgb(var(--ink-2))]">Mật khẩu</span>
                <input
                  type="password"
                  className="mt-1 w-full rounded-md border border-[rgb(var(--line-2))] px-3 py-2 text-sm"
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <p className="text-xs text-[rgb(var(--muted))]">Tối thiểu 8 ký tự, gồm chữ và số.</p>
            </>
          )}
          {err && <div className="rounded bg-rose-50 px-3 py-2 text-xs text-rose-700">{err}</div>}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Đang xử lý…" : "Chấp nhận lời mời"}
          </Button>
          <div className="text-center text-xs">
            <Link href="/signin" className="text-blue-600">Đã có tài khoản? Đăng nhập</Link>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={null}>
      <AcceptInner />
    </Suspense>
  );
}
