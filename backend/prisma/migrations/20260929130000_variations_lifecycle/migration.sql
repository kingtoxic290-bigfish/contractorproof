CREATE TYPE "VariationStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'APPROVED', 'REJECTED');

ALTER TABLE "ContractVariation"
  ADD COLUMN "milestoneId" TEXT,
  ADD COLUMN "originalState" JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN "proposedState" JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN "status" "VariationStatus" NOT NULL DEFAULT 'OPEN',
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "variationEventId" TEXT;

ALTER TABLE "ContractVariation"
  ALTER COLUMN "originalState" DROP DEFAULT,
  ALTER COLUMN "proposedState" DROP DEFAULT,
  ALTER COLUMN "updatedAt" DROP DEFAULT;

CREATE TABLE "VariationResolution" (
  "id" TEXT NOT NULL,
  "variationId" TEXT NOT NULL,
  "status" "VariationStatus" NOT NULL,
  "decision" TEXT NOT NULL,
  "note" TEXT NOT NULL,
  "resolvedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VariationResolution_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VariationResolution_variationId_key" ON "VariationResolution"("variationId");
CREATE INDEX "VariationResolution_resolvedById_idx" ON "VariationResolution"("resolvedById");
CREATE INDEX "VariationResolution_createdAt_idx" ON "VariationResolution"("createdAt");
CREATE UNIQUE INDEX "ContractVariation_variationEventId_key" ON "ContractVariation"("variationEventId");
CREATE INDEX "ContractVariation_milestoneId_idx" ON "ContractVariation"("milestoneId");
CREATE INDEX "ContractVariation_status_idx" ON "ContractVariation"("status");

ALTER TABLE "ContractVariation" ADD CONSTRAINT "ContractVariation_milestoneId_fkey"
  FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ContractVariation" ADD CONSTRAINT "ContractVariation_variationEventId_fkey"
  FOREIGN KEY ("variationEventId") REFERENCES "BlockchainEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VariationResolution" ADD CONSTRAINT "VariationResolution_variationId_fkey"
  FOREIGN KEY ("variationId") REFERENCES "ContractVariation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VariationResolution" ADD CONSTRAINT "VariationResolution_resolvedById_fkey"
  FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
