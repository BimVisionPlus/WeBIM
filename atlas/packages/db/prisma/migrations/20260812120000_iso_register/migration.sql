-- Danh mục tài liệu ISO của công ty và dự án.
CREATE TYPE "IsoDocKind" AS ENUM ('SO_TAY', 'CHINH_SACH', 'QUY_TRINH', 'HUONG_DAN', 'BIEU_MAU');
CREATE TYPE "IsoScope" AS ENUM ('COMPANY', 'PROJECT');
CREATE TYPE "IsoStatus" AS ENUM ('DRAFT', 'EFFECTIVE', 'SUPERSEDED', 'WITHDRAWN');

CREATE TABLE "IsoDocument" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "kind" "IsoDocKind" NOT NULL DEFAULT 'QUY_TRINH',
  "department" "ProjectDepartment" NOT NULL DEFAULT 'CONG_VIEC_KHAC',
  "scope" "IsoScope" NOT NULL DEFAULT 'COMPANY',
  "projectId" TEXT,
  "version" TEXT NOT NULL DEFAULT '01',
  "status" "IsoStatus" NOT NULL DEFAULT 'DRAFT',
  "issuedAt" TIMESTAMP(3),
  "effectiveAt" TIMESTAMP(3),
  "reviewDueAt" TIMESTAMP(3),
  "ownerUserId" TEXT,
  "fileUrl" TEXT,
  "supersedesId" TEXT,
  "processTemplateId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IsoDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IsoDocument_supersedesId_key" ON "IsoDocument"("supersedesId");
CREATE UNIQUE INDEX "IsoDocument_orgId_code_version_key" ON "IsoDocument"("orgId", "code", "version");
CREATE INDEX "IsoDocument_orgId_status_idx" ON "IsoDocument"("orgId", "status");
CREATE INDEX "IsoDocument_orgId_department_idx" ON "IsoDocument"("orgId", "department");

ALTER TABLE "IsoDocument" ADD CONSTRAINT "IsoDocument_supersedesId_fkey"
  FOREIGN KEY ("supersedesId") REFERENCES "IsoDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
