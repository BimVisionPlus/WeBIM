// RENDER AI — nhánh riêng theo sơ đồ workflow.
//
// Trước đây nút này nấp trong thanh công cụ của 3D Viewer, cạnh nút link IFC
// và điều khiển xoay. Sơ đồ tách nó ra, và tách đúng: xem model là việc làm
// suốt buổi, còn render là một việc có mở đầu và kết thúc, có chi phí, và cho
// ra một sản phẩm đem đi họp được.
//
// Toàn bộ AI chạy trên model tự host — xem web/relay/ai.mjs. Không cấu hình
// AI_BASE_URL thì route trả 501 và màn hình nói thẳng, chứ không giả vờ.

import { useRef, useState } from "react";
import { Viewer3D } from "../viewport/Viewer3D";
import { authHeaders, fileServerBase, store, useStoreVersion } from "../state/store";

const RENDER_STYLES = [
  "Hiện đại nhiệt đới (tropical modern)",
  "Nhà phố Việt Nam đương đại",
  "Bê tông trần, cửa kính lớn",
  "Mái ngói truyền thống",
];

interface RenderResult {
  brief_vi?: string;
  prompt_en?: string;
  image?: string | null;
  error?: string;
}

export function RenderModule() {
  const version = useStoreVersion();
  const captureRef = useRef<(() => string) | null>(null);
  const [style, setStyle] = useState(RENDER_STYLES[0]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RenderResult | null>(null);

  const renderConcept = async () => {
    const capture = captureRef.current;
    if (!capture || busy) return;
    setBusy(true);
    setResult(null);
    try {
      const response = await fetch(`${fileServerBase()}/ai/render-concept`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ image: capture(), style }),
      });
      const body = await response.json();
      setResult(response.ok ? body : { error: body.error });
    } catch (error) {
      setResult({ error: (error as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="module-host viewer-module">
      <div className="module-form">
        <span className="module-hint" style={{ margin: 0 }}>
          Xoay khối tới góc muốn render, rồi chọn phong cách.
        </span>
        <select value={style} onChange={(event) => setStyle(event.target.value)}>
          {RENDER_STYLES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <button disabled={busy} onClick={() => void renderConcept()}>
          {busy ? "Đang render…" : "Render concept"}
        </button>
      </div>

      {store.standalone && (
        <p className="module-hint">
          Chế độ độc lập — render cần máy chủ nền tảng và một model tự host.
        </p>
      )}

      <Viewer3D
        project={store.project}
        linked={store.linkedModels}
        version={version}
        onReady={(capture) => {
          captureRef.current = capture;
        }}
      />

      {result && (
        <div className="render-result">
          {result.error && <div className="climate-finding warning">⚠ {result.error}</div>}
          {result.image && (
            <img src={result.image} alt="AI concept render" className="render-image" />
          )}
          {result.brief_vi && (
            <div className="ai-answer">
              <strong>Kịch bản render:</strong> {result.brief_vi}
              {"\n\n"}
              <strong>Prompt:</strong> {result.prompt_en}
            </div>
          )}
          {/*
            Ảnh là img2img từ chính khung hình vừa chụp, nên nó bám khối thật —
            nhưng nó vẫn là ảnh do model sinh ra: cửa, lan can, vật liệu trong
            ảnh không phải dữ liệu của mô hình và không được đo trên đó.
          */}
          {result.image && (
            <p className="module-hint">
              Ảnh concept, không phải bản vẽ: chi tiết trong ảnh do model sinh
              ra, không lấy từ mô hình và không đo được trên đó.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
