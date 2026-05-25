-- CreateEnum
CREATE TYPE "PaymentApplicationType" AS ENUM ('TAM_UNG', 'GIAI_DOAN', 'HOAN_THANH', 'QUYET_TOAN');

-- CreateEnum
CREATE TYPE "PaymentFundSource" AS ENUM ('NGAN_SACH', 'DOANH_NGHIEP', 'FDI', 'HON_HOP');

-- CreateEnum
CREATE TYPE "TakeoffSource" AS ENUM ('MANUAL', 'IFC_AUTO', 'HYBRID', 'IMPORTED');

-- CreateEnum
CREATE TYPE "NormSource" AS ENUM ('TT_10_2019', 'TT_11_2019', 'TT_12_2021', 'PROVINCIAL', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('VL', 'NC', 'M');

-- CreateEnum
CREATE TYPE "SuperviseShift" AS ENUM ('DAY', 'NIGHT', 'FULL');

-- CreateEnum
CREATE TYPE "ItpCategory" AS ENUM ('MONG_COC', 'DAT', 'BE_TONG', 'COT_THEP', 'KHOI_XAY', 'HOAN_THIEN', 'MEP_CAP_THOAT', 'MEP_DIEN', 'MEP_DHKK', 'MEP_PCCC', 'KET_CAU_THEP', 'KHAC');

-- CreateEnum
CREATE TYPE "QaqcResult" AS ENUM ('PENDING', 'PASS', 'FAIL', 'WAIVED', 'REWORK');

-- CreateEnum
CREATE TYPE "TenderPerspective" AS ENUM ('BEN_MOI', 'NHA_THAU');

-- CreateEnum
CREATE TYPE "TenderSecSource" AS ENUM ('MANUAL', 'TEMPLATE', 'AUTO_FROM_PROFILE', 'AUTO_FROM_BOQ', 'IMPORTED');

-- CreateEnum
CREATE TYPE "EiaType" AS ENUM ('DTM', 'DKDT', 'GPMT', 'BAO_CAO_DK');

-- CreateEnum
CREATE TYPE "EnvMeasureType" AS ENUM ('BUI', 'ON', 'KHI_THAI', 'NUOC_THAI', 'NUOC_NGAM', 'DAT', 'RUNG_DONG');

-- CreateEnum
CREATE TYPE "HseGroup" AS ENUM ('N1', 'N2', 'N3', 'N4', 'N5', 'N6');

-- CreateEnum
CREATE TYPE "AttendMethod" AS ENUM ('QR', 'FACE', 'GPS', 'MANUAL');

-- CreateEnum
CREATE TYPE "CapabilityClass" AS ENUM ('HANG_I', 'HANG_II', 'HANG_III', 'CHUA_PHAN_HANG');

-- CreateEnum
CREATE TYPE "MaterialCat" AS ENUM ('XI_MANG', 'THEP', 'KINH', 'GACH', 'BE_TONG_TUOI', 'SON', 'PHU_GIA', 'OTHER');

-- CreateEnum
CREATE TYPE "MaterialState" AS ENUM ('RECEIVED', 'TESTING', 'ACCEPTED', 'REJECTED', 'PARTIAL_USED', 'USED_UP');

-- CreateEnum
CREATE TYPE "LabSampleType" AS ENUM ('BE_TONG', 'THEP', 'XI_MANG', 'CAT_DA', 'DAT_NEN', 'COC_NEN', 'KHAC');

-- CreateEnum
CREATE TYPE "LabResult" AS ENUM ('PENDING', 'PASS', 'FAIL', 'CONDITIONAL');

-- CreateEnum
CREATE TYPE "MethodCategory" AS ENUM ('COC', 'DAO_DAT', 'BE_TONG_KHOI', 'KET_CAU', 'KET_CAU_THEP', 'MEP', 'HOAN_THIEN', 'CAU_GIANG_GIO', 'HAN_CO_DIEN', 'KHAC');

-- CreateEnum
CREATE TYPE "ApprovalSource" AS ENUM ('PAYMENT', 'CHANGEORDER', 'METHOD', 'QAQC', 'ACCEPTANCE', 'MATERIAL', 'PERMIT', 'TENDER', 'OTHER');

-- CreateEnum
CREATE TYPE "ApprovalPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "ApprovalState" AS ENUM ('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('APPROVE', 'REJECT', 'ABSTAIN');

-- CreateEnum
CREATE TYPE "ConsultantType" AS ENUM ('TVTK', 'TVGS', 'TVQLDA', 'TVTM', 'TVDT', 'KHAC');

-- CreateEnum
CREATE TYPE "AgencyType" AS ENUM ('BO_XAY_DUNG', 'SO_XAY_DUNG', 'SO_QHKT', 'SO_TNMT', 'SO_CONG_THUONG', 'KBNN', 'CONG_AN_PCCC', 'UBND', 'CO_QUAN_THUE', 'KHAC');

-- CreateEnum
CREATE TYPE "DocDirection" AS ENUM ('INCOMING', 'OUTGOING');

-- CreateEnum
CREATE TYPE "CorpusSource" AS ENUM ('HOP_DONG', 'BBNT', 'CV_QLNN', 'THIET_KE', 'TCVN', 'BPTC', 'RFI', 'EMAIL', 'KHAC');

-- CreateEnum
CREATE TYPE "MonitorType" AS ENUM ('SETTLEMENT', 'TILT', 'PIEZOMETER', 'STRAIN', 'CRACK', 'VIBRATION', 'TEMPERATURE');

-- CreateEnum
CREATE TYPE "AlertLevel" AS ENUM ('NORMAL', 'WARN', 'ALERT');

-- CreateTable
CREATE TABLE "PaymentApplication" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "paymentType" "PaymentApplicationType" NOT NULL,
    "fundSource" "PaymentFundSource" NOT NULL DEFAULT 'NGAN_SACH',
    "contractorOrgId" TEXT,
    "contractRef" TEXT,
    "contractValueVnd" BIGINT,
    "progressPaymentId" TEXT,
    "workDoneVnd" BIGINT NOT NULL,
    "cumulativeWorkVnd" BIGINT NOT NULL,
    "advanceDeductionVnd" BIGINT NOT NULL DEFAULT 0,
    "retentionVnd" BIGINT NOT NULL DEFAULT 0,
    "vatRate" INTEGER NOT NULL DEFAULT 8,
    "vatVnd" BIGINT NOT NULL DEFAULT 0,
    "netPayableVnd" BIGINT NOT NULL,
    "acceptanceIds" TEXT[],
    "changeOrderIds" TEXT[],
    "attachmentIds" TEXT[],
    "state" TEXT NOT NULL,
    "ntSignedAt" TIMESTAMP(3),
    "tvgsSignedAt" TIMESTAMP(3),
    "cdtApprovedAt" TIMESTAMP(3),
    "kbnnSubmittedAt" TIMESTAMP(3),
    "kbnnTxId" TEXT,
    "kbnnStatus" TEXT,
    "kbnnResponseJson" JSONB,
    "paidAt" TIMESTAMP(3),
    "paidVnd" BIGINT,
    "rejectionNote" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TakeoffSheet" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "source" "TakeoffSource" NOT NULL DEFAULT 'MANUAL',
    "modelId" TEXT,
    "state" TEXT NOT NULL,
    "totalLines" INTEGER NOT NULL DEFAULT 0,
    "totalValue" BIGINT NOT NULL DEFAULT 0,
    "ntSubmittedAt" TIMESTAMP(3),
    "tvgsVerifiedAt" TIMESTAMP(3),
    "cdtApprovedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TakeoffSheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TakeoffLine" (
    "id" TEXT NOT NULL,
    "sheetId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "workCode" TEXT,
    "description" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "qtyEstimated" DECIMAL(18,4) NOT NULL,
    "qtyExecuted" DECIMAL(18,4) NOT NULL,
    "qtyAsBuilt" DECIMAL(18,4),
    "unitPriceVnd" BIGINT NOT NULL,
    "ifcElementId" TEXT,
    "csiCode" TEXT,
    "notes" TEXT,

    CONSTRAINT "TakeoffLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NormCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "chapter" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "group" TEXT,
    "title" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "source" "NormSource" NOT NULL DEFAULT 'TT_10_2019',
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NormCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NormResource" (
    "id" TEXT NOT NULL,
    "normId" TEXT NOT NULL,
    "resourceType" "ResourceType" NOT NULL,
    "resourceCode" TEXT,
    "description" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "notes" TEXT,

    CONSTRAINT "NormResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NormPrice" (
    "id" TEXT NOT NULL,
    "normId" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "unitPriceVnd" BIGINT NOT NULL,
    "vlCostVnd" BIGINT,
    "ncCostVnd" BIGINT,
    "mCostVnd" BIGINT,
    "source" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NormPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractBond" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "contractorOrgId" TEXT,
    "type" "BondType" NOT NULL,
    "bondNumber" TEXT NOT NULL,
    "issuerBank" TEXT NOT NULL,
    "beneficiary" TEXT NOT NULL,
    "amountVnd" BIGINT NOT NULL,
    "pctOfContract" DECIMAL(6,3),
    "contractRef" TEXT,
    "contractValueVnd" BIGINT,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" "BondStatus" NOT NULL DEFAULT 'ACTIVE',
    "releasedAt" TIMESTAMP(3),
    "releasedNote" TEXT,
    "claimedAt" TIMESTAMP(3),
    "claimedAmountVnd" BIGINT,
    "feeVnd" BIGINT,
    "feeRate" DECIMAL(6,4),
    "bankApiSyncedAt" TIMESTAMP(3),
    "bankApiStatus" TEXT,
    "fileUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractBond_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HoanCongDossier" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pdfaUrl" TEXT,
    "pdfaSizeBytes" BIGINT,
    "pdfaSha256" TEXT,
    "pdfaCompiledAt" TIMESTAMP(3),
    "ntSignedAt" TIMESTAMP(3),
    "tvgsSignedAt" TIMESTAMP(3),
    "cdtSignedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "qlnnRef" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HoanCongDossier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HoanCongSection" (
    "id" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "signedCount" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,

    CONSTRAINT "HoanCongSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HoanCongItem" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "docDate" TIMESTAMP(3),
    "docNumber" TEXT,
    "fileUrl" TEXT,
    "fileSize" BIGINT,
    "sha256" TEXT,
    "signedBy" JSONB,
    "status" "DossierStatus" NOT NULL DEFAULT 'MISSING',
    "notes" TEXT,

    CONSTRAINT "HoanCongItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuperviseEntry" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "logDate" TIMESTAMP(3) NOT NULL,
    "shift" "SuperviseShift" NOT NULL DEFAULT 'DAY',
    "supervisorOrgId" TEXT,
    "supervisorUserId" TEXT,
    "weather" TEXT,
    "attendees" TEXT,
    "workItems" TEXT NOT NULL,
    "qualityNotes" TEXT,
    "safetyNotes" TEXT,
    "materialsNotes" TEXT,
    "testRefs" TEXT[],
    "ncrIds" TEXT[],
    "rfiIds" TEXT[],
    "acceptanceIds" TEXT[],
    "photoUrls" TEXT[],
    "voiceNoteUrl" TEXT,
    "voiceTranscript" TEXT,
    "state" TEXT NOT NULL,
    "tvgsSignedAt" TIMESTAMP(3),
    "tvgsCertSerial" TEXT,
    "ntSignedAt" TIMESTAMP(3),
    "ntCertSerial" TEXT,
    "cdtSignedAt" TIMESTAMP(3),
    "cdtCertSerial" TEXT,
    "pdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SuperviseEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItpTemplate" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "category" "ItpCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "tcvnRefs" TEXT[],
    "isGlobal" BOOLEAN NOT NULL DEFAULT true,
    "projectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItpTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItpItem" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "checkPoint" TEXT NOT NULL,
    "acceptCrit" TEXT NOT NULL,
    "method" TEXT,
    "frequency" TEXT,
    "tcvnRef" TEXT,
    "hold" BOOLEAN NOT NULL DEFAULT false,
    "witness" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ItpItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QaqcCheck" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "templateId" TEXT,
    "location" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "conductedAt" TIMESTAMP(3),
    "inspectorOrgId" TEXT,
    "inspectorUserId" TEXT,
    "result" "QaqcResult" NOT NULL DEFAULT 'PENDING',
    "measurements" JSONB,
    "ncrId" TEXT,
    "notes" TEXT,
    "photoUrls" TEXT[],
    "acceptanceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QaqcCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenderPackage" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "perspective" "TenderPerspective" NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "tenderId" TEXT,
    "oppotunityId" TEXT,
    "packageType" TEXT NOT NULL,
    "selectionMethod" TEXT NOT NULL,
    "estimatedValueVnd" BIGINT,
    "bidSecurityVnd" BIGINT,
    "language" TEXT NOT NULL DEFAULT 'vi',
    "state" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "awardedAt" TIMESTAMP(3),
    "awardedTo" TEXT,
    "submissionRef" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenderPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenderSection" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "source" "TenderSecSource" NOT NULL DEFAULT 'MANUAL',
    "templateRef" TEXT,
    "signed" BOOLEAN NOT NULL DEFAULT false,
    "signedAt" TIMESTAMP(3),

    CONSTRAINT "TenderSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EiaApplication" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "EiaType" NOT NULL,
    "code" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "authority" TEXT NOT NULL,
    "consultantOrgId" TEXT,
    "consultStartAt" TIMESTAMP(3),
    "consultEndAt" TIMESTAMP(3),
    "consultMinutes" TEXT,
    "submittedAt" TIMESTAMP(3),
    "decisionRef" TEXT,
    "decisionDate" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "pdfUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EiaApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnvMeasurement" (
    "id" TEXT NOT NULL,
    "eiaId" TEXT,
    "projectId" TEXT NOT NULL,
    "measureType" "EnvMeasureType" NOT NULL,
    "sampleCode" TEXT NOT NULL,
    "sampleDate" TIMESTAMP(3) NOT NULL,
    "location" TEXT NOT NULL,
    "parameter" TEXT NOT NULL,
    "value" DECIMAL(14,4) NOT NULL,
    "unit" TEXT NOT NULL,
    "qcvnRef" TEXT NOT NULL,
    "qcvnLimit" DECIMAL(14,4),
    "exceeded" BOOLEAN NOT NULL DEFAULT false,
    "labCode" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnvMeasurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HseCourse" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "group" "HseGroup" NOT NULL,
    "title" TEXT NOT NULL,
    "durationHours" INTEGER NOT NULL,
    "syllabus" TEXT NOT NULL,
    "validityMonths" INTEGER NOT NULL DEFAULT 24,
    "isOnline" BOOLEAN NOT NULL DEFAULT true,
    "passScore" INTEGER NOT NULL DEFAULT 80,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HseCourse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HseCertificate" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "userId" TEXT,
    "workerName" TEXT NOT NULL,
    "workerIdNo" TEXT,
    "orgId" TEXT,
    "certNumber" TEXT NOT NULL,
    "qrCode" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "testScore" INTEGER,
    "trainerName" TEXT,
    "trainerOrgId" TEXT,
    "state" TEXT NOT NULL DEFAULT 'ACTIVE',
    "cardPdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HseCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteWorker" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "projectId" TEXT,
    "workerCode" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "dob" TIMESTAMP(3),
    "gender" TEXT,
    "idNo" TEXT,
    "phone" TEXT,
    "hometown" TEXT,
    "trade" TEXT NOT NULL,
    "level" TEXT,
    "isStaff" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "hseGroup" "HseGroup",
    "hseCertNumber" TEXT,
    "hseCertExpiry" TIMESTAMP(3),
    "proLicenseNo" TEXT,
    "proLicenseExpiry" TIMESTAMP(3),
    "faceEmbedding" BYTEA,
    "badgePhotoUrl" TEXT,
    "badgeQrCode" TEXT,
    "state" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteWorker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "checkInAt" TIMESTAMP(3) NOT NULL,
    "checkOutAt" TIMESTAMP(3),
    "gateCode" TEXT,
    "gpsLat" DECIMAL(10,7),
    "gpsLng" DECIMAL(10,7),
    "method" "AttendMethod" NOT NULL DEFAULT 'QR',
    "faceMatchScore" DECIMAL(5,4),
    "ppeStatus" JSONB,
    "notes" TEXT,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractorProfile" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "mst" TEXT,
    "capabilityClass" "CapabilityClass" NOT NULL,
    "capabilityNo" TEXT,
    "capabilityExpiry" TIMESTAMP(3),
    "capabilityScope" TEXT[],
    "charteredEng" INTEGER NOT NULL DEFAULT 0,
    "totalStaff" INTEGER NOT NULL DEFAULT 0,
    "charterCapVnd" BIGINT,
    "yearsExperience" INTEGER,
    "pastProjects" INTEGER NOT NULL DEFAULT 0,
    "pastValueVnd" BIGINT,
    "rating" DECIMAL(3,2),
    "blacklisted" BOOLEAN NOT NULL DEFAULT false,
    "blacklistReason" TEXT,
    "blacklistAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractorReference" (
    "id" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "ownerName" TEXT,
    "yearStart" INTEGER NOT NULL,
    "yearEnd" INTEGER,
    "valueVnd" BIGINT,
    "role" TEXT NOT NULL,
    "description" TEXT,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ContractorReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractorPerformance" (
    "id" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "projectId" TEXT,
    "ratingDate" TIMESTAMP(3) NOT NULL,
    "ratingScore" DECIMAL(3,2) NOT NULL,
    "scheduleScore" DECIMAL(3,2),
    "qualityScore" DECIMAL(3,2),
    "safetyScore" DECIMAL(3,2),
    "costScore" DECIMAL(3,2),
    "notes" TEXT,
    "rater" TEXT,

    CONSTRAINT "ContractorPerformance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialLot" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "lotCode" TEXT NOT NULL,
    "materialName" TEXT NOT NULL,
    "materialCode" TEXT,
    "category" "MaterialCat" NOT NULL,
    "supplierOrgId" TEXT,
    "manufacturer" TEXT NOT NULL,
    "origin" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unit" TEXT NOT NULL,
    "coDocUrl" TEXT,
    "cqDocUrl" TEXT,
    "crCertNo" TEXT,
    "crCertExpiry" TIMESTAMP(3),
    "qrCode" TEXT,
    "testRefs" TEXT[],
    "state" "MaterialState" NOT NULL DEFAULT 'RECEIVED',
    "acceptedAt" TIMESTAMP(3),
    "acceptedByUserId" TEXT,
    "rejectedReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabReport" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sampleCode" TEXT NOT NULL,
    "sampleType" "LabSampleType" NOT NULL,
    "materialLotId" TEXT,
    "sampledAt" TIMESTAMP(3) NOT NULL,
    "sampledBy" TEXT,
    "receivedAt" TIMESTAMP(3),
    "testedAt" TIMESTAMP(3),
    "labCode" TEXT NOT NULL,
    "labOrgName" TEXT,
    "testMethod" TEXT NOT NULL,
    "tcvnRef" TEXT NOT NULL,
    "parameters" JSONB NOT NULL,
    "specRequired" JSONB,
    "result" "LabResult" NOT NULL DEFAULT 'PENDING',
    "ncrId" TEXT,
    "reportFileUrl" TEXT,
    "reportNo" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MethodStatement" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "templateId" TEXT,
    "code" TEXT NOT NULL,
    "category" "MethodCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "tcvnRefs" TEXT[],
    "riskMatrix" JSONB,
    "resources" JSONB,
    "duration" INTEGER,
    "state" TEXT NOT NULL,
    "ntSubmittedAt" TIMESTAMP(3),
    "tvgsApprovedAt" TIMESTAMP(3),
    "tvgsCertSerial" TEXT,
    "cdtApprovedAt" TIMESTAMP(3),
    "cdtCertSerial" TEXT,
    "rejectionNote" TEXT,
    "pdfUrl" TEXT,
    "isTemplate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MethodStatement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalRequest" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "source" "ApprovalSource" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "amountVnd" BIGINT,
    "priority" "ApprovalPriority" NOT NULL DEFAULT 'NORMAL',
    "state" "ApprovalState" NOT NULL DEFAULT 'PENDING',
    "requesterUserId" TEXT,
    "requesterOrgId" TEXT,
    "dueAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "decidedByUserId" TEXT,
    "decision" "ApprovalDecision",
    "decisionNote" TEXT,
    "attachmentIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsultantTimesheet" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT,
    "workerName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "projectId" TEXT,
    "workDate" TIMESTAMP(3) NOT NULL,
    "hours" DECIMAL(5,2) NOT NULL,
    "description" TEXT NOT NULL,
    "billable" BOOLEAN NOT NULL DEFAULT true,
    "rateVndPerHour" BIGINT,
    "amountVnd" BIGINT,
    "invoiced" BOOLEAN NOT NULL DEFAULT false,
    "invoiceRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsultantTimesheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsultantContract" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "clientOrgId" TEXT,
    "projectId" TEXT,
    "contractNo" TEXT NOT NULL,
    "contractType" "ConsultantType" NOT NULL,
    "totalValueVnd" BIGINT NOT NULL,
    "invoicedVnd" BIGINT NOT NULL DEFAULT 0,
    "paidVnd" BIGINT NOT NULL DEFAULT 0,
    "percentComplete" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "state" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsultantContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovAgency" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "agencyType" "AgencyType" NOT NULL,
    "level" TEXT,
    "province" TEXT,
    "address" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "notes" TEXT,

    CONSTRAINT "GovAgency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgencyDocument" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "projectId" TEXT,
    "direction" "DocDirection" NOT NULL,
    "docNo" TEXT NOT NULL,
    "docDate" TIMESTAMP(3) NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT,
    "category" TEXT,
    "fileUrl" TEXT,
    "status" TEXT,
    "dueAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgencyDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgencyAppointment" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "projectId" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "duration" INTEGER NOT NULL DEFAULT 60,
    "purpose" TEXT NOT NULL,
    "attendees" TEXT,
    "location" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "outcome" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgencyAppointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocCorpus" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "orgId" TEXT,
    "sourceType" "CorpusSource" NOT NULL,
    "sourceId" TEXT,
    "sourceUrl" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'vi',
    "chunkCount" INTEGER NOT NULL DEFAULT 0,
    "indexed" BOOLEAN NOT NULL DEFAULT false,
    "indexedAt" TIMESTAMP(3),
    "embedModel" TEXT,
    "llmRedacted" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocCorpus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocChunk" (
    "id" TEXT NOT NULL,
    "corpusId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "embedding" BYTEA,
    "tokenCount" INTEGER,
    "pageNo" INTEGER,
    "spanStart" INTEGER,
    "spanEnd" INTEGER,

    CONSTRAINT "DocChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocChatQuery" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "userId" TEXT,
    "question" TEXT NOT NULL,
    "answer" TEXT,
    "citations" JSONB,
    "modelUsed" TEXT,
    "latencyMs" INTEGER,
    "feedback" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocChatQuery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonitorPoint" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "pointCode" TEXT NOT NULL,
    "monitorType" "MonitorType" NOT NULL,
    "description" TEXT,
    "locationX" DECIMAL(12,4),
    "locationY" DECIMAL(12,4),
    "locationZ" DECIMAL(12,4),
    "installedAt" TIMESTAMP(3),
    "thresholdWarn" DECIMAL(12,4),
    "thresholdAlert" DECIMAL(12,4),
    "unit" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonitorPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonitorMeasurement" (
    "id" TEXT NOT NULL,
    "pointId" TEXT NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "value" DECIMAL(14,4) NOT NULL,
    "cumulative" DECIMAL(14,4),
    "rate24h" DECIMAL(14,6),
    "alertLevel" "AlertLevel" NOT NULL DEFAULT 'NORMAL',
    "notes" TEXT,
    "rawJson" JSONB,

    CONSTRAINT "MonitorMeasurement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentApplication_projectId_period_idx" ON "PaymentApplication"("projectId", "period");

-- CreateIndex
CREATE INDEX "PaymentApplication_state_idx" ON "PaymentApplication"("state");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentApplication_projectId_code_key" ON "PaymentApplication"("projectId", "code");

-- CreateIndex
CREATE INDEX "TakeoffSheet_projectId_state_idx" ON "TakeoffSheet"("projectId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "TakeoffSheet_projectId_code_key" ON "TakeoffSheet"("projectId", "code");

-- CreateIndex
CREATE INDEX "TakeoffLine_workCode_idx" ON "TakeoffLine"("workCode");

-- CreateIndex
CREATE UNIQUE INDEX "TakeoffLine_sheetId_seq_key" ON "TakeoffLine"("sheetId", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "NormCode_code_key" ON "NormCode"("code");

-- CreateIndex
CREATE INDEX "NormCode_chapter_idx" ON "NormCode"("chapter");

-- CreateIndex
CREATE INDEX "NormCode_section_idx" ON "NormCode"("section");

-- CreateIndex
CREATE INDEX "NormResource_normId_resourceType_idx" ON "NormResource"("normId", "resourceType");

-- CreateIndex
CREATE INDEX "NormResource_resourceCode_idx" ON "NormResource"("resourceCode");

-- CreateIndex
CREATE INDEX "NormPrice_province_period_idx" ON "NormPrice"("province", "period");

-- CreateIndex
CREATE UNIQUE INDEX "NormPrice_normId_province_period_key" ON "NormPrice"("normId", "province", "period");

-- CreateIndex
CREATE INDEX "ContractBond_projectId_type_status_idx" ON "ContractBond"("projectId", "type", "status");

-- CreateIndex
CREATE INDEX "ContractBond_status_expiresAt_idx" ON "ContractBond"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContractBond_projectId_bondNumber_key" ON "ContractBond"("projectId", "bondNumber");

-- CreateIndex
CREATE UNIQUE INDEX "HoanCongDossier_projectId_key" ON "HoanCongDossier"("projectId");

-- CreateIndex
CREATE INDEX "HoanCongDossier_state_idx" ON "HoanCongDossier"("state");

-- CreateIndex
CREATE INDEX "HoanCongSection_dossierId_idx" ON "HoanCongSection"("dossierId");

-- CreateIndex
CREATE UNIQUE INDEX "HoanCongSection_dossierId_seq_key" ON "HoanCongSection"("dossierId", "seq");

-- CreateIndex
CREATE INDEX "HoanCongItem_sectionId_status_idx" ON "HoanCongItem"("sectionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "HoanCongItem_sectionId_seq_key" ON "HoanCongItem"("sectionId", "seq");

-- CreateIndex
CREATE INDEX "SuperviseEntry_projectId_state_idx" ON "SuperviseEntry"("projectId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "SuperviseEntry_projectId_logDate_shift_key" ON "SuperviseEntry"("projectId", "logDate", "shift");

-- CreateIndex
CREATE UNIQUE INDEX "ItpTemplate_code_key" ON "ItpTemplate"("code");

-- CreateIndex
CREATE INDEX "ItpTemplate_category_idx" ON "ItpTemplate"("category");

-- CreateIndex
CREATE UNIQUE INDEX "ItpItem_templateId_seq_key" ON "ItpItem"("templateId", "seq");

-- CreateIndex
CREATE INDEX "QaqcCheck_projectId_result_idx" ON "QaqcCheck"("projectId", "result");

-- CreateIndex
CREATE INDEX "QaqcCheck_acceptanceId_idx" ON "QaqcCheck"("acceptanceId");

-- CreateIndex
CREATE INDEX "TenderPackage_orgId_perspective_state_idx" ON "TenderPackage"("orgId", "perspective", "state");

-- CreateIndex
CREATE UNIQUE INDEX "TenderPackage_orgId_code_key" ON "TenderPackage"("orgId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "TenderSection_packageId_seq_key" ON "TenderSection"("packageId", "seq");

-- CreateIndex
CREATE INDEX "EiaApplication_projectId_state_idx" ON "EiaApplication"("projectId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "EiaApplication_projectId_code_key" ON "EiaApplication"("projectId", "code");

-- CreateIndex
CREATE INDEX "EnvMeasurement_projectId_measureType_sampleDate_idx" ON "EnvMeasurement"("projectId", "measureType", "sampleDate");

-- CreateIndex
CREATE INDEX "EnvMeasurement_exceeded_idx" ON "EnvMeasurement"("exceeded");

-- CreateIndex
CREATE UNIQUE INDEX "HseCourse_code_key" ON "HseCourse"("code");

-- CreateIndex
CREATE INDEX "HseCourse_group_idx" ON "HseCourse"("group");

-- CreateIndex
CREATE UNIQUE INDEX "HseCertificate_certNumber_key" ON "HseCertificate"("certNumber");

-- CreateIndex
CREATE INDEX "HseCertificate_state_expiresAt_idx" ON "HseCertificate"("state", "expiresAt");

-- CreateIndex
CREATE INDEX "HseCertificate_orgId_idx" ON "HseCertificate"("orgId");

-- CreateIndex
CREATE INDEX "SiteWorker_projectId_state_idx" ON "SiteWorker"("projectId", "state");

-- CreateIndex
CREATE INDEX "SiteWorker_hseCertExpiry_idx" ON "SiteWorker"("hseCertExpiry");

-- CreateIndex
CREATE UNIQUE INDEX "SiteWorker_orgId_workerCode_key" ON "SiteWorker"("orgId", "workerCode");

-- CreateIndex
CREATE INDEX "Attendance_projectId_checkInAt_idx" ON "Attendance"("projectId", "checkInAt");

-- CreateIndex
CREATE INDEX "Attendance_workerId_checkInAt_idx" ON "Attendance"("workerId", "checkInAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContractorProfile_orgId_key" ON "ContractorProfile"("orgId");

-- CreateIndex
CREATE INDEX "ContractorReference_contractorId_idx" ON "ContractorReference"("contractorId");

-- CreateIndex
CREATE INDEX "ContractorPerformance_contractorId_ratingDate_idx" ON "ContractorPerformance"("contractorId", "ratingDate");

-- CreateIndex
CREATE INDEX "MaterialLot_projectId_state_idx" ON "MaterialLot"("projectId", "state");

-- CreateIndex
CREATE INDEX "MaterialLot_category_idx" ON "MaterialLot"("category");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialLot_projectId_lotCode_key" ON "MaterialLot"("projectId", "lotCode");

-- CreateIndex
CREATE INDEX "LabReport_projectId_sampleType_result_idx" ON "LabReport"("projectId", "sampleType", "result");

-- CreateIndex
CREATE UNIQUE INDEX "LabReport_projectId_sampleCode_key" ON "LabReport"("projectId", "sampleCode");

-- CreateIndex
CREATE INDEX "MethodStatement_projectId_state_idx" ON "MethodStatement"("projectId", "state");

-- CreateIndex
CREATE INDEX "MethodStatement_category_isTemplate_idx" ON "MethodStatement"("category", "isTemplate");

-- CreateIndex
CREATE INDEX "ApprovalRequest_projectId_state_dueAt_idx" ON "ApprovalRequest"("projectId", "state", "dueAt");

-- CreateIndex
CREATE INDEX "ApprovalRequest_source_sourceId_idx" ON "ApprovalRequest"("source", "sourceId");

-- CreateIndex
CREATE INDEX "ConsultantTimesheet_orgId_workDate_idx" ON "ConsultantTimesheet"("orgId", "workDate");

-- CreateIndex
CREATE INDEX "ConsultantTimesheet_projectId_workDate_idx" ON "ConsultantTimesheet"("projectId", "workDate");

-- CreateIndex
CREATE INDEX "ConsultantTimesheet_userId_workDate_idx" ON "ConsultantTimesheet"("userId", "workDate");

-- CreateIndex
CREATE INDEX "ConsultantContract_orgId_state_idx" ON "ConsultantContract"("orgId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "ConsultantContract_orgId_contractNo_key" ON "ConsultantContract"("orgId", "contractNo");

-- CreateIndex
CREATE UNIQUE INDEX "GovAgency_code_key" ON "GovAgency"("code");

-- CreateIndex
CREATE INDEX "AgencyDocument_agencyId_docDate_idx" ON "AgencyDocument"("agencyId", "docDate");

-- CreateIndex
CREATE INDEX "AgencyDocument_projectId_idx" ON "AgencyDocument"("projectId");

-- CreateIndex
CREATE INDEX "AgencyDocument_status_idx" ON "AgencyDocument"("status");

-- CreateIndex
CREATE INDEX "AgencyAppointment_agencyId_scheduledAt_idx" ON "AgencyAppointment"("agencyId", "scheduledAt");

-- CreateIndex
CREATE INDEX "DocCorpus_projectId_sourceType_idx" ON "DocCorpus"("projectId", "sourceType");

-- CreateIndex
CREATE INDEX "DocCorpus_indexed_idx" ON "DocCorpus"("indexed");

-- CreateIndex
CREATE INDEX "DocChunk_corpusId_idx" ON "DocChunk"("corpusId");

-- CreateIndex
CREATE INDEX "DocChatQuery_projectId_createdAt_idx" ON "DocChatQuery"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "DocChatQuery_userId_createdAt_idx" ON "DocChatQuery"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "MonitorPoint_projectId_monitorType_active_idx" ON "MonitorPoint"("projectId", "monitorType", "active");

-- CreateIndex
CREATE UNIQUE INDEX "MonitorPoint_projectId_pointCode_key" ON "MonitorPoint"("projectId", "pointCode");

-- CreateIndex
CREATE INDEX "MonitorMeasurement_pointId_measuredAt_idx" ON "MonitorMeasurement"("pointId", "measuredAt");

-- CreateIndex
CREATE INDEX "MonitorMeasurement_alertLevel_idx" ON "MonitorMeasurement"("alertLevel");

-- AddForeignKey
ALTER TABLE "PaymentApplication" ADD CONSTRAINT "PaymentApplication_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentApplication" ADD CONSTRAINT "PaymentApplication_progressPaymentId_fkey" FOREIGN KEY ("progressPaymentId") REFERENCES "ProgressPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentApplication" ADD CONSTRAINT "PaymentApplication_contractorOrgId_fkey" FOREIGN KEY ("contractorOrgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TakeoffSheet" ADD CONSTRAINT "TakeoffSheet_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TakeoffSheet" ADD CONSTRAINT "TakeoffSheet_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TakeoffLine" ADD CONSTRAINT "TakeoffLine_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "TakeoffSheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NormResource" ADD CONSTRAINT "NormResource_normId_fkey" FOREIGN KEY ("normId") REFERENCES "NormCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NormPrice" ADD CONSTRAINT "NormPrice_normId_fkey" FOREIGN KEY ("normId") REFERENCES "NormCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractBond" ADD CONSTRAINT "ContractBond_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractBond" ADD CONSTRAINT "ContractBond_contractorOrgId_fkey" FOREIGN KEY ("contractorOrgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HoanCongDossier" ADD CONSTRAINT "HoanCongDossier_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HoanCongSection" ADD CONSTRAINT "HoanCongSection_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "HoanCongDossier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HoanCongItem" ADD CONSTRAINT "HoanCongItem_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "HoanCongSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuperviseEntry" ADD CONSTRAINT "SuperviseEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuperviseEntry" ADD CONSTRAINT "SuperviseEntry_supervisorOrgId_fkey" FOREIGN KEY ("supervisorOrgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuperviseEntry" ADD CONSTRAINT "SuperviseEntry_supervisorUserId_fkey" FOREIGN KEY ("supervisorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItpItem" ADD CONSTRAINT "ItpItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ItpTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QaqcCheck" ADD CONSTRAINT "QaqcCheck_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QaqcCheck" ADD CONSTRAINT "QaqcCheck_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ItpTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderPackage" ADD CONSTRAINT "TenderPackage_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderSection" ADD CONSTRAINT "TenderSection_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "TenderPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EiaApplication" ADD CONSTRAINT "EiaApplication_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EiaApplication" ADD CONSTRAINT "EiaApplication_consultantOrgId_fkey" FOREIGN KEY ("consultantOrgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvMeasurement" ADD CONSTRAINT "EnvMeasurement_eiaId_fkey" FOREIGN KEY ("eiaId") REFERENCES "EiaApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvMeasurement" ADD CONSTRAINT "EnvMeasurement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HseCertificate" ADD CONSTRAINT "HseCertificate_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "HseCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HseCertificate" ADD CONSTRAINT "HseCertificate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HseCertificate" ADD CONSTRAINT "HseCertificate_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HseCertificate" ADD CONSTRAINT "HseCertificate_trainerOrgId_fkey" FOREIGN KEY ("trainerOrgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteWorker" ADD CONSTRAINT "SiteWorker_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteWorker" ADD CONSTRAINT "SiteWorker_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "SiteWorker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorProfile" ADD CONSTRAINT "ContractorProfile_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorReference" ADD CONSTRAINT "ContractorReference_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "ContractorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorPerformance" ADD CONSTRAINT "ContractorPerformance_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "ContractorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialLot" ADD CONSTRAINT "MaterialLot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialLot" ADD CONSTRAINT "MaterialLot_supplierOrgId_fkey" FOREIGN KEY ("supplierOrgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabReport" ADD CONSTRAINT "LabReport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabReport" ADD CONSTRAINT "LabReport_materialLotId_fkey" FOREIGN KEY ("materialLotId") REFERENCES "MaterialLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MethodStatement" ADD CONSTRAINT "MethodStatement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MethodStatement" ADD CONSTRAINT "MethodStatement_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MethodStatement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultantTimesheet" ADD CONSTRAINT "ConsultantTimesheet_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultantTimesheet" ADD CONSTRAINT "ConsultantTimesheet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultantTimesheet" ADD CONSTRAINT "ConsultantTimesheet_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultantContract" ADD CONSTRAINT "ConsultantContract_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultantContract" ADD CONSTRAINT "ConsultantContract_clientOrgId_fkey" FOREIGN KEY ("clientOrgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultantContract" ADD CONSTRAINT "ConsultantContract_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgencyDocument" ADD CONSTRAINT "AgencyDocument_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "GovAgency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgencyDocument" ADD CONSTRAINT "AgencyDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgencyAppointment" ADD CONSTRAINT "AgencyAppointment_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "GovAgency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgencyAppointment" ADD CONSTRAINT "AgencyAppointment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocCorpus" ADD CONSTRAINT "DocCorpus_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocChunk" ADD CONSTRAINT "DocChunk_corpusId_fkey" FOREIGN KEY ("corpusId") REFERENCES "DocCorpus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonitorPoint" ADD CONSTRAINT "MonitorPoint_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonitorMeasurement" ADD CONSTRAINT "MonitorMeasurement_pointId_fkey" FOREIGN KEY ("pointId") REFERENCES "MonitorPoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
