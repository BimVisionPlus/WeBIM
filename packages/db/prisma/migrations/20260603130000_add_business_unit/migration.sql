-- AlterTable: add businessUnitId to Project
ALTER TABLE "Project" ADD COLUMN "businessUnitId" TEXT;

-- CreateTable: BusinessUnit
CREATE TABLE "BusinessUnit" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "leaderUserId" TEXT,
    "province" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessUnit_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "BusinessUnit_orgId_code_key" ON "BusinessUnit"("orgId", "code");
CREATE INDEX "BusinessUnit_orgId_active_idx" ON "BusinessUnit"("orgId", "active");

-- FKs
ALTER TABLE "BusinessUnit" ADD CONSTRAINT "BusinessUnit_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessUnit" ADD CONSTRAINT "BusinessUnit_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "BusinessUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BusinessUnit" ADD CONSTRAINT "BusinessUnit_leaderUserId_fkey" FOREIGN KEY ("leaderUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
