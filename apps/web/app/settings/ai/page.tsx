import { redirect } from "next/navigation";
import { getSession } from "@atlas/auth";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { aiHealth } from "@atlas/ai";

export const dynamic = "force-dynamic";

export default async function AiSettingsPage() {
  const session = await getSession();
  if (!session) redirect("/signin?callbackUrl=/settings/ai");

  const h = await aiHealth();
  const allUp = h.enabled && h.ollama.reachable && h.ollama.missing.length === 0 && h.whisper.reachable;

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">AI — trạng thái mô hình OSS</h1>
          <p className="mt-1 text-sm text-slate-500">
            Viwase Quản lý công việc chỉ dùng mô hình mã nguồn mở, tự host trên hạ tầng của bạn. Không gửi
            dữ liệu công trình ra bên ngoài.
          </p>
        </div>
        <Badge variant={allUp ? "success" : h.enabled ? "warning" : "neutral"}>
          {allUp ? "✓ Sẵn sàng" : h.enabled ? "Có vấn đề" : "Đã tắt"}
        </Badge>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>
            Ollama (LLM · VLM · Embeddings)
            <Badge className="ml-2" variant={h.ollama.reachable ? "success" : "danger"}>
              {h.ollama.reachable ? "kết nối được" : "không kết nối được"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardBody className="space-y-3 text-sm">
          <Row label="Base URL" value={h.ollama.baseUrl} mono />
          <Row label="LLM" value={h.ollama.required.llm} mono />
          <Row label="VLM (vision)" value={h.ollama.required.vlm} mono />
          <Row label="Embeddings" value={h.ollama.required.embed} mono />
          <Row
            label="Đã cài"
            value={h.ollama.models.length ? h.ollama.models.join(", ") : "(không có)"}
            mono
          />
          {h.ollama.missing.length > 0 && (
            <div className="rounded bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <strong>Thiếu mô hình:</strong> {h.ollama.missing.join(", ")}
              <div className="mt-1">
                Pull bằng: <code className="rounded bg-white px-1 py-0.5">pnpm ai:pull</code>{" "}
                (hoặc <code>ollama pull {h.ollama.missing[0]}</code> trên host).
              </div>
            </div>
          )}
          {h.ollama.error && (
            <div className="rounded bg-rose-50 px-3 py-2 text-xs text-rose-700">
              Lỗi: {h.ollama.error}
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Whisper (Speech-to-Text)
            <Badge className="ml-2" variant={h.whisper.reachable ? "success" : "danger"}>
              {h.whisper.reachable ? "kết nối được" : "không kết nối được"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardBody className="space-y-3 text-sm">
          <Row label="Base URL" value={h.whisper.baseUrl} mono />
          <Row label="Mô hình" value={h.whisper.model} mono />
          {h.whisper.error && (
            <div className="rounded bg-rose-50 px-3 py-2 text-xs text-rose-700">
              Lỗi: {h.whisper.error}
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Tính năng AI hiện tại</CardTitle></CardHeader>
        <CardBody>
          <ul className="space-y-2 text-sm">
            <Feature
              title="RFI — phân loại + nháp trả lời"
              detail="Tự động chạy khi tạo RFI. Mở RFI để xem gợi ý; TVTK quyết định cuối."
              up={h.ollama.reachable}
            />
            <Feature
              title="Nhật ký công trình — giọng nói → văn bản → form"
              detail="Bấm 🎙 trong dialog nhật ký. Whisper phiên âm, LLM cấu trúc."
              up={h.ollama.reachable && h.whisper.reachable}
            />
            <Feature
              title="NCR — gợi ý mức độ từ ảnh"
              detail="Sẽ kích hoạt khi upload ảnh evidence (VLM)."
              up={h.ollama.reachable}
              soon
            />
            <Feature
              title="Specs RAG — tìm theo ngữ nghĩa"
              detail="Embedding bge-m3 mỗi trang spec; tra cứu cosine trong khi soạn RFI."
              up={h.ollama.reachable}
              soon
            />
          </ul>
        </CardBody>
      </Card>

      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
        Cần thay đổi mô hình? Đặt <code>OLLAMA_LLM_MODEL</code>, <code>OLLAMA_VLM_MODEL</code>,{" "}
        <code>OLLAMA_EMBED_MODEL</code>, <code>WHISPER_MODEL</code> trong <code>.env</code> rồi
        chạy <code>pnpm ai:pull</code>. Toàn bộ stack là OSS, có thể air-gap.
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="col-span-1 text-xs text-slate-500">{label}</div>
      <div className={`col-span-2 text-sm text-slate-700 ${mono ? "font-mono text-xs" : ""}`}>{value}</div>
    </div>
  );
}

function Feature({ title, detail, up, soon }: { title: string; detail: string; up: boolean; soon?: boolean }) {
  return (
    <li className="flex items-start gap-3">
      <Badge variant={soon ? "neutral" : up ? "success" : "warning"}>
        {soon ? "sắp có" : up ? "sẵn sàng" : "chờ AI"}
      </Badge>
      <div>
        <div className="text-sm font-medium text-slate-800">{title}</div>
        <div className="text-xs text-slate-500">{detail}</div>
      </div>
    </li>
  );
}
