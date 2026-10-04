import {
  BlockchainEventType,
  MilestoneStatus,
  Role,
  VariationStatus,
  type Prisma,
} from "@prisma/client";
import { ApiError } from "../http/errors";
import { prisma } from "../repositories/prisma";
import { assertCanReadProject, assertCanWriteProject, projectListWhere } from "./access.service";
import { proofService, type ProofView } from "./proof.service";
import type { PublicUser } from "../types";

const variationInclude = {
  project: { select: { id: true, name: true, description: true, nestTenderReference: true, nestContractReference: true, ocid: true, procuringEntity: true, contractStatus: true, contractStartDate: true, contractEndDate: true } },
  milestone: { select: { id: true, name: true, description: true, status: true } },
  reviewedBy: { select: { id: true, role: true } },
  previousEvent: { select: { id: true, eventType: true, referenceId: true, txHash: true, blockNumber: true } },
  variationEvent: { select: { id: true, eventType: true, referenceId: true, txHash: true, blockNumber: true } },
  resolutions: { orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }], include: { resolvedBy: { select: { id: true, role: true } } } },
  evidence: { select: { id: true, milestoneId: true, currentVersionId: true, sha256: true } },
} satisfies Prisma.ContractVariationInclude;

export type VariationRecord = Prisma.ContractVariationGetPayload<{ include: typeof variationInclude }>;
const resolverRoles: Role[] = [Role.ADMIN, Role.AUDITOR, Role.PROCUREMENT_OFFICER];

function requiredText(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new ApiError(400, "VALIDATION_ERROR", `${field} is required`);
  return normalized;
}

function validateChanges(input: unknown): { project: Record<string, unknown>; milestone: Record<string, unknown> } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new ApiError(400, "VALIDATION_ERROR", "changes must be an object");
  }
  const raw = input as Record<string, unknown>;
  if (Object.keys(raw).some((key) => key !== "project" && key !== "milestone")) {
    throw new ApiError(400, "VALIDATION_ERROR", "changes accepts only project and milestone objects");
  }
  const projectKeys = ["name", "description", "nestTenderReference", "nestContractReference", "ocid", "procuringEntity", "contractStatus", "contractStartDate", "contractEndDate"];
  const milestoneKeys = ["name", "description"];
  const project: Record<string, unknown> = {};
  const milestone: Record<string, unknown> = {};
  const readChanges = (source: unknown, allowed: string[], target: Record<string, unknown>, label: string) => {
    if (source === undefined) return;
    if (!source || typeof source !== "object" || Array.isArray(source)) {
      throw new ApiError(400, "VALIDATION_ERROR", `${label} changes must be an object`);
    }
    for (const [key, value] of Object.entries(source as Record<string, unknown>)) {
      if (!allowed.includes(key)) throw new ApiError(400, "VALIDATION_ERROR", `unsupported ${label} field: ${key}`);
      if (value !== null && typeof value !== "string") throw new ApiError(400, "VALIDATION_ERROR", `${label}.${key} must be a string or null`);
      if (typeof value === "string" && !value.trim()) throw new ApiError(400, "VALIDATION_ERROR", `${label}.${key} cannot be empty`);
      if ((key === "contractStartDate" || key === "contractEndDate") && value !== null && Number.isNaN(Date.parse(value as string))) {
        throw new ApiError(400, "VALIDATION_ERROR", `${label}.${key} must be a valid date`);
      }
      target[key] = key.endsWith("Date") && typeof value === "string" ? new Date(value) : value;
    }
  };
  readChanges(raw.project, projectKeys, project, "project");
  readChanges(raw.milestone, milestoneKeys, milestone, "milestone");
  if (!Object.keys(project).length && !Object.keys(milestone).length) {
    throw new ApiError(400, "VALIDATION_ERROR", "at least one project or milestone change is required");
  }
  return { project, milestone };
}

function jsonSafe(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

/**
 * Current milestone status, read inside the resolution transaction so the
 * appended history row records the status that was actually replaced.
 */
async function currentMilestoneStatus(
  tx: Prisma.TransactionClient,
  milestoneId: string,
): Promise<MilestoneStatus> {
  const milestone = await tx.milestone.findUnique({
    where: { id: milestoneId },
    select: { status: true },
  });
  return milestone?.status ?? MilestoneStatus.PENDING;
}

async function load(id: string): Promise<VariationRecord> {
  const row = await prisma.contractVariation.findUnique({ where: { id }, include: variationInclude });
  if (!row) throw new ApiError(404, "VARIATION_NOT_FOUND", "variation not found");
  return row;
}

async function proof(row: VariationRecord): Promise<ProofView | null> {
  if (!row.variationEventId) return null;
  const event = await prisma.blockchainEvent.findUnique({ where: { id: row.variationEventId } });
  return event ? proofService.toProofView(event) : null;
}

export const variationService = {
  async create(input: { actor: PublicUser; projectId: string; milestoneId?: string; previousEventId: string; variationReference: string; reason: string; changes: unknown; evidenceId?: string }): Promise<VariationRecord> {
    const reason = requiredText(input.reason, "reason");
    const variationReference = requiredText(input.variationReference, "variationReference");
    const changes = validateChanges(input.changes);
    if (Object.keys(changes.milestone).length && !input.milestoneId) {
      throw new ApiError(400, "VALIDATION_ERROR", "milestoneId is required for milestone changes");
    }
    await assertCanWriteProject(input.actor, input.projectId);
    const project = await prisma.project.findUnique({ where: { id: input.projectId } });
    if (!project) throw new ApiError(404, "PROJECT_NOT_FOUND", "project not found");
    let milestone = null;
    if (Object.keys(changes.milestone).length || input.milestoneId) {
      if (!input.milestoneId) throw new ApiError(400, "VALIDATION_ERROR", "milestoneId is required");
      milestone = await prisma.milestone.findUnique({ where: { id: input.milestoneId } });
      if (!milestone) throw new ApiError(404, "MILESTONE_NOT_FOUND", "milestone not found");
      if (milestone.projectId !== project.id) throw new ApiError(400, "VALIDATION_ERROR", "milestone does not belong to project");
    }
    const previous = await prisma.blockchainEvent.findUnique({ where: { id: input.previousEventId } });
    if (!previous) throw new ApiError(404, "BLOCKCHAIN_EVENT_NOT_FOUND", "previous blockchain event not found");
    if (previous.projectId !== project.id) throw new ApiError(400, "VALIDATION_ERROR", "previous event does not belong to project");
    let evidence = null;
    if (input.evidenceId) {
      evidence = await prisma.evidence.findUnique({ where: { id: input.evidenceId }, include: { milestone: { select: { projectId: true, id: true } } } });
      if (!evidence) throw new ApiError(404, "EVIDENCE_NOT_FOUND", "evidence not found");
      if (evidence.milestone.projectId !== project.id || (milestone && evidence.milestoneId !== milestone.id)) {
        throw new ApiError(400, "VALIDATION_ERROR", "evidence does not belong to variation project/milestone");
      }
    }
    const originalState = {
      project: { name: project.name, description: project.description, nestTenderReference: project.nestTenderReference, nestContractReference: project.nestContractReference, ocid: project.ocid, procuringEntity: project.procuringEntity, contractStatus: project.contractStatus, contractStartDate: project.contractStartDate, contractEndDate: project.contractEndDate },
      milestone: milestone ? { id: milestone.id, name: milestone.name, description: milestone.description, status: milestone.status } : null,
    };
    const proposedState = {
      project: { ...changes.project },
      milestone: Object.keys(changes.milestone).length ? { id: milestone!.id, ...changes.milestone } : null,
    };
    try {
      return await prisma.contractVariation.create({
        data: {
          projectId: project.id, previousEventId: previous.id, variationReference, reason,
          milestoneId: milestone?.id ?? null, evidenceId: evidence?.id ?? null, actorId: input.actor.id,
          originalState: jsonSafe(originalState), proposedState: jsonSafe(proposedState),
        }, include: variationInclude,
      });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002") {
        throw new ApiError(409, "CONFLICT", "variationReference already exists for project");
      }
      throw error;
    }
  },

  async list(actor: PublicUser, projectId?: string): Promise<VariationRecord[]> {
    if (projectId) await assertCanReadProject(actor, projectId);
    const where: Prisma.ContractVariationWhereInput = {
      project: projectListWhere(actor),
      ...(projectId ? { projectId } : {}),
    };
    return prisma.contractVariation.findMany({ where, include: variationInclude, orderBy: [{ createdAt: "desc" }, { id: "asc" }] });
  },

  async get(actor: PublicUser, id: string): Promise<{ variation: VariationRecord; blockchainProof: ProofView | null }> {
    const variation = await load(id);
    await assertCanReadProject(actor, variation.projectId);
    return { variation, blockchainProof: await proof(variation) };
  },

  async review(actor: PublicUser, id: string): Promise<VariationRecord> {
    if (!resolverRoles.includes(actor.role)) throw new ApiError(403, "FORBIDDEN", "insufficient permission");
    const row = await load(id);
    await assertCanReadProject(actor, row.projectId);
    if (row.status === VariationStatus.UNDER_REVIEW) return row;
    if (row.status !== VariationStatus.OPEN) throw new ApiError(409, "CONFLICT", "only an open variation can enter review");
    const changed = await prisma.contractVariation.updateMany({
      where: { id, status: VariationStatus.OPEN },
      data: { status: VariationStatus.UNDER_REVIEW, reviewedById: actor.id, reviewedAt: new Date() },
    });
    if (changed.count === 0) {
      const current = await load(id);
      if (current.status === VariationStatus.UNDER_REVIEW) return current;
      throw new ApiError(409, "CONFLICT", "only an open variation can enter review");
    }
    return load(id);
  },

  async resolve(input: { actor: PublicUser; id: string; status: VariationStatus; decision: string; note: string }): Promise<{ variation: VariationRecord; resolution: VariationRecord["resolutions"][number]; blockchainProof: ProofView | null }> {
    if (!resolverRoles.includes(input.actor.role)) throw new ApiError(403, "FORBIDDEN", "insufficient permission");
    const decision = requiredText(input.decision, "decision");
    const note = requiredText(input.note, "note");
    let row = await load(input.id);
    await assertCanReadProject(input.actor, row.projectId);
    let resolution = row.resolutions[0];
    if (resolution) {
      if (resolution.status !== input.status || resolution.decision !== decision || resolution.note !== note) {
        throw new ApiError(409, "CONFLICT", "variation already has a different resolution");
      }
    } else {
      if (row.status !== VariationStatus.OPEN && row.status !== VariationStatus.UNDER_REVIEW) throw new ApiError(409, "CONFLICT", "variation is already closed");
      const proposed = row.proposedState as { project?: Record<string, unknown>; milestone?: Record<string, unknown> | null };
      try {
        resolution = await prisma.$transaction(async (tx) => {
          const current = await tx.contractVariation.findUnique({ where: { id: input.id } });
          if (!current || (current.status !== VariationStatus.OPEN && current.status !== VariationStatus.UNDER_REVIEW)) throw new ApiError(409, "CONFLICT", "variation is already closed");
          if (input.status === VariationStatus.APPROVED) {
            const projectChanges = proposed.project ?? {};
            const projectData = { ...projectChanges };
            for (const dateField of ["contractStartDate", "contractEndDate"]) {
              if (typeof projectData[dateField] === "string") projectData[dateField] = new Date(projectData[dateField] as string);
            }
            if (Object.keys(projectData).length) await tx.project.update({ where: { id: current.projectId }, data: projectData as Prisma.ProjectUpdateInput });
            const milestoneChanges = proposed.milestone;
            if (milestoneChanges && current.milestoneId) {
              const { id: _milestoneId, ...data } = milestoneChanges;
              // A variation may carry a milestone status change. When it does,
              // the transition is appended to the same append-only
              // MilestoneStatusHistory in this transaction, so approved history
              // can never change a milestone status without leaving a record.
              const previousStatus = await currentMilestoneStatus(tx, current.milestoneId);
              const changesStatus = typeof data.status === "string" && data.status !== previousStatus;
              const updated = await tx.milestone.update({
                where: { id: current.milestoneId },
                data: data as Prisma.MilestoneUpdateInput,
              });
              // No artificial entry when the variation did not change the status.
              if (changesStatus) {
                // The same per-milestone ordering the transition service uses, so
                // a variation-driven change lands in one continuous sequence.
                const latest = await tx.milestoneStatusHistory.findFirst({
                  where: { milestoneId: updated.id },
                  orderBy: { sequence: "desc" },
                  select: { sequence: true },
                });
                await tx.milestoneStatusHistory.create({
                  data: {
                    milestoneId: updated.id,
                    sequence: (latest?.sequence ?? -1) + 1,
                    previousStatus,
                    newStatus: updated.status,
                    actorName: input.actor.fullName,
                    actorRole: input.actor.role,
                    reason: `Approved contract variation ${current.variationReference}: ${decision}`,
                  },
                });
              }
            }
          }
          const created = await tx.variationResolution.create({ data: { variationId: current.id, status: input.status, decision, note, resolvedById: input.actor.id }, include: { resolvedBy: { select: { id: true, role: true } } } });
          await tx.contractVariation.update({ where: { id: current.id }, data: { status: input.status } });
          return created;
        });
      } catch (error) {
        if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002") {
          const existing = await prisma.variationResolution.findUnique({ where: { variationId: input.id }, include: { resolvedBy: { select: { id: true, role: true } } } });
          if (existing && existing.status === input.status && existing.decision === decision && existing.note === note) resolution = existing;
          else throw new ApiError(409, "CONFLICT", "variation already has a different resolution");
        } else throw error;
      }
    }
    row = await load(input.id);
    let blockchainProof: ProofView | null = await proof(row);
    const sourceEvent = await prisma.blockchainEvent.findUnique({ where: { id: row.previousEventId } });
    const sourceConfirmed = Boolean(sourceEvent?.txHash && sourceEvent.blockNumber != null && sourceEvent.blockNumber > 0);
    if (input.status === VariationStatus.APPROVED && sourceConfirmed) {
      blockchainProof = await proofService.anchorVariation({ variationId: row.id, projectId: row.projectId, previousEventId: row.previousEventId, variationReference: row.variationReference, actorId: input.actor.id });
      if (blockchainProof) {
        await prisma.contractVariation.update({ where: { id: row.id }, data: { variationEventId: blockchainProof.id } });
        row = await load(row.id);
      }
    }
    return { variation: row, resolution: resolution!, blockchainProof };
  },
};
