ALTER TABLE "MilestoneStatusHistory"
DROP CONSTRAINT "MilestoneStatusHistory_milestoneId_fkey";

CREATE OR REPLACE FUNCTION "reject_milestone_status_history_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'MilestoneStatusHistory is append-only';
END;
$$;

CREATE TYPE "ProjectLifecycleStatus" AS ENUM (
    'CREATED',
    'IN_PROGRESS',
    'EXECUTION_COMPLETE',
    'UNDER_FINAL_REVIEW',
    'COMPLETED'
);

ALTER TABLE "Project"
ADD COLUMN "lifecycleStatus" "ProjectLifecycleStatus" NOT NULL DEFAULT 'CREATED';

CREATE TABLE "ProjectStatusHistory" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "previousStatus" "ProjectLifecycleStatus",
    "newStatus" "ProjectLifecycleStatus" NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT,
    "actorRole" "Role",
    "isBaseline" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectStatusHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProjectStatusHistory_projectId_createdAt_idx"
ON "ProjectStatusHistory"("projectId", "createdAt");

CREATE INDEX "ProjectStatusHistory_actorId_idx"
ON "ProjectStatusHistory"("actorId");

ALTER TABLE "ProjectStatusHistory"
ADD CONSTRAINT "ProjectStatusHistory_actorId_fkey"
FOREIGN KEY ("actorId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "ProjectStatusHistory" (
    "id",
    "projectId",
    "previousStatus",
    "newStatus",
    "isBaseline",
    "reason",
    "createdAt"
)
SELECT
    gen_random_uuid()::text,
    project."id",
    NULL,
    project."lifecycleStatus",
    true,
    'Baseline snapshot captured when auditable project lifecycle was introduced.',
    CURRENT_TIMESTAMP
FROM "Project" AS project;

CREATE FUNCTION "reject_project_status_history_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'ProjectStatusHistory is append-only';
END;
$$;

CREATE TRIGGER "ProjectStatusHistory_append_only"
BEFORE UPDATE OR DELETE ON "ProjectStatusHistory"
FOR EACH ROW
EXECUTE FUNCTION "reject_project_status_history_mutation"();
