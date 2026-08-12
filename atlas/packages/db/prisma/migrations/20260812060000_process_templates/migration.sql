-- Quy trình phối hợp theo phòng ban + tiêu chí chuyển giai đoạn.
CREATE TYPE "ProcessKind" AS ENUM ('WORKFLOW', 'STAGE_GATE');
CREATE TYPE "ProcessStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'DONE', 'BLOCKED');

CREATE TABLE "ProcessTemplate" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "department" "ProjectDepartment" NOT NULL DEFAULT 'CONG_VIEC_KHAC',
  "kind" "ProcessKind" NOT NULL DEFAULT 'WORKFLOW',
  "isoCode" TEXT,
  "description" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProcessTemplate_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProcessTemplate_orgId_department_isActive_idx"
  ON "ProcessTemplate"("orgId", "department", "isActive");

CREATE TABLE "ProcessStep" (
  "id" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "seq" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "criteria" TEXT,
  "role" "MemberRole" NOT NULL DEFAULT 'ENGINEER',
  "slaDays" INTEGER NOT NULL DEFAULT 3,
  "isGate" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "ProcessStep_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProcessStep_templateId_seq_key" ON "ProcessStep"("templateId", "seq");

CREATE TABLE "ProcessRun" (
  "id" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "projectId" TEXT,
  "name" TEXT NOT NULL,
  "status" "ProcessStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMP(3),
  CONSTRAINT "ProcessRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProcessRun_projectId_status_idx" ON "ProcessRun"("projectId", "status");

CREATE TABLE "ProcessTask" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "stepId" TEXT NOT NULL,
  "assigneeUserId" TEXT,
  "dueAt" TIMESTAMP(3),
  "progress" INTEGER NOT NULL DEFAULT 0,
  "status" "ProcessStatus" NOT NULL DEFAULT 'PENDING',
  "note" TEXT,
  "decidedAt" TIMESTAMP(3),
  CONSTRAINT "ProcessTask_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProcessTask_runId_stepId_key" ON "ProcessTask"("runId", "stepId");
CREATE INDEX "ProcessTask_assigneeUserId_status_idx" ON "ProcessTask"("assigneeUserId", "status");

ALTER TABLE "ProcessStep" ADD CONSTRAINT "ProcessStep_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "ProcessTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProcessRun" ADD CONSTRAINT "ProcessRun_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "ProcessTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProcessTask" ADD CONSTRAINT "ProcessTask_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "ProcessRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProcessTask" ADD CONSTRAINT "ProcessTask_stepId_fkey"
  FOREIGN KEY ("stepId") REFERENCES "ProcessStep"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
