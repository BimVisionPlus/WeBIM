"use client";
import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@atlas/ui";

const fmt = (n: number | string | null | undefined) => {
  if (n == null) return "—";
  const v = typeof n === "string" ? Number(n) : n;
  if (!isFinite(v)) return "—";
  return new Intl.NumberFormat("vi-VN").format(Math.round(v)) + " ₫";
};

export function NormSearchPanel({ showEstimate }: { showEstimate: boolean }) {
  const [q, setQ] = useState("bê tông");
  const [province, setProvince] = useState("HCM");
  const [period, setPeriod] = useState("2026-Q2");
  const [rows, setRows] = useState<Array<any>>([]);
  const [loading, setLoading] = useState(false);

  const [estCode, setEstCode] = useState("");
  const [estQty, setEstQty] = useState("100");
  const [estResult, setEstResult] = useState<any>(null);
  const [estBusy, setEstBusy] = useState(false);

  async function search() {
    setLoading(true);
    const r = await fetch(`/api/cost-norm/search?q=${encodeURIComponent(q)}&province=${province}&period=${period}`);
    const j = await r.json();
    setRows(j.rows ?? []);
    setLoading(false);
  }

  useEffect(() => { search(); /* eslint-disable-next-line */ }, []);

  async function estimate(code?: string) {
    const useCode = code ?? estCode;
    if (!useCode) return;
    setEstBusy(true);
    const r = await fetch("/api/cost-norm/estimate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: useCode, qty: Number(estQty) || 1, province, period }),
    });
    const j = await r.json();
    setEstResult(j);
    setEstCode(useCode);
    setEstBusy(false);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Tra cứu định mức (TT 10/2019)</CardTitle></CardHeader>
        <CardBody>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Từ khoá</span>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="bê tông móng, AB.13, cốt thép" className="mt-1 rounded border border-[rgb(var(--line-2))] px-2 py-1.5 text-xs min-w-[280px]" />
            </label>
            <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Tỉnh</span>
              <select value={province} onChange={(e) => setProvince(e.target.value)} className="mt-1 rounded border border-[rgb(var(--line-2))] px-2 py-1.5 text-xs">
                <option value="HCM">TP. HCM</option><option value="HN">Hà Nội</option><option value="DN">Đà Nẵng</option><option value="BD">Bình Dương</option>
              </select>
            </label>
            <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Kỳ</span>
              <select value={period} onChange={(e) => setPeriod(e.target.value)} className="mt-1 rounded border border-[rgb(var(--line-2))] px-2 py-1.5 text-xs">
                <option value="2026-Q2">Q2/2026</option><option value="2026-Q1">Q1/2026</option><option value="2025-Q4">Q4/2025</option>
              </select>
            </label>
            <button onClick={search} disabled={loading} className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-[rgb(var(--inverse-ink))] disabled:opacity-50">{loading ? "…" : "Tìm"}</button>
          </div>

          <div className="mt-3 overflow-hidden rounded border border-[rgb(var(--line))]">
            <table className="w-full text-sm">
              <thead className="bg-[rgb(var(--raised))] text-xs uppercase text-[rgb(var(--muted))]">
                <tr><th className="p-2 text-left">Mã</th><th className="p-2 text-left">Hạng mục</th><th className="p-2 text-left">ĐVT</th><th className="p-2 text-right">Đơn giá</th><th className="p-2 text-right">VL</th><th className="p-2 text-right">NC</th><th className="p-2 text-right">Máy</th>{showEstimate && <th className="p-2"></th>}</tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--line))]">
                {rows.length === 0 ? (
                  <tr><td colSpan={showEstimate ? 8 : 7} className="p-6 text-center text-xs text-[rgb(var(--muted))]">Không có kết quả. Thử "bê tông", "cốt thép", "trát"...</td></tr>
                ) : rows.map((r) => (
                  <tr key={r.id} className="hover:bg-[rgb(var(--raised))]">
                    <td className="p-2 font-mono text-xs">{r.code}</td>
                    <td className="p-2 text-xs"><div className="font-medium">{r.title}</div><div className="text-[10px] text-[rgb(var(--muted))]">{r.section}</div></td>
                    <td className="p-2 text-xs">{r.unit}</td>
                    <td className="p-2 text-right text-xs font-medium">{fmt(r.unitPriceVnd)}</td>
                    <td className="p-2 text-right text-xs text-[rgb(var(--muted))]">{fmt(r.vlCostVnd)}</td>
                    <td className="p-2 text-right text-xs text-[rgb(var(--muted))]">{fmt(r.ncCostVnd)}</td>
                    <td className="p-2 text-right text-xs text-[rgb(var(--muted))]">{fmt(r.mCostVnd)}</td>
                    {showEstimate && <td className="p-2"><button onClick={() => estimate(r.code)} className="rounded border border-blue-600 px-2 py-0.5 text-[11px] text-blue-700 hover:bg-blue-50">Lập dự toán</button></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      {showEstimate && (
        <Card>
          <CardHeader><CardTitle>Lập dự toán nhanh</CardTitle></CardHeader>
          <CardBody>
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Mã định mức</span>
                <input value={estCode} onChange={(e) => setEstCode(e.target.value.toUpperCase())} placeholder="AB.13211" className="mt-1 rounded border border-[rgb(var(--line-2))] px-2 py-1.5 text-xs font-mono" />
              </label>
              <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Khối lượng</span>
                <input value={estQty} onChange={(e) => setEstQty(e.target.value)} type="number" step="0.01" className="mt-1 rounded border border-[rgb(var(--line-2))] px-2 py-1.5 text-xs w-32" />
              </label>
              <button onClick={() => estimate()} disabled={estBusy || !estCode} className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-[rgb(var(--inverse-ink))] disabled:opacity-50">{estBusy ? "…" : "Tính"}</button>
            </div>

            {estResult?.ok && (
              <div className="mt-4 rounded border border-blue-200 bg-blue-50/40 p-3">
                <div className="text-xs text-[rgb(var(--muted))]">{estResult.code} — {estResult.title}</div>
                <div className="mt-1 text-xl font-bold text-blue-700">{fmt(estResult.totalVnd)}</div>
                <div className="text-[11px] text-[rgb(var(--muted))]">cho {estResult.qty} {estResult.unit} tại {estResult.province} kỳ {estResult.period}{estResult.priceSource ? ` — nguồn: ${estResult.priceSource}` : ""}</div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded bg-[rgb(var(--surface))] p-2"><div className="text-[rgb(var(--muted))]">Vật liệu</div><div className="font-medium">{fmt(estResult.breakdown.vatLieuVnd)}</div></div>
                  <div className="rounded bg-[rgb(var(--surface))] p-2"><div className="text-[rgb(var(--muted))]">Nhân công</div><div className="font-medium">{fmt(estResult.breakdown.nhanCongVnd)}</div></div>
                  <div className="rounded bg-[rgb(var(--surface))] p-2"><div className="text-[rgb(var(--muted))]">Máy</div><div className="font-medium">{fmt(estResult.breakdown.mayThiCongVnd)}</div></div>
                </div>
                {estResult.resources?.length > 0 && (
                  <div className="mt-3">
                    <div className="text-[11px] font-medium text-[rgb(var(--ink-2))]">Hao phí định mức (top {estResult.resources.length}):</div>
                    <ul className="mt-1 space-y-0.5 text-[11px] text-[rgb(var(--muted))]">
                      {estResult.resources.map((r: any, i: number) => (
                        <li key={i}>· {r.description} — {r.totalQuantity.toLocaleString("vi-VN", { maximumFractionDigits: 2 })} {r.unit} <span className="text-[rgb(var(--muted-2))]">({r.type})</span></li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            {estResult?.error && <div className="mt-3 rounded border border-rose-300 bg-rose-50 p-2 text-xs text-rose-800">{estResult.error}</div>}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
