/**
 * Autodesk APS (Platform Services, ex-"Forge") integration.
 *
 * Two-step flow for BIM viewing:
 *   1. Upload original model (IFC / RVT / NWD) → APS OSS bucket
 *   2. Submit a Model Derivative translation job (SVF2 for the web Viewer)
 *   3. Poll job status → store `urn` + `status` on the Model row
 *   4. Frontend Viewer loads document by `urn` with a short-lived viewer token
 *
 * The `viewables-2d` derivative also produces per-sheet thumbnails we use in
 * the Models → Sheets browser.
 */

const APS_BASE = "https://developer.api.autodesk.com";

type TokenResponse = {
  access_token: string;
  expires_in: number;
  token_type: string;
};

let cachedToken: { value: string; expiresAt: number } | null = null;

/** Get a 2-legged OAuth access token, cached until expiry. */
export async function apsToken(scope = "data:read data:write data:create bucket:create bucket:read"): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.value;
  }

  const clientId = process.env.APS_CLIENT_ID;
  const clientSecret = process.env.APS_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("APS_CLIENT_ID and APS_CLIENT_SECRET must be set");
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    scope,
  });

  const res = await fetch(`${APS_BASE}/authentication/v2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
    },
    body,
  });

  if (!res.ok) throw new Error(`APS token failed: ${res.status} ${await res.text()}`);
  const tok = (await res.json()) as TokenResponse;

  cachedToken = {
    value: tok.access_token,
    expiresAt: Date.now() + tok.expires_in * 1000,
  };
  return tok.access_token;
}

/** Generate a viewer-only token (scope=viewables:read) for the browser. */
export async function apsViewerToken() {
  return apsToken("viewables:read");
}

/** Ensure the OSS bucket exists (idempotent). */
export async function ensureBucket(bucketKey: string) {
  const token = await apsToken();
  const res = await fetch(`${APS_BASE}/oss/v2/buckets`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ bucketKey, policyKey: "persistent" }),
  });
  if (res.status === 409) return; // already exists
  if (!res.ok) throw new Error(`Create bucket failed: ${res.status} ${await res.text()}`);
}

/** Upload bytes to APS OSS and return the object URN. */
export async function uploadModelToAps(
  bucketKey: string,
  objectKey: string,
  body: Uint8Array | Buffer,
): Promise<{ objectId: string; urn: string }> {
  const token = await apsToken();
  await ensureBucket(bucketKey);

  const res = await fetch(
    `${APS_BASE}/oss/v2/buckets/${encodeURIComponent(bucketKey)}/objects/${encodeURIComponent(objectKey)}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/octet-stream",
      },
      body: body as BodyInit,
    },
  );
  if (!res.ok) throw new Error(`Upload failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { objectId: string };
  const urn = Buffer.from(json.objectId).toString("base64").replace(/=+$/, "");
  return { objectId: json.objectId, urn };
}

/** Submit a SVF2 translation job for an uploaded model. */
export async function translateModel(urn: string, isRvt = false) {
  const token = await apsToken();
  const body = {
    input: { urn, ...(isRvt ? { compressedUrn: false } : {}) },
    output: {
      formats: [
        {
          type: "svf2",
          views: ["2d", "3d"],
        },
      ],
    },
  };
  const res = await fetch(`${APS_BASE}/modelderivative/v2/designdata/job`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "x-ads-force": "true",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Translate failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<{ result: string; urn: string }>;
}

/** Poll translation status. */
export async function translationStatus(urn: string) {
  const token = await apsToken();
  const res = await fetch(`${APS_BASE}/modelderivative/v2/designdata/${urn}/manifest`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Status failed: ${res.status}`);
  const m = (await res.json()) as { status: string; progress: string };
  // status: "pending" | "inprogress" | "success" | "failed" | "timeout"
  // progress: "0% complete" .. "complete"
  const pct = m.progress === "complete" ? 100 : parseInt(m.progress, 10) || 0;
  return { status: m.status.toUpperCase() as "PENDING" | "INPROGRESS" | "SUCCESS" | "FAILED" | "TIMEOUT", progress: pct };
}
