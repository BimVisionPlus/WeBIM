-- One-time grandfather for users created before the verify-email release.
--
-- Use this if you decide existing users SHOULD NOT have to re-verify when the
-- new flow goes live. Run once, then delete this file from production.
--
-- If you'd rather force everyone to verify, use scripts/send-verify-all.ts
-- instead and skip this SQL.

BEGIN;

-- Show what would be changed (dry-run by default — uncomment the UPDATE to apply)
SELECT
  COUNT(*) AS to_grandfather
FROM "User"
WHERE "emailVerified" IS NULL
  AND "createdAt" < '2026-05-19'::date;

-- UPDATE "User"
-- SET "emailVerified" = NOW()
-- WHERE "emailVerified" IS NULL
--   AND "createdAt" < '2026-05-19'::date;

-- Audit row for the change so it's traceable
-- INSERT INTO "AuditEvent" (id, action, "entityType", "entityId", "createdAt", after)
-- SELECT
--   gen_random_uuid()::text,
--   'auth.email_verified.grandfathered',
--   'User',
--   id,
--   NOW(),
--   '{"by":"admin","reason":"pre-verify-email release"}'::jsonb
-- FROM "User"
-- WHERE "emailVerified" IS NULL
--   AND "createdAt" < '2026-05-19'::date;

COMMIT;
