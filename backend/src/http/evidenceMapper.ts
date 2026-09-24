import type { EvidenceView, EvidenceVersionView, VerificationView } from "../services/evidence";

export type HttpEvidence = {
  id: string;
  milestoneId: string;
  currentVersionId: string | null;
  fileName: string;
  sha256: string;
  mimeType: string;
  sizeBytes: number;
  status: EvidenceView["status"];
  verificationStatus: EvidenceView["verificationStatus"];
  currentVersion: HttpEvidenceVersion | null;
  createdAt: string;
  updatedAt: string;
};

export type HttpEvidenceVersion = {
  id: string;
  evidenceId: string;
  versionNumber: number;
  sha256: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

export function toHttpEvidence(view: EvidenceView): HttpEvidence {
  return {
    id: view.id,
    milestoneId: view.milestoneId,
    currentVersionId: view.currentVersionId,
    fileName: view.fileName,
    sha256: view.sha256,
    mimeType: view.mimeType,
    sizeBytes: view.sizeBytes,
    status: view.status,
    verificationStatus: view.verificationStatus,
    currentVersion: view.currentVersion ? toHttpEvidenceVersion(view.currentVersion) : null,
    createdAt: view.createdAt,
    updatedAt: view.updatedAt,
  };
}

export function toHttpEvidenceVersion(view: EvidenceVersionView): HttpEvidenceVersion {
  return {
    id: view.id,
    evidenceId: view.evidenceId,
    versionNumber: view.versionNumber,
    sha256: view.sha256,
    fileName: view.fileName,
    mimeType: view.mimeType,
    sizeBytes: view.sizeBytes,
    createdAt: view.createdAt,
  };
}

export function toHttpVerification(view: VerificationView) {
  return {
    id: view.id,
    status: view.status,
    source: view.source,
    evidenceId: view.evidenceId,
    evidenceVersionId: view.evidenceVersionId,
    sha256: view.sha256,
    createdAt: view.createdAt,
  };
}
