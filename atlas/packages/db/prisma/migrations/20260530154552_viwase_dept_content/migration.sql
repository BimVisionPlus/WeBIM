-- CreateEnum
CREATE TYPE "InternalDocCategory" AS ENUM ('QUYET_DINH', 'THONG_BAO', 'QUY_CHE', 'QUY_TRINH', 'BIEN_BAN', 'KHAC');

-- CreateEnum
CREATE TYPE "BhxhStatus" AS ENUM ('DANG_DONG', 'TAM_DUNG', 'CHO_DANG_KY', 'DA_NGHI', 'KHAC');

-- CreateEnum
CREATE TYPE "DispatchStatus" AS ENUM ('SCHEDULED', 'IN_USE', 'RETURNED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AdvanceType" AS ENUM ('TAM_UNG', 'THANH_TOAN', 'HOAN_UNG');

-- CreateEnum
CREATE TYPE "AdvanceTxnStatus" AS ENUM ('PENDING', 'APPROVED', 'SETTLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ON_HOLD', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('POTENTIAL', 'TRACKING', 'WON', 'LOST', 'ARCHIVED');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "contractScope" TEXT;

-- CreateTable
CREATE TABLE "ProjectStatusUpdate" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "pctComplete" DOUBLE PRECISION,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectStatusUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternalDocument" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "projectId" TEXT,
    "docNo" TEXT NOT NULL,
    "category" "InternalDocCategory" NOT NULL DEFAULT 'KHAC',
    "title" TEXT NOT NULL,
    "body" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "authorId" TEXT,

    CONSTRAINT "InternalDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialInsuranceRecord" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "projectId" TEXT,
    "employeeName" TEXT NOT NULL,
    "employeeIdNo" TEXT,
    "bhxhNumber" TEXT,
    "status" "BhxhStatus" NOT NULL DEFAULT 'DANG_DONG',
    "monthlyBaseVnd" BIGINT,
    "startedAt" TIMESTAMP(3),
    "stoppedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialInsuranceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleDispatch" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "projectId" TEXT,
    "vehiclePlate" TEXT NOT NULL,
    "driverName" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "status" "DispatchStatus" NOT NULL DEFAULT 'SCHEDULED',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleDispatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvanceTransaction" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "projectId" TEXT,
    "type" "AdvanceType" NOT NULL,
    "txnNo" TEXT,
    "payeeName" TEXT NOT NULL,
    "amountVnd" BIGINT NOT NULL,
    "purpose" TEXT NOT NULL,
    "txnDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "AdvanceTxnStatus" NOT NULL DEFAULT 'PENDING',
    "parentTxnId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvanceTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractorAssignment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "contractorName" TEXT NOT NULL,
    "contractorOrgId" TEXT,
    "scope" TEXT NOT NULL,
    "amountVnd" BIGINT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "pctComplete" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractorAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketTerritory" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "province" TEXT,
    "scope" TEXT,
    "ownerUserId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketTerritory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectLead" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "territoryId" TEXT,
    "name" TEXT NOT NULL,
    "clientName" TEXT,
    "province" TEXT,
    "estValueVnd" BIGINT,
    "source" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'POTENTIAL',
    "nextActionAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectLead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectStatusUpdate_projectId_reportedAt_idx" ON "ProjectStatusUpdate"("projectId", "reportedAt");

-- CreateIndex
CREATE INDEX "InternalDocument_orgId_issuedAt_idx" ON "InternalDocument"("orgId", "issuedAt");

-- CreateIndex
CREATE INDEX "InternalDocument_projectId_idx" ON "InternalDocument"("projectId");

-- CreateIndex
CREATE INDEX "SocialInsuranceRecord_orgId_status_idx" ON "SocialInsuranceRecord"("orgId", "status");

-- CreateIndex
CREATE INDEX "VehicleDispatch_orgId_startAt_idx" ON "VehicleDispatch"("orgId", "startAt");

-- CreateIndex
CREATE INDEX "VehicleDispatch_status_startAt_idx" ON "VehicleDispatch"("status", "startAt");

-- CreateIndex
CREATE INDEX "AdvanceTransaction_orgId_type_txnDate_idx" ON "AdvanceTransaction"("orgId", "type", "txnDate");

-- CreateIndex
CREATE INDEX "AdvanceTransaction_projectId_idx" ON "AdvanceTransaction"("projectId");

-- CreateIndex
CREATE INDEX "ContractorAssignment_projectId_status_idx" ON "ContractorAssignment"("projectId", "status");

-- CreateIndex
CREATE INDEX "MarketTerritory_orgId_active_idx" ON "MarketTerritory"("orgId", "active");

-- CreateIndex
CREATE INDEX "ProjectLead_orgId_status_idx" ON "ProjectLead"("orgId", "status");

-- AddForeignKey
ALTER TABLE "ProjectStatusUpdate" ADD CONSTRAINT "ProjectStatusUpdate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectStatusUpdate" ADD CONSTRAINT "ProjectStatusUpdate_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalDocument" ADD CONSTRAINT "InternalDocument_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalDocument" ADD CONSTRAINT "InternalDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalDocument" ADD CONSTRAINT "InternalDocument_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialInsuranceRecord" ADD CONSTRAINT "SocialInsuranceRecord_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialInsuranceRecord" ADD CONSTRAINT "SocialInsuranceRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleDispatch" ADD CONSTRAINT "VehicleDispatch_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleDispatch" ADD CONSTRAINT "VehicleDispatch_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvanceTransaction" ADD CONSTRAINT "AdvanceTransaction_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvanceTransaction" ADD CONSTRAINT "AdvanceTransaction_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvanceTransaction" ADD CONSTRAINT "AdvanceTransaction_parentTxnId_fkey" FOREIGN KEY ("parentTxnId") REFERENCES "AdvanceTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorAssignment" ADD CONSTRAINT "ContractorAssignment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorAssignment" ADD CONSTRAINT "ContractorAssignment_contractorOrgId_fkey" FOREIGN KEY ("contractorOrgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketTerritory" ADD CONSTRAINT "MarketTerritory_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketTerritory" ADD CONSTRAINT "MarketTerritory_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectLead" ADD CONSTRAINT "ProjectLead_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectLead" ADD CONSTRAINT "ProjectLead_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "MarketTerritory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
