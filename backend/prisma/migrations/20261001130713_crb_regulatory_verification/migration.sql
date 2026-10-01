-- CreateEnum
CREATE TYPE "CrbVerificationStatus" AS ENUM ('REGISTERED', 'NOT_REGISTERED', 'EXPIRED', 'SUSPENDED', 'PENDING', 'UNAVAILABLE', 'INVALID_REFERENCE');

-- CreateEnum
CREATE TYPE "CrbVerificationSource" AS ENUM ('SANDBOX', 'CRB_OFFICIAL');

-- AlterTable
ALTER TABLE "Contractor" ALTER COLUMN "crbSource" DROP NOT NULL,
ALTER COLUMN "crbSource" DROP DEFAULT;

-- CreateTable
CREATE TABLE "CrbVerification" (
    "id" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "registrationReference" TEXT NOT NULL,
    "status" "CrbVerificationStatus" NOT NULL,
    "source" "CrbVerificationSource" NOT NULL,
    "registrationNumber" TEXT,
    "registeredName" TEXT,
    "category" TEXT,
    "registrationClass" TEXT,
    "registrationDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "externalReference" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "canonicalDigest" TEXT NOT NULL,
    "failureCode" TEXT,
    "requestedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrbVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CrbVerification_contractorId_checkedAt_idx" ON "CrbVerification"("contractorId", "checkedAt");

-- CreateIndex
CREATE INDEX "CrbVerification_contractorId_status_idx" ON "CrbVerification"("contractorId", "status");

-- CreateIndex
CREATE INDEX "CrbVerification_requestedById_idx" ON "CrbVerification"("requestedById");

-- AddForeignKey
ALTER TABLE "CrbVerification" ADD CONSTRAINT "CrbVerification_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrbVerification" ADD CONSTRAINT "CrbVerification_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
