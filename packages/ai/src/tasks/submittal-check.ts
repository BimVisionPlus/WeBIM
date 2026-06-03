/**
 * Submittal vs Spec auto-checker.
 *
 * Given:
 *   - Submittal (specSection, materialName, manufacturer)
 *   - Project's SpecPage corpus (already-embedded in DB)
 *
 * Pipeline:
 *   1. Build a short query string from submittal.
 *   2. Embed via bge-m3.
 *   3. Cosine match against SpecPage.embedding for the project; topK=3.
 *   4. Llama-3.3 compares submitted material vs spec requirements →
 *      structured findings JSON.
 *
 * On any AI failure, returns `compliance: "unknown"` + reason; UI shows
 * "Chưa thể kiểm tra tự động" and the human reviewer continues manually.
 */

import { chat } from "../llm";
import { embed, cosine } from "../embed";
import type { AiResult } from "../types";

export type SubmittalCheckInput = {
  submittal: {
    specSection: string | null;
    materialName: string;
    manufacturer: string | null;
  };
  specPages: Array<{
    id: string;
    title: string;
    body: string;
    embedding: number[] | null;
  }>;
};

export type Finding = {
  requirement: string;          // VN, short
  submittedValue: string;       // what nhà thầu submitted
  verdict: "match" | "partial" | "mismatch" | "unknown";
  note: string;                 // ≤ 30 từ
};

export type SubmittalCheckOutput = {
  compliance: "pass" | "partial" | "fail" | "unknown";
  findings: Finding[];
  matchedSpecTitles: string[];  // titles of pages used
  suggestion: string;           // overall recommendation text in VN
  source: "ai" | "fallback";
  model?: string;
  latencyMs?: number;
};

export async function checkSubmittal(input: SubmittalCheckInput): Promise<AiResult<SubmittalCheckOutput>> {
  const sm = input.submittal;
  const query = `${sm.specSection ?? ""} ${sm.materialName} ${sm.manufacturer ?? ""}`.trim();

  // 1) Embed query (bge-m3 via Cloudflare).
  const q = await embed(query);

  // 2) Cosine match against the project's spec pages with embeddings.
  let matched: Array<{ id: string; title: string; body: string; score: number }> = [];
  if (q.ok) {
    matched = input.specPages
      .filter((p) => Array.isArray(p.embedding) && p.embedding.length > 0)
      .map((p) => ({ id: p.id, title: p.title, body: p.body, score: cosine(q.data, p.embedding as number[]) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .filter((m) => m.score > 0.4);
  }

  // 3) Fallback: spec section text search (substring) when no embed match.
  if (matched.length === 0 && sm.specSection) {
    const needle = (sm.specSection.split(" — ")[0] ?? sm.specSection).trim();
    matched = input.specPages
      .filter((p) => p.title.toLowerCase().includes(needle.toLowerCase()) || p.body.toLowerCase().includes(needle.toLowerCase()))
      .slice(0, 2)
      .map((p) => ({ id: p.id, title: p.title, body: p.body, score: 0.5 }));
  }

  if (matched.length === 0) {
    return {
      ok: true,
      data: {
        compliance: "unknown",
        findings: [],
        matchedSpecTitles: [],
        suggestion: "Chưa tìm thấy spec phù hợp trong dự án để đối chiếu. Vui lòng upload spec section liên quan hoặc kiểm tra thủ công.",
        source: "fallback",
      },
      model: "fallback",
      latencyMs: q.ok ? q.latencyMs : 0,
    };
  }

  // 4) LLM compare.
  const sys = [
    "Bạn là chuyên viên QA/QC xây dựng tại VN, kiểm duyệt submittal vật liệu.",
    "Đối chiếu vật liệu nhà thầu trình duyệt vs yêu cầu trong spec.",
    "Trả về JSON: {\"compliance\":\"pass|partial|fail|unknown\", \"findings\":[{\"requirement\":\"\",\"submittedValue\":\"\",\"verdict\":\"match|partial|mismatch|unknown\",\"note\":\"\"}], \"suggestion\":\"\"}",
    "Quy tắc: findings tối đa 5 dòng, mỗi requirement là 1 đặc tính cụ thể (mác, độ bền, xuất xứ, chứng nhận, kích thước).",
    "Tiếng Việt. Không bịa số liệu. Suggestion ≤ 50 từ.",
  ].join(" ");

  const specBlocks = matched.map((m, i) => `[Spec #${i + 1} — ${m.title} (similarity ${(m.score * 100).toFixed(0)}%)]\n${m.body.slice(0, 1500)}`).join("\n\n");

  const user = [
    `Submittal cần kiểm tra:`,
    `- Spec section: ${sm.specSection ?? "(không ghi)"}`,
    `- Vật liệu: ${sm.materialName}`,
    `- Nhà sản xuất: ${sm.manufacturer ?? "(không ghi)"}`,
    "",
    `Spec(s) tham chiếu trong dự án:`,
    specBlocks,
    "",
    "So sánh vật liệu trình duyệt vs yêu cầu trong spec. Trả JSON theo schema.",
  ].join("\n");

  const r = await chat([{ role: "system", content: sys }, { role: "user", content: user }], {
    format: "json",
    temperature: 0.1,
    timeoutMs: 30_000,
  });

  if (!r.ok) {
    return {
      ok: true,
      data: {
        compliance: "unknown",
        findings: [],
        matchedSpecTitles: matched.map((m) => m.title),
        suggestion: "Đã tìm thấy spec phù hợp nhưng AI tạm thời ngoại tuyến. Vui lòng đối chiếu thủ công.",
        source: "fallback",
        latencyMs: r.latencyMs,
      },
      model: "fallback",
      latencyMs: r.latencyMs,
    };
  }

  try {
    const parsed = JSON.parse(r.data);
    const validV: Finding["verdict"][] = ["match", "partial", "mismatch", "unknown"];
    const findings = (Array.isArray(parsed.findings) ? parsed.findings : []).slice(0, 5).map((f: any): Finding => ({
      requirement: String(f.requirement ?? "").slice(0, 200),
      submittedValue: String(f.submittedValue ?? "").slice(0, 200),
      verdict: validV.includes(f.verdict) ? f.verdict : "unknown",
      note: String(f.note ?? "").slice(0, 200),
    }));
    const cv: SubmittalCheckOutput["compliance"][] = ["pass", "partial", "fail", "unknown"];
    const compliance = cv.includes(parsed.compliance) ? parsed.compliance : "unknown";
    const suggestion = String(parsed.suggestion ?? "").slice(0, 500);

    return {
      ok: true,
      data: {
        compliance,
        findings,
        matchedSpecTitles: matched.map((m) => m.title),
        suggestion,
        source: "ai",
        model: r.model,
        latencyMs: r.latencyMs,
      },
      model: r.model,
      latencyMs: r.latencyMs,
    };
  } catch {
    return {
      ok: true,
      data: {
        compliance: "unknown",
        findings: [],
        matchedSpecTitles: matched.map((m) => m.title),
        suggestion: "AI trả về JSON không hợp lệ. Vui lòng thử lại hoặc đối chiếu thủ công.",
        source: "fallback",
        latencyMs: r.latencyMs,
      },
      model: r.model,
      latencyMs: r.latencyMs,
    };
  }
}
