UPDATE "ContractVariation"
SET
  "originalState" = '{"legacySnapshotUnavailable": true}'::jsonb,
  "proposedState" = '{"legacyProposalUnavailable": true}'::jsonb
WHERE "originalState" = '{}'::jsonb
  AND "proposedState" = '{}'::jsonb;
