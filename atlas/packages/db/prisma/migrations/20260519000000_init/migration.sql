-- CreateEnum
CREATE TYPE "OrgType" AS ENUM ('CHU_DAU_TU', 'TU_VAN_GIAM_SAT', 'TU_VAN_THIET_KE', 'NHA_THAU_CHINH', 'NHA_THAU_PHU', 'NHA_CUNG_CAP', 'CO_QUAN_NHA_NUOC');

-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('OWNER', 'ADMIN', 'PROJECT_MGR', 'ENGINEER', 'SUPERVISOR', 'FIELD', 'VIEWER');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('PLANNING', 'IN_PROGRESS', 'HANDOVER', 'WARRANTY', 'CLOSED');

-- CreateEnum
CREATE TYPE "IssueType" AS ENUM ('TASK', 'RFI', 'SUBMITTAL', 'NCR', 'PUNCH', 'CHANGE_ORDER', 'SAFETY');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "SubmittalDecision" AS ENUM ('APPROVED', 'APPROVED_AS_NOTED', 'REVISE_RESUBMIT', 'REJECTED');

-- CreateEnum
CREATE TYPE "NCRSeverity" AS ENUM ('MINOR', 'MAJOR', 'CRITICAL');

-- CreateEnum
CREATE TYPE "Shift" AS ENUM ('DAY', 'NIGHT');

-- CreateEnum
CREATE TYPE "Discipline" AS ENUM ('KIEN_TRUC', 'KET_CAU', 'CO_DIEN_M', 'CO_DIEN_E', 'CO_DIEN_P', 'PCCC', 'CANH_QUAN', 'HA_TANG', 'NOI_THAT');

-- CreateEnum
CREATE TYPE "ModelFormat" AS ENUM ('IFC', 'RVT', 'NWD', 'NWC', 'DWG', 'DXF', 'PDF', 'OTHER');

-- CreateEnum
CREATE TYPE "TranslationStatus" AS ENUM ('PENDING', 'INPROGRESS', 'SUCCESS', 'FAILED', 'TIMEOUT');

-- CreateEnum
CREATE TYPE "AcceptanceType" AS ENUM ('CONG_VIEC', 'GIAI_DOAN', 'HOAN_THANH');

-- CreateEnum
CREATE TYPE "TenderSource" AS ENUM ('MUASAMCONG', 'DAUTHAU_ASIA', 'BAO_DAU_THAU', 'MANUAL', 'OTHER');

-- CreateEnum
CREATE TYPE "BidOutcome" AS ENUM ('AWARDED', 'LOST', 'CANCELLED', 'WITHDRAWN', 'PENDING');

-- CreateEnum
CREATE TYPE "BondType" AS ENUM ('BAO_LANH_DU_THAU', 'BAO_LANH_THUC_HIEN', 'BAO_LANH_TAM_UNG', 'BAO_LANH_BAO_HANH');

-- CreateEnum
CREATE TYPE "BondStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'RELEASED', 'CLAIMED');

-- CreateEnum
CREATE TYPE "ComplianceSeverity" AS ENUM ('INFO', 'WARNING', 'BLOCKING');

-- CreateEnum
CREATE TYPE "ComplianceStatus" AS ENUM ('PASS', 'FAIL', 'NOT_APPLICABLE', 'NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "RegulationKind" AS ENUM ('TCVN', 'QCVN', 'LUAT', 'NGHI_DINH', 'THONG_TU', 'QUYET_DINH', 'CONG_VAN');

-- CreateEnum
CREATE TYPE "RegulationStatus" AS ENUM ('DRAFT', 'IN_FORCE', 'SUSPENDED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "CodeSeverity" AS ENUM ('INFO', 'WARNING', 'BLOCKING');

-- CreateEnum
CREATE TYPE "DossierCategory" AS ENUM ('KHAO_SAT', 'THIET_KE', 'THI_CONG', 'NGHIEM_THU', 'HOAN_CONG');

-- CreateEnum
CREATE TYPE "DossierStatus" AS ENUM ('MISSING', 'DRAFT', 'SUBMITTED', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ClashCategory" AS ENUM ('HARD', 'CLEARANCE', 'WORKFLOW');

-- CreateEnum
CREATE TYPE "ClashStatus" AS ENUM ('OPEN', 'TRIAGED', 'RESOLVED', 'IGNORED');

-- CreateEnum
CREATE TYPE "VisionKind" AS ENUM ('PPE_VIOLATION', 'WORKER_COUNT', 'INTRUSION', 'FIRE_SMOKE', 'CRANE_SWING', 'VEHICLE');

-- CreateEnum
CREATE TYPE "IncidentCategory" AS ENUM ('AN_TOAN_LAO_DONG', 'CHAY_NO', 'SUP_DO', 'ROI_NGA', 'DIEN_GIAT', 'HOA_CHAT', 'MOI_TRUONG', 'KHAC');

-- CreateEnum
CREATE TYPE "IncidentSeverity" AS ENUM ('NEAR_MISS', 'MINOR', 'MAJOR', 'CRITICAL');

-- CreateEnum
CREATE TYPE "OverrunSeverity" AS ENUM ('WATCH', 'ALERT', 'CRITICAL');

-- CreateEnum
CREATE TYPE "OverrunStatus" AS ENUM ('OPEN', 'MITIGATING', 'RESOLVED', 'ACCEPTED_OVERRUN');

-- CreateEnum
CREATE TYPE "WorkflowScope" AS ENUM ('ORG', 'PROJECT', 'PUBLIC');

-- CreateEnum
CREATE TYPE "AgentTier" AS ENUM ('AUTO', 'AUTO_REVIEW', 'HUMAN_APPROVE');

-- CreateEnum
CREATE TYPE "AgentRunStatus" AS ENUM ('PENDING', 'PLANNING', 'AWAITING_APPROVAL', 'EXECUTING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DriftAlert" AS ENUM ('OK', 'WATCH', 'DEGRADED', 'REQUIRES_RETRAIN');

-- CreateEnum
CREATE TYPE "MsgChannel" AS ENUM ('EMAIL', 'SMS', 'ZALO_OA', 'ZALO_MINI_APP', 'WHATSAPP', 'TELEGRAM', 'IN_APP');

-- CreateEnum
CREATE TYPE "MsgStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'BOUNCED');

-- CreateEnum
CREATE TYPE "TemplateKind" AS ENUM ('WORKFLOW', 'SPEC', 'BOQ', 'BIM_FAMILY', 'AGENT_SKILL', 'CHECKLIST');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "mst" TEXT,
    "type" "OrgType" NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "isBetaApproved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT,
    "caCertSerial" TEXT,
    "avatarUrl" TEXT,
    "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
    "lockedUntil" TIMESTAMP(3),
    "failedLogins" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerOrgId" TEXT NOT NULL,
    "address" TEXT,
    "province" TEXT,
    "district" TEXT,
    "contractValueVnd" BIGINT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "status" "ProjectStatus" NOT NULL DEFAULT 'PLANNING',
    "permitNumber" TEXT,
    "permitDate" TIMESTAMP(3),
    "warrantyMonths" INTEGER NOT NULL DEFAULT 24,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectStakeholder" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "role" "OrgType" NOT NULL,

    CONSTRAINT "ProjectStakeholder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Issue" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "IssueType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "state" TEXT NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "reporterId" TEXT NOT NULL,
    "assigneeId" TEXT,
    "dueDate" TIMESTAMP(3),
    "locationZone" TEXT,
    "sheetId" TEXT,
    "positionX" DOUBLE PRECISION,
    "positionY" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "Issue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transition" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "fromState" TEXT NOT NULL,
    "toState" TEXT NOT NULL,
    "byUserId" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RFI" (
    "issueId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "category" TEXT,
    "requestedById" TEXT NOT NULL,
    "respondedById" TEXT,
    "answer" TEXT,
    "costImpactVnd" BIGINT,
    "scheduleImpactDays" INTEGER,
    "needBy" TIMESTAMP(3),
    "answeredAt" TIMESTAMP(3),
    "projectId" TEXT,

    CONSTRAINT "RFI_pkey" PRIMARY KEY ("issueId")
);

-- CreateTable
CREATE TABLE "Submittal" (
    "issueId" TEXT NOT NULL,
    "specSection" TEXT,
    "materialName" TEXT NOT NULL,
    "manufacturer" TEXT,
    "submitterOrgId" TEXT NOT NULL,
    "reviewerOrgId" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "decision" "SubmittalDecision",
    "decidedAt" TIMESTAMP(3),
    "projectId" TEXT,

    CONSTRAINT "Submittal_pkey" PRIMARY KEY ("issueId")
);

-- CreateTable
CREATE TABLE "NCR" (
    "issueId" TEXT NOT NULL,
    "severity" "NCRSeverity" NOT NULL,
    "rootCause" TEXT,
    "correctiveAction" TEXT,
    "preventiveAction" TEXT,
    "raisedByOrgId" TEXT NOT NULL,
    "responsibleOrgId" TEXT NOT NULL,
    "costImpactVnd" BIGINT,
    "qcvnRef" TEXT,
    "rectifiedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "projectId" TEXT,

    CONSTRAINT "NCR_pkey" PRIMARY KEY ("issueId")
);

-- CreateTable
CREATE TABLE "PunchItem" (
    "issueId" TEXT NOT NULL,
    "trade" TEXT NOT NULL,
    "zone" TEXT NOT NULL,
    "photoBeforeUrl" TEXT,
    "photoAfterUrl" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "projectId" TEXT,

    CONSTRAINT "PunchItem_pkey" PRIMARY KEY ("issueId")
);

-- CreateTable
CREATE TABLE "ChangeOrder" (
    "issueId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "scopeChange" TEXT NOT NULL,
    "costDeltaVnd" BIGINT NOT NULL,
    "scheduleDeltaDays" INTEGER NOT NULL DEFAULT 0,
    "approvedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "projectId" TEXT,

    CONSTRAINT "ChangeOrder_pkey" PRIMARY KEY ("issueId")
);

-- CreateTable
CREATE TABLE "DailyLog" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "authorId" TEXT NOT NULL,
    "weather" TEXT,
    "shift" "Shift" NOT NULL DEFAULT 'DAY',
    "workforce" JSONB NOT NULL,
    "workDone" TEXT NOT NULL,
    "workTomorrow" TEXT,
    "safetyNotes" TEXT,
    "signoffByCdtId" TEXT,
    "signoffByGsId" TEXT,
    "signedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrawingSet" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "discipline" "Discipline" NOT NULL,
    "issuedDate" TIMESTAMP(3),
    "revision" TEXT NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DrawingSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sheet" (
    "id" TEXT NOT NULL,
    "drawingSetId" TEXT NOT NULL,
    "sheetNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "scale" TEXT,
    "fileUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "pageNumber" INTEGER,
    "revision" TEXT NOT NULL,
    "supersededById" TEXT,

    CONSTRAINT "Sheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Markup" (
    "id" TEXT NOT NULL,
    "sheetId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "geometry" JSONB NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#ff3b30',
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Markup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Model" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "discipline" "Discipline",
    "fileUrl" TEXT NOT NULL,
    "fileSizeBytes" BIGINT NOT NULL,
    "format" "ModelFormat" NOT NULL,
    "apsUrn" TEXT,
    "apsTranslationStatus" "TranslationStatus" NOT NULL DEFAULT 'PENDING',
    "apsTranslationProgress" INTEGER NOT NULL DEFAULT 0,
    "revision" TEXT NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Model_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Acceptance" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "AcceptanceType" NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "conductedAt" TIMESTAMP(3),
    "finalizedAt" TIMESTAMP(3),
    "rejectionNote" TEXT,
    "qcvnRefs" TEXT[],
    "testResults" JSONB,

    CONSTRAINT "Acceptance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Signoff" (
    "id" TEXT NOT NULL,
    "acceptanceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "OrgType" NOT NULL,
    "signedAt" TIMESTAMP(3),
    "signatureUrl" TEXT,
    "caCertSerial" TEXT,
    "rejected" BOOLEAN NOT NULL DEFAULT false,
    "rejectNote" TEXT,

    CONSTRAINT "Signoff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgressPayment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "workDoneVnd" BIGINT NOT NULL,
    "vatRate" INTEGER NOT NULL DEFAULT 8,
    "vatVnd" BIGINT NOT NULL,
    "retentionPct" INTEGER NOT NULL DEFAULT 5,
    "retentionVnd" BIGINT NOT NULL,
    "cumulativeVnd" BIGINT NOT NULL,
    "state" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "ProgressPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpecPage" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "parentId" TEXT,
    "authorId" TEXT NOT NULL,
    "embedding" JSONB,
    "embeddedAt" TIMESTAMP(3),
    "embedModel" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpecPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issueId" TEXT,
    "dailyLogId" TEXT,
    "acceptanceId" TEXT,
    "bidId" TEXT,
    "incidentId" TEXT,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiSuggestion" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "projectId" TEXT,
    "model" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "failReason" TEXT,
    "output" JSONB NOT NULL,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "accepted" BOOLEAN NOT NULL DEFAULT false,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaitlistEntry" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "company" TEXT,
    "role" TEXT,
    "size" TEXT,
    "notes" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invite" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "projectId" TEXT,
    "role" "MemberRole" NOT NULL,
    "invitedById" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "orgId" TEXT,
    "projectId" TEXT,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenderOpportunity" (
    "id" TEXT NOT NULL,
    "source" "TenderSource" NOT NULL,
    "sourceUrl" TEXT,
    "sourceRef" TEXT,
    "title" TEXT NOT NULL,
    "invitor" TEXT,
    "invitorMst" TEXT,
    "budgetVnd" BIGINT,
    "fundingSource" TEXT,
    "category" TEXT,
    "province" TEXT,
    "district" TEXT,
    "publishedAt" TIMESTAMP(3),
    "closingAt" TIMESTAMP(3),
    "openingAt" TIMESTAMP(3),
    "bidMethod" TEXT,
    "bidForm" TEXT,
    "contractType" TEXT,
    "rawHash" TEXT NOT NULL,
    "rawJson" JSONB,
    "scrapedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenderOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bid" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "opportunityId" TEXT,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "estimatedValueVnd" BIGINT,
    "proposedValueVnd" BIGINT,
    "marginPct" DOUBLE PRECISION,
    "contingencyPct" DOUBLE PRECISION,
    "technicalScore" INTEGER,
    "financialScore" INTEGER,
    "winProbability" DOUBLE PRECISION,
    "submittedAt" TIMESTAMP(3),
    "decisionAt" TIMESTAMP(3),
    "outcome" "BidOutcome",
    "outcomeNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bid_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BidBond" (
    "id" TEXT NOT NULL,
    "bidId" TEXT NOT NULL,
    "type" "BondType" NOT NULL,
    "issuerBank" TEXT NOT NULL,
    "bondNumber" TEXT NOT NULL,
    "amountVnd" BIGINT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "feeVnd" BIGINT,
    "status" "BondStatus" NOT NULL DEFAULT 'ACTIVE',
    "releasedAt" TIMESTAMP(3),
    "fileUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BidBond_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BidComplianceCheck" (
    "id" TEXT NOT NULL,
    "bidId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "ruleVersion" TEXT NOT NULL DEFAULT 'LDT-22-2023',
    "ruleTitle" TEXT NOT NULL,
    "ruleRef" TEXT NOT NULL,
    "severity" "ComplianceSeverity" NOT NULL,
    "status" "ComplianceStatus" NOT NULL,
    "evidence" JSONB,
    "note" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BidComplianceCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Regulation" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "kind" "RegulationKind" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "issuedBy" TEXT,
    "effectiveAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "supersedes" TEXT,
    "url" TEXT,
    "status" "RegulationStatus" NOT NULL DEFAULT 'IN_FORCE',
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Regulation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectRegulation" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "regulationId" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectRegulation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodeRule" (
    "id" TEXT NOT NULL,
    "regulationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "clauseRef" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "severity" "CodeSeverity" NOT NULL DEFAULT 'WARNING',
    "category" TEXT,
    "check" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CodeRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodeRuleFinding" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "status" "ComplianceStatus" NOT NULL,
    "evidence" JSONB,
    "note" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CodeRuleFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualityDossierItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "category" "DossierCategory" NOT NULL,
    "itemCode" TEXT NOT NULL,
    "itemTitle" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "status" "DossierStatus" NOT NULL DEFAULT 'MISSING',
    "evidenceUrl" TEXT,
    "uploadedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewerId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QualityDossierItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelElement" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "elementId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "discipline" "Discipline",
    "level" TEXT,
    "zone" TEXT,
    "ifcType" TEXT,
    "bbox" DOUBLE PRECISION[],
    "properties" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModelElement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Clash" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "elementAId" TEXT NOT NULL,
    "elementBId" TEXT NOT NULL,
    "category" "ClashCategory" NOT NULL DEFAULT 'HARD',
    "description" TEXT,
    "severity" INTEGER NOT NULL DEFAULT 50,
    "status" "ClashStatus" NOT NULL DEFAULT 'OPEN',
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "issueId" TEXT,

    CONSTRAINT "Clash_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IssueElementLink" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "elementId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IssueElementLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteCamera" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "streamUrl" TEXT,
    "location" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteCamera_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisionEvent" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "cameraId" TEXT,
    "kind" "VisionKind" NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bbox" INTEGER[],
    "label" TEXT NOT NULL,
    "frameUrl" TEXT,
    "payload" JSONB,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "VisionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeatherSnapshot" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tempC" DOUBLE PRECISION,
    "humidity" DOUBLE PRECISION,
    "rainMmHr" DOUBLE PRECISION,
    "windKph" DOUBLE PRECISION,
    "condition" TEXT,
    "source" TEXT,
    "payload" JSONB,

    CONSTRAINT "WeatherSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentReport" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category" "IncidentCategory" NOT NULL,
    "severity" "IncidentSeverity" NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT,
    "injured" INTEGER NOT NULL DEFAULT 0,
    "rootCause" TEXT,
    "immediateAction" TEXT,
    "preventiveAction" TEXT,
    "closedAt" TIMESTAMP(3),
    "issueId" TEXT,

    CONSTRAINT "IncidentReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoQ" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contractValueVnd" BIGINT NOT NULL,
    "version" TEXT NOT NULL DEFAULT 'v1',
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoQ_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoQLine" (
    "id" TEXT NOT NULL,
    "boqId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL,
    "unitPriceVnd" BIGINT NOT NULL,
    "totalVnd" BIGINT NOT NULL,
    "qtyCompleted" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "category" TEXT,
    "costCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoQLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialPriceIndex" (
    "id" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "material" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "priceVnd" BIGINT NOT NULL,
    "period" TEXT NOT NULL,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialPriceIndex_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubcontractorScore" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "projectId" TEXT,
    "period" TEXT NOT NULL,
    "priceScore" INTEGER NOT NULL,
    "qualityScore" INTEGER NOT NULL,
    "scheduleScore" INTEGER NOT NULL,
    "safetyScore" INTEGER NOT NULL,
    "overallScore" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubcontractorScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostOverrunSignal" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "category" TEXT,
    "forecastedVnd" BIGINT NOT NULL,
    "baselineVnd" BIGINT NOT NULL,
    "deltaPct" DOUBLE PRECISION NOT NULL,
    "weeksAhead" INTEGER NOT NULL DEFAULT 0,
    "severity" "OverrunSeverity" NOT NULL DEFAULT 'WATCH',
    "status" "OverrunStatus" NOT NULL DEFAULT 'OPEN',
    "evidence" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CostOverrunSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowTemplate" (
    "id" TEXT NOT NULL,
    "orgId" TEXT,
    "name" TEXT NOT NULL,
    "scope" "WorkflowScope" NOT NULL DEFAULT 'ORG',
    "description" TEXT,
    "dag" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringTask" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "template" JSONB NOT NULL,
    "cron" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastFiredAt" TIMESTAMP(3),
    "nextFireAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecurringTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatChannel" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "orgId" TEXT,
    "name" TEXT NOT NULL,
    "topic" TEXT,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "threadId" TEXT,
    "attachments" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlaBreach" (
    "id" TEXT NOT NULL,
    "issueId" TEXT,
    "workflowId" TEXT,
    "stepKey" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "breachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "escalatedTo" TEXT,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "SlaBreach_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
    "orgId" TEXT,
    "name" TEXT NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "tools" TEXT[],
    "escalationTier" "AgentTier" NOT NULL DEFAULT 'AUTO_REVIEW',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "projectId" TEXT,
    "userId" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "plan" JSONB,
    "steps" JSONB,
    "result" JSONB,
    "status" "AgentRunStatus" NOT NULL DEFAULT 'PENDING',
    "errorReason" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentMemory" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "projectId" TEXT,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentMemory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelCard" (
    "id" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "trainingDataSummary" TEXT,
    "intendedUse" TEXT,
    "limitations" TEXT,
    "benchmarkResults" JSONB,
    "datasetCitations" TEXT[],
    "fairnessSummary" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModelCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiCitation" (
    "id" TEXT NOT NULL,
    "suggestionId" TEXT NOT NULL,
    "claim" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "sourceQuote" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiCitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExplanationRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "suggestionId" TEXT NOT NULL,
    "question" TEXT,
    "explanation" TEXT,
    "answeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExplanationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriftSnapshot" (
    "id" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "inputKLDiv" DOUBLE PRECISION,
    "outputKLDiv" DOUBLE PRECISION,
    "acceptanceRate" DOUBLE PRECISION,
    "stabilityScore" DOUBLE PRECISION,
    "alertLevel" "DriftAlert" NOT NULL DEFAULT 'OK',
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriftSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataLineage" (
    "id" TEXT NOT NULL,
    "modelCardId" TEXT NOT NULL,
    "datasetRef" TEXT NOT NULL,
    "rows" INTEGER,
    "hash" TEXT,
    "collectedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "DataLineage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BiasAudit" (
    "id" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "dimension" TEXT NOT NULL,
    "results" JSONB NOT NULL,
    "alertLevel" TEXT NOT NULL DEFAULT 'ok',
    "auditedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BiasAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiCostEvent" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "feature" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "tokensIn" INTEGER NOT NULL DEFAULT 0,
    "tokensOut" INTEGER NOT NULL DEFAULT 0,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "costVnd" BIGINT NOT NULL DEFAULT 0,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiCostEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZaloIdentity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "zaloUserId" TEXT NOT NULL,
    "phone" TEXT,
    "oaFollowerId" TEXT,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ZaloIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboundMessage" (
    "id" TEXT NOT NULL,
    "channel" "MsgChannel" NOT NULL,
    "toRef" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "MsgStatus" NOT NULL DEFAULT 'PENDING',
    "providerId" TEXT,
    "errorReason" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboundMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EInvoice" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "paymentId" TEXT,
    "invoiceNumber" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "templateNumber" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "buyerName" TEXT NOT NULL,
    "buyerMst" TEXT NOT NULL,
    "sellerName" TEXT NOT NULL,
    "sellerMst" TEXT NOT NULL,
    "subtotalVnd" BIGINT NOT NULL,
    "vatRate" INTEGER NOT NULL DEFAULT 8,
    "vatVnd" BIGINT NOT NULL,
    "totalVnd" BIGINT NOT NULL,
    "cqtCode" TEXT,
    "cqtStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "xmlPayload" TEXT,
    "pdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FengShuiAnalysis" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "unitCode" TEXT NOT NULL,
    "facingDirection" TEXT,
    "ownerBirthYear" INTEGER,
    "menh" TEXT,
    "cungMenh" TEXT,
    "scoreOverall" INTEGER,
    "findings" JSONB,
    "modelVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FengShuiAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdCardScan" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "cardType" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "dob" TIMESTAMP(3),
    "address" TEXT,
    "issuedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "imageUrl" TEXT,
    "ocrConfidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdCardScan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LunarEvent" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "lunarDate" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "good" BOOLEAN NOT NULL,
    "note" TEXT,

    CONSTRAINT "LunarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "scopes" TEXT[],
    "expiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Webhook" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "events" TEXT[],
    "secret" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "lastDeliveryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Webhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookDelivery" (
    "id" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "responseCode" INTEGER,
    "responseBody" TEXT,
    "ok" BOOLEAN NOT NULL DEFAULT false,
    "deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Connector" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "system" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "credentialsEnc" TEXT NOT NULL,
    "config" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "errorReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Connector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DevicePushToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DevicePushToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfflineSyncOp" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "opType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "appliedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "errorReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfflineSyncOp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pricingJson" JSONB NOT NULL,
    "features" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "renewsAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "aiCreditVnd" BIGINT NOT NULL DEFAULT 0,
    "paymentMethod" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NpsResponse" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT,
    "segment" TEXT,
    "surveyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NpsResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "referrerOrgId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "inviteeEmail" TEXT,
    "signedUpOrgId" TEXT,
    "rewardVnd" BIGINT,
    "rewardPaid" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateListing" (
    "id" TEXT NOT NULL,
    "authorOrgId" TEXT,
    "kind" "TemplateKind" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "payload" JSONB NOT NULL,
    "priceVnd" BIGINT,
    "downloads" INTEGER NOT NULL DEFAULT 0,
    "rating" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TemplateListing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_orgId_key" ON "Membership"("userId", "orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_key_key" ON "Project"("key");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectStakeholder_projectId_orgId_role_key" ON "ProjectStakeholder"("projectId", "orgId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "Issue_key_key" ON "Issue"("key");

-- CreateIndex
CREATE INDEX "Issue_projectId_type_state_idx" ON "Issue"("projectId", "type", "state");

-- CreateIndex
CREATE INDEX "Issue_assigneeId_state_idx" ON "Issue"("assigneeId", "state");

-- CreateIndex
CREATE INDEX "Transition_issueId_createdAt_idx" ON "Transition"("issueId", "createdAt");

-- CreateIndex
CREATE INDEX "DailyLog_projectId_date_idx" ON "DailyLog"("projectId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyLog_projectId_date_shift_key" ON "DailyLog"("projectId", "date", "shift");

-- CreateIndex
CREATE INDEX "DrawingSet_projectId_discipline_idx" ON "DrawingSet"("projectId", "discipline");

-- CreateIndex
CREATE UNIQUE INDEX "Sheet_drawingSetId_sheetNumber_revision_key" ON "Sheet"("drawingSetId", "sheetNumber", "revision");

-- CreateIndex
CREATE INDEX "Model_projectId_discipline_idx" ON "Model"("projectId", "discipline");

-- CreateIndex
CREATE UNIQUE INDEX "Acceptance_projectId_code_key" ON "Acceptance"("projectId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Signoff_acceptanceId_userId_role_key" ON "Signoff"("acceptanceId", "userId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "ProgressPayment_projectId_period_key" ON "ProgressPayment"("projectId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "SpecPage_projectId_slug_key" ON "SpecPage"("projectId", "slug");

-- CreateIndex
CREATE INDEX "AiSuggestion_entityType_entityId_kind_createdAt_idx" ON "AiSuggestion"("entityType", "entityId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "AiSuggestion_projectId_kind_createdAt_idx" ON "AiSuggestion"("projectId", "kind", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WaitlistEntry_email_key" ON "WaitlistEntry"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Invite_tokenHash_key" ON "Invite"("tokenHash");

-- CreateIndex
CREATE INDEX "Invite_email_orgId_idx" ON "Invite"("email", "orgId");

-- CreateIndex
CREATE INDEX "Invite_orgId_idx" ON "Invite"("orgId");

-- CreateIndex
CREATE INDEX "AuditEvent_orgId_createdAt_idx" ON "AuditEvent"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_projectId_createdAt_idx" ON "AuditEvent"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_actorId_createdAt_idx" ON "AuditEvent"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_entityType_entityId_idx" ON "AuditEvent"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "TenderOpportunity_rawHash_key" ON "TenderOpportunity"("rawHash");

-- CreateIndex
CREATE INDEX "TenderOpportunity_source_closingAt_idx" ON "TenderOpportunity"("source", "closingAt");

-- CreateIndex
CREATE INDEX "TenderOpportunity_province_closingAt_idx" ON "TenderOpportunity"("province", "closingAt");

-- CreateIndex
CREATE UNIQUE INDEX "Bid_key_key" ON "Bid"("key");

-- CreateIndex
CREATE INDEX "Bid_orgId_state_idx" ON "Bid"("orgId", "state");

-- CreateIndex
CREATE INDEX "Bid_opportunityId_idx" ON "Bid"("opportunityId");

-- CreateIndex
CREATE INDEX "BidBond_bidId_idx" ON "BidBond"("bidId");

-- CreateIndex
CREATE INDEX "BidBond_status_expiresAt_idx" ON "BidBond"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "BidComplianceCheck_bidId_status_idx" ON "BidComplianceCheck"("bidId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Regulation_code_key" ON "Regulation"("code");

-- CreateIndex
CREATE INDEX "Regulation_kind_status_idx" ON "Regulation"("kind", "status");

-- CreateIndex
CREATE INDEX "Regulation_effectiveAt_idx" ON "Regulation"("effectiveAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectRegulation_projectId_regulationId_key" ON "ProjectRegulation"("projectId", "regulationId");

-- CreateIndex
CREATE INDEX "CodeRule_category_severity_idx" ON "CodeRule"("category", "severity");

-- CreateIndex
CREATE UNIQUE INDEX "CodeRule_regulationId_code_key" ON "CodeRule"("regulationId", "code");

-- CreateIndex
CREATE INDEX "CodeRuleFinding_projectId_status_createdAt_idx" ON "CodeRuleFinding"("projectId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "CodeRuleFinding_entityType_entityId_idx" ON "CodeRuleFinding"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "QualityDossierItem_projectId_status_idx" ON "QualityDossierItem"("projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "QualityDossierItem_projectId_itemCode_key" ON "QualityDossierItem"("projectId", "itemCode");

-- CreateIndex
CREATE INDEX "ModelElement_modelId_category_idx" ON "ModelElement"("modelId", "category");

-- CreateIndex
CREATE INDEX "ModelElement_discipline_level_idx" ON "ModelElement"("discipline", "level");

-- CreateIndex
CREATE UNIQUE INDEX "ModelElement_modelId_elementId_key" ON "ModelElement"("modelId", "elementId");

-- CreateIndex
CREATE INDEX "Clash_projectId_status_idx" ON "Clash"("projectId", "status");

-- CreateIndex
CREATE INDEX "Clash_elementAId_idx" ON "Clash"("elementAId");

-- CreateIndex
CREATE INDEX "Clash_elementBId_idx" ON "Clash"("elementBId");

-- CreateIndex
CREATE INDEX "IssueElementLink_elementId_idx" ON "IssueElementLink"("elementId");

-- CreateIndex
CREATE UNIQUE INDEX "IssueElementLink_issueId_elementId_key" ON "IssueElementLink"("issueId", "elementId");

-- CreateIndex
CREATE INDEX "SiteCamera_projectId_active_idx" ON "SiteCamera"("projectId", "active");

-- CreateIndex
CREATE INDEX "VisionEvent_projectId_kind_ts_idx" ON "VisionEvent"("projectId", "kind", "ts");

-- CreateIndex
CREATE INDEX "VisionEvent_projectId_acknowledged_idx" ON "VisionEvent"("projectId", "acknowledged");

-- CreateIndex
CREATE INDEX "WeatherSnapshot_projectId_ts_idx" ON "WeatherSnapshot"("projectId", "ts");

-- CreateIndex
CREATE INDEX "IncidentReport_projectId_occurredAt_idx" ON "IncidentReport"("projectId", "occurredAt");

-- CreateIndex
CREATE INDEX "IncidentReport_severity_closedAt_idx" ON "IncidentReport"("severity", "closedAt");

-- CreateIndex
CREATE INDEX "BoQ_projectId_isCurrent_idx" ON "BoQ"("projectId", "isCurrent");

-- CreateIndex
CREATE INDEX "BoQLine_boqId_category_idx" ON "BoQLine"("boqId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "BoQLine_boqId_code_key" ON "BoQLine"("boqId", "code");

-- CreateIndex
CREATE INDEX "MaterialPriceIndex_material_period_idx" ON "MaterialPriceIndex"("material", "period");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialPriceIndex_province_material_period_key" ON "MaterialPriceIndex"("province", "material", "period");

-- CreateIndex
CREATE INDEX "SubcontractorScore_orgId_period_idx" ON "SubcontractorScore"("orgId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "SubcontractorScore_orgId_projectId_period_key" ON "SubcontractorScore"("orgId", "projectId", "period");

-- CreateIndex
CREATE INDEX "CostOverrunSignal_projectId_status_createdAt_idx" ON "CostOverrunSignal"("projectId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "WorkflowTemplate_orgId_isActive_idx" ON "WorkflowTemplate"("orgId", "isActive");

-- CreateIndex
CREATE INDEX "RecurringTask_projectId_active_nextFireAt_idx" ON "RecurringTask"("projectId", "active", "nextFireAt");

-- CreateIndex
CREATE INDEX "ChatChannel_projectId_idx" ON "ChatChannel"("projectId");

-- CreateIndex
CREATE INDEX "ChatMessage_channelId_createdAt_idx" ON "ChatMessage"("channelId", "createdAt");

-- CreateIndex
CREATE INDEX "SlaBreach_issueId_idx" ON "SlaBreach"("issueId");

-- CreateIndex
CREATE INDEX "SlaBreach_breachedAt_idx" ON "SlaBreach"("breachedAt");

-- CreateIndex
CREATE INDEX "Agent_orgId_enabled_idx" ON "Agent"("orgId", "enabled");

-- CreateIndex
CREATE INDEX "AgentRun_projectId_startedAt_idx" ON "AgentRun"("projectId", "startedAt");

-- CreateIndex
CREATE INDEX "AgentRun_agentId_status_idx" ON "AgentRun"("agentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AgentMemory_agentId_projectId_key_key" ON "AgentMemory"("agentId", "projectId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "ModelCard_feature_modelName_modelVersion_key" ON "ModelCard"("feature", "modelName", "modelVersion");

-- CreateIndex
CREATE INDEX "AiCitation_suggestionId_idx" ON "AiCitation"("suggestionId");

-- CreateIndex
CREATE INDEX "ExplanationRequest_userId_idx" ON "ExplanationRequest"("userId");

-- CreateIndex
CREATE INDEX "DriftSnapshot_feature_modelVersion_windowEnd_idx" ON "DriftSnapshot"("feature", "modelVersion", "windowEnd");

-- CreateIndex
CREATE INDEX "DataLineage_modelCardId_idx" ON "DataLineage"("modelCardId");

-- CreateIndex
CREATE INDEX "BiasAudit_feature_modelVersion_idx" ON "BiasAudit"("feature", "modelVersion");

-- CreateIndex
CREATE INDEX "AiCostEvent_projectId_occurredAt_idx" ON "AiCostEvent"("projectId", "occurredAt");

-- CreateIndex
CREATE INDEX "AiCostEvent_feature_occurredAt_idx" ON "AiCostEvent"("feature", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "ZaloIdentity_userId_key" ON "ZaloIdentity"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ZaloIdentity_zaloUserId_key" ON "ZaloIdentity"("zaloUserId");

-- CreateIndex
CREATE INDEX "OutboundMessage_channel_status_createdAt_idx" ON "OutboundMessage"("channel", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EInvoice_invoiceNumber_key" ON "EInvoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "EInvoice_projectId_issueDate_idx" ON "EInvoice"("projectId", "issueDate");

-- CreateIndex
CREATE INDEX "EInvoice_cqtStatus_idx" ON "EInvoice"("cqtStatus");

-- CreateIndex
CREATE UNIQUE INDEX "FengShuiAnalysis_projectId_unitCode_key" ON "FengShuiAnalysis"("projectId", "unitCode");

-- CreateIndex
CREATE INDEX "IdCardScan_userId_idx" ON "IdCardScan"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LunarEvent_date_category_key" ON "LunarEvent"("date", "category");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "ApiKey_orgId_idx" ON "ApiKey"("orgId");

-- CreateIndex
CREATE INDEX "Webhook_orgId_active_idx" ON "Webhook"("orgId", "active");

-- CreateIndex
CREATE INDEX "WebhookDelivery_webhookId_deliveredAt_idx" ON "WebhookDelivery"("webhookId", "deliveredAt");

-- CreateIndex
CREATE INDEX "Connector_orgId_active_idx" ON "Connector"("orgId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "Connector_orgId_system_key" ON "Connector"("orgId", "system");

-- CreateIndex
CREATE UNIQUE INDEX "DevicePushToken_token_key" ON "DevicePushToken"("token");

-- CreateIndex
CREATE INDEX "DevicePushToken_userId_active_idx" ON "DevicePushToken"("userId", "active");

-- CreateIndex
CREATE INDEX "OfflineSyncOp_userId_status_createdAt_idx" ON "OfflineSyncOp"("userId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_code_key" ON "Plan"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_orgId_key" ON "Subscription"("orgId");

-- CreateIndex
CREATE INDEX "Subscription_planId_idx" ON "Subscription"("planId");

-- CreateIndex
CREATE INDEX "NpsResponse_surveyKey_idx" ON "NpsResponse"("surveyKey");

-- CreateIndex
CREATE UNIQUE INDEX "NpsResponse_orgId_userId_surveyKey_key" ON "NpsResponse"("orgId", "userId", "surveyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_code_key" ON "Referral"("code");

-- CreateIndex
CREATE INDEX "Referral_referrerOrgId_idx" ON "Referral"("referrerOrgId");

-- CreateIndex
CREATE INDEX "TemplateListing_kind_idx" ON "TemplateListing"("kind");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_ownerOrgId_fkey" FOREIGN KEY ("ownerOrgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectStakeholder" ADD CONSTRAINT "ProjectStakeholder_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectStakeholder" ADD CONSTRAINT "ProjectStakeholder_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "Sheet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transition" ADD CONSTRAINT "Transition_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RFI" ADD CONSTRAINT "RFI_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RFI" ADD CONSTRAINT "RFI_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submittal" ADD CONSTRAINT "Submittal_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submittal" ADD CONSTRAINT "Submittal_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NCR" ADD CONSTRAINT "NCR_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NCR" ADD CONSTRAINT "NCR_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PunchItem" ADD CONSTRAINT "PunchItem_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PunchItem" ADD CONSTRAINT "PunchItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeOrder" ADD CONSTRAINT "ChangeOrder_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeOrder" ADD CONSTRAINT "ChangeOrder_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyLog" ADD CONSTRAINT "DailyLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyLog" ADD CONSTRAINT "DailyLog_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawingSet" ADD CONSTRAINT "DrawingSet_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sheet" ADD CONSTRAINT "Sheet_drawingSetId_fkey" FOREIGN KEY ("drawingSetId") REFERENCES "DrawingSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sheet" ADD CONSTRAINT "Sheet_supersededById_fkey" FOREIGN KEY ("supersededById") REFERENCES "Sheet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Markup" ADD CONSTRAINT "Markup_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "Sheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Model" ADD CONSTRAINT "Model_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Acceptance" ADD CONSTRAINT "Acceptance_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Signoff" ADD CONSTRAINT "Signoff_acceptanceId_fkey" FOREIGN KEY ("acceptanceId") REFERENCES "Acceptance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Signoff" ADD CONSTRAINT "Signoff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressPayment" ADD CONSTRAINT "ProgressPayment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecPage" ADD CONSTRAINT "SpecPage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecPage" ADD CONSTRAINT "SpecPage_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "SpecPage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_dailyLogId_fkey" FOREIGN KEY ("dailyLogId") REFERENCES "DailyLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_acceptanceId_fkey" FOREIGN KEY ("acceptanceId") REFERENCES "Acceptance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_bidId_fkey" FOREIGN KEY ("bidId") REFERENCES "Bid"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "IncidentReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "TenderOpportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BidBond" ADD CONSTRAINT "BidBond_bidId_fkey" FOREIGN KEY ("bidId") REFERENCES "Bid"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BidComplianceCheck" ADD CONSTRAINT "BidComplianceCheck_bidId_fkey" FOREIGN KEY ("bidId") REFERENCES "Bid"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectRegulation" ADD CONSTRAINT "ProjectRegulation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectRegulation" ADD CONSTRAINT "ProjectRegulation_regulationId_fkey" FOREIGN KEY ("regulationId") REFERENCES "Regulation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodeRule" ADD CONSTRAINT "CodeRule_regulationId_fkey" FOREIGN KEY ("regulationId") REFERENCES "Regulation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodeRuleFinding" ADD CONSTRAINT "CodeRuleFinding_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "CodeRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelElement" ADD CONSTRAINT "ModelElement_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Clash" ADD CONSTRAINT "Clash_elementA_fkey" FOREIGN KEY ("elementAId") REFERENCES "ModelElement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Clash" ADD CONSTRAINT "Clash_elementB_fkey" FOREIGN KEY ("elementBId") REFERENCES "ModelElement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueElementLink" ADD CONSTRAINT "IssueElementLink_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueElementLink" ADD CONSTRAINT "IssueElementLink_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "ModelElement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisionEvent" ADD CONSTRAINT "VisionEvent_cameraId_fkey" FOREIGN KEY ("cameraId") REFERENCES "SiteCamera"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoQ" ADD CONSTRAINT "BoQ_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoQLine" ADD CONSTRAINT "BoQLine_boqId_fkey" FOREIGN KEY ("boqId") REFERENCES "BoQ"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostOverrunSignal" ADD CONSTRAINT "CostOverrunSignal_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "ChatChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "Webhook"("id") ON DELETE CASCADE ON UPDATE CASCADE;
