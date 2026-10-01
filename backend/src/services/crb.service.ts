import {
  CrbVerificationStatus,
  CrbVerificationSource,
  type Prisma,
} from "@prisma/client";
import { ApiError } from "../http/errors";
import { prisma } from "../repositories/prisma";
import { sha256Hex } from "../utils/hash";
import type { PublicUser } from "../types";
import { crbAdapter, isValidCrbReference } from "../integrations/crb";
import { CRB_ERROR_CODES } from "../types/crb";

/**
 * Canonical representation of a CRB check.
 *
 * Field order is fixed so the digest is deterministic and reproducible. Only
 * factual, non-sensitive values are included; the raw upstream response is
 * never stored and never digested.
 */
function canonicalRecord(parts: {
  registrationReference: string;
  status: string;
  source: string;
  registrationNumber: string | null;
  registeredName: string | null;
  category: string | null;
  registrationClass: string | null;
  registrationDate: string | null;
  expiryDate: string | null;
  externalReference: string | null;
}): string {
  return JSON.stringify([
    parts.registrationReference,
    parts.status,
    parts.source,
    parts.registrationNumber,
    parts.registeredName,
    parts.category,
    parts.registrationClass,
    parts.registrationDate,
    parts.expiryDate,
    parts.externalReference,
  ]);
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toIso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

type CrbVerificationRow = Prisma.CrbVerificationGetPayload<Record<string, never>>;

function toPublicVerification(row: CrbVerificationRow) {
  return {
    id: row.id,
    contractorId: row.contractorId,
    registrationReference: row.registrationReference,
    status: row.status,
    source: row.source,
    registrationNumber: row.registrationNumber,
    registeredName: row.registeredName,
    category: row.category,
    registrationClass: row.registrationClass,
    registrationDate: toIso(row.registrationDate),
    expiryDate: toIso(row.expiryDate),
    externalReference: row.externalReference,
    checkedAt: row.checkedAt.toISOString(),
    canonicalDigest: row.canonicalDigest,
    failureCode: row.failureCode,
    requestedById: row.requestedById,
    createdAt: row.createdAt.toISOString(),
  };
}

export type PublicCrbVerification = ReturnType<typeof toPublicVerification>;

export const crbService = {
  /**
   * Runs one CRB registration check for a contractor and stores the factual
   * outcome.
   *
   * Every call appends a new record. Nothing is overwritten, so a REGISTERED
   * check in one month and a SUSPENDED check the next remain separately
   * auditable.
   */
  async verifyContractorWithCRB(
    actor: PublicUser,
    contractorId: string | undefined,
  ): Promise<{ verification: PublicCrbVerification; previous: PublicCrbVerification | null }> {
    if (!contractorId) {
      throw new ApiError(400, "VALIDATION_ERROR", "contractorId is required");
    }
    const contractor = await prisma.contractor.findUnique({ where: { id: contractorId } });
    if (!contractor) {
      throw new ApiError(404, "CONTRACTOR_NOT_FOUND", "contractor not found");
    }

    // Not every contractor is subject to CRB registration (for example foreign
    // contractors), so a missing reference is a recorded fact, not an error.
    const reference = contractor.crbRegistrationNumber?.trim() ?? "";
    if (!reference) {
      throw new ApiError(400, CRB_ERROR_CODES.REFERENCE_MISSING, "contractor has no CRB registration reference");
    }
    if (!isValidCrbReference(reference)) {
      throw new ApiError(400, CRB_ERROR_CODES.REFERENCE_INVALID, "CRB registration reference is not valid");
    }

    const adapter = crbAdapter();
    const lookup = await adapter.lookup(reference);
    const checkedAt = new Date();

    const digest = sha256Hex(
      canonicalRecord({
        registrationReference: lookup.registrationReference,
        status: lookup.status,
        source: adapter.source,
        registrationNumber: lookup.registrationNumber,
        registeredName: lookup.registeredName,
        category: lookup.category,
        registrationClass: lookup.registrationClass,
        registrationDate: lookup.registrationDate,
        expiryDate: lookup.expiryDate,
        externalReference: lookup.externalReference,
      }),
    );

    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.crbVerification.create({
        data: {
          contractorId,
          registrationReference: lookup.registrationReference,
          status: lookup.status,
          source: adapter.source === "CRB_OFFICIAL"
            ? CrbVerificationSource.CRB_OFFICIAL
            : CrbVerificationSource.SANDBOX,
          registrationNumber: lookup.registrationNumber,
          registeredName: lookup.registeredName,
          category: lookup.category,
          registrationClass: lookup.registrationClass,
          registrationDate: parseDate(lookup.registrationDate),
          expiryDate: parseDate(lookup.expiryDate),
          externalReference: lookup.externalReference,
          checkedAt,
          canonicalDigest: digest,
          failureCode: lookup.failureCode,
          requestedById: actor.id,
        },
      });

      // Denormalised "latest check" snapshot on the contractor row. The
      // append-only CrbVerification history above remains the audit record.
      await tx.contractor.update({
        where: { id: contractorId },
        data: {
          crbRegistrationNumber: lookup.registrationReference,
          crbStatus: lookup.status,
          crbCategory: lookup.category,
          crbClass: lookup.registrationClass,
          crbLastVerifiedAt: checkedAt,
          crbSource: adapter.source === "CRB_OFFICIAL" ? "CRB_OFFICIAL" : "SANDBOX",
        },
      });

      return created;
    });

    const previous = await prisma.crbVerification.findFirst({
      where: { contractorId, id: { not: row.id } },
      orderBy: [{ checkedAt: "desc" }, { createdAt: "desc" }],
    });

    return {
      verification: toPublicVerification(row),
      previous: previous ? toPublicVerification(previous) : null,
    };
  },

  /** Full append-only history, newest first. */
  async listHistory(contractorId: string | undefined): Promise<PublicCrbVerification[]> {
    if (!contractorId) {
      throw new ApiError(400, "VALIDATION_ERROR", "contractorId is required");
    }
    const rows = await prisma.crbVerification.findMany({
      where: { contractorId },
      orderBy: [{ checkedAt: "desc" }, { createdAt: "desc" }],
    });
    return rows.map(toPublicVerification);
  },

  /**
   * Latest check overall, and separately the latest check that actually
   * reached the source. An UNAVAILABLE attempt never masks an earlier
   * successful result.
   */
  async latestFor(contractorId: string): Promise<{
    latest: PublicCrbVerification | null;
    latestCompleted: PublicCrbVerification | null;
  }> {
    const [latest, latestCompleted] = await Promise.all([
      prisma.crbVerification.findFirst({
        where: { contractorId },
        orderBy: [{ checkedAt: "desc" }, { createdAt: "desc" }],
      }),
      prisma.crbVerification.findFirst({
        where: {
          contractorId,
          status: {
            in: [
              CrbVerificationStatus.REGISTERED,
              CrbVerificationStatus.NOT_REGISTERED,
              CrbVerificationStatus.EXPIRED,
              CrbVerificationStatus.SUSPENDED,
            ],
          },
        },
        orderBy: [{ checkedAt: "desc" }, { createdAt: "desc" }],
      }),
    ]);
    return {
      latest: latest ? toPublicVerification(latest) : null,
      latestCompleted: latestCompleted ? toPublicVerification(latestCompleted) : null,
    };
  },
};

export { toPublicVerification };