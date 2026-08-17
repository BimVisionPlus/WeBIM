// SO SÁNH HAI PHIÊN BẢN PDF — overlay kiểu dân bản vẽ: đỏ = nét bản cũ đã
// mất, xanh = nét bản mới thêm vào, xám = giữ nguyên. Trả lời câu "revision
// C02 đổi gì so với C01" bằng MỘT hình thay vì hai tờ đặt cạnh nhau.
//
// Hai bản được render về CÙNG bề rộng (1200px) trước khi diff — hai file có
// thể khác khổ giấy; phần trang này có mà trang kia không được coi là giấy
// trắng (alpha 0 → không mực), tức là hiện như "thêm/xoá" — đúng bản chất.

import { useEffect, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { blendDiff, type DiffStats } from "../application/pdfDiff";

// pdf.js cần worker TRƯỚC lần getDocument đầu tiên. PdfMarkup cũng set dòng
// này — nhưng nếu người dùng mở So sánh trước khi từng mở pane Bản vẽ,
// module kia chưa evaluated và getDocument sẽ treo im lặng chờ worker.
// Set ở đây nữa: idempotent, rẻ, và không phụ thuộc thứ tự import.
pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

const TARGET_WIDTH = 1200;

async function renderPage(
  url: string,
  pageIndex: number,
): Promise<{ pixels: Uint8ClampedArray; width: number; height: number; pages: number }> {
  const task = pdfjs.getDocument(url);
  const pdf = await task.promise;
  const page = await pdf.getPage(Math.min(pageIndex, pdf.numPages - 1) + 1);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: TARGET_WIDTH / base.width });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Không tạo được canvas");
  // intent "print": đây là rasterize để diff, không phải hiển thị tương tác.
  // Quan trọng hơn: intent mặc định ("display") nhịp render bằng
  // requestAnimationFrame — tab bị ẩn thì rAF không chạy và promise treo
  // VĨNH VIỄN, không lỗi. "print" chạy thẳng, không phụ thuộc tab hiện.
  await Promise.race([
    page.render({ canvasContext: context, viewport, intent: "print" }).promise,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("Render PDF quá 20 giây — file có thể hỏng hoặc quá nặng.")),
        20_000,
      ),
    ),
  ]);
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  return {
    pixels: image.data,
    width: canvas.width,
    height: canvas.height,
    pages: pdf.numPages,
  };
}

export function PdfCompare({
  urlOld,
  urlNew,
  labelOld,
  labelNew,
  onClose,
}: {
  urlOld: string;
  urlNew: string;
  labelOld: string;
  labelNew: string;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [page, setPage] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [stats, setStats] = useState<DiffStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    (async () => {
      try {
        const [oldPage, newPage] = await Promise.all([
          renderPage(urlOld, page),
          renderPage(urlNew, page),
        ]);
        if (cancelled) return;
        setPageCount(Math.max(oldPage.pages, newPage.pages));
        const width = Math.max(oldPage.width, newPage.width);
        const height = Math.max(oldPage.height, newPage.height);
        // Đệm hai bitmap về cùng khung — vùng thiếu là giấy (alpha 0).
        const pad = (source: typeof oldPage) => {
          const out = new Uint8ClampedArray(width * height * 4);
          for (let row = 0; row < source.height; row += 1) {
            out.set(
              source.pixels.subarray(row * source.width * 4, (row + 1) * source.width * 4),
              row * width * 4,
            );
          }
          return out;
        };
        const out = new Uint8ClampedArray(width * height * 4);
        const diffStats = blendDiff(pad(oldPage), pad(newPage), out);
        if (cancelled) return;
        setStats(diffStats);
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = width;
        canvas.height = height;
        canvas
          .getContext("2d")
          ?.putImageData(new ImageData(out, width, height), 0, 0);
      } catch (cause) {
        if (!cancelled) setError((cause as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [urlOld, urlNew, page]);

  const inkTotal = stats ? stats.added + stats.removed + stats.unchanged : 0;
  return (
    <div className="pdf-compare">
      <div className="module-form">
        <strong>So sánh:</strong>
        <span className="diff-old">{labelOld} (đỏ = đã bỏ)</span>
        <span className="diff-new">{labelNew} (xanh = mới thêm)</span>
        <span className="module-hint-inline">xám = giữ nguyên</span>
        {pageCount > 1 && (
          <>
            <button disabled={page === 0} onClick={() => setPage(page - 1)}>
              ← Trang
            </button>
            <span>
              {page + 1}/{pageCount}
            </span>
            <button disabled={page >= pageCount - 1} onClick={() => setPage(page + 1)}>
              Trang →
            </button>
          </>
        )}
        <button onClick={onClose}>Đóng so sánh</button>
      </div>
      {stats && inkTotal > 0 && (
        <p className="module-hint">
          Thay đổi: {((stats.added + stats.removed) / inkTotal * 100).toFixed(1)}% nét
          ({stats.added.toLocaleString("vi-VN")} px thêm ·{" "}
          {stats.removed.toLocaleString("vi-VN")} px bỏ). Hai bản khác khổ giấy
          thì phần lệch khung hiện thành thêm/bỏ — đúng bản chất, đừng hiểu
          nhầm là nét vẽ đổi.
        </p>
      )}
      {error && <p className="module-hint members-error">⚠ {error}</p>}
      <div className="pdf-compare-scroll">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
