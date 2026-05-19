import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const endpoint = process.env.S3_ENDPOINT ?? "http://localhost:9000";
const region = process.env.S3_REGION ?? "us-east-1";
const accessKeyId = process.env.S3_ACCESS_KEY ?? "atlas";
const secretAccessKey = process.env.S3_SECRET_KEY ?? "atlas-secret-key";
const forcePathStyle = (process.env.S3_FORCE_PATH_STYLE ?? "true") === "true";

export const s3 = new S3Client({
  endpoint,
  region,
  forcePathStyle,
  credentials: { accessKeyId, secretAccessKey },
});

export const buckets = {
  models: process.env.S3_BUCKET_MODELS ?? "models",
  drawings: process.env.S3_BUCKET_DRAWINGS ?? "drawings",
  markups: process.env.S3_BUCKET_MARKUPS ?? "markups",
  attachments: process.env.S3_BUCKET_ATTACHMENTS ?? "attachments",
} as const;

export type BucketKey = keyof typeof buckets;

export async function presignUpload(
  bucket: BucketKey,
  key: string,
  contentType: string,
  expiresIn = 60 * 15,
) {
  const cmd = new PutObjectCommand({
    Bucket: buckets[bucket],
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(s3, cmd, { expiresIn });
}

export async function presignDownload(bucket: BucketKey, key: string, expiresIn = 60 * 60) {
  const cmd = new GetObjectCommand({ Bucket: buckets[bucket], Key: key });
  return getSignedUrl(s3, cmd, { expiresIn });
}

export async function deleteObject(bucket: BucketKey, key: string) {
  await s3.send(new DeleteObjectCommand({ Bucket: buckets[bucket], Key: key }));
}

/** Build a stable object key for a project's uploaded file. */
export function projectKey(projectKey: string, kind: string, filename: string) {
  const date = new Date().toISOString().slice(0, 10);
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${projectKey}/${kind}/${date}/${crypto.randomUUID()}-${safe}`;
}
