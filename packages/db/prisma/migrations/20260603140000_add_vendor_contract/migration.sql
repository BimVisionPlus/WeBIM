-- Enums
CREATE TYPE "VendorContractType" AS ENUM ('FRAMEWORK', 'SPOT_PO', 'ANNUAL', 'RAMP_UP');
CREATE TYPE "VendorContractState" AS ENUM ('DRAFT', 'NEGOTIATING', 'ACTIVE', 'EXPIRED', 'TERMINATED');
CREATE TYPE "VendorCreditType" AS ENUM ('PURCHASE', 'PAYMENT', 'RETURN', 'ADJUST');

-- VendorContract
CREATE TABLE "VendorContract" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "vendorOrgId" TEXT,
    "supplierId" TEXT,
    "vendorName" TEXT NOT NULL,
    "contractNo" TEXT NOT NULL,
    "type" "VendorContractType" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "valueVnd" BIGINT,
    "scope" TEXT,
    "terms" TEXT,
    "state" "VendorContractState" NOT NULL DEFAULT 'DRAFT',
    "signedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VendorContract_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VendorContract_orgId_contractNo_key" ON "VendorContract"("orgId", "contractNo");
CREATE INDEX "VendorContract_orgId_state_idx" ON "VendorContract"("orgId", "state");
CREATE INDEX "VendorContract_vendorOrgId_idx" ON "VendorContract"("vendorOrgId");
CREATE INDEX "VendorContract_supplierId_idx" ON "VendorContract"("supplierId");

-- VendorCreditEntry
CREATE TABLE "VendorCreditEntry" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "contractId" TEXT,
    "vendorOrgId" TEXT,
    "supplierId" TEXT,
    "vendorName" TEXT NOT NULL,
    "txnDate" TIMESTAMP(3) NOT NULL,
    "txnNo" TEXT,
    "type" "VendorCreditType" NOT NULL,
    "amountVnd" BIGINT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VendorCreditEntry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "VendorCreditEntry_orgId_txnDate_idx" ON "VendorCreditEntry"("orgId", "txnDate");
CREATE INDEX "VendorCreditEntry_vendorOrgId_idx" ON "VendorCreditEntry"("vendorOrgId");
CREATE INDEX "VendorCreditEntry_supplierId_idx" ON "VendorCreditEntry"("supplierId");

-- FKs
ALTER TABLE "VendorContract" ADD CONSTRAINT "VendorContract_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VendorContract" ADD CONSTRAINT "VendorContract_vendorOrgId_fkey" FOREIGN KEY ("vendorOrgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VendorContract" ADD CONSTRAINT "VendorContract_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VendorCreditEntry" ADD CONSTRAINT "VendorCreditEntry_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VendorCreditEntry" ADD CONSTRAINT "VendorCreditEntry_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "VendorContract"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VendorCreditEntry" ADD CONSTRAINT "VendorCreditEntry_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
