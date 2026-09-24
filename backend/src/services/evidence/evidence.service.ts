import { Prisma } from "@prisma/client";
import { evidenceRepository } from "../../repositories/evidence.repository";
import { evidenceVersionRepository } from "../../repositories/evidenceVersion.repository";
import { projectRepository } from "../../repositories/project.repository";
import { RepositoryError } from "../../repositories/errors";
import type { StorageService } from "../storage/StorageService";
import { localStorageService } from "../storage/LocalFilesystemStorageService";
import { EVIDENCE_ERROR_CODES, EvidenceError } from "./errors";
import { hashEvidenceBytes } from "./hash";
import type {
  AppendEvidenceInput,
  EvidenceBytes,
  EvidenceView,
  EvidenceVersionView,
  UploadEvidenceInput,
} from "./types";
import { requireUuid, validateUploadBuffer } from "./validation";

function isPrismaKnown(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

function toVersionView(version: {
  id: string;
  evidenceId: string;
  versionNumber: number;
  sha256: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
}): EvidenceVersionView {
  return {
    id: version.id,
    evidenceId: version.evidenceId,
    versionNumber: version.versionNumber,
    sha256: version.sha256,
    fileName: version.fileName,
    mimeType: version.mimeType,
    sizeBytes: version.sizeBytes,
    createdAt: version.createdAt.toISOString(),
  };
}

function toEvidenceView(
  row: NonNullable<Awaited<ReturnType<typeof evidenceRepository.findById>>>,
): EvidenceView {
  const current = row.currentVersion;
  return {
    id: row.id,
    milestoneId: row.milestoneId,
    uploadedById: row.uploadedById,
    currentVersionId: row.currentVersionId,
    fileName: row.fileName,
    sha256: row.sha256,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    status: row.status,
    verificationStatus: "PENDING",
    currentVersion: current ? toVersionView(current) : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapWriteError(error: unknown): never {
  if (error instanceof EvidenceError) {
    throw error;
  }
  if (error instanceof RepositoryError) {
    if (error.message === "evidence not found") {
      throw new EvidenceError(EVIDENCE_ERROR_CODES.EVIDENCE_NOT_FOUND, "evidence not found");
    }
    throw new EvidenceError(EVIDENCE_ERROR_CODES.VALIDATION_ERROR, error.message);
  }
  if (isPrismaKnown(error, "P2002")) {
    throw new EvidenceError(
      EVIDENCE_ERROR_CODES.HASH_CONFLICT,
      "an evidence version with this SHA-256 already exists",
    );
  }
  if (isPrismaKnown(error, "P2003")) {
    throw new EvidenceError(
      EVIDENCE_ERROR_CODES.VALIDATION_ERROR,
      "related record is invalid",
    );
  }
  throw new EvidenceError(
    EVIDENCE_ERROR_CODES.STORAGE_FAILED,
    "evidence could not be recorded",
  );
}

export class EvidenceService {
  constructor(private readonly storage: StorageService = localStorageService) {}

  async create(input: UploadEvidenceInput): Promise<EvidenceView> {
    const milestoneId = requireUuid(input.milestoneId, "milestoneId");
    const uploadedById = requireUuid(input.uploadedById, "uploadedById");
    const validated = validateUploadBuffer(input.buffer, input.originalName, input.mimeType);
    const sha256 = hashEvidenceBytes(input.buffer);

    const milestone = await projectRepository.getMilestoneById(milestoneId);
    if (!milestone) {
      throw new EvidenceError(EVIDENCE_ERROR_CODES.MILESTONE_NOT_FOUND, "milestone not found");
    }

    return this.persistAfterStore({
      fileName: validated.fileName,
      mimeType: validated.mimeType,
      buffer: input.buffer,
      write: (storageReference, sizeBytes) =>
        evidenceRepository.createWithInitialVersion({
          milestoneId,
          uploadedById,
          fileName: validated.fileName,
          storageReference,
          mimeType: validated.mimeType,
          sizeBytes,
          sha256,
          createdById: uploadedById,
        }),
    });
  }

  async appendVersion(input: AppendEvidenceInput): Promise<EvidenceView> {
    const evidenceId = requireUuid(input.evidenceId, "evidenceId");
    const uploadedById = requireUuid(input.uploadedById, "uploadedById");
    const validated = validateUploadBuffer(input.buffer, input.originalName, input.mimeType);
    const sha256 = hashEvidenceBytes(input.buffer);

    const existing = await evidenceRepository.findById(evidenceId);
    if (!existing) {
      throw new EvidenceError(EVIDENCE_ERROR_CODES.EVIDENCE_NOT_FOUND, "evidence not found");
    }

    return this.persistAfterStore({
      fileName: validated.fileName,
      mimeType: validated.mimeType,
      buffer: input.buffer,
      write: (storageReference, sizeBytes) =>
        evidenceRepository.appendVersion({
          evidenceId,
          fileName: validated.fileName,
          storageReference,
          mimeType: validated.mimeType,
          sizeBytes,
          sha256,
          createdById: uploadedById,
        }),
    });
  }

  async getById(evidenceId: string): Promise<EvidenceView> {
    const id = requireUuid(evidenceId, "evidenceId");
    const row = await evidenceRepository.findById(id);
    if (!row) {
      throw new EvidenceError(EVIDENCE_ERROR_CODES.EVIDENCE_NOT_FOUND, "evidence not found");
    }
    return toEvidenceView(row);
  }

  async listByMilestone(milestoneId: string): Promise<EvidenceView[]> {
    const id = requireUuid(milestoneId, "milestoneId");
    const rows = await evidenceRepository.findByMilestoneId(id);
    return rows.map(toEvidenceView);
  }

  async listByProject(projectId: string): Promise<EvidenceView[]> {
    const id = requireUuid(projectId, "projectId");
    const project = await projectRepository.getProjectById(id);
    if (!project) {
      throw new EvidenceError(EVIDENCE_ERROR_CODES.PROJECT_NOT_FOUND, "project not found");
    }
    const milestones = await projectRepository.listProjectMilestones(id);
    const groups = await Promise.all(
      milestones.map((milestone) => evidenceRepository.findByMilestoneId(milestone.id)),
    );
    return groups.flat().map(toEvidenceView);
  }

  async listAccessible(where: Parameters<typeof evidenceRepository.findAccessible>[0]) {
    const rows = await evidenceRepository.findAccessible(where);
    return rows.map(toEvidenceView);
  }

  async listVersions(evidenceId: string): Promise<EvidenceVersionView[]> {
    const id = requireUuid(evidenceId, "evidenceId");
    const evidence = await evidenceRepository.findById(id);
    if (!evidence) {
      throw new EvidenceError(EVIDENCE_ERROR_CODES.EVIDENCE_NOT_FOUND, "evidence not found");
    }
    const versions = await evidenceVersionRepository.findByEvidenceId(id);
    return versions.map(toVersionView);
  }

  async getVersion(versionId: string): Promise<EvidenceVersionView> {
    const id = requireUuid(versionId, "evidenceVersionId");
    const version = await evidenceVersionRepository.findById(id);
    if (!version) {
      throw new EvidenceError(EVIDENCE_ERROR_CODES.VERSION_NOT_FOUND, "evidence version not found");
    }
    return toVersionView(version);
  }

  /**
   * Authorized download helper. Returns bytes and display metadata only.
   * Never returns storageReference, filesystem paths, or storage keys.
   */
  async readVersionBytes(versionId: string): Promise<EvidenceBytes> {
    const id = requireUuid(versionId, "evidenceVersionId");
    const version = await evidenceVersionRepository.findById(id);
    if (!version) {
      throw new EvidenceError(EVIDENCE_ERROR_CODES.VERSION_NOT_FOUND, "evidence version not found");
    }
    return this.readStoredVersion(version);
  }

  async readCurrentBytes(evidenceId: string): Promise<EvidenceBytes> {
    const id = requireUuid(evidenceId, "evidenceId");
    const evidence = await evidenceRepository.findById(id);
    if (!evidence?.currentVersion) {
      throw new EvidenceError(EVIDENCE_ERROR_CODES.EVIDENCE_NOT_FOUND, "evidence not found");
    }
    return this.readStoredVersion(evidence.currentVersion);
  }

  /**
   * Filesystem and PostgreSQL are not one atomic transaction.
   *
   * Compensation:
   * 1. Validate metadata and file constraints (no I/O).
   * 2. Hash the uploaded buffer (same bytes that will be stored).
   * 3. StorageService.save — object exists without a DB row.
   * 4. Write Evidence / EvidenceVersion. If this fails, StorageService.remove
   *    the new key so a successful HTTP/service result cannot point at a
   *    missing file, and a failed write does not leave a permanent orphan
   *    when compensation runs.
   *
   * A crash between save and remove can leave an unreferenced object.
   * The service never leaves Evidence metadata pointing at a file that was
   * not stored. Agent 2 must not persist client-supplied storage keys.
   */
  private async persistAfterStore(params: {
    fileName: string;
    mimeType: string;
    buffer: Buffer;
    write: (
      storageReference: string,
      sizeBytes: number,
    ) => ReturnType<typeof evidenceRepository.createWithInitialVersion>;
  }): Promise<EvidenceView> {
    let storedKey: string | undefined;
    try {
      const stored = await this.storage.save({
        originalName: params.fileName,
        buffer: params.buffer,
        mimeType: params.mimeType,
      });
      storedKey = stored.storageKey;
      const row = await params.write(stored.storageKey, stored.sizeBytes);
      return toEvidenceView(row);
    } catch (error) {
      if (storedKey) {
        await this.storage.remove(storedKey).catch(() => undefined);
      }
      mapWriteError(error);
    }
  }

  private async readStoredVersion(version: {
    id: string;
    evidenceId: string;
    versionNumber: number;
    storageReference: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    sha256: string;
  }): Promise<EvidenceBytes> {
    try {
      const buffer = await this.storage.read(version.storageReference);
      return {
        evidenceId: version.evidenceId,
        evidenceVersionId: version.id,
        versionNumber: version.versionNumber,
        fileName: version.fileName,
        mimeType: version.mimeType,
        sizeBytes: version.sizeBytes,
        sha256: version.sha256,
        buffer,
      };
    } catch {
      throw new EvidenceError(
        EVIDENCE_ERROR_CODES.STORAGE_FAILED,
        "evidence file is unavailable",
      );
    }
  }
}

export const evidenceService = new EvidenceService();
