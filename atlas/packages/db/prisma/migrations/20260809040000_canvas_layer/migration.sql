-- Atlas Canvas: browser-native sheet review, normalized markup, comments, and share links.
CREATE TYPE "MarkupKind" AS ENUM ('PIN', 'RECT', 'CLOUD', 'ARROW', 'POLYLINE', 'TEXT', 'MEASURE');
CREATE TYPE "MarkupStatus" AS ENUM ('OPEN', 'RESOLVED');
CREATE TYPE "ShareRole" AS ENUM ('VIEW', 'COMMENT');

ALTER TABLE "Sheet"
  ADD COLUMN "rasterUrl" TEXT,
  ADD COLUMN "rasterWidth" INTEGER,
  ADD COLUMN "rasterHeight" INTEGER,
  ADD COLUMN "paperWidthMm" DOUBLE PRECISION,
  ADD COLUMN "paperHeightMm" DOUBLE PRECISION;

ALTER TABLE "Markup" RENAME TO "MarkupLegacy";
-- Primary-key indexes are schema-global in PostgreSQL; free the generated name
-- before creating the replacement table.
ALTER TABLE "MarkupLegacy" RENAME CONSTRAINT "Markup_pkey" TO "MarkupLegacy_pkey";

CREATE TABLE "Markup" (
  "id" TEXT NOT NULL,
  "sheetId" TEXT NOT NULL,
  "authorId" TEXT,
  "guestName" TEXT,
  "kind" "MarkupKind" NOT NULL DEFAULT 'PIN',
  "geometry" JSONB NOT NULL,
  "color" TEXT NOT NULL DEFAULT '#ff3b30',
  "label" TEXT,
  "status" "MarkupStatus" NOT NULL DEFAULT 'OPEN',
  "pageNumber" INTEGER NOT NULL DEFAULT 1,
  "resolvedAt" TIMESTAMP(3),
  "resolvedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Markup_pkey" PRIMARY KEY ("id")
);

INSERT INTO "Markup" ("id", "sheetId", "authorId", "kind", "geometry", "color", "label", "createdAt", "updatedAt")
SELECT "id", "sheetId", "authorId", 'POLYLINE'::"MarkupKind", "geometry", "color", "label", "createdAt", "createdAt"
FROM "MarkupLegacy";
DROP TABLE "MarkupLegacy";

CREATE TABLE "MarkupComment" (
  "id" TEXT NOT NULL,
  "markupId" TEXT NOT NULL,
  "authorId" TEXT,
  "guestName" TEXT,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarkupComment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SheetShareLink" (
  "id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "sheetId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "role" "ShareRole" NOT NULL DEFAULT 'COMMENT',
  "label" TEXT,
  "createdById" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "viewCount" INTEGER NOT NULL DEFAULT 0,
  "lastViewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SheetShareLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CanvasPresence" (
  "id" TEXT NOT NULL,
  "sheetId" TEXT NOT NULL,
  "sessionKey" TEXT NOT NULL,
  "userId" TEXT,
  "displayName" TEXT NOT NULL,
  "color" TEXT NOT NULL,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CanvasPresence_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Markup_sheetId_status_idx" ON "Markup"("sheetId", "status");
CREATE INDEX "Markup_sheetId_pageNumber_idx" ON "Markup"("sheetId", "pageNumber");
CREATE INDEX "MarkupComment_markupId_createdAt_idx" ON "MarkupComment"("markupId", "createdAt");
CREATE UNIQUE INDEX "SheetShareLink_token_key" ON "SheetShareLink"("token");
CREATE INDEX "SheetShareLink_sheetId_revokedAt_idx" ON "SheetShareLink"("sheetId", "revokedAt");
CREATE INDEX "SheetShareLink_projectId_idx" ON "SheetShareLink"("projectId");
CREATE UNIQUE INDEX "CanvasPresence_sheetId_sessionKey_key" ON "CanvasPresence"("sheetId", "sessionKey");
CREATE INDEX "CanvasPresence_sheetId_lastSeenAt_idx" ON "CanvasPresence"("sheetId", "lastSeenAt");

ALTER TABLE "Markup" ADD CONSTRAINT "Markup_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "Sheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarkupComment" ADD CONSTRAINT "MarkupComment_markupId_fkey" FOREIGN KEY ("markupId") REFERENCES "Markup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SheetShareLink" ADD CONSTRAINT "SheetShareLink_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "Sheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CanvasPresence" ADD CONSTRAINT "CanvasPresence_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "Sheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
