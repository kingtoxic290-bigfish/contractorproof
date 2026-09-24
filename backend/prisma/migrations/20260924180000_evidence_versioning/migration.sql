-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('MATCH', 'MISMATCH', 'PENDING', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "VerificationSource" AS ENUM ('INTERNAL', 'PUBLIC');

-- AlterTable
ALTER TABLE "Evidence" ADD COLUMN "currentVersionId" TEXT;

-- CreateTable
CREATE TABLE "EvidenceVersion" (
    "id" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "storageReference" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verification" (
    "id" TEXT NOT NULL,
    "evidenceVersionId" TEXT NOT NULL,
    "status" "VerificationStatus" NOT NULL,
    "presentedSha256" TEXT,
    "authoritativeSha256" TEXT NOT NULL,
    "source" "VerificationSource" NOT NULL,
    "requestedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EvidenceVersion_evidenceId_idx" ON "EvidenceVersion"("evidenceId");

-- CreateIndex
CREATE INDEX "EvidenceVersion_sha256_idx" ON "EvidenceVersion"("sha256");

-- CreateIndex
CREATE INDEX "EvidenceVersion_createdById_idx" ON "EvidenceVersion"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceVersion_id_evidenceId_key" ON "EvidenceVersion"("id", "evidenceId");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceVersion_evidenceId_versionNumber_key" ON "EvidenceVersion"("evidenceId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceVersion_evidenceId_sha256_key" ON "EvidenceVersion"("evidenceId", "sha256");

-- CreateIndex
CREATE INDEX "Verification_evidenceVersionId_idx" ON "Verification"("evidenceVersionId");

-- CreateIndex
CREATE INDEX "Verification_status_idx" ON "Verification"("status");

-- CreateIndex
CREATE INDEX "Verification_createdAt_idx" ON "Verification"("createdAt");

-- CreateIndex
CREATE INDEX "Verification_requestedById_idx" ON "Verification"("requestedById");

-- CreateIndex
CREATE UNIQUE INDEX "Evidence_currentVersionId_key" ON "Evidence"("currentVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "Evidence_currentVersionId_id_key" ON "Evidence"("currentVersionId", "id");

-- EvidenceVersion belongs to Evidence. Current-version FK is added after backfill.
ALTER TABLE "EvidenceVersion" ADD CONSTRAINT "EvidenceVersion_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EvidenceVersion" ADD CONSTRAINT "EvidenceVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Verification" ADD CONSTRAINT "Verification_evidenceVersionId_fkey" FOREIGN KEY ("evidenceVersionId") REFERENCES "EvidenceVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Verification" ADD CONSTRAINT "Verification_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Grandfather existing Evidence rows as version 1 so storageKey/sha256 remain readable.
INSERT INTO "EvidenceVersion" (
    "id",
    "evidenceId",
    "versionNumber",
    "storageReference",
    "fileName",
    "mimeType",
    "sizeBytes",
    "sha256",
    "createdById",
    "createdAt"
)
SELECT
    gen_random_uuid()::text,
    e.id,
    1,
    e."storageKey",
    e."fileName",
    e."mimeType",
    e."sizeBytes",
    lower(e.sha256),
    e."uploadedById",
    e."createdAt"
FROM "Evidence" e
WHERE NOT EXISTS (
    SELECT 1 FROM "EvidenceVersion" v WHERE v."evidenceId" = e.id
);

UPDATE "Evidence" e
SET "currentVersionId" = v.id,
    sha256 = lower(e.sha256)
FROM "EvidenceVersion" v
WHERE v."evidenceId" = e.id
  AND v."versionNumber" = 1
  AND e."currentVersionId" IS NULL;

-- currentVersion must belong to the same Evidence (composite FK).
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_currentVersionId_id_fkey" FOREIGN KEY ("currentVersionId", "id") REFERENCES "EvidenceVersion"("id", "evidenceId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EvidenceVersion" ADD CONSTRAINT "EvidenceVersion_sha256_hex_chk" CHECK (sha256 ~ '^[0-9a-f]{64}$');
ALTER TABLE "EvidenceVersion" ADD CONSTRAINT "EvidenceVersion_versionNumber_chk" CHECK ("versionNumber" > 0);
ALTER TABLE "EvidenceVersion" ADD CONSTRAINT "EvidenceVersion_sizeBytes_chk" CHECK ("sizeBytes" >= 0);
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_sha256_hex_chk" CHECK (sha256 ~ '^[0-9a-f]{64}$');
ALTER TABLE "Verification" ADD CONSTRAINT "Verification_authoritative_sha256_hex_chk" CHECK ("authoritativeSha256" ~ '^[0-9a-f]{64}$');
ALTER TABLE "Verification" ADD CONSTRAINT "Verification_presented_sha256_hex_chk" CHECK ("presentedSha256" IS NULL OR "presentedSha256" ~ '^[0-9a-f]{64}$');
