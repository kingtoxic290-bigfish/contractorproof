CREATE TYPE "CorrectionStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'APPROVED', 'REJECTED');

ALTER TABLE "Correction"
ADD COLUMN "originalEvidenceVersionId" TEXT,
ADD COLUMN "status" "CorrectionStatus" NOT NULL DEFAULT 'OPEN',
ADD COLUMN "correctionEventId" TEXT;

CREATE INDEX "Correction_originalEvidenceVersionId_idx" ON "Correction"("originalEvidenceVersionId");
CREATE INDEX "Correction_status_idx" ON "Correction"("status");
CREATE UNIQUE INDEX "Correction_correctionEventId_key" ON "Correction"("correctionEventId");

ALTER TABLE "Correction"
ADD CONSTRAINT "Correction_originalEvidenceVersionId_fkey"
FOREIGN KEY ("originalEvidenceVersionId") REFERENCES "EvidenceVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Correction"
ADD CONSTRAINT "Correction_correctionEventId_fkey"
FOREIGN KEY ("correctionEventId") REFERENCES "BlockchainEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "CorrectionResolution" (
    "id" TEXT NOT NULL,
    "correctionId" TEXT NOT NULL,
    "status" "CorrectionStatus" NOT NULL,
    "resolution" TEXT NOT NULL,
    "correctedEvidenceVersionId" TEXT,
    "resolvedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CorrectionResolution_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CorrectionResolution_correctionId_key" ON "CorrectionResolution"("correctionId");
CREATE INDEX "CorrectionResolution_correctedEvidenceVersionId_idx" ON "CorrectionResolution"("correctedEvidenceVersionId");
CREATE INDEX "CorrectionResolution_resolvedById_idx" ON "CorrectionResolution"("resolvedById");
CREATE INDEX "CorrectionResolution_createdAt_idx" ON "CorrectionResolution"("createdAt");

ALTER TABLE "CorrectionResolution"
ADD CONSTRAINT "CorrectionResolution_correctionId_fkey"
FOREIGN KEY ("correctionId") REFERENCES "Correction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CorrectionResolution"
ADD CONSTRAINT "CorrectionResolution_correctedEvidenceVersionId_fkey"
FOREIGN KEY ("correctedEvidenceVersionId") REFERENCES "EvidenceVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CorrectionResolution"
ADD CONSTRAINT "CorrectionResolution_resolvedById_fkey"
FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
