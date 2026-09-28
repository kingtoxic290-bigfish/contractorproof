import { timingSafeEqual } from "crypto";
import type { VerificationSource, VerificationStatus } from "@prisma/client";
import { evidenceRepository } from "../../repositories/evidence.repository";
import { evidenceVersionRepository } from "../../repositories/evidenceVersion.repository";
import { verificationRepository } from "../../repositories/verification.repository";
import { blockchainEventRepository } from "../../repositories/blockchainEvent.repository";
import { normalizeSha256 } from "../../repositories/sha256";
import type { StorageService } from "../storage/StorageService";
import { localStorageService } from "../storage/LocalFilesystemStorageService";
import { EVIDENCE_ERROR_CODES, EvidenceError } from "./errors";
import { hashEvidenceBytes } from "./hash";
import type {
  CompareInput,
  CompareTargetInput,
  PublicVerificationView,
  VerificationView,
} from "./types";
import { requireUuid } from "./validation";

export const VERIFICATION_MATCH_MEANING =
  "The submitted file matches the evidence fingerprint in a confirmed verification proof. This does not prove the underlying claim is true.";

export const VERIFICATION_MISMATCH_MEANING =
  "The submitted file does not match the recorded evidence fingerprint.";

export const VERIFICATION_PENDING_MEANING =
  "Verification cannot be completed because the authoritative fingerprint is not ready.";

export const VERIFICATION_UNAVAILABLE_MEANING =
  "Verification could not be performed because the authoritative record is unavailable.";

function meaningFor(status: VerificationStatus): string {
  switch (status) {
    case "MATCH":
      return VERIFICATION_MATCH_MEANING;
    case "MISMATCH":
      return VERIFICATION_MISMATCH_MEANING;
    case "PENDING":
      return VERIFICATION_PENDING_MEANING;
    case "UNAVAILABLE":
      return VERIFICATION_UNAVAILABLE_MEANING;
    default:
      return VERIFICATION_UNAVAILABLE_MEANING;
  }
}

function hashesEqual(left: string, right: string): boolean {
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

function unavailableResult(source: VerificationSource): VerificationView {
  return {
    id: null,
    status: "UNAVAILABLE",
    source,
    evidenceId: null,
    evidenceVersionId: null,
    sha256: null,
    meaning: meaningFor("UNAVAILABLE"),
    createdAt: null,
  };
}

function toPublicView(result: VerificationView): PublicVerificationView {
  return {
    status: result.status,
    evidenceVersionId: result.evidenceVersionId,
    meaning: result.meaning,
    transactionHash: null,
    blockNumber: null,
  };
}

function requesterFor(source: VerificationSource, requestedById?: string | null) {
  return source === "PUBLIC" ? null : (requestedById ?? null);
}

export class VerificationService {
  constructor(private readonly storage: StorageService = localStorageService) {}

  /**
   * Single compare path for INTERNAL and PUBLIC callers.
   * MATCH/MISMATCH are fingerprint results only — never VERIFIED/SAFE/CLEAN.
   */
  async compare(input: CompareInput): Promise<VerificationView> {
    if (!input.presentedBytes || input.presentedBytes.length === 0) {
      throw new EvidenceError(EVIDENCE_ERROR_CODES.FILE_EMPTY, "file is required");
    }

    const version = await this.resolveAuthoritativeVersion(input);
    if (!version) {
      return unavailableResult(input.source);
    }
    if (!version.sha256) {
      return {
        id: null,
        status: "PENDING",
        source: input.source,
        evidenceId: version.evidenceId,
        evidenceVersionId: version.id,
        sha256: null,
        meaning: meaningFor("PENDING"),
        createdAt: null,
      };
    }

    const presentedSha256 = hashEvidenceBytes(input.presentedBytes);
    const authoritativeSha256 = normalizeSha256(version.sha256);
    const status: VerificationStatus = hashesEqual(presentedSha256, authoritativeSha256)
      ? "MATCH"
      : "MISMATCH";

    return this.persistCompare({
      version,
      status,
      presentedSha256,
      authoritativeSha256,
      source: input.source,
      requestedById: input.requestedById,
    });
  }

  /**
   * Self-check: hash stored bytes and compare to EvidenceVersion.sha256.
   * A successful upload of those same bytes must MATCH.
   */
  async compareStored(input: CompareTargetInput): Promise<VerificationView> {
    const version = await this.resolveAuthoritativeVersion(input);
    if (!version) {
      return unavailableResult(input.source);
    }
    if (!version.sha256) {
      return {
        id: null,
        status: "PENDING",
        source: input.source,
        evidenceId: version.evidenceId,
        evidenceVersionId: version.id,
        sha256: null,
        meaning: meaningFor("PENDING"),
        createdAt: null,
      };
    }

    let presentedBytes: Buffer;
    try {
      presentedBytes = await this.storage.read(version.storageReference);
    } catch {
      return this.persistCompare({
        version,
        status: "UNAVAILABLE",
        presentedSha256: null,
        authoritativeSha256: version.sha256,
        source: input.source,
        requestedById: input.requestedById,
      });
    }

    return this.compare({
      ...input,
      presentedBytes,
    });
  }

  async comparePublic(input: Omit<CompareInput, "source">): Promise<PublicVerificationView> {
    const result = await this.compare({
      ...input,
      source: "PUBLIC",
      requestedById: null,
    });
    const view = toPublicView(result);
    if (!result.evidenceVersionId || result.status === "UNAVAILABLE") {
      return view;
    }

    let proof;
    try {
      proof = await blockchainEventRepository.findVerificationProofByReference(
        result.evidenceVersionId,
      );
    } catch {
      return { ...view, status: "UNAVAILABLE", meaning: meaningFor("UNAVAILABLE") };
    }
    if (!proof) {
      return { ...view, status: "UNAVAILABLE", meaning: meaningFor("UNAVAILABLE") };
    }
    if (!proof.txHash || !proof.blockNumber || proof.blockNumber <= 0) {
      return { ...view, status: "PENDING", meaning: meaningFor("PENDING") };
    }

    // A confirmed event is authoritative only when it anchors the stored version hash.
    let anchoredHashMatches = false;
    try {
      anchoredHashMatches = Boolean(
        result.sha256 &&
          proof.evidenceHash &&
          normalizeSha256(proof.evidenceHash) === normalizeSha256(result.sha256),
      );
    } catch {
      // Corrupt persisted proof data is not public verification evidence.
      return { ...view, status: "UNAVAILABLE", meaning: meaningFor("UNAVAILABLE") };
    }
    if (!anchoredHashMatches) {
      return { ...view, status: "UNAVAILABLE", meaning: meaningFor("UNAVAILABLE") };
    }

    return {
      ...view,
      transactionHash: proof.txHash,
      blockNumber: proof.blockNumber,
    };
  }

  async listByVersion(evidenceVersionId: string): Promise<VerificationView[]> {
    const id = requireUuid(evidenceVersionId, "evidenceVersionId");
    const version = await evidenceVersionRepository.findById(id);
    if (!version) {
      throw new EvidenceError(EVIDENCE_ERROR_CODES.VERSION_NOT_FOUND, "evidence version not found");
    }
    const rows = await verificationRepository.findByEvidenceVersionId(id);
    return rows.map((row) => ({
      id: row.id,
      status: row.status,
      source: row.source,
      evidenceId: version.evidenceId,
      evidenceVersionId: version.id,
      sha256: row.authoritativeSha256,
      meaning: meaningFor(row.status),
      createdAt: row.createdAt.toISOString(),
    }));
  }

  private async persistCompare(params: {
    version: { id: string; evidenceId: string };
    status: VerificationStatus;
    presentedSha256: string | null;
    authoritativeSha256: string;
    source: VerificationSource;
    requestedById?: string | null;
  }): Promise<VerificationView> {
    try {
      const row = await verificationRepository.create({
        evidenceVersionId: params.version.id,
        status: params.status,
        presentedSha256: params.presentedSha256,
        authoritativeSha256: params.authoritativeSha256,
        source: params.source,
        requestedById: requesterFor(params.source, params.requestedById),
      });

      return {
        id: row.id,
        status: row.status,
        source: row.source,
        evidenceId: params.version.evidenceId,
        evidenceVersionId: params.version.id,
        // This remains internal to VerificationService; toPublicView explicitly omits it.
        sha256: row.authoritativeSha256,
        meaning: meaningFor(row.status),
        createdAt: row.createdAt.toISOString(),
      };
    } catch {
      throw new EvidenceError(
        EVIDENCE_ERROR_CODES.VERIFICATION_UNAVAILABLE,
        "verification could not be recorded",
      );
    }
  }

  private async resolveAuthoritativeVersion(input: CompareTargetInput) {
    try {
      if (input.evidenceVersionId) {
        const versionId = requireUuid(input.evidenceVersionId, "evidenceVersionId");
        const version = await evidenceVersionRepository.findById(versionId);
        if (!version) {
          return null;
        }
        if (input.evidenceId) {
          const evidenceId = requireUuid(input.evidenceId, "evidenceId");
          if (version.evidenceId !== evidenceId) {
            return null;
          }
        }
        return version;
      }
      if (input.evidenceId) {
        const id = requireUuid(input.evidenceId, "evidenceId");
        const evidence = await evidenceRepository.findById(id);
        if (!evidence?.currentVersion) {
          return null;
        }
        return evidence.currentVersion;
      }
    } catch (error) {
      if (error instanceof EvidenceError) {
        throw error;
      }
      return null;
    }
    throw new EvidenceError(
      EVIDENCE_ERROR_CODES.VALIDATION_ERROR,
      "evidenceId or evidenceVersionId is required",
    );
  }
}

export const verificationService = new VerificationService();
