// WeBIM → Atlas: publish the native BIM project into the Atlas Models module.
//
// Atlas (atlas/ in this repo) is session-authenticated everywhere except the
// `/api/webim/*` bridge, which takes an org-scoped API key instead — WeBIM Web
// runs on its own origin and has no Auth.js cookie. The flow mirrors the
// browser upload path in Atlas exactly:
//
//   1. POST /api/webim/presign   → { uploadUrl, key }
//   2. PUT  uploadUrl            → the IFC bytes go straight to S3/MinIO
//   3. POST /api/webim/commit    → a Model row appears in the Models module
//
// The bytes never pass through the Atlas server, so a 200 MB federated export
// costs Atlas one presign and one insert.

export type AtlasDiscipline =
  | "KIEN_TRUC"
  | "KET_CAU"
  | "CO_DIEN_M"
  | "CO_DIEN_E"
  | "CO_DIEN_P"
  | "PCCC"
  | "CANH_QUAN"
  | "HA_TANG"
  | "NOI_THAT";

export const ATLAS_DISCIPLINES: Array<[AtlasDiscipline, string]> = [
  ["KIEN_TRUC", "Kiến trúc"],
  ["KET_CAU", "Kết cấu"],
  ["CO_DIEN_M", "Cơ điện — HVAC"],
  ["CO_DIEN_E", "Cơ điện — Điện"],
  ["CO_DIEN_P", "Cơ điện — Cấp thoát nước"],
  ["PCCC", "PCCC"],
  ["CANH_QUAN", "Cảnh quan"],
  ["HA_TANG", "Hạ tầng"],
  ["NOI_THAT", "Nội thất"],
];

export interface AtlasConfig {
  /** Origin of the Atlas deployment, e.g. https://atlas.aecplatform.vn */
  baseUrl: string;
  apiKey: string;
  projectId: string;
  /** Cached label so the picker reads sensibly before projects are fetched. */
  projectLabel: string;
  discipline: AtlasDiscipline;
  revision: string;
}

export interface AtlasProject {
  id: string;
  key: string;
  name: string;
  status: string;
}

export interface PublishResult {
  modelId: string;
  /** True when an existing model of the same name + revision was overwritten. */
  replaced: boolean;
  viewerUrl: string;
  fileKey: string;
  sizeBytes: number;
}

/** IFC-SPF is a STEP physical file; Atlas accepts `application/x-*` for models. */
export const IFC_CONTENT_TYPE = "application/x-step";

const CONFIG_KEY = "webim.atlas";

/**
 * Production Atlas lives on its own subdomain; a dev machine points elsewhere
 * with VITE_ATLAS_BASE. This is only the first-run default — the value the
 * user picks is what gets persisted.
 */
const DEFAULT_ATLAS_BASE =
  (import.meta.env?.VITE_ATLAS_BASE as string | undefined) ?? "https://atlas.webim.vn";

export const DEFAULT_ATLAS_CONFIG: AtlasConfig = {
  baseUrl: DEFAULT_ATLAS_BASE,
  apiKey: "",
  projectId: "",
  projectLabel: "",
  discipline: "KIEN_TRUC",
  revision: "v1",
};

export function loadAtlasConfig(): AtlasConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return { ...DEFAULT_ATLAS_CONFIG };
    return { ...DEFAULT_ATLAS_CONFIG, ...(JSON.parse(raw) as Partial<AtlasConfig>) };
  } catch {
    return { ...DEFAULT_ATLAS_CONFIG };
  }
}

export function saveAtlasConfig(config: AtlasConfig): void {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  } catch {
    // Private-mode storage failures must not block a publish.
  }
}

/**
 * S3 object keys are built server-side, but the *filename* is validated there
 * against a path-separator check, so strip anything that could look like one
 * before it leaves the browser.
 */
export function ifcFileName(modelName: string, revision: string): string {
  const safe = `${modelName}-${revision}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    // Trim the separators too, or a name of only punctuation collapses to
    // something like "-.ifc" — a leading dot would also mean a hidden file.
    .replace(/^[._-]+|[._-]+$/g, "");
  return `${safe || "webim-model"}.ifc`;
}

function base(config: AtlasConfig): string {
  return config.baseUrl.replace(/\/+$/, "");
}

function authHeaders(config: AtlasConfig): Record<string, string> {
  return { Authorization: `Bearer ${config.apiKey}` };
}

/** Turns a non-2xx bridge response into the Vietnamese message Atlas sent. */
async function bridgeFailure(response: Response, fallback: string): Promise<Error> {
  const body = await response.json().catch(() => null);
  const detail =
    typeof body?.error === "string"
      ? body.error
      : body?.error
        ? JSON.stringify(body.error)
        : `HTTP ${response.status}`;
  return new Error(`${fallback}: ${detail}`);
}

export async function listAtlasProjects(
  config: AtlasConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<AtlasProject[]> {
  const response = await fetchImpl(`${base(config)}/api/webim/projects`, {
    headers: authHeaders(config),
  });
  if (!response.ok) throw await bridgeFailure(response, "Không lấy được danh sách dự án");
  const body = (await response.json()) as { projects: AtlasProject[] };
  return body.projects ?? [];
}

/** The bridge health route names the service; nothing else answers "atlas". */
const ATLAS_SERVICE = "atlas";

/**
 * Does an Atlas answer here, and can it prove it?
 *
 * `/api/webim/health` is CORS-enabled precisely so this question is
 * answerable from another origin. Reachability alone is not: port 3000 on a
 * developer's machine is as likely to be Dagster or Grafana, and every one of
 * them returns 200 — framing whichever answered first is how the tab ends up
 * showing somebody else's app.
 *
 * A false negative is possible and deliberate: an Atlas whose
 * WEBIM_ALLOWED_ORIGINS does not include us will not answer readably. That is
 * the correct answer for *guessing* — an Atlas that will not talk to this
 * origin is not one to adopt silently. An address the user typed is handled
 * differently; see `probeAtlas`.
 */
export async function identifyAtlas(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 6000,
): Promise<boolean> {
  const url = baseUrl.replace(/\/+$/, "");
  if (!url) return false;
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`${url}/api/webim/health`, {
      signal: abort.signal,
      cache: "no-store",
    });
    if (!response.ok) return false;
    const body = (await response.json()) as { service?: string };
    return body?.service === ATLAS_SERVICE;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Is anything reachable at this address?
 *
 * Used only for an address the user typed: they have said what it is, so
 * framing what they asked for is right even when it cannot prove itself —
 * an older Atlas, or one that does not allow this origin, still displays.
 * The pane warns when `identifyAtlas` disagrees rather than refusing.
 *
 * A cross-origin iframe cannot report its own load failure, which is why
 * anything is asked at all: a dead host would otherwise render the browser's
 * error page inside the app layout.
 */
export async function probeAtlas(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 6000,
): Promise<boolean> {
  const url = baseUrl.replace(/\/+$/, "");
  if (!url) return false;
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeoutMs);
  try {
    // Opaque is a fine answer here — only "did this reach a server" is asked.
    await fetchImpl(`${url}/api/webim/health`, {
      mode: "no-cors",
      signal: abort.signal,
      cache: "no-store",
    });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Where an Atlas usually is, in the order worth trying.
 *
 * Same-origin first: a deployment that reverse-proxies Atlas under /atlas
 * needs no configuration at all. Then the port `atlas/apps/web` binds in
 * dev, then plain 3000 for anyone who changed it.
 */
export function atlasCandidates(): string[] {
  const here = typeof window === "undefined" ? "" : window.location.origin;
  return [
    ...(here ? [`${here}/atlas`] : []),
    "http://localhost:3170",
    "http://localhost:3000",
  ];
}

/**
 * Find an Atlas without asking the user to type an address.
 *
 * Probes every candidate at once and returns the first that *identifies as
 * Atlas*, in candidate order rather than whichever-was-fastest — otherwise
 * the chosen address would change between reloads on a machine running two.
 */
export async function discoverAtlas(
  candidates: string[] = atlasCandidates(),
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  const results = await Promise.all(
    candidates.map((candidate) => identifyAtlas(candidate, fetchImpl)),
  );
  const index = results.findIndex(Boolean);
  return index === -1 ? null : candidates[index];
}

export interface PublishOptions {
  config: AtlasConfig;
  /** IFC-SPF text, straight out of the store's exportIfc(). */
  ifc: string;
  modelName: string;
  /** WeBIM's own project id — recorded in the Atlas audit trail. */
  webimProjectId?: string;
  onProgress?: (message: string) => void;
}

export async function publishToAtlas(
  options: PublishOptions,
  fetchImpl: typeof fetch = fetch,
): Promise<PublishResult> {
  const { config, ifc, modelName, webimProjectId, onProgress } = options;
  if (!config.baseUrl) throw new Error("Chưa cấu hình địa chỉ Atlas");
  if (!config.apiKey) throw new Error("Chưa có API key Atlas");
  if (!config.projectId) throw new Error("Chưa chọn dự án Atlas");
  if (!modelName.trim()) throw new Error("Chưa đặt tên model");

  const blob = new Blob([ifc], { type: IFC_CONTENT_TYPE });
  const fileName = ifcFileName(modelName, config.revision);

  onProgress?.("Xin quyền tải lên…");
  const presign = await fetchImpl(`${base(config)}/api/webim/presign`, {
    method: "POST",
    headers: { ...authHeaders(config), "content-type": "application/json" },
    body: JSON.stringify({
      projectId: config.projectId,
      filename: fileName,
      contentType: IFC_CONTENT_TYPE,
      sizeBytes: blob.size,
    }),
  });
  if (!presign.ok) throw await bridgeFailure(presign, "Presign thất bại");
  const { uploadUrl, key } = (await presign.json()) as { uploadUrl: string; key: string };

  onProgress?.(`Đang tải ${(blob.size / 1024).toFixed(0)} KB lên kho file…`);
  // The presigned signature covers Content-Type, so it must be sent back
  // byte-identical or S3 answers 403 SignatureDoesNotMatch.
  const upload = await fetchImpl(uploadUrl, {
    method: "PUT",
    headers: { "content-type": IFC_CONTENT_TYPE },
    body: blob,
  });
  if (!upload.ok) {
    throw new Error(`Tải file lên kho thất bại (HTTP ${upload.status})`);
  }

  onProgress?.("Đăng ký model trong Atlas…");
  const commit = await fetchImpl(`${base(config)}/api/webim/commit`, {
    method: "POST",
    headers: { ...authHeaders(config), "content-type": "application/json" },
    body: JSON.stringify({
      projectId: config.projectId,
      name: modelName.trim(),
      discipline: config.discipline,
      revision: config.revision,
      fileKey: key,
      fileName,
      fileSizeBytes: blob.size,
      webimProjectId,
    }),
  });
  if (!commit.ok) throw await bridgeFailure(commit, "Đăng ký model thất bại");
  const body = (await commit.json()) as {
    modelId: string;
    replaced: boolean;
    viewerPath: string;
  };

  onProgress?.(body.replaced ? "Đã thay thế bản cũ." : "Đã tạo model mới.");
  return {
    modelId: body.modelId,
    replaced: body.replaced,
    viewerUrl: `${base(config)}${body.viewerPath}`,
    fileKey: key,
    sizeBytes: blob.size,
  };
}
