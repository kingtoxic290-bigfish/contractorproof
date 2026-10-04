-- Append-only history must not break referential integrity.
--
-- Both history tables reference "User" with ON DELETE SET NULL. When a user is
-- deleted Postgres issues an UPDATE to null out actorId, which the append-only
-- triggers rejected with "is append-only" and made the user row undeletable.
--
-- Referential actions are implemented by Postgres as internal RI triggers, so
-- they run at a trigger depth greater than 1. Application-issued UPDATE/DELETE
-- statements run at depth 1 and remain blocked: the append-only guarantee is
-- unchanged for every direct mutation. Only the foreign key's own cascade is
-- let through, and it can only null actorId.
CREATE OR REPLACE FUNCTION "reject_milestone_status_history_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF pg_trigger_depth() > 1 THEN
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        END IF;
        RETURN NEW;
    END IF;

    IF TG_OP = 'DELETE' AND NOT EXISTS (
        SELECT 1 FROM "Milestone" WHERE "id" = OLD."milestoneId"
    ) THEN
        RETURN OLD;
    END IF;

    RAISE EXCEPTION 'MilestoneStatusHistory is append-only';
END;
$$;

CREATE OR REPLACE FUNCTION "reject_project_status_history_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF pg_trigger_depth() > 1 THEN
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        END IF;
        RETURN NEW;
    END IF;

    RAISE EXCEPTION 'ProjectStatusHistory is append-only';
END;
$$;