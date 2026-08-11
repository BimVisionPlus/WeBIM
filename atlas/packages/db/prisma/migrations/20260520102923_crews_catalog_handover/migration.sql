-- CreateEnum
CREATE TYPE "CrewWorkState" AS ENUM ('PLANNED', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'REVIEWED');

-- CreateEnum
CREATE TYPE "CatalogCategory" AS ENUM ('BE_TONG', 'COT_THEP', 'GACH_DA', 'XI_MANG_VOI', 'SON_PHU', 'ME_HVAC', 'ME_DIEN', 'ME_NUOC', 'PCCC', 'CUA_KINH', 'THIET_BI_THI_CONG', 'KHAC');

-- CreateEnum
CREATE TYPE "HandoverCategory" AS ENUM ('THAM_DOT', 'NUT_TUONG', 'DIEN_GIAT', 'CAP_THOAT_NUOC', 'HVAC', 'SON_HOAN_THIEN', 'CUA_KHOA', 'AN_NINH', 'KHAC');

-- CreateEnum
CREATE TYPE "HandoverSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "HandoverState" AS ENUM ('NEW', 'TRIAGED', 'IN_PROGRESS', 'AWAITING_PARTS', 'RECTIFIED', 'VERIFIED', 'REJECTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "WarrantyType" AS ENUM ('PHAN_PHU', 'PHAN_CHINH', 'HA_TANG');

-- CreateTable
CREATE TABLE "Crew" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trade" TEXT NOT NULL,
    "foremanName" TEXT,
    "headcount" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Crew_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrewAssignment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "crewId" TEXT NOT NULL,
    "workDate" DATE NOT NULL,
    "shift" "Shift" NOT NULL DEFAULT 'DAY',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "zone" TEXT,
    "state" "CrewWorkState" NOT NULL DEFAULT 'PLANNED',
    "blockedReason" TEXT,
    "hoursPlanned" DOUBLE PRECISION,
    "hoursActual" DOUBLE PRECISION,
    "issueId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrewAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "CatalogCategory" NOT NULL,
    "unit" TEXT NOT NULL,
    "spec" TEXT,
    "baselineUnitPriceVnd" BIGINT,
    "imageUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "orgId" TEXT,
    "name" TEXT NOT NULL,
    "mst" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "rating" DOUBLE PRECISION,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierCatalogItem" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "catalogItemId" TEXT NOT NULL,
    "unitPriceVnd" BIGINT NOT NULL,
    "leadTimeDays" INTEGER NOT NULL DEFAULT 7,
    "minOrderQty" DOUBLE PRECISION,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validTo" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "SupplierCatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HandoverTicket" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "unitCode" TEXT,
    "category" "HandoverCategory" NOT NULL,
    "severity" "HandoverSeverity" NOT NULL DEFAULT 'LOW',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "reporterName" TEXT NOT NULL,
    "reporterPhone" TEXT,
    "reporterEmail" TEXT,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "warrantyType" "WarrantyType" NOT NULL,
    "warrantyEndsAt" TIMESTAMP(3) NOT NULL,
    "state" "HandoverState" NOT NULL DEFAULT 'NEW',
    "slaDueAt" TIMESTAMP(3),
    "assigneeOrgId" TEXT,
    "rectifiedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "customerSatisfactionScore" INTEGER,
    "issueId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HandoverTicket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Crew_projectId_active_idx" ON "Crew"("projectId", "active");

-- CreateIndex
CREATE INDEX "CrewAssignment_projectId_workDate_shift_idx" ON "CrewAssignment"("projectId", "workDate", "shift");

-- CreateIndex
CREATE INDEX "CrewAssignment_crewId_workDate_idx" ON "CrewAssignment"("crewId", "workDate");

-- CreateIndex
CREATE INDEX "CatalogItem_category_active_idx" ON "CatalogItem"("category", "active");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogItem_projectId_code_key" ON "CatalogItem"("projectId", "code");

-- CreateIndex
CREATE INDEX "Supplier_name_idx" ON "Supplier"("name");

-- CreateIndex
CREATE INDEX "Supplier_active_idx" ON "Supplier"("active");

-- CreateIndex
CREATE INDEX "SupplierCatalogItem_catalogItemId_unitPriceVnd_idx" ON "SupplierCatalogItem"("catalogItemId", "unitPriceVnd");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierCatalogItem_supplierId_catalogItemId_validFrom_key" ON "SupplierCatalogItem"("supplierId", "catalogItemId", "validFrom");

-- CreateIndex
CREATE INDEX "HandoverTicket_projectId_state_idx" ON "HandoverTicket"("projectId", "state");

-- CreateIndex
CREATE INDEX "HandoverTicket_slaDueAt_state_idx" ON "HandoverTicket"("slaDueAt", "state");

-- CreateIndex
CREATE INDEX "HandoverTicket_warrantyEndsAt_idx" ON "HandoverTicket"("warrantyEndsAt");

-- AddForeignKey
ALTER TABLE "CrewAssignment" ADD CONSTRAINT "CrewAssignment_crewId_fkey" FOREIGN KEY ("crewId") REFERENCES "Crew"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierCatalogItem" ADD CONSTRAINT "SupplierCatalogItem_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierCatalogItem" ADD CONSTRAINT "SupplierCatalogItem_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
