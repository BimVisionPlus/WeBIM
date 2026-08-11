"use client";
import { useState } from "react";

export function StartForm() {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [industry, setIndustry] = useState("Xây dựng dân dụng");
  const [slugManual, setSlugManual] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; signinUrl: string; stats: Record<string, number> } | null>(null);

  // Auto-derive slug from company name
  function deriveSlug(c: string): string {
    return c
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/đ/g, "d")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 30);
  }

  const slug = slugManual || deriveSlug(company);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/tenant/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug, name: `${company} Pilot`, email,
          prospectName: name, company, industry,
          source: "self-serve /start",
        }),
      });
      const j = await r.json();
      if (!r.ok) { setErr(j.error ?? "Không tạo được"); setBusy(false); return; }
      setResult({ url: j.url, signinUrl: j.signinUrl, stats: j.stats });
    } catch (e: any) {
      setErr(e.message ?? "Lỗi mạng");
    } finally { setBusy(false); }
  }

  if (result) {
    return (
      <div className="space-y-4">
        <div className="text-center">
          <div className="text-5xl">🎉</div>
          <h3 className="mt-3 text-2xl font-bold">Sandbox đã sẵn sàng!</h3>
          <p className="mt-1 text-sm text-[rgb(var(--muted))]">
            {result.stats.projects} dự án · {result.stats.boqLines} dòng BoQ · {result.stats.issues} issue · {result.stats.scheduleTasks} công việc · {result.stats.dailyLogs} nhật ký
          </p>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="text-xs uppercase text-blue-700">URL của bạn</div>
          <div className="mt-1 font-mono text-sm font-bold text-blue-900">{result.url}</div>
        </div>
        <a
          href={result.signinUrl}
          className="block w-full rounded-lg bg-blue-600 px-4 py-3 text-center text-base font-semibold text-[rgb(var(--inverse-ink))] shadow-lg hover:bg-blue-700"
        >
          Đăng nhập ngay (1-cú-click) →
        </a>
        <p className="text-center text-xs text-[rgb(var(--muted))]">
          Email kèm link đã gửi tới <strong>{email}</strong>. Magic link hết hạn sau 24h.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4" data-testid="start-form">
      <h2 className="text-2xl font-bold">Tạo sandbox riêng cho công ty</h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="text-sm">
          <span className="block font-medium text-[rgb(var(--ink-2))]">Họ tên</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required className="mt-1 w-full rounded-md border border-[rgb(var(--line-2))] px-3 py-2 text-sm" placeholder="Nguyễn Văn A" />
        </label>
        <label className="text-sm">
          <span className="block font-medium text-[rgb(var(--ink-2))]">Email công ty</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1 w-full rounded-md border border-[rgb(var(--line-2))] px-3 py-2 text-sm" placeholder="ban-giam-doc@congty.vn" />
        </label>
        <label className="text-sm md:col-span-2">
          <span className="block font-medium text-[rgb(var(--ink-2))]">Tên công ty</span>
          <input value={company} onChange={(e) => setCompany(e.target.value)} required className="mt-1 w-full rounded-md border border-[rgb(var(--line-2))] px-3 py-2 text-sm" placeholder="CTCP Xây dựng ABC" />
        </label>
        <label className="text-sm">
          <span className="block font-medium text-[rgb(var(--ink-2))]">Lĩnh vực</span>
          <select value={industry} onChange={(e) => setIndustry(e.target.value)} className="mt-1 w-full rounded-md border border-[rgb(var(--line-2))] px-3 py-2 text-sm">
            <option>Xây dựng dân dụng</option>
            <option>Xây dựng công nghiệp</option>
            <option>Hạ tầng giao thông</option>
            <option>Cấp thoát nước</option>
            <option>Tư vấn giám sát</option>
            <option>Tư vấn thiết kế</option>
            <option>Chủ đầu tư BĐS</option>
            <option>Khác</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="block font-medium text-[rgb(var(--ink-2))]">URL sandbox</span>
          <div className="mt-1 flex items-center rounded-md border border-[rgb(var(--line-2))] bg-[rgb(var(--surface))] text-sm">
            <input value={slugManual || deriveSlug(company)} onChange={(e) => setSlugManual(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="cong-ty" className="flex-1 rounded-l-md px-3 py-2 outline-none" />
            <span className="rounded-r-md bg-[rgb(var(--raised))] px-3 py-2 text-xs text-[rgb(var(--muted))]">.aecplatform.vn</span>
          </div>
        </label>
      </div>
      {err && <div className="rounded-md border border-rose-300 bg-rose-50 p-3 text-xs text-rose-800">{err}</div>}
      <button type="submit" disabled={busy} className="w-full rounded-lg bg-blue-600 px-4 py-3 text-base font-semibold text-[rgb(var(--inverse-ink))] shadow-lg hover:bg-blue-700 disabled:opacity-50">
        {busy ? "Đang tạo sandbox… (15-30s)" : "Tạo sandbox miễn phí →"}
      </button>
      <p className="text-center text-xs text-[rgb(var(--muted))]">
        Đăng ký = đồng ý với <a href="/terms" className="underline">Điều khoản</a> + <a href="/privacy" className="underline">Bảo mật</a>. Không spam, không chia sẻ thông tin.
      </p>
    </form>
  );
}
