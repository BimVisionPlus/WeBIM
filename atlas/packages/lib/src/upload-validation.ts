/**
 * Server-side upload validation.
 *
 * The browser-direct S3 flow means we cannot enforce mime/size on the bytes
 * themselves, but we DO control which presigned URLs we issue. Reject early:
 *  - per-kind allowlist of extensions + content types
 *  - per-kind max byte size
 *
 * Bytes still need scanning post-upload — that's the AV worker (out of scope
 * for v1 pilot but called out in DEPLOY.md).
 */

export type UploadKind = "models" | "drawings" | "attachments" | "markups";

const POLICY: Record<UploadKind, { maxBytes: number; exts: string[]; contentTypes: RegExp[] }> = {
  models: {
    maxBytes: 2 * 1024 * 1024 * 1024, // 2 GiB
    exts: ["ifc", "rvt", "rfa", "nwd", "nwc", "dwg", "dxf", "pdf"],
    contentTypes: [/^application\/octet-stream$/, /^application\/x-/, /^application\/pdf$/, /^model\//],
  },
  drawings: {
    maxBytes: 500 * 1024 * 1024,
    exts: ["pdf", "dwg", "dxf", "png", "jpg", "jpeg", "webp"],
    contentTypes: [/^application\/(pdf|octet-stream|x-)/, /^image\/(png|jpe?g|webp)$/],
  },
  attachments: {
    maxBytes: 50 * 1024 * 1024,
    exts: ["pdf", "png", "jpg", "jpeg", "webp", "heic", "doc", "docx", "xls", "xlsx", "txt", "csv"],
    contentTypes: [/^application\/(pdf|msword|vnd\.openxmlformats|vnd\.ms-)/, /^image\//, /^text\//],
  },
  markups: {
    maxBytes: 5 * 1024 * 1024,
    exts: ["json", "svg", "png"],
    contentTypes: [/^application\/json$/, /^image\/(svg\+xml|png)$/],
  },
};

export function validateUpload(args: {
  kind: UploadKind;
  filename: string;
  contentType: string;
  sizeBytes?: number;
}): { ok: true } | { ok: false; error: string } {
  const p = POLICY[args.kind];
  if (!p) return { ok: false, error: `Loại upload không hợp lệ: ${args.kind}` };

  const ext = args.filename.toLowerCase().split(".").pop() ?? "";
  if (!p.exts.includes(ext)) {
    return { ok: false, error: `Định dạng .${ext} không được phép cho ${args.kind}` };
  }

  if (!p.contentTypes.some((re) => re.test(args.contentType))) {
    return { ok: false, error: `Content-Type ${args.contentType} không hợp lệ` };
  }

  if (args.sizeBytes !== undefined && args.sizeBytes > p.maxBytes) {
    const mb = Math.round(p.maxBytes / 1024 / 1024);
    return { ok: false, error: `File vượt giới hạn ${mb} MB` };
  }

  // Filename sanity
  if (args.filename.length > 255) return { ok: false, error: "Tên tệp quá dài" };
  if (/[/\\]/.test(args.filename)) return { ok: false, error: "Tên tệp chứa ký tự không cho phép" };

  return { ok: true };
}

export const uploadLimits = POLICY;
