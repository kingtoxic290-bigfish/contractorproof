-- Idempotent logical identity for BlockchainEvent (ADR-0002).
-- Confirmed proof remains implied by non-null txHash; no status column.

ALTER TABLE "BlockchainEvent" ADD COLUMN "logicalKey" TEXT;

UPDATE "BlockchainEvent"
SET "logicalKey" = CONCAT(
  "eventType"::text,
  ':',
  "projectId",
  ':',
  COALESCE("referenceId", "id")
)
WHERE "logicalKey" IS NULL;

ALTER TABLE "BlockchainEvent" ALTER COLUMN "logicalKey" SET NOT NULL;

CREATE UNIQUE INDEX "BlockchainEvent_logicalKey_key" ON "BlockchainEvent"("logicalKey");
