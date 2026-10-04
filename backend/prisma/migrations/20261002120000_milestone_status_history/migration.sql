CREATE TABLE "MilestoneStatusHistory" (
    "id" TEXT NOT NULL,
    "milestoneId" TEXT NOT NULL,
    "previousStatus" "MilestoneStatus",
    "newStatus" "MilestoneStatus" NOT NULL,
    "actorName" TEXT,
    "actorRole" "Role",
    "evidenceId" TEXT,
    "isBaseline" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MilestoneStatusHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MilestoneStatusHistory_milestoneId_createdAt_idx"
ON "MilestoneStatusHistory"("milestoneId", "createdAt");

CREATE INDEX "MilestoneStatusHistory_evidenceId_idx"
ON "MilestoneStatusHistory"("evidenceId");

ALTER TABLE "MilestoneStatusHistory"
ADD CONSTRAINT "MilestoneStatusHistory_milestoneId_fkey"
FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MilestoneStatusHistory"
ADD CONSTRAINT "MilestoneStatusHistory_evidenceId_fkey"
FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "MilestoneStatusHistory" (
    "id",
    "milestoneId",
    "previousStatus",
    "newStatus",
    "isBaseline",
    "reason",
    "createdAt"
)
SELECT
    gen_random_uuid()::text,
    milestone."id",
    NULL,
    milestone."status",
    true,
    'Baseline snapshot captured when milestone history was introduced; earlier transitions were not recorded.',
    CURRENT_TIMESTAMP
FROM "Milestone" AS milestone;

CREATE FUNCTION "reject_milestone_status_history_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' AND NOT EXISTS (
        SELECT 1 FROM "Milestone" WHERE "id" = OLD."milestoneId"
    ) THEN
        RETURN OLD;
    END IF;
    RAISE EXCEPTION 'MilestoneStatusHistory is append-only';
END;
$$;

CREATE TRIGGER "MilestoneStatusHistory_append_only"
BEFORE UPDATE OR DELETE ON "MilestoneStatusHistory"
FOR EACH ROW
EXECUTE FUNCTION "reject_milestone_status_history_mutation"();
