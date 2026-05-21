-- CreateEnum
CREATE TYPE "ScheduleTaskState" AS ENUM ('PLANNED', 'IN_PROGRESS', 'ON_HOLD', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ScheduleDependencyKind" AS ENUM ('FS', 'SS', 'FF', 'SF');

-- CreateEnum
CREATE TYPE "PermitType" AS ENUM ('GPXD_MOI', 'GPXD_DIEU_CHINH', 'GPXD_SUA_CHUA', 'GPXD_TAM', 'THONG_BAO_KHOI_CONG', 'GPXD_HA_TANG');

-- CreateEnum
CREATE TYPE "PermitApplicationState" AS ENUM ('DRAFT', 'SUBMITTED', 'REVIEWING', 'APPROVED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "PermitDecision" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PcccStage" AS ENUM ('THAM_DUYET_THIET_KE', 'NGHIEM_THU_PCCC', 'CAP_GIAY_DU_DIEU_KIEN');

-- CreateEnum
CREATE TYPE "PcccApplicationState" AS ENUM ('DRAFT', 'SUBMITTED', 'REVIEWING', 'APPROVED', 'REJECTED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "ScheduleTask" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "discipline" TEXT,
    "zone" TEXT,
    "plannedStart" TIMESTAMP(3) NOT NULL,
    "plannedEnd" TIMESTAMP(3) NOT NULL,
    "actualStart" TIMESTAMP(3),
    "actualEnd" TIMESTAMP(3),
    "pctComplete" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "state" "ScheduleTaskState" NOT NULL DEFAULT 'PLANNED',
    "isCritical" BOOLEAN NOT NULL DEFAULT false,
    "ownerOrgId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleDependency" (
    "id" TEXT NOT NULL,
    "predecessorId" TEXT NOT NULL,
    "successorId" TEXT NOT NULL,
    "kind" "ScheduleDependencyKind" NOT NULL DEFAULT 'FS',
    "lagDays" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ScheduleDependency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermitApplication" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "permitType" "PermitType" NOT NULL,
    "applicationCode" TEXT,
    "applicant" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "decisionAt" TIMESTAMP(3),
    "decision" "PermitDecision" NOT NULL DEFAULT 'PENDING',
    "decisionNote" TEXT,
    "expiresAt" TIMESTAMP(3),
    "evidenceUrl" TEXT,
    "state" "PermitApplicationState" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PermitApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermitChecklist" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "itemTitle" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "attached" BOOLEAN NOT NULL DEFAULT false,
    "evidenceUrl" TEXT,
    "note" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PermitChecklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PcccApplication" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "stage" "PcccStage" NOT NULL,
    "applicationCode" TEXT,
    "submittedAt" TIMESTAMP(3),
    "decisionAt" TIMESTAMP(3),
    "decision" "PermitDecision" NOT NULL DEFAULT 'PENDING',
    "decisionNote" TEXT,
    "evidenceUrl" TEXT,
    "state" "PcccApplicationState" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PcccApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduleTask_projectId_plannedStart_idx" ON "ScheduleTask"("projectId", "plannedStart");

-- CreateIndex
CREATE INDEX "ScheduleTask_projectId_isCritical_state_idx" ON "ScheduleTask"("projectId", "isCritical", "state");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleTask_projectId_code_key" ON "ScheduleTask"("projectId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleDependency_predecessorId_successorId_key" ON "ScheduleDependency"("predecessorId", "successorId");

-- CreateIndex
CREATE INDEX "PermitApplication_projectId_state_idx" ON "PermitApplication"("projectId", "state");

-- CreateIndex
CREATE INDEX "PermitApplication_state_decisionAt_idx" ON "PermitApplication"("state", "decisionAt");

-- CreateIndex
CREATE UNIQUE INDEX "PermitChecklist_applicationId_itemCode_key" ON "PermitChecklist"("applicationId", "itemCode");

-- CreateIndex
CREATE INDEX "PcccApplication_projectId_state_idx" ON "PcccApplication"("projectId", "state");

-- AddForeignKey
ALTER TABLE "ScheduleTask" ADD CONSTRAINT "ScheduleTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleDependency" ADD CONSTRAINT "ScheduleDependency_predecessorId_fkey" FOREIGN KEY ("predecessorId") REFERENCES "ScheduleTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleDependency" ADD CONSTRAINT "ScheduleDependency_successorId_fkey" FOREIGN KEY ("successorId") REFERENCES "ScheduleTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermitApplication" ADD CONSTRAINT "PermitApplication_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermitChecklist" ADD CONSTRAINT "PermitChecklist_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "PermitApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PcccApplication" ADD CONSTRAINT "PcccApplication_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
