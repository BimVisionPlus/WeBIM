/**
 * POST /api/webim/commit — step 2 of publishing a WeBIM model.
 *
 * Registers the object that WeBIM Web just PUT to S3 as a `Model` row, so the
 * IFC shows up in the Models module and goes through the same APS translation
 * as anything uploaded from the browser. Kept separate from `/api/drawings`
 * (which is session-authenticated) so the bridge stays purely additive.
 *
 * Publishing the same revision twice updates the existing row rather than
 * stacking duplicates — WeBIM re-exports the whole native project on every
 * push, so a retry after a flaky upload is normal, not a new revision.
 *
 * The superseded S3 object is deliberately NOT deleted here: the bytes are
 * still what an earlier audit row points at, and deleting from a request that
 * may itself be a retry is the wrong place to reclaim space. Orphan cleanup
 * belongs with the AV/lifecycle sweep over the models bucket.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { audit, logger, rateLimitGuard, reqMeta, runApsPipeline } from "@atlas/lib";
import { prisma } from "@atlas/db";
import {
  bridgeError,
  bridgeJson,
  bridgePreflight,
  requireApiKey,
  requireProjectInOrg,
} from "@/lib/webim-bridge";

const DISCIPLINES = [
  "KIEN_TRUC",
  "KET_CAU",
  "CO_DIEN_M",
  "CO_DIEN_E",
  "CO_DIEN_P",
  "PCCC",
  "CANH_QUAN",
  "HA_TANG",
  "NOI_THAT",
] as const;

const Body = z.object({
  projectId: z.string().min(1),
  name: z.string().min(2).max(200),
  discipline: z.enum(DISCIPLINES).default("KIEN_TRUC"),
  revision: z.string().min(1).max(20),
  fileKey: z.string().min(1).max(500),
  fileName: z.string().min(1).max(255),
  fileSizeBytes: z.number().int().nonnegative(),
  /** WeBIM's own project id — carried for traceability back to the .blend. */
  webimProjectId: z.string().max(120).optional(),
});

export async function OPTIONS(req: NextRequest) {
  return bridgePreflight(req);
}

export async function POST(req: NextRequest) {
  const limited = await rateLimitGuard(req, { name: "webim.commit" });
  if (limited) return limited;

  try {
    const key = await requireApiKey(req, "models:write");
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return bridgeJson(req, { error: parsed.error.flatten() }, { status: 400 });
    }
    const {
      projectId,
      name,
      discipline,
      revision,
      fileKey,
      fileName,
      fileSizeBytes,
      webimProjectId,
    } = parsed.data;
    await requireProjectInOrg(projectId, key.orgId);

    // The bridge only ever ships IFC — anything else means the client lied
    // about the filename it presigned, so reject rather than guess a format.
    if (!fileName.toLowerCase().endsWith(".ifc")) {
      return bridgeJson(req, { error: "Bridge chỉ nhận file .ifc" }, { status: 400 });
    }

    const existing = await prisma.model.findFirst({
      where: { projectId, name, revision },
      select: { id: true },
    });

    const model = existing
      ? await prisma.model.update({
          where: { id: existing.id },
          data: {
            discipline,
            fileUrl: fileKey,
            fileSizeBytes: BigInt(fileSizeBytes),
            apsUrn: null,
            apsTranslationStatus: "PENDING",
            apsTranslationProgress: 0,
            uploadedAt: new Date(),
          },
        })
      : await prisma.model.create({
          data: {
            projectId,
            name,
            discipline,
            revision,
            fileUrl: fileKey,
            fileSizeBytes: BigInt(fileSizeBytes),
            format: "IFC",
            apsTranslationStatus: "PENDING",
            uploadedByUserId: key.createdByUserId ?? "",
          },
        });

    await audit({
      action: existing ? "webim.model.replaced" : "webim.model.created",
      entityType: "Model",
      entityId: model.id,
      actorId: key.createdByUserId ?? undefined,
      orgId: key.orgId,
      projectId,
      ...reqMeta(req),
      after: { name, revision, fileSizeBytes, webimProjectId, apiKeyId: key.id },
    });

    // Same fire-and-forget translation as the browser upload path.
    runApsPipeline(model.id).catch((err) =>
      logger().error({ err, modelId: model.id }, "webim.aps_fire_forget_err"),
    );

    return bridgeJson(req, {
      ok: true,
      modelId: model.id,
      replaced: Boolean(existing),
      viewerPath: `/projects/${projectId}/models/${model.id}`,
    });
  } catch (err) {
    return bridgeError(req, err);
  }
}
