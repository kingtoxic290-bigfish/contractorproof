-- Narrow the append-only escape to the one referential action it exists for.
--
-- Migration 20261002170000 let through any UPDATE issued from inside a trigger,
-- because `pg_trigger_depth() > 1` is true for *every* nested trigger, not just
-- the foreign key's own ON DELETE SET NULL on actorId. The guarantee was correct
-- but broader than the comment claimed: any future trigger anywhere that touched
-- a history row would have bypassed append-only entirely.
--
-- The escape is now restricted to the exact shape the FK produces: actorId going
-- from a value to NULL, with no other column changed. Everything else, at any
-- depth, is still refused.
CREATE OR REPLACE FUNCTION "reject_milestone_status_history_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- Referential action only: Postgres nulls actorId when its User row is
    -- deleted. That is an integrity action, not a mutation of the history.
    IF TG_OP = 'UPDATE'
       AND OLD."actorId" IS NOT NULL
       AND NEW."actorId" IS NULL
       AND NEW."milestoneId"      IS NOT DISTINCT FROM OLD."milestoneId"
       AND NEW."sequence"         IS NOT DISTINCT FROM OLD."sequence"
       AND NEW."previousStatus"   IS NOT DISTINCT FROM OLD."previousStatus"
       AND NEW."newStatus"        IS NOT DISTINCT FROM OLD."newStatus"
       AND NEW."actorName"        IS NOT DISTINCT FROM OLD."actorName"
       AND NEW."actorRole"        IS NOT DISTINCT FROM OLD."actorRole"
       AND NEW."evidenceId"       IS NOT DISTINCT FROM OLD."evidenceId"
       AND NEW."isBaseline"       IS NOT DISTINCT FROM OLD."isBaseline"
       AND NEW."reason"           IS NOT DISTINCT FROM OLD."reason"
       AND NEW."createdAt"        IS NOT DISTINCT FROM OLD."createdAt"
    THEN
        RETURN NEW;
    END IF;

    RAISE EXCEPTION 'MilestoneStatusHistory is append-only';
END;
$$;

CREATE OR REPLACE FUNCTION "reject_project_status_history_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'UPDATE'
       AND OLD."actorId" IS NOT NULL
       AND NEW."actorId" IS NULL
       AND NEW."projectId"       IS NOT DISTINCT FROM OLD."projectId"
       AND NEW."sequence"        IS NOT DISTINCT FROM OLD."sequence"
       AND NEW."previousStatus"  IS NOT DISTINCT FROM OLD."previousStatus"
       AND NEW."newStatus"       IS NOT DISTINCT FROM OLD."newStatus"
       AND NEW."actorName"       IS NOT DISTINCT FROM OLD."actorName"
       AND NEW."actorRole"       IS NOT DISTINCT FROM OLD."actorRole"
       AND NEW."isBaseline"      IS NOT DISTINCT FROM OLD."isBaseline"
       AND NEW."reason"          IS NOT DISTINCT FROM OLD."reason"
       AND NEW."createdAt"       IS NOT DISTINCT FROM OLD."createdAt"
    THEN
        RETURN NEW;
    END IF;

    RAISE EXCEPTION 'ProjectStatusHistory is append-only';
END;
$$;
