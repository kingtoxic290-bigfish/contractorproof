CREATE TYPE "ProcurementSourceSystem" AS ENUM ('SANDBOX_DEMO', 'NEST_OCDS_PUBLIC');

CREATE TABLE "ProcurementRecord" (
    "id" TEXT NOT NULL,
    "sourceSystem" "ProcurementSourceSystem" NOT NULL,
    "externalReference" TEXT NOT NULL,
    "sourceRecordId" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProcurementRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProcurementObservation" (
    "id" TEXT NOT NULL,
    "procurementRecordId" TEXT NOT NULL,
    "ocid" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "releaseDate" TIMESTAMP(3),
    "tenderReference" TEXT,
    "title" TEXT,
    "description" TEXT,
    "buyerName" TEXT,
    "buyerIdentifier" TEXT,
    "procurementCategory" TEXT,
    "tenderStatus" TEXT,
    "awardStatus" TEXT,
    "awardDate" TIMESTAMP(3),
    "contractReference" TEXT,
    "contractStatus" TEXT,
    "contractorName" TEXT,
    "contractorIdentifier" TEXT,
    "contractValue" DECIMAL(20,4),
    "contractCurrency" TEXT,
    "contractStartDate" TIMESTAMP(3),
    "contractEndDate" TIMESTAMP(3),
    "normalizedData" JSONB NOT NULL,
    "sourceDigest" TEXT NOT NULL,
    "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProcurementObservation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProcurementLink" (
    "id" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "procurementRecordId" TEXT NOT NULL,
    "linkedById" TEXT NOT NULL,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProcurementLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProcurementRecord_sourceSystem_externalReference_key" ON "ProcurementRecord"("sourceSystem", "externalReference");
CREATE INDEX "ProcurementRecord_sourceRecordId_idx" ON "ProcurementRecord"("sourceRecordId");
CREATE INDEX "ProcurementObservation_procurementRecordId_retrievedAt_idx" ON "ProcurementObservation"("procurementRecordId", "retrievedAt");
CREATE INDEX "ProcurementObservation_ocid_releaseId_idx" ON "ProcurementObservation"("ocid", "releaseId");
CREATE UNIQUE INDEX "ProcurementLink_contractorId_procurementRecordId_key" ON "ProcurementLink"("contractorId", "procurementRecordId");
CREATE INDEX "ProcurementLink_procurementRecordId_idx" ON "ProcurementLink"("procurementRecordId");

ALTER TABLE "ProcurementObservation" ADD CONSTRAINT "ProcurementObservation_procurementRecordId_fkey" FOREIGN KEY ("procurementRecordId") REFERENCES "ProcurementRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProcurementLink" ADD CONSTRAINT "ProcurementLink_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProcurementLink" ADD CONSTRAINT "ProcurementLink_procurementRecordId_fkey" FOREIGN KEY ("procurementRecordId") REFERENCES "ProcurementRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProcurementLink" ADD CONSTRAINT "ProcurementLink_linkedById_fkey" FOREIGN KEY ("linkedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;