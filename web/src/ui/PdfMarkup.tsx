// ĐỌC, GHI CHÚ, CHỈNH SỬA PDF — nhánh đầu tiên của sơ đồ workflow.
//
// Trước đây tab này nhét file vào một <iframe> và để trình duyệt lo. Xem thì
// được, đánh dấu thì không: không với tay vào trong iframe được, mà phủ lên
// trên nó thì mọi nét vẽ sẽ trôi ngay khi ai đó cuộn hoặc đổi mức zoom.
//
// Nên trang được render bằng pdf.js ra một <canvas> của chính mình, và markup
// nằm trên một lớp SVG phủ đúng canvas ấy. Toạ độ ghi theo **tỉ lệ trang
// (0–1)**, không phải pixel: người xem trên laptop, người xem trên điện thoại
// ngoài công trường và người in A3 phải thấy dấu ghi ở cùng một chỗ trên bản
// vẽ. Ghi bằng pixel thì cả ba đều sai, mỗi người sai một kiểu.
//
// Markup đi vào dự án nên nó đồng bộ như mọi thứ khác — và nó *phủ lên* PDF
// chứ không ghi vào file: bản trong CDE là bản đã phát hành, ghi đè lên nó sẽ
// phá đúng cái chuỗi revision mà CDE tồn tại để giữ.

import { useEffect, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { DocumentDatum, MarkupKind } from "../domain/project";
import { store, useStoreVersion } from "../state/store";
import { measure, scaleFromCalibration } from "../application/pdfDiff";

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

const TOOLS: { kind: MarkupKind; label: string; hint: string }[] = [
  { kind: "RECT", label: "Khung", hint: "Khoanh vùng cần sửa" },
  { kind: "CLOUD", label: "Mây", hint: "Mây sửa đổi — quy ước bản vẽ" },
  { kind: "ARROW", label: "Mũi tên", hint: "Chỉ vào một chi tiết" },
  { kind: "TEXT", label: "Chữ", hint: "Ghi chú tại chỗ" },
];

const COLORS = ["#e06c75", "#fab219", "#4da3ff", "#5f9e6e"];

/** Mây sửa đổi: cung tròn nối tiếp quanh chu vi hộp, đúng quy ước bản vẽ. */
function cloudPath(x1: number, y1: number, x2: number, y2: number): string {
  const left = Math.min(x1, x2);
  const right = Math.max(x1, x2);
  const top = Math.min(y1, y2);
  const bottom = Math.max(y1, y2);
  const bump = Math.max(Math.min((right - left) / 8, (bottom - top) / 8), 6);
  const arcs: string[] = [`M ${left} ${top}`];
  const run = (from: number, to: number, fixed: number, horizontal: boolean) => {
    const steps = Math.max(Math.round(Math.abs(to - from) / bump), 1);
    const step = (to - from) / steps;
    for (let i = 1; i <= steps; i += 1) {
      const at = from + step * i;
      arcs.push(
        horizontal
          ? `A ${bump} ${bump} 0 0 1 ${at} ${fixed}`
          : `A ${bump} ${bump} 0 0 1 ${fixed} ${at}`,
      );
    }
  };
  run(left, right, top, true);
  run(top, bottom, right, false);
  run(right, left, bottom, true);
  run(bottom, top, left, false);
  return arcs.join(" ");
}

export function PdfMarkupView({
  document: doc,
  url,
}: {
  document: DocumentDatum;
  url: string;
}) {
  useStoreVersion();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pageCount, setPageCount] = useState(0);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [tool, setTool] = useState<MarkupKind | null>(null);
  const [color, setColor] = useState(COLORS[0]);
  const [start, setStart] = useState<[number, number] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Đo khoảng cách: phù du trong phiên (không sync — phép đo là câu hỏi,
  // không phải dữ liệu dự án). Tỉ lệ lấy bằng CALIBRATE trên một đoạn đã
  // biết chiều dài thật — khung tên nói 1:100 nhưng file in ra có thể đã
  // bị scale, đo đoạn thật là nguồn sự thật duy nhất.
  const [measuring, setMeasuring] = useState(false);
  const [metresPerPixel, setMetresPerPixel] = useState<number | null>(null);
  const [measureStart, setMeasureStart] = useState<[number, number] | null>(null);
  const [readings, setReadings] = useState<
    { a: [number, number]; b: [number, number]; metres: number }[]
  >([]);

  useEffect(() => {
    let cancelled = false;
    let task: pdfjs.PDFDocumentLoadingTask | null = null;
    setError(null);
    (async () => {
      try {
        task = pdfjs.getDocument(url);
        const pdf = await task.promise;
        if (cancelled) return;
        setPageCount(pdf.numPages);
        const rendered = await pdf.getPage(Math.min(page, pdf.numPages - 1) + 1);
        const viewport = rendered.getViewport({ scale: 1.5 });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        setSize({ width: viewport.width, height: viewport.height });
        const context = canvas.getContext("2d");
        if (!context) return;
        await rendered.render({ canvasContext: context, viewport }).promise;
      } catch (cause) {
        if (!cancelled) setError((cause as Error).message);
      }
    })();
    return () => {
      cancelled = true;
      void task?.destroy();
    };
  }, [url, page]);

  const markups = (doc.markups ?? []).filter((markup) => markup.page === page);

  // Chuột → tỉ lệ trang. Đây là chỗ duy nhất pixel được phép xuất hiện.
  const toPageRatio = (
    event: React.MouseEvent<SVGSVGElement>,
  ): [number, number] | null => {
    const box = event.currentTarget.getBoundingClientRect();
    // SVG chưa layout xong thì width/height = 0 — chia cho nó cho ra
    // Infinity, và toạ độ Infinity từng bị LƯU vào dự án (thành null qua
    // JSON) rồi vẽ NaN mãi mãi. Click lúc chưa sẵn sàng thì bỏ, không đoán.
    if (!(box.width > 0) || !(box.height > 0)) return null;
    const clamp = (value: number) => Math.min(1, Math.max(0, value));
    return [
      clamp((event.clientX - box.left) / box.width),
      clamp((event.clientY - box.top) / box.height),
    ];
  };

  const onClick = (event: React.MouseEvent<SVGSVGElement>) => {
    if (measuring) {
      const box = event.currentTarget.getBoundingClientRect();
      if (!(box.width > 0) || !(box.height > 0)) return;
      // Toạ độ VIEWBOX, không phải CSS px: SVG vẽ theo viewBox (kích thước
      // canvas PDF), còn CSS px đổi theo cỡ cửa sổ. Lưu CSS px thì line đo
      // vẽ lệch chỗ và tỉ lệ calibrate chết ngay khi resize — đo 5m hôm nay,
      // resize xong cùng đoạn đó ra số khác.
      const point: [number, number] = [
        ((event.clientX - box.left) / box.width) * (size.width || 1),
        ((event.clientY - box.top) / box.height) * (size.height || 1),
      ];
      if (measureStart === null) {
        setMeasureStart(point);
        return;
      }
      const pixelDistance = Math.hypot(
        point[0] - measureStart[0],
        point[1] - measureStart[1],
      );
      if (metresPerPixel === null) {
        const answer = window.prompt(
          "CALIBRATE: đoạn vừa đo dài bao nhiêu mét ngoài thực tế?",
        );
        const metres = Number(answer);
        const scale = scaleFromCalibration(pixelDistance, metres);
        if (scale === null) {
          store.setStatus("Chiều dài calibrate phải là số dương — đo lại.");
        } else {
          setMetresPerPixel(scale);
          store.setStatus(
            `Đã đặt tỉ lệ: ${pixelDistance.toFixed(0)}px = ${metres}m. Giờ mỗi cặp click là một phép đo.`,
          );
        }
      } else {
        setReadings([
          ...readings,
          { a: measureStart, b: point, metres: measure(measureStart, point, metresPerPixel) },
        ]);
      }
      setMeasureStart(null);
      return;
    }
    if (!tool) return;
    const at = toPageRatio(event);
    if (at === null) return;
    if (tool === "TEXT") {
      const text = window.prompt("Nội dung ghi chú:");
      if (!text?.trim()) return;
      store.addMarkup(doc.id, {
        kind: "TEXT",
        page,
        from: at,
        to: at,
        text: text.trim(),
        color,
      });
      return;
    }
    if (start === null) {
      setStart(at);
      return;
    }
    store.addMarkup(doc.id, { kind: tool, page, from: start, to: at, text: "", color });
    setStart(null);
  };

  const px = (point: [number, number]): [number, number] => [
    point[0] * size.width,
    point[1] * size.height,
  ];

  return (
    <div className="pdf-markup">
      <div className="module-form">
        <button
          className={measuring ? "active" : ""}
          onClick={() => {
            setMeasuring(!measuring);
            setTool(null);
            setMeasureStart(null);
          }}
          title="Đo khoảng cách — cặp click đầu tiên calibrate tỉ lệ bằng một đoạn đã biết"
        >
          Đo
        </button>
        {metresPerPixel !== null && measuring && (
          <button
            className="mini"
            onClick={() => {
              setMetresPerPixel(null);
              setReadings([]);
              store.setStatus("Đã xoá tỉ lệ — cặp click sau sẽ calibrate lại.");
            }}
          >
            Đặt lại tỉ lệ
          </button>
        )}
        {TOOLS.map((entry) => (
          <button
            key={entry.kind}
            className={tool === entry.kind ? "active" : ""}
            title={entry.hint}
            onClick={() => {
              setTool(tool === entry.kind ? null : entry.kind);
              setStart(null);
            }}
          >
            {entry.label}
          </button>
        ))}
        {COLORS.map((option) => (
          <button
            key={option}
            className={`swatch ${color === option ? "active" : ""}`}
            style={{ background: option }}
            title="Màu đánh dấu"
            onClick={() => setColor(option)}
          />
        ))}
        {pageCount > 1 && (
          <span className="module-hint" style={{ margin: 0 }}>
            <button disabled={page === 0} onClick={() => setPage(page - 1)}>
              ‹
            </button>{" "}
            Trang {page + 1}/{pageCount}{" "}
            <button disabled={page >= pageCount - 1} onClick={() => setPage(page + 1)}>
              ›
            </button>
          </span>
        )}
        <span className="module-hint" style={{ margin: 0 }}>
          {tool === null
            ? "Chọn một công cụ để đánh dấu · click dấu cũ để xoá"
            : tool === "TEXT"
              ? "Click một điểm để đặt chữ"
              : start === null
                ? "Click điểm thứ nhất"
                : "Click điểm thứ hai"}
        </span>
      </div>

      {error && <div className="climate-finding warning">⚠ Không đọc được PDF: {error}</div>}

      <div className="pdf-stage">
        <canvas ref={canvasRef} className="pdf-canvas" />
        <svg
          className="pdf-overlay"
          viewBox={`0 0 ${size.width || 1} ${size.height || 1}`}
          preserveAspectRatio="none"
          style={{ cursor: tool ? "crosshair" : "default" }}
          onClick={onClick}
        >
          {markups.map((markup) => {
            const [x1, y1] = px(markup.from);
            const [x2, y2] = px(markup.to);
            const remove = (event: React.MouseEvent) => {
              // Đang đo thì markup phải "trong suốt" với click: nuốt sự kiện
              // ở đây vừa XOÁ nhầm chú thích vừa mất điểm đo — người dùng đo
              // cạnh vùng đã đánh dấu là dính cả hai.
              if (measuring) return;
              event.stopPropagation();
              store.removeMarkup(doc.id, markup.id);
            };
            const title = `${markup.author} · ${markup.at.slice(0, 10)} — click để xoá`;
            if (markup.kind === "RECT") {
              return (
                <rect
                  key={markup.id}
                  x={Math.min(x1, x2)}
                  y={Math.min(y1, y2)}
                  width={Math.abs(x2 - x1)}
                  height={Math.abs(y2 - y1)}
                  fill="none"
                  stroke={markup.color}
                  strokeWidth={2}
                  onClick={remove}
                >
                  <title>{title}</title>
                </rect>
              );
            }
            if (markup.kind === "CLOUD") {
              return (
                <path
                  key={markup.id}
                  d={cloudPath(x1, y1, x2, y2)}
                  fill="none"
                  stroke={markup.color}
                  strokeWidth={2}
                  onClick={remove}
                >
                  <title>{title}</title>
                </path>
              );
            }
            if (markup.kind === "ARROW") {
              const angle = Math.atan2(y2 - y1, x2 - x1);
              const head = 12;
              return (
                <g key={markup.id} onClick={remove}>
                  <title>{title}</title>
                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={markup.color} strokeWidth={2} />
                  <polygon
                    points={[
                      `${x2},${y2}`,
                      `${x2 - head * Math.cos(angle - 0.4)},${y2 - head * Math.sin(angle - 0.4)}`,
                      `${x2 - head * Math.cos(angle + 0.4)},${y2 - head * Math.sin(angle + 0.4)}`,
                    ].join(" ")}
                    fill={markup.color}
                  />
                </g>
              );
            }
            return (
              <text
                key={markup.id}
                x={x1}
                y={y1}
                fill={markup.color}
                fontSize={14}
                fontWeight={600}
                onClick={remove}
              >
                <title>{title}</title>
                {markup.text}
              </text>
            );
          })}
          {readings.map((reading, index) => (
            <g key={index} stroke="#fab219" fill="#fab219">
              <line
                x1={reading.a[0]} y1={reading.a[1]}
                x2={reading.b[0]} y2={reading.b[1]}
                strokeWidth={1.5}
              />
              <text
                x={(reading.a[0] + reading.b[0]) / 2 + 4}
                y={(reading.a[1] + reading.b[1]) / 2 - 4}
                fontSize={12}
                fontWeight={600}
                stroke="none"
              >
                {reading.metres.toFixed(2)} m
              </text>
            </g>
          ))}
          {measureStart && (
            <circle cx={measureStart[0]} cy={measureStart[1]} r={4} fill="#fab219" />
          )}
          {start && (
            <circle cx={px(start)[0]} cy={px(start)[1]} r={4} fill={color} />
          )}
        </svg>
      </div>

      <p className="module-hint">
        {markups.length} dấu trên trang này. Markup nằm trong dự án và đồng bộ
        như mọi thứ khác — nó <strong>phủ lên</strong> bản PDF chứ không ghi vào
        file, nên bản đã phát hành trong CDE giữ nguyên.
      </p>
    </div>
  );
}
