/**
 * POST /api/webim/presign — step 1 of publishing a WeBIM model.
 *
 * Mirrors `/api/upload` (kind: "models") but authenticates with a WeBIM API
 * key instead of a session. The bytes never pass through Atlas: WeBIM Web PUTs
 * the IFC straight to S3/MinIO with the returned URL, then calls
 * `/api/webim/commit` with the key it was given.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import {
  audit,
  presignUpload,
  projectKey,
  rateLimitGuard,
  reqMeta,
  validateUpload,
} from "@atlas/lib";
import {
  bridgeError,
  bridgeJson,
  bridgePreflight,
  requireApiKey,
  requireProjectInOrg,
} from "@/lib/webim-bridge";

const Body = z.object({
  projectId: z.string().min(1),
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(120),
  sizeBytes: z.number().int().nonnegative().optional(),
});

export async function OPTIONS(req: NextRequest) {
  return bridgePreflight(req);
}

export async function POST(req: NextRequest) {
  const limited = await rateLimitGuard(req, { name: "webim.presign" });
  if (limited) return limited;

  try {
    const key = await requireApiKey(req, "models:write");
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return bridgeJson(req, { error: parsed.error.flatten() }, { status: 400 });
    }
    const { projectId, filename, contentType, sizeBytes } = parsed.data;
    const project = await requireProjectInOrg(projectId, key.orgId);

    const check = validateUpload({ kind: "models", filename, contentType, sizeBytes });
    if (!check.ok) return bridgeJson(req, { error: check.error }, { status: 400 });

    const objectKey = projectKey(project.key, "models", filename);
    const uploadUrl = await presignUpload("models", objectKey, contentType);

    await audit({
      action: "webim.presigned",
      entityType: "Upload",
      actorId: key.createdByUserId ?? undefined,
      orgId: key.orgId,
      projectId,
      ...reqMeta(req),
      after: { key: objectKey, filename, sizeBytes, apiKeyId: key.id },
    });

    return bridgeJson(req, { uploadUrl, key: objectKey, contentType });
  } catch (err) {
    return bridgeError(req, err);
  }
}
