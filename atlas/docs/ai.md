# Atlas AEC — AI stack (OSS-only)

> Tất cả AI trong Atlas AEC chạy bằng mô hình **mã nguồn mở, tự host**. Không
> gọi OpenAI / Anthropic / Gemini. Lý do: dữ liệu công trường (hồ sơ, ảnh
> hiện trường, BBNT, hợp đồng) thường yêu cầu on-prem / VPC, và chi phí
> per-photo / per-drawing của API đóng sẽ phá nát đơn giá AEC.

## Bộ mô hình mặc định

| Mục đích | Mô hình | Phục vụ bởi | Yêu cầu RAM/VRAM tối thiểu |
|---|---|---|---|
| LLM (phân loại, soạn thảo) | `qwen2.5:7b-instruct` | Ollama | 8 GB |
| Vision (NCR ảnh, OCR bản vẽ) | `qwen2.5vl:7b` | Ollama | 12 GB |
| Embeddings (RAG specs) | `bge-m3` | Ollama | 2 GB |
| STT (nhật ký giọng nói) | `Systran/faster-whisper-medium` | faster-whisper-server | 4 GB CPU / 2 GB GPU |

Đổi mô hình bằng biến môi trường — không cần đổi code:

```env
OLLAMA_LLM_MODEL="llama3.1:8b-instruct"      # hoặc deepseek-r1:7b
OLLAMA_VLM_MODEL="llama3.2-vision:11b"
OLLAMA_EMBED_MODEL="nomic-embed-text"
WHISPER_MODEL="Systran/faster-whisper-large-v3"
```

## Khởi động

```bash
# Stack mặc định (postgres + minio + redis)
pnpm infra:up

# Bật AI (Ollama + Whisper) — lần đầu tải ~10GB weights
pnpm ai:up

# Kiểm tra mô hình đã pull đầy đủ
pnpm ai:pull          # idempotent — chạy lại an toàn

# Theo dõi log AI
pnpm ai:logs
```

Sau khi boot, vào **Cài đặt → AI** (`/settings/ai`) để xem trạng thái live của
Ollama + Whisper, danh sách mô hình đã pull, và các tính năng đang khả dụng.

## Tính năng đang chạy end-to-end (v1)

### 1. RFI — phân loại + nháp trả lời

- **Trigger:** ngay khi nhà thầu tạo RFI (fire-and-forget) + nút "Chạy lại" trên
  trang chi tiết.
- **Pipeline:** câu hỏi → LLM (Qwen 2.5) → JSON `{category, priority,
  costRiskVnd, scheduleRiskDays}` + JSON `{draftAnswer, references, confidence,
  caveats}`.
- **UI:** khung tím trên trang RFI (`/projects/.../site/issues/{KEY}`). TVTK
  click "Áp dụng vào câu trả lời" → nháp đổ vào textarea, suggestion được mark
  `accepted=true` (telemetry adoption).
- **Engineer-in-loop:** mô hình KHÔNG bao giờ tự đẩy RFI sang ANSWERED. Người
  trả lời (TVTK / CĐT) phải xem và submit.

### 2. Nhật ký công trình — giọng nói → form

- **Trigger:** nút 🎙 trong dialog "Ghi nhật ký công trình".
- **Pipeline:** MediaRecorder (webm/opus) → POST `/api/ai/transcribe` →
  whisper.cpp (Vietnamese) → text → LLM cấu trúc thành `{workDone, workTomorrow,
  safetyNotes, workforce[], weather}`.
- **UI:** kỹ sư nói 30 giây, form tự điền. Vẫn có thể edit thủ công trước khi
  lưu. Tiết kiệm ~5 phút/ngày/kỹ sư.

### 3. NCR — ảnh hiện trường → mức độ + CAR draft

- **Trigger:** TVGS nhấn "📷 Tải ảnh hiện trường" trên trang chi tiết NCR.
- **Pipeline:** ảnh ≤4MB → base64 client-side → POST `/api/ai/ncr/assess` →
  Qwen2.5-VL → JSON `{severity, defectDescription, rootCauseHypothesis,
  correctiveActionDraft, qcvnRef, confidence}`.
- **UI:** khung tím trong card "Chi tiết NCR". Hiển thị mức độ đề xuất vs
  mức hiện tại (badge cảnh báo nếu khác), mô tả lỗi AI thấy, CAR sơ bộ.
- **Engineer-in-loop:** TVGS xác nhận trong workflow (`ROOT_CAUSE → CAR_PROPOSED → …`).
  AI không bao giờ tự cập nhật `NCR.severity`.

### 4. Specs — RAG tìm kiếm theo ngữ nghĩa

- **Trigger:** ô tìm kiếm trên trang `/projects/.../specs` (cũng có thể wire vào
  RFI compose ở v1.x).
- **Pipeline:** query → bge-m3 embed (~100ms) → in-memory cosine over Postgres
  JSON embeddings → top-K theo điểm.
- **Auto-embed:** mỗi lần tạo/cập nhật SpecPage (`POST/PATCH /api/specs/*`),
  fire-and-forget gọi `embedSpecText`. Admin có nút "Re-embed tất cả" để chạy
  bulk sau seed hoặc đổi model embed.
- **Scale:** đủ tốt cho <10k pages/project. Vượt → migrate sang pgvector
  (chỉ đổi column type + một câu SQL trong search route).

## Air-gapped / on-prem

1. Trên máy có internet:
   ```bash
   ollama pull qwen2.5:7b-instruct qwen2.5vl:7b bge-m3
   docker save ollama/ollama:latest fedirz/faster-whisper-server:latest-cpu | gzip > ai-images.tar.gz
   ```
2. Mang `~/.ollama/models/`, image tar, và project source lên server cô lập.
3. `docker load < ai-images.tar.gz` + mount Ollama volume.
4. Đặt `OLLAMA_BASE_URL` / `WHISPER_BASE_URL` trỏ vào LAN.

Không có lưu lượng ngoại bộ nào trong suốt luồng AI.

## Tắt AI hoàn toàn

```env
AI_ENABLED="false"
```

- `/api/ai/*` trả `{ok: false, reason: "disabled"}`.
- UI tự ẩn các khung gợi ý.
- Nút 🎙 vẫn xuất hiện nhưng báo "Phiên âm thất bại: disabled".
- App phục vụ bình thường — AI hoàn toàn tuỳ chọn.

## Lưu vết & audit

Mỗi lần gọi AI (kể cả lỗi) đều được ghi vào `AiSuggestion`:

```
kind            rfi.draft_answer | daily_log.structure | …
entityType      Issue | DailyLog | SpecPage | …
entityId        FK đến entity
ok              true | false
failReason      timeout | unreachable | model_missing | …
output          JSON payload (đã validate qua Zod)
model           tên model đã chạy (versioned)
latencyMs       đo bằng server
accepted        true sau khi user nhấn "Áp dụng"
```

Dùng để: (1) đo tỉ lệ adoption, (2) re-rank prompt theo phản hồi, (3) compliance
trail "AI đã đề xuất gì tại thời điểm nào".

## Sizing nhanh (pilot scale)

| Khối lượng | Cấu hình đủ dùng |
|---|---|
| 1 PM, ≤10 RFI/ngày, voice ≤30 phút/ngày | Mac M2 16GB hoặc 1× RTX 3060 12GB |
| 5–10 PM, 50 RFI/ngày, NCR ảnh | 1× RTX 4090 24GB hoặc A10G |
| Multi-tenant ≥50 user | 2× L40S / A100 + vLLM thay Ollama (batching tốt hơn) |

## Khi muốn thay Ollama → vLLM

`@atlas/ai/llm.ts` và `@atlas/ai/embed.ts` gọi REST đơn giản. Đổi sang vLLM
chỉ cần:

1. `aiConfig().ollama.baseUrl` → vLLM endpoint.
2. Đổi `/api/chat` → `/v1/chat/completions`, `/api/embeddings` →
   `/v1/embeddings` (OpenAI-compatible — vLLM expose sẵn).
3. Body schema gần như giống. Không thay Prisma, không thay UI.
