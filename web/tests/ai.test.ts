// Self-hosted AI adapter: wire format against an OpenAI-compatible model
// server and an AUTOMATIC1111-compatible Stable Diffusion.
import { describe, expect, it } from "vitest";
import {
  aiConfig,
  aiEnabled,
  answerDrawingQuestion,
  answerStandardsQuestion,
  chat,
  extractPdfText,
  imageRenderEnabled,
  parseJsonLoose,
  renderConcept,
  writeRenderBrief,
} from "../relay/ai.mjs";

const CONFIG = aiConfig({
  AI_BASE_URL: "http://127.0.0.1:11434/v1/",
  AI_MODEL: "qwen2.5vl:7b",
  SD_BASE_URL: "http://127.0.0.1:7860",
});

const PNG = "data:image/png;base64,AAAA";

/**
 * Minimal PDF with a real text layer, built here so the fixture cannot drift
 * away from what the test claims about it. `pages` is one content string per
 * page; an empty string yields a page with no text at all (a "scan").
 */
function makePdf(pages: string[]): Buffer {
  const objects: string[] = [];
  const pageIds = pages.map((_, index) => 4 + index * 2);
  objects.push("<</Type/Catalog/Pages 2 0 R>>");
  objects.push(
    `<</Type/Pages/Kids[${pageIds.map((id) => `${id} 0 R`).join(" ")}]/Count ${pages.length}>>`,
  );
  objects.push("<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>");
  for (const [index, text] of pages.entries()) {
    objects.push(
      "<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 300]" +
        `/Resources<</Font<</F1 3 0 R>>>>/Contents ${pageIds[index] + 1} 0 R>>`,
    );
    const stream = text ? `BT /F1 12 Tf 20 150 Td (${text}) Tj ET` : "";
    objects.push(`<</Length ${stream.length}>>stream\n${stream}\nendstream`);
  }

  // pdf.js will not recover a file with no xref, so write a real one.
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj${object}endobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

const DRAWING_SET = makePdf([
  "MAT BANG TANG TRET",
  "MAT BANG TANG 2",
  "MAT CAT A-A",
]);

/** Records requests and replies with one canned body. */
function stub(body: unknown, ok = true, status = 200) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchImpl = (async (url: unknown, init: RequestInit) => {
    calls.push({ url: String(url), init });
    return {
      ok,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body),
    };
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

function completion(content: string) {
  return { choices: [{ message: { content } }] };
}

describe("aiConfig", () => {
  it("is off until a self-hosted server is named", () => {
    expect(aiEnabled(aiConfig({}))).toBe(false);
    expect(imageRenderEnabled(aiConfig({}))).toBe(false);
    expect(aiEnabled(CONFIG)).toBe(true);
    expect(imageRenderEnabled(CONFIG)).toBe(true);
  });

  it("strips the trailing slash so paths do not double up", () => {
    expect(CONFIG.baseUrl).toBe("http://127.0.0.1:11434/v1");
  });
});

describe("parseJsonLoose", () => {
  it("digs the object out of a fenced, prefaced answer", () => {
    const answer = 'Đây là kết quả:\n```json\n{"brief_vi": "a", "prompt_en": "b"}\n```\nHết.';
    expect(parseJsonLoose(answer)).toEqual({ brief_vi: "a", prompt_en: "b" });
  });

  it("stops at the matching brace, not the first one", () => {
    expect(parseJsonLoose('{"a": {"b": 1}} trailing junk {')).toEqual({ a: { b: 1 } });
  });

  it("is not fooled by braces inside strings", () => {
    expect(parseJsonLoose('{"a": "} not the end"}')).toEqual({ a: "} not the end" });
  });

  it("reports unusable output instead of returning junk", () => {
    expect(() => parseJsonLoose("xin lỗi, tôi không thể")).toThrow("không trả về JSON");
    expect(() => parseJsonLoose('{"a": 1')).toThrow("chưa đóng");
  });
});

describe("answerStandardsQuestion", () => {
  it("system prompt do server giữ và buộc trích dẫn; trích đoạn nằm trong user text", async () => {
    const { calls, fetchImpl } = stub(completion("Theo [1], tối thiểu 1,2 m."));
    const answer = await answerStandardsQuestion(
      "hành lang rộng bao nhiêu?",
      [{ label: "[1] QCVN 06:2022/BXD, điều 3.3.5", text: "không nhỏ hơn 1,2 m" }],
      CONFIG,
      fetchImpl,
    );
    expect(answer).toContain("[1]");
    const body = JSON.parse(String(calls[0].init.body));
    const [system, user] = body.messages;
    expect(system.role).toBe("system");
    expect(system.content).toContain("trích dẫn");
    expect(system.content).toContain("không suy đoán");
    expect(user.content).toContain("[1] QCVN 06:2022/BXD, điều 3.3.5");
    expect(user.content).toContain("hành lang rộng bao nhiêu?");
    // Nhiệt độ thấp có chủ đích: tra cứu quy phạm không phải chỗ sáng tác.
    expect(body.temperature).toBe(0.1);
  });
});

describe("chat", () => {
  it("posts an OpenAI-compatible body to /chat/completions", async () => {
    const { calls, fetchImpl } = stub(completion("xin chào"));
    const answer = await chat({ system: "s", text: "t" }, CONFIG, fetchImpl);

    expect(answer).toBe("xin chào");
    expect(calls[0].url).toBe("http://127.0.0.1:11434/v1/chat/completions");
    const body = JSON.parse(String(calls[0].init.body));
    expect(body.model).toBe("qwen2.5vl:7b");
    expect(body.messages).toEqual([
      { role: "system", content: "s" },
      { role: "user", content: "t" },
    ]);
    expect(body.response_format).toBeUndefined();
  });

  it("sends images as an image_url part for vision models", async () => {
    const { calls, fetchImpl } = stub(completion("ok"));
    await chat({ text: "t", imageDataUrl: PNG, json: true }, CONFIG, fetchImpl);

    const body = JSON.parse(String(calls[0].init.body));
    expect(body.messages[0].content).toEqual([
      { type: "text", text: "t" },
      { type: "image_url", image_url: { url: PNG } },
    ]);
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  it("sends no Authorization unless a local gateway needs one", async () => {
    const { calls, fetchImpl } = stub(completion("ok"));
    await chat({ text: "t" }, CONFIG, fetchImpl);
    expect((calls[0].init.headers as Record<string, string>).authorization).toBeUndefined();

    const keyed = stub(completion("ok"));
    await chat({ text: "t" }, { ...CONFIG, apiKey: "local-token" }, keyed.fetchImpl);
    expect((keyed.calls[0].init.headers as Record<string, string>).authorization).toBe(
      "Bearer local-token",
    );
  });

  it("refuses to run against an unconfigured server", async () => {
    await expect(chat({ text: "t" }, aiConfig({}))).rejects.toThrow("AI_BASE_URL");
  });

  it("surfaces the model server's own error", async () => {
    const { fetchImpl } = stub({ error: "model not found" }, false, 404);
    await expect(chat({ text: "t" }, CONFIG, fetchImpl)).rejects.toThrow("Model server 404");
  });

  it("rejects an empty completion rather than returning undefined", async () => {
    const { fetchImpl } = stub({ choices: [] });
    await expect(chat({ text: "t" }, CONFIG, fetchImpl)).rejects.toThrow("phản hồi rỗng");
  });
});

describe("extractPdfText", () => {
  it("reads the text layer page by page, with page markers", async () => {
    const result = await extractPdfText(DRAWING_SET);
    expect(result.pageCount).toBe(3);
    expect(result.text).toContain("--- Trang 1/3 ---");
    expect(result.text).toContain("MAT BANG TANG TRET");
    expect(result.text).toContain("MAT CAT A-A");
  });

  it("caps how many pages are read", async () => {
    const result = await extractPdfText(DRAWING_SET, 2);
    expect(result.readPages).toBe(2);
    expect(result.pageCount).toBe(3);
    expect(result.text).not.toContain("Trang 3/3");
  });

  it("skips pages with no text rather than emitting empty markers", async () => {
    const result = await extractPdfText(makePdf(["", "CHI TIET MONG M1", ""]));
    expect(result.text).toBe("--- Trang 2/3 ---\nCHI TIET MONG M1");
  });
});

describe("answerDrawingQuestion", () => {
  it("says a scanned drawing needs OCR instead of asking the model about nothing", async () => {
    const { calls, fetchImpl } = stub(completion("không nên gọi tới đây"));
    const scanned = makePdf(["", ""]);
    const answer = await answerDrawingQuestion(scanned, "gì đây?", CONFIG, fetchImpl);
    expect(answer).toContain("OCR");
    expect(calls).toHaveLength(0);
  });

  it("tells the model it only has the text layer, and flags truncation", async () => {
    const { calls, fetchImpl } = stub(completion("3 trang"));
    await answerDrawingQuestion(DRAWING_SET, "mấy trang?", CONFIG, fetchImpl);

    const body = JSON.parse(String(calls[0].init.body));
    expect(body.messages[0].content).toContain("chỉ nhận được lớp text");
    expect(body.messages[1].content).toContain("Câu hỏi: mấy trang?");
  });
});

describe("writeRenderBrief", () => {
  it("returns both fields from a fenced answer", async () => {
    const { fetchImpl } = stub(
      completion('```json\n{"brief_vi":"kịch bản","prompt_en":"a render"}\n```'),
    );
    await expect(writeRenderBrief(PNG, "hiện đại", CONFIG, fetchImpl)).resolves.toEqual({
      brief_vi: "kịch bản",
      prompt_en: "a render",
    });
  });

  it("rejects a half-filled object", async () => {
    const { fetchImpl } = stub(completion('{"brief_vi":"chỉ có tiếng Việt"}'));
    await expect(writeRenderBrief(PNG, "hiện đại", CONFIG, fetchImpl)).rejects.toThrow(
      "brief_vi/prompt_en",
    );
  });
});

describe("renderConcept", () => {
  it("posts img2img with the massing as the init image", async () => {
    const { calls, fetchImpl } = stub({ images: ["QUJD"] });
    const image = await renderConcept(PNG, "a render", CONFIG, fetchImpl);

    expect(calls[0].url).toBe("http://127.0.0.1:7860/sdapi/v1/img2img");
    const body = JSON.parse(String(calls[0].init.body));
    expect(body.init_images).toEqual(["AAAA"]); // data URL prefix stripped
    expect(body.prompt).toBe("a render");
    // Below 1.0 or the model invents a different building.
    expect(body.denoising_strength).toBeLessThan(1);
    expect(image).toBe("data:image/png;base64,QUJD");
  });

  it("passes through a data URL the API already wrapped", async () => {
    const { fetchImpl } = stub({ images: ["data:image/png;base64,QUJD"] });
    await expect(renderConcept(PNG, "p", CONFIG, fetchImpl)).resolves.toBe(
      "data:image/png;base64,QUJD",
    );
  });

  it("fails loudly when no image comes back", async () => {
    const { fetchImpl } = stub({ images: [] });
    await expect(renderConcept(PNG, "p", CONFIG, fetchImpl)).rejects.toThrow("không trả về ảnh");
  });

  it("refuses without SD_BASE_URL", async () => {
    await expect(renderConcept(PNG, "p", aiConfig({ AI_BASE_URL: "x" }))).rejects.toThrow(
      "SD_BASE_URL",
    );
  });
});
