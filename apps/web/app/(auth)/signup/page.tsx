"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card, CardBody, CardHeader, CardTitle } from "@atlas/ui";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const r = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setErr(j.error ?? "Không thể tạo tài khoản");
      setBusy(false);
      return;
    }
    await signIn("credentials", { email, password, redirect: false });
    router.push("/onboarding/org");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tạo tài khoản</CardTitle>
      </CardHeader>
      <CardBody>
        <form className="space-y-3" onSubmit={submit}>
          <Field label="Họ và tên" value={name} setValue={setName} type="text" autoComplete="name" />
          <Field label="Email" value={email} setValue={setEmail} type="email" autoComplete="email" />
          <Field label="Mật khẩu" value={password} setValue={setPassword} type="password" autoComplete="new-password" />
          <p className="text-xs text-[rgb(var(--muted))]">Tối thiểu 8 ký tự, gồm chữ và số.</p>
          {err && <div className="rounded bg-rose-50 px-3 py-2 text-xs text-rose-700">{err}</div>}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Đang tạo…" : "Tạo tài khoản"}
          </Button>
          <div className="text-xs text-[rgb(var(--muted))] text-center">
            Đã có tài khoản? <Link href="/signin" className="text-blue-600">Đăng nhập</Link>
          </div>
          <p className="pt-2 text-center text-[11px] text-[rgb(var(--muted-2))]">
            Bằng việc tạo tài khoản, bạn đồng ý với{" "}
            <Link href="/terms" className="underline">Điều khoản</Link> và{" "}
            <Link href="/privacy" className="underline">Chính sách bảo mật</Link>.
          </p>
        </form>
      </CardBody>
    </Card>
  );
}

function Field(props: { label: string; value: string; setValue: (s: string) => void; type: string; autoComplete?: string }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-[rgb(var(--ink-2))]">{props.label}</span>
      <input
        className="mt-1 w-full rounded-md border border-[rgb(var(--line-2))] px-3 py-2 text-sm"
        type={props.type}
        autoComplete={props.autoComplete}
        required
        value={props.value}
        onChange={(e) => props.setValue(e.target.value)}
      />
    </label>
  );
}
