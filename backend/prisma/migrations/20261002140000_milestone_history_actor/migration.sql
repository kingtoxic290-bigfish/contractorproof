ALTER TABLE "MilestoneStatusHistory"
ADD COLUMN "actorId" TEXT;

CREATE INDEX "MilestoneStatusHistory_actorId_idx"
ON "MilestoneStatusHistory"("actorId");

ALTER TABLE "MilestoneStatusHistory"
ADD CONSTRAINT "MilestoneStatusHistory_actorId_fkey"
FOREIGN KEY ("actorId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
