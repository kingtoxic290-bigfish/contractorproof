ALTER TABLE "ContractVariation"
  ADD COLUMN "reviewedById" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3);

CREATE INDEX "ContractVariation_reviewedById_idx" ON "ContractVariation"("reviewedById");

ALTER TABLE "ContractVariation" ADD CONSTRAINT "ContractVariation_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
