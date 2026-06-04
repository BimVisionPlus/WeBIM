-- Enums
CREATE TYPE "AuditPrepKind" AS ENUM ('PC07_PCCC', 'SO_XAY_DUNG', 'CDT_NGHIEM_THU', 'HOAN_CONG_QLNN', 'TVGS_NGHIEM_THU', 'KHAC');
CREATE TYPE "AuditPrepState" AS ENUM ('DRAFT', 'IN_PROGRESS', 'READY', 'INSPECTING', 'PASSED', 'FAILED', 'CLOSED');
CREATE TYPE "AuditPrepItemState" AS ENUM ('PENDING', 'IN_PROGRESS', 'READY', 'NOT_APPLICABLE', 'FAILED');

-- AuditPrep
CREATE TABLE "AuditPrep" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" "AuditPrepKind" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "inspectorOrg" TEXT,
    "inspectorName" TEXT,
    "state" "AuditPrepState" NOT NULL DEFAULT 'DRAFT',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "resultNote" TEXT,
    "evidenceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AuditPrep_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AuditPrep_projectId_state_idx" ON "AuditPrep"("projectId", "state");
CREATE INDEX "AuditPrep_kind_scheduledAt_idx" ON "AuditPrep"("kind", "scheduledAt");
ALTER TABLE "AuditPrep" ADD CONSTRAINT "AuditPrep_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AuditPrepItem
CREATE TABLE "AuditPrepItem" (
    "id" TEXT NOT NULL,
    "prepId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "state" "AuditPrepItemState" NOT NULL DEFAULT 'PENDING',
    "evidenceUrl" TEXT,
    "notes" TEXT,
    "signedByName" TEXT,
    "signedAt" TIMESTAMP(3),
    "regulationCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AuditPrepItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AuditPrepItem_prepId_seq_key" ON "AuditPrepItem"("prepId", "seq");
CREATE INDEX "AuditPrepItem_prepId_state_idx" ON "AuditPrepItem"("prepId", "state");
ALTER TABLE "AuditPrepItem" ADD CONSTRAINT "AuditPrepItem_prepId_fkey" FOREIGN KEY ("prepId") REFERENCES "AuditPrep"("id") ON DELETE CASCADE ON UPDATE CASCADE;
