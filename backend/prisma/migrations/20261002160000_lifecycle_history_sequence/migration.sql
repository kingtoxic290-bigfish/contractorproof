-- Backfill the per-milestone ordering column.
--
ALTER TABLE "MilestoneStatusHistory"
ADD COLUMN IF NOT EXISTS "sequence" INTEGER;

CREATE OR REPLACE FUNCTION "reject_milestone_status_history_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'UPDATE'
       AND OLD."sequence" IS NULL
       AND NEW."sequence" IS NOT NULL
       AND (to_jsonb(OLD) - 'sequence') = (to_jsonb(NEW) - 'sequence') THEN
        RETURN NEW;
    END IF;
    RAISE EXCEPTION 'MilestoneStatusHistory is append-only';
END;
$$;

WITH ordered AS (
    SELECT "id",
           ROW_NUMBER() OVER (
               PARTITION BY "milestoneId"
               ORDER BY "createdAt" ASC, "id" ASC
           ) - 1 AS sequence_number
    FROM "MilestoneStatusHistory"
)
UPDATE "MilestoneStatusHistory" AS history
SET "sequence" = ordered.sequence_number::INTEGER
FROM ordered
WHERE history."id" = ordered."id"
    AND history."sequence" IS NULL;

ALTER TABLE "MilestoneStatusHistory"
ALTER COLUMN "sequence" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "MilestoneStatusHistory_milestoneId_sequence_key"
ON "MilestoneStatusHistory"("milestoneId", "sequence");

-- Same sequence-only backfill exception for project history.
ALTER TABLE "ProjectStatusHistory"
ADD COLUMN IF NOT EXISTS "sequence" INTEGER;

CREATE OR REPLACE FUNCTION "reject_project_status_history_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'UPDATE'
       AND OLD."sequence" IS NULL
       AND NEW."sequence" IS NOT NULL
       AND (to_jsonb(OLD) - 'sequence') = (to_jsonb(NEW) - 'sequence') THEN
        RETURN NEW;
    END IF;
    RAISE EXCEPTION 'ProjectStatusHistory is append-only';
END;
$$;

WITH ordered AS (
    SELECT "id",
           ROW_NUMBER() OVER (
               PARTITION BY "projectId"
               ORDER BY "createdAt" ASC, "id" ASC
           ) - 1 AS sequence_number
    FROM "ProjectStatusHistory"
)
UPDATE "ProjectStatusHistory" AS history
SET "sequence" = ordered.sequence_number::INTEGER
FROM ordered
WHERE history."id" = ordered."id"
    AND history."sequence" IS NULL;

ALTER TABLE "ProjectStatusHistory"
ALTER COLUMN "sequence" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "ProjectStatusHistory_projectId_sequence_key"
ON "ProjectStatusHistory"("projectId", "sequence");
