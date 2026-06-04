"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * Self-serve guided tour of the demo. Triggered by ?tour=1 or a button.
 * Auto-advances or manual nav.
 */

type Stop = {
  key: string;
  emoji: string;
  title: string;
  vn: string;
  url: string;
  callToAction: string;
  proof?: string; // what data to point at in the screenshot
};

const STOPS: Stop[] = [
  {
    key: "1",
    emoji: "🏠",
    title: "Home — 16 dự án, 6 phòng, KPI live",
    vn: "Mỗi phòng có tab riêng. Pie chart bên dưới phân bố theo trạng thái (Đúng tiến độ / Cảnh báo / Chậm) — real numbers từ Postgres, không phải mock.",
    url: "/",
    callToAction: "Mở trang Home",
    proof: "Tab Đấu thầu / Hành chính / TC-KT load instant — server-rendered.",
  },
  {
    key: "2",
    emoji: "🎯",
    title: "Atlas Vendor — sổ thầu phụ + công nợ",
    vn: "12 supplier thực: Hòa Phát, Holcim, Cadivi, Dulux, ABB, Daikin… 13 hợp đồng ACTIVE = 87 tỉ. Sổ công nợ PURCHASE/PAYMENT theo từng kỳ.",
    url: "/vendor",
    callToAction: "Vào Atlas Vendor",
    proof: "KPI hero: 20 cung cấp · 3 thầu phụ · 13 HĐ · 2,68 tỉ công nợ.",
  },
  {
    key: "3",
    emoji: "💰",
    title: "Atlas Cost — tra định mức + AI overrun",
    vn: "Gõ 'bê tông' → 8 mã định mức TT 10/2019 với đơn giá HCM/HN/ĐN/BD. Click 'Lập dự toán' → AB.31211 × 850 m³ = 1,513 tỉ.",
    url: "/cost",
    callToAction: "Vào Atlas Cost",
    proof: "AI dự báo cost overrun cho 1 dự án bất kỳ — Llama trả EVM + drivers + action.",
  },
  {
    key: "4",
    emoji: "✅",
    title: "Atlas Compliance — TCVN/QCVN + audit prep",
    vn: "8 chuẩn TCVN/QCVN seed sẵn. 5 audit prep workflow PC07 / Sở XD / Hoàn công QLNN — mỗi prep có % readiness bar.",
    url: "/compliance",
    callToAction: "Vào Atlas Compliance",
    proof: "AI compliance check: nhập dự án → score 0-100 per chuẩn + findings + recommendations.",
  },
  {
    key: "5",
    emoji: "📱",
    title: "Atlas Field (PWA) — Voice-to-form",
    vn: "Mở trên điện thoại để cài Home-screen. Nhấn nút mic → nói 'Đã đổ bê tông cột tầng 5, tiến độ 60%' → AI điền sẵn form Daily Log.",
    url: "/field",
    callToAction: "Mở trang Field (mobile-best)",
    proof: "Whisper + Llama tự phân 5 intent — INCIDENT / PPE / PROGRESS / DAILY_LOG / NCR.",
  },
  {
    key: "6",
    emoji: "📜",
    title: "Hồ sơ hoàn công — AI auto-draft 13 mục",
    vn: "Mỗi mục VIIIb (NĐ 06/2021) AI soạn 1 đoạn 150-200 từ dựa trên dữ liệu thực của dự án (BoQ + NCR + nghiệm thu).",
    url: "/hoancong",
    callToAction: "Vào Hồ sơ hoàn công",
    proof: "Click 'Tạo bằng AI' trên 1 mục bất kỳ — Llama trả VN narrative trong 1-2s.",
  },
  {
    key: "7",
    emoji: "📋",
    title: "Audit log — CSV export cho compliance officer",
    vn: "Mọi action (login / CRUD / workflow / AI) lưu vào AuditEvent. Lọc theo entity / user / time. Xuất CSV ngay.",
    url: "/audit",
    callToAction: "Vào Audit log",
    proof: "Bấm 'Xuất CSV' → download ngay, mở Excel kiểm — đủ 11 column.",
  },
];

export function DemoTour() {
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);

  // Auto-open on ?tour=1
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("tour") === "1") setOpen(true);
  }, []);

  const cur = STOPS[idx];
  const next = () => setIdx((i) => Math.min(STOPS.length - 1, i + 1));
  const prev = () => setIdx((i) => Math.max(0, i - 1));
  const close = () => setOpen(false);

  if (!cur) return null;

  return (
    <>
      <button
        onClick={() => { setIdx(0); setOpen(true); }}
        className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-700 px-5 py-3 text-sm font-semibold text-white shadow-xl hover:scale-105 transition"
        data-testid="open-tour"
      >
        🎬 Bắt đầu tour 7 chặng
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 px-4 py-8 backdrop-blur-sm" onClick={close}>
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()} data-testid="tour-modal">
            {/* Progress bar */}
            <div className="h-1.5 w-full bg-slate-100">
              <div className="h-full bg-gradient-to-r from-blue-600 to-indigo-700 transition-all" style={{ width: `${((idx + 1) / STOPS.length) * 100}%` }} />
            </div>

            <div className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-mono uppercase tracking-wider text-slate-400">
                    Chặng {idx + 1} / {STOPS.length}
                  </div>
                  <div className="mt-1 flex items-center gap-3">
                    <div className="text-4xl">{cur.emoji}</div>
                    <h3 className="text-xl font-bold text-slate-900">{cur.title}</h3>
                  </div>
                </div>
                <button onClick={close} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Đóng">✕</button>
              </div>

              <p className="mt-4 text-sm leading-relaxed text-slate-700">{cur.vn}</p>

              {cur.proof && (
                <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-900">
                  <span className="font-medium">Để khách nhìn:</span> {cur.proof}
                </div>
              )}

              <div className="mt-5 flex items-center gap-2">
                <Link
                  href={cur.url}
                  className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  onClick={close}
                  data-testid="tour-cta"
                >
                  {cur.callToAction} →
                </Link>
                <div className="ml-auto flex gap-2">
                  <button
                    onClick={prev}
                    disabled={idx === 0}
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                  >
                    ← Quay
                  </button>
                  <button
                    onClick={next}
                    disabled={idx === STOPS.length - 1}
                    className="rounded-md bg-slate-700 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40"
                    data-testid="tour-next"
                  >
                    Chặng kế →
                  </button>
                </div>
              </div>

              {/* Dot nav */}
              <div className="mt-4 flex justify-center gap-1.5">
                {STOPS.map((s, i) => (
                  <button
                    key={s.key}
                    onClick={() => setIdx(i)}
                    className={`h-1.5 rounded-full transition-all ${i === idx ? "w-8 bg-blue-600" : "w-1.5 bg-slate-300 hover:bg-slate-400"}`}
                    aria-label={`Chặng ${i + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
