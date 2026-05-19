/**
 * Centralised env validation. Imported once from each app's entrypoint.
 *
 * Fails fast (throws on import) so misconfigured prod deployments die at
 * startup instead of midway through a request that lost a secret.
 */

import { z } from "zod";

const Schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  DATABASE_URL: z.string().url(),

  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be ≥32 chars — generate with `openssl rand -base64 32`"),
  AUTH_URL: z.string().url(),

  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().default("us-east-1"),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_BUCKET_MODELS: z.string().default("models"),
  S3_BUCKET_DRAWINGS: z.string().default("drawings"),
  S3_BUCKET_MARKUPS: z.string().default("markups"),
  S3_BUCKET_ATTACHMENTS: z.string().default("attachments"),
  S3_FORCE_PATH_STYLE: z.string().default("true"),

  REDIS_URL: z.string().optional(),

  APS_CLIENT_ID: z.string().optional(),
  APS_CLIENT_SECRET: z.string().optional(),
  APS_BUCKET_KEY: z.string().default("atlas-aec-models"),
  APS_CALLBACK_URL: z.string().url().optional(),

  AUTH_EMAIL_SERVER: z.string().optional(),
  AUTH_EMAIL_FROM: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Atlas AEC <no-reply@atlas-aec.vn>"),

  SENTRY_DSN: z.string().optional(),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),

  // ─── AI (OSS-only: Ollama + faster-whisper) ────────────────────────────────
  // Set AI_ENABLED=false to fully disable AI calls; APIs return null suggestions.
  AI_ENABLED: z.enum(["true", "false"]).default("true"),
  OLLAMA_BASE_URL: z.string().url().default("http://localhost:11434"),
  OLLAMA_LLM_MODEL: z.string().default("qwen2.5:7b-instruct"),
  OLLAMA_VLM_MODEL: z.string().default("qwen2.5vl:7b"),
  OLLAMA_EMBED_MODEL: z.string().default("bge-m3"),
  OLLAMA_TIMEOUT_MS: z.coerce.number().int().positive().default(45_000),
  WHISPER_BASE_URL: z.string().url().default("http://localhost:8009"),
  WHISPER_MODEL: z.string().default("Systran/faster-whisper-medium"),
  WHISPER_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),

  NEXT_PUBLIC_APP_NAME: z.string().default("Atlas AEC"),
  NEXT_PUBLIC_BASE_URL: z.string().url().default("http://localhost:3000"),
});

export type Env = z.infer<typeof Schema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;

  // Skip validation during Next.js build collection unless we're in prod.
  const isBuild = process.env.NEXT_PHASE === "phase-production-build";
  const parsed = Schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  • ${i.path.join(".")}: ${i.message}`).join("\n");
    if (process.env.NODE_ENV === "production" && !isBuild) {
      throw new Error(`Invalid environment variables:\n${issues}`);
    }
    // In dev / build, warn but still construct a partial env to avoid hard-crashing locally.
    // Missing AUTH_SECRET will be caught at request-time when NextAuth tries to use it.
    // eslint-disable-next-line no-console
    console.warn(`[env] Validation warnings:\n${issues}`);
    cached = process.env as unknown as Env;
    return cached;
  }
  cached = parsed.data;
  return cached;
}
