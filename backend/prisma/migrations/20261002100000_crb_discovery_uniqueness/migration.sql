UPDATE "Contractor"
SET "crbRegistrationNumber" = UPPER(BTRIM("crbRegistrationNumber"))
WHERE "crbRegistrationNumber" IS NOT NULL;

DROP INDEX IF EXISTS "Contractor_crbRegistrationNumber_idx";

CREATE UNIQUE INDEX "Contractor_crbRegistrationNumber_key"
ON "Contractor"("crbRegistrationNumber");