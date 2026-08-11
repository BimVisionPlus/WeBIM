/**
 * Background pipeline: pull a freshly-uploaded model from S3/MinIO,
 * push to APS OSS, submit a translation job, poll until done, persist URN.
 *
 * Designed to run inside a Node process — either as a fire-and-forget call
 * from the API route (dev / pilot scale) or as a separate worker reading
 * a Redis queue (production). For pilot we just fire-and-forget.
 *
 * Skips silently if APS_CLIENT_ID is not set — model stays PENDING and the
 * UI surfaces "APS chưa cấu hình".
 */

import { GetObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "@atlas/db";
import { s3, buckets } from "./s3";
import { uploadModelToAps, translateModel, translationStatus } from "./aps";
import { logger } from "./log";

export async function runApsPipeline(modelId: string) {
  if (!process.env.APS_CLIENT_ID || !process.env.APS_CLIENT_SECRET) {
    logger().info({ modelId }, "aps.skipped_unconfigured");
    return;
  }

  const log = logger().child({ modelId });
  let model = await prisma.model.findUnique({ where: { id: modelId } });
  if (!model) {
    log.warn("aps.model_missing");
    return;
  }

  try {
    await prisma.model.update({
      where: { id: modelId },
      data: { apsTranslationStatus: "INPROGRESS", apsTranslationProgress: 5 },
    });

    // 1. Stream from S3/MinIO into a buffer (small/mid models). For huge
    //    files this would need APS resumable upload + chunking — out of v1.
    const obj = await s3.send(new GetObjectCommand({ Bucket: buckets.models, Key: model.fileUrl }));
    const bytes = await streamToBuffer(obj.Body as any);
    log.info({ size: bytes.length }, "aps.fetched_from_s3");

    // 2. Push to APS OSS
    const bucketKey = process.env.APS_BUCKET_KEY ?? "atlas-aec-models";
    const objectKey = `${modelId}-${model.name}`.replace(/[^a-zA-Z0-9._-]/g, "_");
    const { urn } = await uploadModelToAps(bucketKey, objectKey, bytes);
    log.info({ urn }, "aps.uploaded");

    // 3. Submit translation
    await translateModel(urn, model.format === "RVT");
    await prisma.model.update({
      where: { id: modelId },
      data: { apsUrn: urn, apsTranslationProgress: 30 },
    });
    log.info("aps.translation_submitted");

    // 4. Poll (cap at ~10 min for v1; long-running translations would need a real worker)
    const deadline = Date.now() + 10 * 60 * 1000;
    while (Date.now() < deadline) {
      await sleep(8_000);
      const s = await translationStatus(urn);
      await prisma.model.update({
        where: { id: modelId },
        data: { apsTranslationStatus: s.status, apsTranslationProgress: s.progress },
      });
      if (s.status === "SUCCESS" || s.status === "FAILED" || s.status === "TIMEOUT") {
        log.info({ status: s.status }, "aps.translation_done");
        return;
      }
    }
    await prisma.model.update({
      where: { id: modelId },
      data: { apsTranslationStatus: "TIMEOUT" },
    });
    log.warn("aps.polling_timeout");
  } catch (err) {
    log.error({ err }, "aps.pipeline_failed");
    await prisma.model
      .update({ where: { id: modelId }, data: { apsTranslationStatus: "FAILED" } })
      .catch(() => {});
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function streamToBuffer(stream: any): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}
