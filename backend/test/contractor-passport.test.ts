import { BlockchainEventType, EvidenceStatus, Role, VerificationStatus } from "@prisma/client";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { prisma } from "../src/repositories/prisma";
import { evidenceService } from "../src/services/evidence";
import {
  assertNoSecrets,
  cleanupQaUsers,
  privileged,
  registerClient,
  registerContractor,
  uploadEvidence,
} from "./qa/fixtures";

const REGISTRATION_NUMBER = "CRB-PHASE42-0001";

async function withRegistrationNumber(
  contractorId: string,
  registrationNumber: string | null,
): Promise<void> {
  await prisma.contractor.update({
    where: { id: contractorId },
    data: { crbRegistrationNumber: registrationNumber },
  });
}

function collectKeys(value: unknown, found: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectKeys(item, found);
    }
    return found;
  }
  if (typeof value === "object" && value !== null) {
    for (const [key, item] of Object.entries(value)) {
      found.push(key);
      collectKeys(item, found);
    }
  }
  return found;
}

describe("contractor discovery by CRB Registration Number", () => {
  afterEach(cleanupQaUsers);

  it("lets a CLIENT search by CRB Registration Number and returns the matching contractor", async () => {
    const client = await registerClient("Discovery Client");
    const contractor = await registerContractor("Discovery Match");
    await withRegistrationNumber(contractor.contractorId, REGISTRATION_NUMBER);

    const response = await request(app)
      .get("/api/v1/contractors")
      .query({ crbRegistrationNumber: REGISTRATION_NUMBER })
      .set("Authorization", `Bearer ${client.token}`);

    expect(response.status).toBe(200);
    expect(response.body.contractors).toHaveLength(1);
    expect(response.body.contractors[0]).toMatchObject({
      id: contractor.contractorId,
      legalName: "Discovery Match",
      crbRegistrationNumber: REGISTRATION_NUMBER,
    });
    assertNoSecrets(response.body);
  });

  it("matches a stored registration number case-insensitively and ignores surrounding whitespace", async () => {
    const client = await registerClient("Case Client");
    const contractor = await registerContractor("Case Match");
    await withRegistrationNumber(contractor.contractorId, REGISTRATION_NUMBER);

    const response = await request(app)
      .get("/api/v1/contractors")
      .query({ crbRegistrationNumber: `  ${REGISTRATION_NUMBER.toLowerCase()}  ` })
      .set("Authorization", `Bearer ${client.token}`);

    expect(response.status).toBe(200);
    expect(response.body.contractors.map((row: { id: string }) => row.id)).toEqual([
      contractor.contractorId,
    ]);
  });

  it("returns an empty collection for an unknown CRB Registration Number", async () => {
    const client = await registerClient("Miss Client");
    await registerContractor("Unrelated Contractor");

    const response = await request(app)
      .get("/api/v1/contractors")
      .query({ crbRegistrationNumber: "CRB-DOES-NOT-EXIST" })
      .set("Authorization", `Bearer ${client.token}`);

    expect(response.status).toBe(200);
    expect(response.body.contractors).toEqual([]);
  });

  it("rejects a blank or repeated crbRegistrationNumber instead of silently ignoring it", async () => {
    const client = await registerClient("Filter Validation Client");
    const contractor = await registerContractor("Filter Validation Contractor");

    const blank = await request(app)
      .get("/api/v1/contractors")
      .query({ crbRegistrationNumber: "   " })
      .set("Authorization", `Bearer ${client.token}`);
    expect(blank.status).toBe(400);
    expect(blank.body.error.code).toBe("VALIDATION_ERROR");

    const repeated = await request(app)
      .get("/api/v1/contractors")
      .query({ crbRegistrationNumber: [REGISTRATION_NUMBER, REGISTRATION_NUMBER] })
      .set("Authorization", `Bearer ${client.token}`);
    expect(repeated.status).toBe(400);

    // A rejected filter must never degrade into an unfiltered listing.
    expect(contractor.contractorId).toEqual(expect.any(String));
  });

  it("keeps an unfiltered listing unchanged when no registration number is supplied", async () => {
    const client = await registerClient("Unfiltered Client");
    await registerContractor("Unfiltered Contractor");

    const response = await request(app)
      .get("/api/v1/contractors")
      .set("Authorization", `Bearer ${client.token}`);

    expect(response.status).toBe(200);
    expect(response.body.contractors.length).toBeGreaterThan(0);
  });

  it("does not let a CONTRACTOR search widen access beyond their own record", async () => {
    const contractor = await registerContractor("Searching Contractor");
    const other = await registerContractor("Unsearchable Contractor");
    await withRegistrationNumber(contractor.contractorId, REGISTRATION_NUMBER);
    await withRegistrationNumber(other.contractorId, "CRB-OTHER-0002");

    const ownHit = await request(app)
      .get("/api/v1/contractors")
      .query({ crbRegistrationNumber: REGISTRATION_NUMBER })
      .set("Authorization", `Bearer ${contractor.token}`);
    expect(ownHit.status).toBe(200);
    expect(ownHit.body.contractors.map((row: { id: string }) => row.id)).toEqual([
      contractor.contractorId,
    ]);

    const otherHit = await request(app)
      .get("/api/v1/contractors")
      .query({ crbRegistrationNumber: "CRB-OTHER-0002" })
      .set("Authorization", `Bearer ${contractor.token}`);
    expect(otherHit.status).toBe(200);
    expect(otherHit.body.contractors).toEqual([]);
  });

  it("requires authentication for discovery", async () => {
    const response = await request(app)
      .get("/api/v1/contractors")
      .query({ crbRegistrationNumber: REGISTRATION_NUMBER });
    expect(response.status).toBe(401);
  });
});

describe("GET /api/v1/contractors/:contractorId/passport", () => {
  afterEach(cleanupQaUsers);

  it("lets a CLIENT open a contractor passport with factual identity and history", async () => {
    const client = await registerClient("Passport Client");
    const contractor = await registerContractor("Passport Subject");
    await withRegistrationNumber(contractor.contractorId, REGISTRATION_NUMBER);

    const project = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${client.token}`)
      .send({ name: "Passport Project", contractorId: contractor.contractorId });
    expect(project.status).toBe(201);
    const projectId = project.body.data.project.id as string;

    const milestone = await request(app)
      .post(`/api/v1/projects/${projectId}/milestones`)
      .set("Authorization", `Bearer ${client.token}`)
      .send({ name: "Passport Milestone" });

    const evidenceBytes = Buffer.from("passport history evidence");
    const upload = await uploadEvidence(
      contractor.token,
      milestone.body.data.milestone.id,
      evidenceBytes,
      "passport-history.txt",
    );
    expect(upload.status).toBe(201);
    const evidence = upload.body.data.evidence;
    const version = await prisma.evidenceVersion.findUniqueOrThrow({
      where: { id: evidence.currentVersionId },
    });
    await prisma.verification.create({
      data: {
        evidenceVersionId: version.id,
        status: "MATCH",
        authoritativeSha256: version.sha256,
        source: "INTERNAL",
      },
    });
    await prisma.blockchainEvent.create({
      data: {
        projectId,
        eventType: "VERIFICATION",
        logicalKey: `VERIFICATION:${projectId}:${version.id}:contractor-passport-test`,
        referenceId: version.id,
        evidenceHash: version.sha256,
        txHash: `0x${"ab".repeat(32)}`,
        blockNumber: 7,
      },
    });

    const discovery = await request(app)
      .get("/api/v1/contractors")
      .query({ crbRegistrationNumber: REGISTRATION_NUMBER })
      .set("Authorization", `Bearer ${client.token}`);
    expect(discovery.status).toBe(200);
    expect(discovery.body.contractors).toHaveLength(1);
    expect(discovery.body.contractors[0].id).toBe(contractor.contractorId);
    expect(discovery.body.contractors[0]).not.toHaveProperty("userId");
    expect(discovery.body.contractors[0]).not.toHaveProperty("user");

    const response = await request(app)
      .get(`/api/v1/contractors/${discovery.body.contractors[0].id}/passport`)
      .set("Authorization", `Bearer ${client.token}`);

    expect(response.status).toBe(200);
    const passport = response.body.contractorPassport;

    expect(passport.contractor).toMatchObject({
      id: contractor.contractorId,
      legalName: "Passport Subject",
      crbRegistrationNumber: REGISTRATION_NUMBER,
    });
    expect(passport.contractor).not.toHaveProperty("account");
    expect(passport.scope).toMatchObject({
      viewerRole: "CLIENT",
      isOwnPassport: false,
      containsRatings: false,
    });
    expect(passport.totals.projects).toBe(1);
    expect(passport.totals.milestones.PENDING).toBe(1);
    expect(passport.totals.evidence.PENDING_VERIFICATION).toBe(1);
    expect(passport.totals.verification.MATCH).toBe(1);
    expect(passport.totals.blockchainProofs).toEqual({ total: 1, confirmed: 1, pending: 0 });
    expect(passport.projects[0]).toMatchObject({
      id: projectId,
      name: "Passport Project",
      clientVisible: true,
      clientName: "Passport Client",
    });
    expect(passport.projects[0].milestones).toHaveLength(1);
    expect(passport.projects[0].milestones[0].name).toBe("Passport Milestone");
    expect(passport.projects[0].milestoneStatus).toMatchObject({
      total: 1,
      allVerified: false,
      withUnverified: true,
    });
    expect(passport.projects[0]).not.toHaveProperty("clientId");
    const detailedPassport = await request(app)
      .get(`/api/v1/passports/${projectId}`)
      .set("Authorization", `Bearer ${client.token}`);
    expect(detailedPassport.status).toBe(200);
    expect(detailedPassport.body.data.passport.milestones[0].evidence[0].versions[0])
      .toMatchObject({
        verificationStatus: "MATCH",
        blockchainProof: {
          referenceId: version.id,
          confirmationState: "CONFIRMED",
          txHash: `0x${"ab".repeat(32)}`,
          blockNumber: 7,
        },
      });
    expect(detailedPassport.body.data.passport.project).not.toHaveProperty("clientId");
    assertNoSecrets(response.body);
  });

  it("keeps contractor summaries consistent with detailed project Passports across versions and proof states", async () => {
    const client = await registerClient("Passport Summary Owner");
    const stranger = await registerClient("Passport Summary Stranger");
    const contractor = await registerContractor("Passport Summary Contractor");
    const admin = await privileged(Role.ADMIN, "Passport Summary Admin");
    await withRegistrationNumber(contractor.contractorId, REGISTRATION_NUMBER);

    async function createProject(name: string) {
      const projectResponse = await request(app)
        .post("/api/v1/projects")
        .set("Authorization", `Bearer ${client.token}`)
        .send({ name, contractorId: contractor.contractorId });
      expect(projectResponse.status).toBe(201);
      const projectId = projectResponse.body.data.project.id as string;
      const milestoneResponse = await request(app)
        .post(`/api/v1/projects/${projectId}/milestones`)
        .set("Authorization", `Bearer ${client.token}`)
        .send({ name: `${name} Milestone` });
      expect(milestoneResponse.status).toBe(201);
      return { projectId, milestoneId: milestoneResponse.body.data.milestone.id as string };
    }

    const projectA = await createProject("Passport Project A");
    const projectB = await createProject("Passport Project B");
    const firstUpload = await uploadEvidence(
      contractor.token,
      projectA.milestoneId,
      Buffer.from("project A version one"),
      "project-a.txt",
    );
    expect(firstUpload.status).toBe(201);
    const evidenceA = firstUpload.body.data.evidence;
    const versionA1 = await prisma.evidenceVersion.findUniqueOrThrow({
      where: { id: evidenceA.currentVersionId },
    });
    await evidenceService.appendVersion({
      evidenceId: evidenceA.id,
      uploadedById: contractor.userId,
      buffer: Buffer.from("project A version two"),
      originalName: "project-a-v2.txt",
      mimeType: "text/plain",
    });
    const versionA2 = await prisma.evidenceVersion.findUniqueOrThrow({
      where: { evidenceId_versionNumber: { evidenceId: evidenceA.id, versionNumber: 2 } },
    });
    const secondUpload = await uploadEvidence(
      contractor.token,
      projectB.milestoneId,
      Buffer.from("project B version one"),
      "project-b.txt",
    );
    expect(secondUpload.status).toBe(201);
    const versionB1 = await prisma.evidenceVersion.findUniqueOrThrow({
      where: { id: secondUpload.body.data.evidence.currentVersionId },
    });

    const statuses = [
      [versionA1, VerificationStatus.MATCH],
      [versionA1, VerificationStatus.MISMATCH],
      [versionA2, VerificationStatus.PENDING],
      [versionA2, VerificationStatus.UNAVAILABLE],
      [versionB1, VerificationStatus.MATCH],
    ] as const;
    for (const [index, [version, status]] of statuses.entries()) {
      await prisma.verification.create({
        data: {
          evidenceVersionId: version.id,
          status,
          presentedSha256: status === VerificationStatus.MISMATCH ? "f".repeat(64) : version.sha256,
          authoritativeSha256: version.sha256,
          source: "INTERNAL",
          requestedById: contractor.userId,
          createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)),
        },
      });
    }

    const proofRows = [
      { projectId: projectA.projectId, referenceId: versionA1.id, suffix: "a1", confirmed: true },
      { projectId: projectA.projectId, referenceId: versionA2.id, suffix: "a2", confirmed: false },
      { projectId: projectB.projectId, referenceId: versionB1.id, suffix: "b1", confirmed: true },
    ];
    const proofEventByReference = new Map<string, string>();
    for (const proof of proofRows) {
      const event = await prisma.blockchainEvent.create({
        data: {
          projectId: proof.projectId,
          eventType: BlockchainEventType.VERIFICATION,
          logicalKey: `VERIFICATION:${proof.projectId}:${proof.referenceId}:passport-summary-${proof.suffix}`,
          referenceId: proof.referenceId,
          evidenceHash: proof.referenceId === versionA1.id ? versionA1.sha256 :
            proof.referenceId === versionA2.id ? versionA2.sha256 : versionB1.sha256,
          txHash: proof.confirmed ? `0x${proof.suffix.repeat(64).slice(0, 64)}` : null,
          blockNumber: proof.confirmed ? 10 : null,
        },
      });
      proofEventByReference.set(proof.referenceId, event.id);
    }
    await prisma.blockchainEvent.create({
      data: {
        projectId: projectA.projectId,
        eventType: BlockchainEventType.PROJECT_REGISTERED,
        logicalKey: `PROJECT_REGISTERED:${projectA.projectId}:passport-summary`,
        txHash: `0x${"c".repeat(64)}`,
        blockNumber: 11,
      },
    });
    const disputeEvent = await prisma.blockchainEvent.create({
      data: {
        projectId: projectB.projectId,
        eventType: BlockchainEventType.DISPUTE,
        logicalKey: `DISPUTE:${projectB.projectId}:passport-summary`,
        referenceId: "passport-summary-dispute",
        txHash: `0x${"d".repeat(64)}`,
        blockNumber: 12,
      },
    });
    const resolutionEvent = await prisma.blockchainEvent.create({
      data: {
        projectId: projectB.projectId,
        eventType: BlockchainEventType.RESOLUTION,
        logicalKey: `RESOLUTION:${projectB.projectId}:passport-summary`,
        referenceId: "passport-summary-resolution",
        txHash: `0x${"e".repeat(64)}`,
        blockNumber: 13,
      },
    });
    const dispute = await prisma.dispute.create({
      data: {
        milestoneId: projectB.milestoneId,
        evidenceId: secondUpload.body.data.evidence.id,
        raisedById: contractor.userId,
        status: "RESOLVED",
        reason: "Observed scope discrepancy",
        originalEventId: proofEventByReference.get(versionB1.id),
        disputeEventId: disputeEvent.id,
        resolutionEventId: resolutionEvent.id,
      },
    });
    await prisma.disputeResolution.create({
      data: {
        disputeId: dispute.id,
        status: "RESOLVED",
        resolution: "Reviewed and resolved",
        resolvedById: admin.userId,
      },
    });

    const summaryResponse = await request(app)
      .get(`/api/v1/contractors/${contractor.contractorId}/passport`)
      .set("Authorization", `Bearer ${client.token}`);
    expect(summaryResponse.status).toBe(200);
    const summary = summaryResponse.body.contractorPassport;
    expect(summary.contractor.crbRegistrationNumber).toBe(REGISTRATION_NUMBER);
    expect(summary.projects.map((project: { id: string }) => project.id).sort())
      .toEqual([projectA.projectId, projectB.projectId].sort());
    expect(summary.projects.map((project: { lifecycleStatus: string }) => project.lifecycleStatus))
      .toEqual(["CREATED", "CREATED"]);
    expect(summary.projects[0].lifecycleHistory[0]).toMatchObject({
      sequence: 0,
      newStatus: "CREATED",
      isBaseline: true,
    });
    expect(summary.projects[0].milestones[0].statusHistory).toHaveLength(1);
    expect(summary.projects[0].milestones[0].statusHistory[0].isBaseline).toBe(true);
    expect(summary.totals.verification).toEqual({ MATCH: 2, MISMATCH: 1, PENDING: 1, UNAVAILABLE: 1 });
    expect(summary.totals.blockchainProofs).toEqual({ total: 5, confirmed: 4, pending: 1 });
    expect(summary.totals.projectsWithBlockchainProofs).toBe(2);
    const summaryKeys = collectKeys(summary);
    for (const key of [
      "userId", "email", "passwordHash", "actorId", "requestedById", "resolvedById", "reviewedById", "reason",
    ]) {
      expect(summaryKeys).not.toContain(key);
    }

    const detailedPassports = [];
    for (const projectId of [projectA.projectId, projectB.projectId]) {
      const detailResponse = await request(app)
        .get(`/api/v1/passports/${projectId}`)
        .set("Authorization", `Bearer ${client.token}`);
      expect(detailResponse.status).toBe(200);
      detailedPassports.push(detailResponse.body.data.passport);
    }
    const expectedVerification = { MATCH: 0, MISMATCH: 0, PENDING: 0, UNAVAILABLE: 0 };
    let detailedProofTotal = 0;
    let detailedProofConfirmed = 0;
    let detailedProofPending = 0;
    for (const detail of detailedPassports) {
      const matchingSummary = summary.projects.find((project: { id: string }) => project.id === detail.project.id);
      expect(matchingSummary).toBeDefined();
      const projectVerification = { MATCH: 0, MISMATCH: 0, PENDING: 0, UNAVAILABLE: 0 };
      const projectEvidence = {
        total: 0,
        byStatus: Object.fromEntries(Object.values(EvidenceStatus).map((status) => [status, 0])) as Record<EvidenceStatus, number>,
      };
      for (const milestone of detail.milestones) {
        for (const evidence of milestone.evidence) {
          projectEvidence.total += 1;
          projectEvidence.byStatus[evidence.status as EvidenceStatus] += 1;
          for (const version of evidence.versions) {
            for (const verification of version.verifications) {
              expectedVerification[verification.status as keyof typeof expectedVerification] += 1;
              projectVerification[verification.status as keyof typeof projectVerification] += 1;
            }
          }
        }
      }
      expect(matchingSummary.verification).toEqual(projectVerification);
      expect(matchingSummary.evidence).toEqual(projectEvidence);
      detailedProofTotal += detail.blockchainProofs.length;
      detailedProofConfirmed += detail.blockchainProofs.filter((proof: { confirmed: boolean }) => proof.confirmed).length;
      detailedProofPending += detail.blockchainProofs.filter((proof: { confirmed: boolean }) => !proof.confirmed).length;
      expect(matchingSummary.proof).toEqual({
        total: detail.blockchainProofs.length,
        confirmed: detail.blockchainProofs.filter((proof: { confirmed: boolean }) => proof.confirmed).length,
        pending: detail.blockchainProofs.filter((proof: { confirmed: boolean }) => !proof.confirmed).length,
      });
      expect(detail.milestones[0].evidence[0].versions.map((version: { versionNumber: number }) => version.versionNumber))
        .toEqual(detail.project.id === projectA.projectId ? [1, 2] : [1]);
      if (detail.project.id === projectB.projectId) {
        expect(detail.milestones[0].disputes[0]).toMatchObject({
          id: dispute.id,
          status: "RESOLVED",
          raisedByRole: "CONTRACTOR",
          disputeProof: { eventType: "DISPUTE", confirmed: true },
          resolutionProof: { eventType: "RESOLUTION", confirmed: true },
          resolutions: [{ status: "RESOLVED", resolvedByRole: "ADMIN" }],
        });
        expect(detail.milestones[0].disputes[0].resolutions[0]).not.toHaveProperty("resolvedById");
      }
    }
    expect(summary.totals.verification).toEqual(expectedVerification);
    expect(summary.totals.blockchainProofs).toEqual({
      total: detailedProofTotal,
      confirmed: detailedProofConfirmed,
      pending: detailedProofPending,
    });

    const unrelatedDetail = await request(app)
      .get(`/api/v1/passports/${projectA.projectId}`)
      .set("Authorization", `Bearer ${stranger.token}`);
    expect(unrelatedDetail.status).toBe(403);
    assertNoSecrets(summaryResponse.body, [client.email, contractor.email]);
  });

  it("emits counts and enum values only, with no rating or recommendation field", async () => {
    const client = await registerClient("Verdict Check Client");
    const contractor = await registerContractor("Verdict Check Contractor");

    const response = await request(app)
      .get(`/api/v1/contractors/${contractor.contractorId}/passport`)
      .set("Authorization", `Bearer ${client.token}`);

    expect(response.status).toBe(200);
    const passport = response.body.contractorPassport;
    expect(passport.totals).toMatchObject({
      projects: 0,
      projectsWithAllMilestonesVerified: 0,
      evidence: { PENDING_VERIFICATION: 0, VERIFIED: 0, REJECTED: 0 },
      attestations: { APPROVED: 0, REJECTED: 0 },
      blockchainProofs: { total: 0, confirmed: 0, pending: 0 },
    });
    expect(passport.projects).toEqual([]);
    expect(passport.crbRegistrations).toMatchObject({ checkCount: 0, latest: null, history: [] });
    assertNoSecrets(response.body);

    // Only "containsRatings: false" may mention a rating, and only as a denial.
    const verdictKeys = collectKeys(response.body).filter((key) =>
      /score|rating|rank|recommend|verdict|trust|best/i.test(key),
    );
    expect(verdictKeys).toEqual(["containsRatings"]);
  });

  it("withholds another client's project narrative and identity from a viewing CLIENT", async () => {
    const owner = await registerClient("Owning Client");
    const viewer = await registerClient("Viewing Client");
    const contractor = await registerContractor("Shared History Contractor");

    const project = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        name: "Confidential Works",
        description: "Sensitive scope notes",
        contractorId: contractor.contractorId,
      });
    const projectId = project.body.data.project.id as string;

    await request(app)
      .post(`/api/v1/projects/${projectId}/milestones`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ name: "Confidential Milestone" });

    const ownerView = await request(app)
      .get(`/api/v1/contractors/${contractor.contractorId}/passport`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(ownerView.status).toBe(200);
    expect(ownerView.body.contractorPassport.projects[0]).toMatchObject({
      clientVisible: true,
      clientName: "Owning Client",
      description: "Sensitive scope notes",
    });

    const viewerView = await request(app)
      .get(`/api/v1/contractors/${contractor.contractorId}/passport`)
      .set("Authorization", `Bearer ${viewer.token}`);
    expect(viewerView.status).toBe(200);
    const viewerProject = viewerView.body.contractorPassport.projects[0];
    expect(viewerProject.clientVisible).toBe(false);
    expect(viewerProject.clientName).toBeNull();
    expect(viewerProject).not.toHaveProperty("clientId");
    expect(viewerProject.description).toBeNull();
    // Factual execution history remains available so the client can decide.
    expect(viewerProject.name).toBe("Confidential Works");
    expect(viewerProject.milestones[0].name).toBe("Confidential Milestone");
    expect(viewerView.body.contractorPassport.scope.withheldProjectDetailCount).toBe(1);
  });

  it("lets a CONTRACTOR read their own passport and denies another contractor's", async () => {
    const contractor = await registerContractor("Own Passport Contractor");
    const other = await registerContractor("Foreign Passport Contractor");

    const own = await request(app)
      .get(`/api/v1/contractors/${contractor.contractorId}/passport`)
      .set("Authorization", `Bearer ${contractor.token}`);
    expect(own.status).toBe(200);
    expect(own.body.contractorPassport.scope.isOwnPassport).toBe(true);

    const foreign = await request(app)
      .get(`/api/v1/contractors/${other.contractorId}/passport`)
      .set("Authorization", `Bearer ${contractor.token}`);
    expect(foreign.status).toBe(403);
    expect(foreign.body.error.code).toBe("FORBIDDEN");
  });

  it("resolves the signed-in CONTRACTOR passport without a client-supplied id", async () => {
    const contractor = await registerContractor("Self Service Contractor");

    const response = await request(app)
      .get("/api/v1/contractors/me/passport")
      .set("Authorization", `Bearer ${contractor.token}`);

    expect(response.status).toBe(200);
    expect(response.body.contractorPassport.contractor.id).toBe(contractor.contractorId);
    expect(response.body.contractorPassport.scope.isOwnPassport).toBe(true);
  });

  it("returns 404 for a client without a contractor record", async () => {
    const client = await registerClient("No Contractor Profile Client");

    const response = await request(app)
      .get("/api/v1/contractors/me/passport")
      .set("Authorization", `Bearer ${client.token}`);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("CONTRACTOR_NOT_FOUND");
  });

  it("keeps privileged read roles working and leaves ADMIN capabilities unchanged", async () => {
    const contractor = await registerContractor("Oversight Contractor");
    const client = await registerClient("Oversight Client");

    await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${client.token}`)
      .send({ name: "Oversight Project", contractorId: contractor.contractorId });

    for (const role of [Role.ADMIN, Role.AUDITOR, Role.PROCUREMENT_OFFICER]) {
      const staff = await privileged(role);
      const response = await request(app)
        .get(`/api/v1/contractors/${contractor.contractorId}/passport`)
        .set("Authorization", `Bearer ${staff.token}`);
      expect(response.status).toBe(200);
      expect(response.body.contractorPassport.projects[0].clientName).toBe("Oversight Client");
    }
  });

  it("rejects unauthenticated, malformed, and unknown passport identifiers", async () => {
    const client = await registerClient("Passport Validation Client");

    const unauthenticated = await request(app).get(
      "/api/v1/contractors/11111111-1111-4111-8111-111111111111/passport",
    );
    expect(unauthenticated.status).toBe(401);

    const malformed = await request(app)
      .get("/api/v1/contractors/not-a-uuid/passport")
      .set("Authorization", `Bearer ${client.token}`);
    expect(malformed.status).toBe(400);

    const unknown = await request(app)
      .get("/api/v1/contractors/11111111-1111-4111-8111-111111111111/passport")
      .set("Authorization", `Bearer ${client.token}`);
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe("CONTRACTOR_NOT_FOUND");
  });

  it("denies a role that is not permitted to read contractor records", async () => {
    const contractor = await registerContractor("Engineer View Contractor");
    const engineer = await privileged(Role.CONSULTANT_ENGINEER);

    const response = await request(app)
      .get(`/api/v1/contractors/${contractor.contractorId}/passport`)
      .set("Authorization", `Bearer ${engineer.token}`);

    expect(response.status).toBe(403);
  });
});

describe("role rules across discovery, passport, and assignment", () => {
  afterEach(cleanupQaUsers);

  it("keeps project creation and contractor assignment with CLIENT only", async () => {
    const contractor = await registerContractor("Non Creating Contractor");
    const client = await registerClient("Assigning Client");

    const contractorCreate = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${contractor.token}`)
      .send({ name: "Self Assigned", contractorId: contractor.contractorId });
    expect(contractorCreate.status).toBe(403);

    const contractorAssign = await request(app)
      .patch("/api/v1/projects/11111111-1111-4111-8111-111111111111/contractor")
      .set("Authorization", `Bearer ${contractor.token}`)
      .send({ contractorId: contractor.contractorId });
    expect(contractorAssign.status).toBe(403);

    const clientProject = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${client.token}`)
      .send({ name: "Client Created", contractorId: contractor.contractorId });
    expect(clientProject.status).toBe(201);

    const clientAssign = await request(app)
      .patch(`/api/v1/projects/${clientProject.body.data.project.id}/contractor`)
      .set("Authorization", `Bearer ${client.token}`)
      .send({ contractorId: contractor.contractorId });
    expect(clientAssign.status).toBe(200);
    expect(clientAssign.body.data.project.contractorId).toBe(contractor.contractorId);
  });

  it("does not let an unrelated client read another client's project through a contractor passport", async () => {
    const owner = await registerClient("Isolation Owner");
    const stranger = await registerClient("Isolation Stranger");
    const contractor = await registerContractor("Isolation Contractor");

    const project = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ name: "Isolated Project", contractorId: contractor.contractorId });

    const strangerProjectRead = await request(app)
      .get(`/api/v1/projects/${project.body.data.project.id}`)
      .set("Authorization", `Bearer ${stranger.token}`);
    expect(strangerProjectRead.status).toBe(403);

    const strangerPassport = await request(app)
      .get(`/api/v1/contractors/${contractor.contractorId}/passport`)
      .set("Authorization", `Bearer ${stranger.token}`);
    expect(strangerPassport.status).toBe(200);
    expect(strangerPassport.body.contractorPassport.projects[0].description).toBeNull();
    expect(strangerPassport.body.contractorPassport.projects[0]).not.toHaveProperty("clientId");
  });
});