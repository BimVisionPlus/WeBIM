// Storage adapters behind the CDE file API.
//
// The CDE treats storage as an opaque blob store (put/get/list), so the
// backend is swappable — the BYO-storage promise. Two adapters:
//
//   local  — files under relay/data (default, zero config)
//   s3     — any S3-compatible endpoint (AWS, MinIO, Ceph…) via
//            hand-rolled SigV4, path-style URLs; no SDK dependency.
//            Enable with S3_ENDPOINT + S3_BUCKET + S3_ACCESS_KEY +
//            S3_SECRET_KEY (+ S3_REGION, default ap-southeast-1).

import { createHash, createHmac } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";

export function createLocalStorage(dataDir) {
  const keyToPath = (key) => join(dataDir, normalize(key));
  return {
    kind: "local",
    async put(key, body) {
      const filePath = keyToPath(key);
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, body);
    },
    async get(key) {
      return readFile(keyToPath(key));
    },
    async list(prefix) {
      const root = prefix ? keyToPath(prefix) : dataDir;
      const entries = [];
      const walk = async (directory, relative) => {
        let names = [];
        try {
          names = await readdir(directory);
        } catch {
          return;
        }
        for (const name of names) {
          const full = join(directory, name);
          const info = await stat(full);
          if (info.isDirectory()) {
            await walk(full, `${relative}${name}/`);
          } else {
            entries.push({ key: `${relative}${name}`, size: info.size });
          }
        }
      };
      await walk(root, prefix ? `${prefix}/` : "");
      return entries;
    },
  };
}

/** AWS Signature V4 for S3-compatible object storage. */
function sigV4Headers({ method, url, body, region, accessKey, secretKey }) {
  const parsed = new URL(url);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const dateStamp = amzDate.slice(0, 8);
  const service = "s3";
  const payloadHash = createHash("sha256")
    .update(body ?? "")
    .digest("hex");

  const canonicalHeaders =
    `host:${parsed.host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalQuery = [...parsed.searchParams.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
  const canonicalRequest = [
    method,
    parsed.pathname.replace(/[^/A-Za-z0-9._~-]/g, (c) =>
      `%${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`,
    ),
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    createHash("sha256").update(canonicalRequest).digest("hex"),
  ].join("\n");

  let key = createHmac("sha256", `AWS4${secretKey}`).update(dateStamp).digest();
  for (const part of [region, service, "aws4_request"]) {
    key = createHmac("sha256", key).update(part).digest();
  }
  const signature = createHmac("sha256", key).update(stringToSign).digest("hex");

  return {
    "x-amz-date": amzDate,
    "x-amz-content-sha256": payloadHash,
    Authorization:
      `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

export function createS3Storage({ endpoint, bucket, region, accessKey, secretKey }) {
  const objectUrl = (key) =>
    `${endpoint.replace(/\/$/, "")}/${bucket}/${key
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`;

  const send = async (method, url, body) => {
    const headers = sigV4Headers({ method, url, body, region, accessKey, secretKey });
    const response = await fetch(url, { method, headers, body });
    if (!response.ok) {
      throw new Error(`S3 ${method} ${response.status}: ${await response.text()}`);
    }
    return response;
  };

  return {
    kind: "s3",
    async put(key, body) {
      await send("PUT", objectUrl(key), body);
    },
    async get(key) {
      const response = await send("GET", objectUrl(key));
      return Buffer.from(await response.arrayBuffer());
    },
    async list(prefix) {
      const url =
        `${endpoint.replace(/\/$/, "")}/${bucket}?list-type=2` +
        (prefix ? `&prefix=${encodeURIComponent(prefix)}` : "");
      const response = await send("GET", url);
      const xml = await response.text();
      const entries = [];
      const pattern = /<Key>([^<]+)<\/Key>\s*(?:<[^>]+>[^<]*<\/[^>]+>\s*)*?<Size>(\d+)<\/Size>/g;
      let match;
      while ((match = pattern.exec(xml))) {
        entries.push({ key: match[1], size: Number(match[2]) });
      }
      return entries;
    },
  };
}

export function createStorage(dataDir) {
  const { S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY, S3_REGION } =
    process.env;
  if (S3_ENDPOINT && S3_BUCKET && S3_ACCESS_KEY && S3_SECRET_KEY) {
    return createS3Storage({
      endpoint: S3_ENDPOINT,
      bucket: S3_BUCKET,
      region: S3_REGION ?? "ap-southeast-1",
      accessKey: S3_ACCESS_KEY,
      secretKey: S3_SECRET_KEY,
    });
  }
  return createLocalStorage(dataDir);
}
