-- Tighten the append-only guarantee.
--
-- The trigger used to allow a history row to be deleted once its milestone no
-- longer existed, on the theory that a missing milestone left the row
-- unreachable. That weakened the guarantee exactly when it matters: the one
-- moment the record can no longer be corroborated against a live milestone is
-- the moment it must not be erasable. History is now append-only for the life
-- of the row, regardless of whether the milestone still exists.
--
-- Referential cascades (ON DELETE SET NULL on actorId) remain permitted at
-- trigger depth > 1, because those are integrity actions, not mutations.
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

    RAISE EXCEPTION 'MilestoneStatusHistory is append-only';
END;
$$;
