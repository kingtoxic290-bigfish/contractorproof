-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CONTRACTOR', 'CLIENT', 'CONSULTANT_ENGINEER', 'PROCUREMENT_OFFICER', 'AUDITOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "EvidenceStatus" AS ENUM ('PENDING_VERIFICATION', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MilestoneStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'PENDING_VERIFICATION', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AttestationDecision" AS ENUM ('APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "BlockchainEventType" AS ENUM ('PROJECT_REGISTERED', 'VERIFICATION', 'ATTESTATION', 'CORRECTION', 'DISPUTE', 'RESOLUTION', 'VARIATION');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contractor" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "crbRegistrationNumber" TEXT,
    "crbCategory" TEXT,
    "crbType" TEXT,
    "crbClass" TEXT,
    "crbStatus" TEXT,
    "crbLastVerifiedAt" TIMESTAMP(3),
    "crbSource" TEXT NOT NULL DEFAULT 'SYNTHETIC_DEMO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contractor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "nestTenderReference" TEXT,
    "nestContractReference" TEXT,
    "ocid" TEXT,
    "procuringEntity" TEXT,
    "contractStatus" TEXT,
    "contractStartDate" TIMESTAMP(3),
    "contractEndDate" TIMESTAMP(3),
    "nestSource" TEXT NOT NULL DEFAULT 'SYNTHETIC_DEMO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationPolicy" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "name" TEXT NOT NULL,
    "requiredApprovals" INTEGER NOT NULL DEFAULT 1,
    "allowedRoles" "Role"[],
    "verifierLabels" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "policyId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "MilestoneStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "milestoneId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "status" "EvidenceStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attestation" (
    "id" TEXT NOT NULL,
    "milestoneId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "verifierId" TEXT NOT NULL,
    "verifierRole" "Role" NOT NULL,
    "decision" "AttestationDecision" NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attestation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockchainEvent" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "eventType" "BlockchainEventType" NOT NULL,
    "referenceId" TEXT,
    "previousEventId" TEXT,
    "txHash" TEXT,
    "blockNumber" INTEGER,
    "evidenceHash" TEXT,
    "actorId" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlockchainEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dispute" (
    "id" TEXT NOT NULL,
    "milestoneId" TEXT NOT NULL,
    "raisedById" TEXT NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "reason" TEXT NOT NULL,
    "originalEventId" TEXT,
    "resolutionEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Correction" (
    "id" TEXT NOT NULL,
    "milestoneId" TEXT NOT NULL,
    "originalEventId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "evidenceId" TEXT,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Correction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractVariation" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "previousEventId" TEXT NOT NULL,
    "variationReference" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "evidenceId" TEXT,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractVariation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Contractor_userId_key" ON "Contractor"("userId");

-- CreateIndex
CREATE INDEX "Contractor_crbRegistrationNumber_idx" ON "Contractor"("crbRegistrationNumber");

-- CreateIndex
CREATE INDEX "Project_contractorId_idx" ON "Project"("contractorId");

-- CreateIndex
CREATE INDEX "Project_nestContractReference_idx" ON "Project"("nestContractReference");

-- CreateIndex
CREATE INDEX "Project_ocid_idx" ON "Project"("ocid");

-- CreateIndex
CREATE INDEX "VerificationPolicy_projectId_idx" ON "VerificationPolicy"("projectId");

-- CreateIndex
CREATE INDEX "Milestone_projectId_idx" ON "Milestone"("projectId");

-- CreateIndex
CREATE INDEX "Milestone_policyId_idx" ON "Milestone"("policyId");

-- CreateIndex
CREATE INDEX "Evidence_sha256_idx" ON "Evidence"("sha256");

-- CreateIndex
CREATE INDEX "Evidence_uploadedById_idx" ON "Evidence"("uploadedById");

-- CreateIndex
CREATE UNIQUE INDEX "Evidence_milestoneId_sha256_key" ON "Evidence"("milestoneId", "sha256");

-- CreateIndex
CREATE INDEX "Attestation_milestoneId_idx" ON "Attestation"("milestoneId");

-- CreateIndex
CREATE INDEX "Attestation_verifierId_idx" ON "Attestation"("verifierId");

-- CreateIndex
CREATE UNIQUE INDEX "Attestation_evidenceId_verifierId_key" ON "Attestation"("evidenceId", "verifierId");

-- CreateIndex
CREATE INDEX "BlockchainEvent_projectId_idx" ON "BlockchainEvent"("projectId");

-- CreateIndex
CREATE INDEX "BlockchainEvent_eventType_idx" ON "BlockchainEvent"("eventType");

-- CreateIndex
CREATE INDEX "BlockchainEvent_previousEventId_idx" ON "BlockchainEvent"("previousEventId");

-- CreateIndex
CREATE INDEX "BlockchainEvent_txHash_idx" ON "BlockchainEvent"("txHash");

-- CreateIndex
CREATE INDEX "Dispute_milestoneId_idx" ON "Dispute"("milestoneId");

-- CreateIndex
CREATE INDEX "Dispute_raisedById_idx" ON "Dispute"("raisedById");

-- CreateIndex
CREATE INDEX "Dispute_status_idx" ON "Dispute"("status");

-- CreateIndex
CREATE INDEX "Correction_milestoneId_idx" ON "Correction"("milestoneId");

-- CreateIndex
CREATE INDEX "Correction_originalEventId_idx" ON "Correction"("originalEventId");

-- CreateIndex
CREATE INDEX "Correction_actorId_idx" ON "Correction"("actorId");

-- CreateIndex
CREATE INDEX "ContractVariation_projectId_idx" ON "ContractVariation"("projectId");

-- CreateIndex
CREATE INDEX "ContractVariation_previousEventId_idx" ON "ContractVariation"("previousEventId");

-- CreateIndex
CREATE INDEX "ContractVariation_actorId_idx" ON "ContractVariation"("actorId");

-- CreateIndex
CREATE UNIQUE INDEX "ContractVariation_projectId_variationReference_key" ON "ContractVariation"("projectId", "variationReference");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Contractor" ADD CONSTRAINT "Contractor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationPolicy" ADD CONSTRAINT "VerificationPolicy_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "VerificationPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attestation" ADD CONSTRAINT "Attestation_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attestation" ADD CONSTRAINT "Attestation_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attestation" ADD CONSTRAINT "Attestation_verifierId_fkey" FOREIGN KEY ("verifierId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockchainEvent" ADD CONSTRAINT "BlockchainEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockchainEvent" ADD CONSTRAINT "BlockchainEvent_previousEventId_fkey" FOREIGN KEY ("previousEventId") REFERENCES "BlockchainEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockchainEvent" ADD CONSTRAINT "BlockchainEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_raisedById_fkey" FOREIGN KEY ("raisedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_originalEventId_fkey" FOREIGN KEY ("originalEventId") REFERENCES "BlockchainEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_resolutionEventId_fkey" FOREIGN KEY ("resolutionEventId") REFERENCES "BlockchainEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Correction" ADD CONSTRAINT "Correction_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Correction" ADD CONSTRAINT "Correction_originalEventId_fkey" FOREIGN KEY ("originalEventId") REFERENCES "BlockchainEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Correction" ADD CONSTRAINT "Correction_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Correction" ADD CONSTRAINT "Correction_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractVariation" ADD CONSTRAINT "ContractVariation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractVariation" ADD CONSTRAINT "ContractVariation_previousEventId_fkey" FOREIGN KEY ("previousEventId") REFERENCES "BlockchainEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractVariation" ADD CONSTRAINT "ContractVariation_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractVariation" ADD CONSTRAINT "ContractVariation_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

