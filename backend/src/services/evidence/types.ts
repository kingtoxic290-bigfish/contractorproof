import type { EvidenceStatus, VerificationSource, VerificationStatus } from "@prisma/client";

export type UploadEvidenceInput = {
  milestoneId: string;
  uploadedById: string;
  originalName: string;
  buffer: Buffer;
  mimeType?: string;
};

export type AppendEvidenceInput = {
  evidenceId: string;
  uploadedById: string;
  originalName: string;
  buffer: Buffer;
  mimeType?: string;
};

export type EvidenceVersionView = {
  id: string;
  evidenceId: string;
  versionNumber: number;
  sha256: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

export type EvidenceView = {
  id: string;
  milestoneId: string;
  uploadedById: string;
  currentVersionId: string | null;
  fileName: string;
  sha256: string;
  mimeType: string;
  sizeBytes: number;
  status: EvidenceStatus;
  verificationStatus: "PENDING";
  currentVersion: EvidenceVersionView | null;
  createdAt: string;
  updatedAt: string;
};

export type CompareTargetInput = {
  evidenceId?: string;
  evidenceVersionId?: string;
  source: VerificationSource;
  requestedById?: string | null;
};

export type CompareInput = CompareTargetInput & {
  presentedBytes: Buffer;
};

export type EvidenceBytes = {
  evidenceId: string;
  evidenceVersionId: string;
  versionNumber: number;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  buffer: Buffer;
};

export type VerificationView = {
  id: string | null;
  status: VerificationStatus;
  source: VerificationSource;
  evidenceId: string | null;
  evidenceVersionId: string | null;
  sha256: string | null;
  meaning: string;
  createdAt: string | null;
};

export type PublicVerificationView = {
  status: VerificationStatus;
  evidenceVersionId: string | null;
  meaning: string;
  transactionHash: string | null;
  blockNumber: number | null;
};
