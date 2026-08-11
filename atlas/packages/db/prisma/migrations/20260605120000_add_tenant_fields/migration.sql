-- Multi-tenant subdomain support (module D — "Sandbox per customer").
--
-- Strategy: every prospect = its own Organization with tenant flags.
-- Subdomain <slug>.aecplatform.vn → resolves Organization by slug.
-- Existing org-scoped query patterns work unchanged; we just add metadata.

-- Tenant lifecycle
CREATE TYPE "TenantStatus" AS ENUM (
  'PROVISIONING', -- being created (clone in flight)
  'ACTIVE',       -- normal pilot
  'EXPIRED',      -- past expiresAt → read-only banner shown
  'ARCHIVED',     -- soft-deleted, no longer accessible
  'CONVERTED'     -- prospect upgraded to paid → kept as production tenant
);

-- AlterTable: extend Organization with tenant + CRM fields
ALTER TABLE "Organization"
  ADD COLUMN "isTenantDemo" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "tenantStatus" "TenantStatus",
  ADD COLUMN "tenantExpiresAt" TIMESTAMP(3),
  ADD COLUMN "tenantProvisionedFrom" TEXT, -- source org slug ("DEMO_TEMPLATE" default)
  ADD COLUMN "tenantProvisionedAt" TIMESTAMP(3),
  ADD COLUMN "prospectName" TEXT,
  ADD COLUMN "prospectEmail" TEXT,
  ADD COLUMN "prospectCompany" TEXT,
  ADD COLUMN "prospectIndustry" TEXT,
  ADD COLUMN "prospectSource" TEXT, -- "/start signup" | "manual" | "partner"
  ADD COLUMN "lastVisitedAt" TIMESTAMP(3),
  ADD COLUMN "visitCount" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "Organization_isTenantDemo_tenantStatus_idx"
  ON "Organization" ("isTenantDemo", "tenantStatus");
CREATE INDEX "Organization_tenantExpiresAt_idx"
  ON "Organization" ("tenantExpiresAt")
  WHERE "isTenantDemo" = true;

-- TenantProvisioning — audit + analytics log for every clone op.
CREATE TABLE "TenantProvisioning" (
  "id"            TEXT PRIMARY KEY,
  "orgId"         TEXT NOT NULL,
  "sourceOrgId"   TEXT, -- which template org we cloned from
  "startedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt"    TIMESTAMP(3),
  "status"        TEXT NOT NULL DEFAULT 'RUNNING', -- RUNNING | SUCCESS | FAILED
  "errorMessage"  TEXT,
  "stats"         JSONB, -- { projects: 5, issues: 234, vendorContracts: 12, ... }
  "actorId"       TEXT,
  "ip"            TEXT,
  "userAgent"     TEXT,
  CONSTRAINT "TenantProvisioning_orgId_fkey" FOREIGN KEY ("orgId")
    REFERENCES "Organization"("id") ON DELETE CASCADE
);
CREATE INDEX "TenantProvisioning_orgId_idx" ON "TenantProvisioning" ("orgId");
CREATE INDEX "TenantProvisioning_status_startedAt_idx" ON "TenantProvisioning" ("status", "startedAt");

-- TenantVisit — analytics: who visited what subdomain when.
CREATE TABLE "TenantVisit" (
  "id"          TEXT PRIMARY KEY,
  "orgId"       TEXT NOT NULL,
  "visitedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "userId"      TEXT, -- nullable for anonymous
  "path"        TEXT NOT NULL, -- the route accessed
  "ip"          TEXT,
  "userAgent"   TEXT,
  CONSTRAINT "TenantVisit_orgId_fkey" FOREIGN KEY ("orgId")
    REFERENCES "Organization"("id") ON DELETE CASCADE
);
CREATE INDEX "TenantVisit_orgId_visitedAt_idx" ON "TenantVisit" ("orgId", "visitedAt" DESC);
