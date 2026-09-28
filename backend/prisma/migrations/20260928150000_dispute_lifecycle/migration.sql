-- Link a dispute to the evidence it contests, when supplied, and to its own
-- on-chain event separately from the original event it challenges.
ALTER TABLE "Dispute"
ADD COLUMN "evidenceId" TEXT,
ADD COLUMN "disputeEventId" TEXT;

CREATE INDEX "Dispute_evidenceId_idx" ON "Dispute"("evidenceId");
CREATE UNIQUE INDEX "Dispute_disputeEventId_key" ON "Dispute"("disputeEventId");

ALTER TABLE "Dispute"
ADD CONSTRAINT "Dispute_evidenceId_fkey"
FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Dispute"
ADD CONSTRAINT "Dispute_disputeEventId_fkey"
FOREIGN KEY ("disputeEventId") REFERENCES "BlockchainEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "DisputeResolution" (
    "id" TEXT NOT NULL,
    "disputeId" TEXT NOT NULL,
    "status" "DisputeStatus" NOT NULL,
    "resolution" TEXT NOT NULL,
    "resolvedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DisputeResolution_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DisputeResolution_disputeId_key" ON "DisputeResolution"("disputeId");
CREATE INDEX "DisputeResolution_resolvedById_idx" ON "DisputeResolution"("resolvedById");
CREATE INDEX "DisputeResolution_createdAt_idx" ON "DisputeResolution"("createdAt");

ALTER TABLE "DisputeResolution"
ADD CONSTRAINT "DisputeResolution_disputeId_fkey"
FOREIGN KEY ("disputeId") REFERENCES "Dispute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DisputeResolution"
ADD CONSTRAINT "DisputeResolution_resolvedById_fkey"
FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
