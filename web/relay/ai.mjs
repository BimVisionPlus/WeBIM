// Self-hosted AI for the WeBIM platform server.
//
// Every model here is one you run yourself — no closed API, no key leaving
// the site. AEC clients (CĐT, nhà thầu, TVGS) need hồ sơ and site photos to
// stay on-prem or in their own VPC, and drawing-scale volume makes per-call
// pricing untenable anyway.
//
//   text + vision : any OpenAI-compatible server — Ollama, vLLM,
//                   llama.cpp's server, LM Studio. Qwen2.5-VL / Llama 3.x /
//                   DeepSeek all work. Set AI_BASE_URL + AI_MODEL.
//   image render  : any AUTOMATIC1111-compatible Stable Diffusion API
//                   (A1111, SD.Next, Forge) at SD_BASE_URL.
//
// Nothing is enabled by default: with AI_BASE_URL unset the AI routes answer
// 501 and say what to run, rather than silently degrading.

export function aiConfig(env = process.env) {
  const trim = (value) => (value ?? "").trim().replace(/\/+$/, "");
  return {
    // e.g. http://127.0.0.1:11434/v1 (Ollama) or http://127.0.0.1:8000/v1 (vLLM)
    baseUrl: trim(env.AI_BASE_URL),
    model: (env.AI_MODEL ?? "qwen2.5vl:7b").trim(),
    // Only for local gateways that demand one; llama.cpp/Ollama ignore it.
    apiKey: (env.AI_API_KEY ?? "").trim() || null,
    // e.g. http://127.0.0.1:7860
    sdBaseUrl: trim(env.SD_BASE_URL),
    sdSteps: Number(env.SD_STEPS ?? 28),
    sdDenoising: Number(env.SD_DENOISING ?? 0.65),
    sdSampler: (env.SD_SAMPLER ?? "DPM++ 2M Karras").trim(),
  };
}

export function aiEnabled(config = aiConfig()) {
  return Boolean(config.baseUrl);
}

export function imageRenderEnabled(config = aiConfig()) {
  return Boolean(config.sdBaseUrl);
}

/**
 * Local models answer JSON with a preamble, or fenced, or both. Take the
 * first balanced object rather than trusting the whole body to parse.
 */
export function parseJsonLoose(text) {
  const unfenced = text.replace(/```(?:json)?/gi, "");
  const start = unfenced.indexOf("{");
  if (start === -1) throw new Error("Model không trả về JSON");
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < unfenced.length; index += 1) {
    const char = unfenced[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return JSON.parse(unfenced.slice(start, index + 1));
    }
  }
  throw new Error("Model trả về JSON chưa đóng");
}

/**
 * One chat turn against the OpenAI-compatible endpoint. `imageDataUrl` is
 * passed as an image_url part — the wire format Ollama, vLLM and llama.cpp
 * all accept for vision models.
 */
export async function chat(
  { system, text, imageDataUrl = null, json = false, maxTokens = 2048, temperature = 0.3 },
  config = aiConfig(),
  fetchImpl = fetch,
) {
  if (!config.baseUrl) throw new Error("AI_BASE_URL chưa được cấu hình");

  const content = imageDataUrl
    ? [
        { type: "text", text },
        { type: "image_url", image_url: { url: imageDataUrl } },
      ]
    : text;

  const body = {
    model: config.model,
    max_tokens: maxTokens,
    temperature,
    messages: [
      ...(system ? [{ role: "system", content: system }] : []),
      { role: "user", content },
    ],
    // Servers that don't know this field ignore it; those that do stop the
    // model wrapping the object in prose.
    ...(json ? { response_format: { type: "json_object" } } : {}),
  };

  const response = await fetchImpl(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Model server ${response.status}: ${await response.text()}`);
  }
  const payload = await response.json();
  const answer = payload?.choices?.[0]?.message?.content;
  if (typeof answer !== "string") throw new Error("Model server trả về phản hồi rỗng");
  return answer;
}

/**
 * Text layer of a PDF, page by page, via pdfjs — the same OSS reader the
 * canvas uses in the browser, run headless here (no canvas, text only).
 *
 * A scanned drawing has no text layer and comes back empty; that is reported
 * as such rather than sent to the model as a blank page.
 */
export async function extractPdfText(buffer, maxPages = 20) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    disableFontFace: true,
  }).promise;

  const pages = [];
  const pageCount = doc.numPages;
  const count = Math.min(pageCount, maxPages);
  for (let number = 1; number <= count; number += 1) {
    const page = await doc.getPage(number);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (text) pages.push(`--- Trang ${number}/${pageCount} ---\n${text}`);
  }
  await doc.destroy();
  return { text: pages.join("\n\n"), pageCount, readPages: count };
}

const DRAWING_SYSTEM =
  "Bạn là kỹ sư xây dựng đọc bản vẽ kỹ thuật. Trả lời ngắn gọn, chính xác," +
  " bằng ngôn ngữ của câu hỏi. Bạn chỉ nhận được lớp text trích từ bản vẽ," +
  " không thấy hình học — nếu text không đủ để trả lời, nói rõ điều đó thay vì" +
  " suy đoán. Khi trích số liệu, nêu số trang nếu xác định được.";

export async function answerDrawingQuestion(pdfBuffer, question, config = aiConfig(), fetchImpl = fetch) {
  const { text, pageCount, readPages } = await extractPdfText(pdfBuffer);
  if (!text) {
    return (
      "Bản vẽ này không có lớp text (nhiều khả năng là bản scan), nên chưa đọc" +
      " được bằng mô hình ngôn ngữ. Cần OCR trước — hoặc xuất lại PDF từ CAD" +
      " thay vì scan giấy."
    );
  }
  const truncated = readPages < pageCount ? `\n\n(Chỉ đọc ${readPages}/${pageCount} trang đầu.)` : "";
  return chat(
    {
      system: DRAWING_SYSTEM,
      text: `Nội dung text trích từ bản vẽ:\n\n${text}${truncated}\n\nCâu hỏi: ${question}`,
      maxTokens: 1500,
    },
    config,
    fetchImpl,
  );
}

// Kỷ luật trích dẫn là CHÍNH SÁCH SERVER — client gửi câu hỏi + trích đoạn,
// nhưng không được thay system prompt: đổi được prompt là đổi được việc
// model có bị buộc trích dẫn hay không.
const STANDARDS_QA_SYSTEM =
  "Bạn là trợ lý tra cứu quy chuẩn xây dựng Việt Nam. CHỈ được dùng các trích" +
  " đoạn được cung cấp; không dùng kiến thức ngoài. Mỗi khẳng định phải kèm số" +
  " trích dẫn dạng [1], [2]… đúng theo danh sách. Nếu các trích đoạn không đủ" +
  ' để trả lời, nói thẳng: "Corpus hiện chưa có điều khoản trả lời câu này" —' +
  " không suy đoán. Trả lời ngắn gọn bằng tiếng Việt.";

export async function answerStandardsQuestion(
  question,
  excerpts,
  config = aiConfig(),
  fetchImpl = fetch,
) {
  const blocks = excerpts
    .map((excerpt) => `${excerpt.label}\n${excerpt.text}`)
    .join("\n\n");
  return chat(
    {
      system: STANDARDS_QA_SYSTEM,
      text: `TRÍCH ĐOẠN QUY CHUẨN:\n\n${blocks}\n\nCÂU HỎI: ${question}`,
      maxTokens: 1024,
      temperature: 0.1,
    },
    config,
    fetchImpl,
  );
}

const RENDER_SYSTEM =
  "Bạn là kiến trúc sư viết brief render. Chỉ trả về JSON đúng schema, không" +
  " thêm lời dẫn.";

export async function writeRenderBrief(imageDataUrl, style, config = aiConfig(), fetchImpl = fetch) {
  const answer = await chat(
    {
      system: RENDER_SYSTEM,
      text:
        "Đây là ảnh chụp khối mô hình BIM (massing) của một công trình. " +
        `Phong cách mong muốn: ${style}. Viết kịch bản render concept bám đúng ` +
        "hình khối này (không bịa thêm khối mới) và một prompt tiếng Anh cho " +
        "công cụ sinh ảnh.\n\n" +
        'Trả về JSON: {"brief_vi": "kịch bản tiếng Việt: vật liệu, ánh sáng, ' +
        'bối cảnh, góc máy", "prompt_en": "one-paragraph English prompt for a ' +
        'photorealistic architectural render"}',
      imageDataUrl,
      json: true,
      maxTokens: 1200,
    },
    config,
    fetchImpl,
  );
  const brief = parseJsonLoose(answer);
  if (!brief.brief_vi || !brief.prompt_en) {
    throw new Error("Model thiếu trường brief_vi/prompt_en");
  }
  return { brief_vi: String(brief.brief_vi), prompt_en: String(brief.prompt_en) };
}

const RENDER_NEGATIVE =
  "blurry, lowres, watermark, text, distorted geometry, extra buildings, people with deformed faces";

/**
 * img2img against a self-hosted AUTOMATIC1111-compatible API. The massing
 * screenshot is the init image and denoising stays below 1 so the model
 * dresses the massing instead of inventing a different building.
 */
export async function renderConcept(imageDataUrl, prompt, config = aiConfig(), fetchImpl = fetch) {
  if (!config.sdBaseUrl) throw new Error("SD_BASE_URL chưa được cấu hình");
  const base64 = imageDataUrl.replace(/^data:image\/png;base64,/, "");

  const response = await fetchImpl(`${config.sdBaseUrl}/sdapi/v1/img2img`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      init_images: [base64],
      prompt,
      negative_prompt: RENDER_NEGATIVE,
      denoising_strength: config.sdDenoising,
      steps: config.sdSteps,
      sampler_name: config.sdSampler,
      cfg_scale: 7,
    }),
  });
  if (!response.ok) {
    throw new Error(`Stable Diffusion ${response.status}: ${await response.text()}`);
  }
  const payload = await response.json();
  const image = payload?.images?.[0];
  if (!image) throw new Error("Stable Diffusion không trả về ảnh");
  // A1111 sometimes returns a data URL already; normalise to one either way.
  return image.startsWith("data:") ? image : `data:image/png;base64,${image}`;
}
