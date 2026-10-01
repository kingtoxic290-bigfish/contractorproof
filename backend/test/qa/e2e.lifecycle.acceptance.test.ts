import request from "supertest";
import { BlockchainEventType, Role } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../../src/app";
import { BlockchainService } from "../../src/blockchain/BlockchainService";
import { prisma } from "../../src/repositories/prisma";
import { sha256Buffer } from "../../src/utils/hash";
import { setProofBlockchainWriterFactory } from "../../src/services/proof.service";
import {
  assertNoSecrets,
  cleanupQaUsers,
  independentSha256,
  privileged,
  registerClient,
  registerContractor,
} from "./fixtures";
import {
  deployContractorProofRegistry,
  ensureLocalHardhat,
  HARDHAT_CHAIN_ID,
  HARDHAT_TEST_PRIVATE_KEY,
  stopQaHardhat,
} from "./hardhat";

/**
 * PHASE 2 acceptance scenario.
 *
 * Exercises the complete real product lifecycle over HTTP against a live local
 * Hardhat chain — no mocked proof writer:
 *
 *   CLIENT creates project -> creates milestones -> assigns CONTRACTOR A
 *   CONTRACTOR A sees only the assigned project, submits evidence
 *   SYSTEM stores the file off-chain, computes SHA-256, verifies technically
 *   CLIENT reviews evidence (correction / dispute) without touching the
 *     cryptographic result
 *   AUTHORIZED ATTESTOR attests; unauthorized roles are refused
 *   blockchain proof is confirmed on chain
 *   passport reflects the whole history; public verification confirms it
 *   tampering with the evidence yields MISMATCH, never MATCH
 *
 * This file owns a dedicated Hardhat node on its own port. Vitest runs test
 * files in parallel, and every live transaction is sent from Hardhat account #0,
 * so sharing the suite-wide node would race nonces against the other live-chain
 * file. An isolated node keeps this scenario deterministic.
 */
const ACCEPTANCE_RPC_URL = "http://127.0.0.1:8546";
const ACCEPTANCE_CHAIN_PORT = 8546;

const PROJECT_NAME = "Morogoro Municipal Office Renovation";
const MILESTONE_NAMES = ["Site Preparation", "Foundation Works", "Structural Works"] as const;

/** Deterministic payloads so every SHA-256 in this file is reproducible. */
const EVIDENCE_A = Buffer.from(
  "morogoro-municipal-office-renovation/site-preparation/v1/photographic-survey",
);
const TAMPERED_B = Buffer.from(
  "morogoro-municipal-office-renovation/site-preparation/v2/TAMPERED-payload",
);

const HASH_A = sha256Buffer(EVIDENCE_A);
const HASH_B = sha256Buffer(TAMPERED_B);

type Account = { token: string; userId: string };

const CTX: {
  client: Account;
  contractorA: Account & { contractorId: string };
  contractorB: Account & { contractorId: string };
  attestor: Account;
  projectId: string;
  milestones: Record<string, string>;
  evidenceId: string;
  evidenceVersionId: string;
  verificationId: string;
  verificationProofId: string | null;
  attestationId: string;
  attestationProofId: string | null;
} = {
  client: { token: "", userId: "" },
  contractorA: { token: "", userId: "", contractorId: "" },
  contractorB: { token: "", userId: "", contractorId: "" },
  attestor: { token: "", userId: "" },
  projectId: "",
  milestones: {},
  evidenceId: "",
  evidenceVersionId: "",
  verificationId: "",
  verificationProofId: null,
  attestationId: "",
  attestationProofId: null,
};

function auth(token: string) {
  return `Bearer ${token}`;
}

async function createProjectAndMilestones() {
  // Contractor B is bound first so that the later reassignment to Contractor A
  // is a real state change and B's continued denial is a real IDOR assertion.
  const created = await request(app)
    .post("/api/v1/projects")
    .set("Authorization", auth(CTX.client.token))
    .send({
      name: PROJECT_NAME,
      description: "Renovation of the Morogoro municipal office block.",
      contractorId: CTX.contractorB.contractorId,
      procuringEntity: "Morogoro Municipal Council",
      contractStatus: "ACTIVE",
    });
  expect(created.status).toBe(201);
  CTX.projectId = created.body.data.project.id;

  for (const name of MILESTONE_NAMES) {
    const milestone = await request(app)
      .post(`/api/v1/projects/${CTX.projectId}/milestones`)
      .set("Authorization", auth(CTX.client.token))
      .send({ name });
    expect(milestone.status).toBe(201);
    expect(milestone.body.data.milestone.projectId).toBe(CTX.projectId);
    CTX.milestones[name] = milestone.body.data.milestone.id;
  }

  const fetched = await request(app)
    .get(`/api/v1/projects/${CTX.projectId}`)
    .set("Authorization", auth(CTX.client.token));
  expect(fetched.status).toBe(200);
  expect(fetched.body.project.name).toBe(PROJECT_NAME);

  const listed = await request(app)
    .get(`/api/v1/projects/${CTX.projectId}/milestones`)
    .set("Authorization", auth(CTX.client.token));
  expect(listed.status).toBe(200);
  expect(listed.body.milestones).toHaveLength(3);
}

describe.sequential("PHASE-2 acceptance: complete product lifecycle", () => {
  let live = false;
  let contractAddress = "";

  beforeAll(async () => {
    live = await ensureLocalHardhat(ACCEPTANCE_RPC_URL, ACCEPTANCE_CHAIN_PORT);
    if (live) {
      const deployed = await deployContractorProofRegistry(ACCEPTANCE_RPC_URL);
      contractAddress = deployed.address;
    }
  }, 45_000);

  afterAll(async () => {
    setProofBlockchainWriterFactory();
    await cleanupQaUsers();
    stopQaHardhat();
  });

  it("STEP 1-3 | client creates project + milestones and assigns CONTRACTOR A", async () => {
    expect(live, "local Hardhat RPC is required for this acceptance scenario").toBe(true);

    CTX.client = await registerClient("Morogoro Client");
    CTX.contractorA = await registerContractor("Contractor A");
    CTX.contractorB = await registerContractor("Contractor B");
    CTX.attestor = await privileged(Role.PROCUREMENT_OFFICER, "Morogoro Attestor");

    // Point the app at the live chain rather than a mocked writer.
    setProofBlockchainWriterFactory(
      () =>
        new BlockchainService({
          rpcUrl: ACCEPTANCE_RPC_URL,
          contractAddress,
          privateKey: HARDHAT_TEST_PRIVATE_KEY,
          chainId: HARDHAT_CHAIN_ID,
          confirmations: 1,
        }),
    );

    await createProjectAndMilestones();

    // A contractor can never create a project, whatever the role gate says.
    const contractorCreates = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", auth(CTX.contractorA.token))
      .send({ name: "Unauthorised Project", contractorId: CTX.contractorA.contractorId });
    expect(contractorCreates.status).toBe(403);

    const assigned = await request(app)
      .patch(`/api/v1/projects/${CTX.projectId}/contractor`)
      .set("Authorization", auth(CTX.client.token))
      .send({ contractorId: CTX.contractorA.contractorId });
    expect(assigned.status).toBe(200);
    expect(assigned.body.data.project.contractorId).toBe(CTX.contractorA.contractorId);

    const persisted = await prisma.project.findUnique({ where: { id: CTX.projectId } });
    expect(persisted?.clientId).toBe(CTX.client.userId);
    expect(persisted?.contractorId).toBe(CTX.contractorA.contractorId);

    // A stranger client cannot create milestones on another client's project.
    const otherClient = await registerClient("Unrelated Client");
    const foreignMilestone = await request(app)
      .post(`/api/v1/projects/${CTX.projectId}/milestones`)
      .set("Authorization", auth(otherClient.token))
      .send({ name: "Injected Milestone" });
    expect(foreignMilestone.status).toBe(403);
  });

  it("STEP 4 | CONTRACTOR A sees the assigned project; CONTRACTOR B is denied (IDOR)", async () => {
    const asA = await request(app)
      .get("/api/v1/projects")
      .set("Authorization", auth(CTX.contractorA.token));
    expect(asA.status).toBe(200);
    const aIds = asA.body.projects.map((p: { id: string }) => p.id);
    expect(aIds).toContain(CTX.projectId);

    const detailA = await request(app)
      .get(`/api/v1/projects/${CTX.projectId}`)
      .set("Authorization", auth(CTX.contractorA.token));
    expect(detailA.status).toBe(200);
    expect(detailA.body.project.contractorId).toBe(CTX.contractorA.contractorId);

    const milestonesA = await request(app)
      .get(`/api/v1/projects/${CTX.projectId}/milestones`)
      .set("Authorization", auth(CTX.contractorA.token));
    expect(milestonesA.status).toBe(200);
    expect(milestonesA.body.milestones).toHaveLength(3);

    // Contractor B was the originally-bound contractor and is now unassigned.
    const listB = await request(app)
      .get("/api/v1/projects")
      .set("Authorization", auth(CTX.contractorB.token));
    expect(listB.status).toBe(200);
    expect(listB.body.projects.map((p: { id: string }) => p.id)).not.toContain(CTX.projectId);

    // Direct IDOR attempt by object reference.
    const detailB = await request(app)
      .get(`/api/v1/projects/${CTX.projectId}`)
      .set("Authorization", auth(CTX.contractorB.token));
    expect(detailB.status).toBe(403);

    const milestonesB = await request(app)
      .get(`/api/v1/projects/${CTX.projectId}/milestones`)
      .set("Authorization", auth(CTX.contractorB.token));
    expect(milestonesB.status).toBe(403);

    // 403 must not invalidate the session: B can still act on its own resources.
    const stillAuthorized = await request(app)
      .get("/api/v1/projects")
      .set("Authorization", auth(CTX.contractorB.token));
    expect(stillAuthorized.status).toBe(200);
  });

  it("STEP 5 | CONTRACTOR A submits evidence; SHA-256 is computed and the file stays off-chain", async () => {
    const milestoneId = CTX.milestones["Site Preparation"];
    const upload = await request(app)
      .post("/api/v1/evidence")
      .set("Authorization", auth(CTX.contractorA.token))
      .field("milestoneId", milestoneId)
      // A client-supplied hash must never be trusted.
      .field("sha256", HASH_B)
      .attach("file", EVIDENCE_A, "site-preparation.jpg");
    expect(upload.status).toBe(201);

    const evidence = upload.body.data.evidence;
    CTX.evidenceId = evidence.id;
    CTX.evidenceVersionId = evidence.currentVersion.id;

    expect(evidence.sha256).toBe(HASH_A);
    expect(independentSha256(EVIDENCE_A)).toBe(HASH_A);
    expect(evidence.verificationStatus).toBe("PENDING");

    const row = await prisma.evidence.findUnique({
      where: { id: CTX.evidenceId },
      include: { versions: true, milestone: { include: { project: true } } },
    });
    expect(row?.milestoneId).toBe(milestoneId);
    expect(row?.milestone.projectId).toBe(CTX.projectId);
    expect(row?.uploadedById).toBe(CTX.contractorA.userId);
    expect(row?.versions[0].sha256).toBe(HASH_A);
    expect(row?.versions[0].versionNumber).toBe(1);

    // The file lives on disk, referenced by an opaque storage key.
    expect(typeof row?.storageKey).toBe("string");
    expect(row?.storageKey).not.toContain(EVIDENCE_A.toString("utf8"));
    // No response field exposes the storage reference.
    assertNoSecrets(upload.body);

    // Only the hash/reference identifiers are ever anchored; never file bytes.
    expect(HASH_A).toMatch(/^[0-9a-f]{64}$/);
  });

  it("STEP 6 | technical verification is system-computed; the client cannot rewrite it", async () => {
    const verified = await request(app)
      .post("/api/v1/verification")
      .set("Authorization", auth(CTX.attestor.token))
      .field("evidenceId", CTX.evidenceId);
    expect(verified.status).toBe(200);

    const verification = verified.body.data.verification;
    CTX.verificationId = verification.id;
    expect(verification.status).toBe("MATCH");
    expect(verification.sha256).toBe(HASH_A);
    expect(["MATCH", "MISMATCH", "PENDING", "UNAVAILABLE"]).toContain(verification.status);

    // The HTTP view is deliberately narrow; the comparison detail lives in the
    // immutable Verification record.
    const storedMatch = await prisma.verification.findUnique({
      where: { id: CTX.verificationId },
    });
    expect(storedMatch?.status).toBe("MATCH");
    expect(storedMatch?.authoritativeSha256).toBe(HASH_A);

    CTX.verificationProofId = verified.body.data.proof?.id ?? null;

    // A mismatch for the same evidence, via a genuinely different payload.
    const mismatched = await request(app)
      .post("/api/v1/verification")
      .set("Authorization", auth(CTX.attestor.token))
      .field("evidenceId", CTX.evidenceId)
      .attach("file", TAMPERED_B, "tampered.jpg");
    expect(mismatched.status).toBe(200);
    expect(mismatched.body.data.verification.status).toBe("MISMATCH");

    const storedMismatch = await prisma.verification.findUnique({
      where: { id: mismatched.body.data.verification.id },
    });
    expect(storedMismatch?.presentedSha256).toBe(HASH_B);
    expect(storedMismatch?.authoritativeSha256).toBe(HASH_A);

    // STEP 6 guard: no client-writable field may change the technical state.
    const attempt = await request(app)
      .post("/api/v1/verification")
      .set("Authorization", auth(CTX.client.token))
      .field("evidenceId", CTX.evidenceId)
      .field("status", "MATCH");
    expect([403, 400]).toContain(attempt.status);

    // Neither the client nor the contractor may run internal verification at all.
    for (const account of [CTX.client, CTX.contractorA, CTX.contractorB]) {
      const denied = await request(app)
        .post("/api/v1/verification")
        .set("Authorization", auth(account.token))
        .field("evidenceId", CTX.evidenceId);
      expect(denied.status).toBe(403);
    }

    // Verification never mutates evidence workflow status.
    const evidenceRow = await prisma.evidence.findUnique({ where: { id: CTX.evidenceId } });
    expect(evidenceRow?.status).toBe("PENDING_VERIFICATION");
  });

  it("STEP 7-9 | client human review (correction + dispute) leaves technical results intact", async () => {
    // Human review applies to the evidence under review, which belongs to the
    // Site Preparation milestone.
    const milestoneId = CTX.milestones["Site Preparation"];
    const dispute = await request(app)
      .post("/api/v1/disputes")
      .set("Authorization", auth(CTX.client.token))
      .send({
        milestoneId,
        reason: "Client disputes the photographic survey quality for this milestone.",
      });
    expect(dispute.status, JSON.stringify(dispute.body)).toBe(201);
    expect(dispute.body.data.dispute.status).toBeDefined();

    const disputeRow = await prisma.dispute.findUnique({
      where: { id: dispute.body.data.dispute.id },
      include: { resolutions: true },
    });
    expect(disputeRow?.raisedById).toBe(CTX.client.userId);

    const correction = await request(app)
      .post("/api/v1/corrections")
      .set("Authorization", auth(CTX.client.token))
      .send({
        milestoneId,
        originalEventId: CTX.verificationProofId,
        reason: "Requesting corrected site-preparation evidence.",
        evidenceId: CTX.evidenceId,
      });
    expect(correction.status, JSON.stringify(correction.body)).toBe(201);
    expect(correction.body.data.correction.originalEventId).toBe(CTX.verificationProofId);

    // Human review must not rewrite the cryptographic verification history.
    const verificationRows = await prisma.verification.findMany({
      where: { evidenceVersion: { evidenceId: CTX.evidenceId } },
      orderBy: { createdAt: "asc" },
    });
    expect(verificationRows).toHaveLength(2);
    expect(verificationRows.map((row) => row.status)).toEqual(["MATCH", "MISMATCH"]);
    const original = verificationRows.find((row) => row.id === CTX.verificationId);
    expect(original?.status).toBe("MATCH");
    expect(original?.authoritativeSha256).toBe(HASH_A);

    // History is append-only: the original version and hash are preserved.
    const versions = await prisma.evidenceVersion.findMany({
      where: { evidenceId: CTX.evidenceId },
      orderBy: { versionNumber: "asc" },
    });
    expect(versions).toHaveLength(1);
    expect(versions[0].sha256).toBe(HASH_A);

    // A contractor cannot resolve a dispute; only privileged roles may.
    const contractorResolve = await request(app)
      .post(`/api/v1/disputes/${dispute.body.data.dispute.id}/resolutions`)
      .set("Authorization", auth(CTX.contractorA.token))
      .send({ status: "RESOLVED", resolution: "contractor self-resolution" });
    expect(contractorResolve.status).toBe(403);
  });

  it("STEP 10 | authorized attestor attests; unauthorized roles are refused", async () => {
    const attested = await request(app)
      .post("/api/v1/attestations")
      .set("Authorization", auth(CTX.attestor.token))
      .send({
        evidenceId: CTX.evidenceId,
        milestoneId: CTX.milestones["Site Preparation"],
        decision: "APPROVED",
        comment: "Evidence accepted for the milestone record.",
      });
    expect(attested.status).toBe(201);
    const attestation = attested.body.data.attestation;
    CTX.attestationId = attestation.id;
    expect(attestation.decision).toBe("APPROVED");
    expect(attestation.verifierRole).toBe("PROCUREMENT_OFFICER");
    CTX.attestationProofId = attested.body.data.proof?.id ?? null;

    const stored = await prisma.attestation.findUnique({ where: { id: CTX.attestationId } });
    expect(stored?.verifierId).toBe(CTX.attestor.userId);
    expect(stored?.evidenceId).toBe(CTX.evidenceId);
    expect(stored?.milestoneId).toBe(CTX.milestones["Site Preparation"]);
    expect(stored?.createdAt).toBeInstanceOf(Date);

    // An attestation must not alter the technical verification result.
    const stillMatch = await prisma.verification.findUnique({ where: { id: CTX.verificationId } });
    expect(stillMatch?.status).toBe("MATCH");

    // CONTRACTOR can never attest, not even their own evidence.
    for (const account of [CTX.contractorA, CTX.contractorB]) {
      const denied = await request(app)
        .post("/api/v1/attestations")
        .set("Authorization", auth(account.token))
        .send({
          evidenceId: CTX.evidenceId,
          milestoneId: CTX.milestones["Site Preparation"],
          decision: "APPROVED",
        });
      expect(denied.status).toBe(403);
    }

    // The client may also attest under the current ATTEST role set, but never
    // their own uploaded evidence, and never as a substitute for verification.
    const clientAttest = await request(app)
      .post("/api/v1/attestations")
      .set("Authorization", auth(CTX.client.token))
      .send({
        evidenceId: CTX.evidenceId,
        milestoneId: CTX.milestones["Site Preparation"],
        decision: "APPROVED",
      });
    expect(clientAttest.status).toBe(201);
    expect(clientAttest.body.data.attestation.verifierRole).toBe("CLIENT");
  });

  it("STEP 11 | blockchain proof is confirmed on the live chain, with no file content", async () => {
    const verificationProof = await prisma.blockchainEvent.findUnique({
      where: { id: CTX.verificationProofId as string },
    });
    expect(verificationProof).not.toBeNull();
    expect(verificationProof?.eventType).toBe("VERIFICATION");
    expect(verificationProof?.projectId).toBe(CTX.projectId);
    expect(verificationProof?.txHash).toMatch(/^0x[0-9a-f]{64}$/i);
    expect(verificationProof?.blockNumber).toBeGreaterThan(0);
    // Only the digest is anchored.
    expect(verificationProof?.evidenceHash).toBe(HASH_A);
    expect(JSON.stringify(verificationProof)).not.toContain(EVIDENCE_A.toString("utf8"));

    const attestationProof = await prisma.blockchainEvent.findFirst({
      where: {
        eventType: "ATTESTATION",
        referenceId: CTX.attestationId,
      },
    });
    expect(attestationProof).not.toBeNull();
    expect(attestationProof?.txHash).toMatch(/^0x[0-9a-f]{64}$/i);
    expect(attestationProof?.blockNumber).toBeGreaterThan(0);
    expect(attestationProof?.projectId).toBe(CTX.projectId);
  });

  it("STEP 12 | contractor passport reflects the full lifecycle and keeps history", async () => {
    const passport = await request(app)
      .get(`/api/v1/passports/${CTX.projectId}`)
      .set("Authorization", auth(CTX.attestor.token));
    expect(passport.status).toBe(200);

    const view = passport.body.data.passport;
    expect(view.contractor.id).toBe(CTX.contractorA.contractorId);
    expect(view.project.id).toBe(CTX.projectId);
    expect(view.milestones).toHaveLength(3);

    const evidence = view.milestones
      .flatMap((m: { evidence: unknown[] }) => m.evidence)
      .find((e: { id: string }) => e.id === CTX.evidenceId);
    expect(evidence).toBeDefined();
    expect(evidence.versions).toHaveLength(1);
    expect(evidence.versions[0].sha256).toBe(HASH_A);
    // Both technical results remain visible as history.
    expect(evidence.versions[0].verifications.map((v: { status: string }) => v.status)).toEqual([
      "MATCH",
      "MISMATCH",
    ]);
    expect(evidence.attestations.length).toBeGreaterThan(0);
    expect(evidence.versions[0].blockchainProof.txHash).toMatch(/^0x[0-9a-f]{64}$/i);

    const correction = view.milestones
      .flatMap((m: { corrections: unknown[] }) => m.corrections)
      .find(
        (c: { originalRecord: { eventId: string } }) =>
          c.originalRecord.eventId === CTX.verificationProofId,
      );
    expect(correction).toBeDefined();
    // The correction keeps pointing at the immutable original record.
    expect(correction.originalRecord.evidenceVersion.sha256).toBe(HASH_A);
    expect(correction.status).toBeDefined();

    // No score of any kind is introduced by the projection.
    assertNoSecrets(passport.body);
    expect(JSON.stringify(passport.body)).not.toMatch(/trustScore|reputation|riskScore|rating/i);

    // An unrelated contractor cannot read the passport.
    const denied = await request(app)
      .get(`/api/v1/passports/${CTX.projectId}`)
      .set("Authorization", auth(CTX.contractorB.token));
    expect(denied.status).toBe(403);
  });

  it("STEP 13-14 | public verification confirms the proof; tampered content is never MATCH", async () => {
    const publicMatch = await request(app)
      .post("/api/v1/public/verify")
      .field("evidenceVersionId", CTX.evidenceVersionId)
      .attach("file", EVIDENCE_A, "site-preparation.jpg");
    expect(publicMatch.status).toBe(200);
    expect(publicMatch.body.data.verification.status).toBe("MATCH");
    expect(publicMatch.body.data.verification.blockchainProof.confirmed).toBe(true);
    expect(publicMatch.body.data.verification.blockchainProof.transactionHash).toMatch(
      /^0x[0-9a-f]{64}$/i,
    );
    expect(publicMatch.body.data.verification.blockchainProof.blockNumber).toBeGreaterThan(0);
    // Public payloads stay public-safe.
    assertNoSecrets(publicMatch.body, [CTX.projectId, CTX.contractorA.userId]);
    expect(publicMatch.body.data.verification.sha256).toBeUndefined();

    const publicTampered = await request(app)
      .post("/api/v1/public/verify")
      .field("evidenceVersionId", CTX.evidenceVersionId)
      .attach("file", TAMPERED_B, "tampered.jpg");
    expect(publicTampered.status).toBe(200);
    expect(publicTampered.body.data.verification.status).toBe("MISMATCH");
    expect(publicTampered.body.data.verification.status).not.toBe("MATCH");

    // A well-formed reference to a record that does not exist must not confirm.
    const unknown = await request(app)
      .post("/api/v1/public/verify")
      .field("evidenceVersionId", "00000000-0000-4000-8000-000000000000")
      .attach("file", EVIDENCE_A, "site-preparation.jpg");
    expect(unknown.status).toBe(200);
    expect(unknown.body.data.verification.status).toBe("UNAVAILABLE");
    assertNoSecrets(unknown.body);
  });

  it("STEP 15 | role matrix holds for the whole scenario", async () => {
    const matrix: Array<[string, () => Promise<{ status: number }>, number]> = [
      [
        "CLIENT creates project",
        () =>
          request(app)
            .post("/api/v1/projects")
            .set("Authorization", auth(CTX.client.token))
            .send({ name: "Permitted", contractorId: CTX.contractorA.contractorId }),
        201,
      ],
      [
        "CONTRACTOR cannot create project",
        () =>
          request(app)
            .post("/api/v1/projects")
            .set("Authorization", auth(CTX.contractorA.token))
            .send({ name: "Forbidden", contractorId: CTX.contractorA.contractorId }),
        403,
      ],
      [
        "CONTRACTOR cannot self-verify",
        () =>
          request(app)
            .post("/api/v1/verification")
            .set("Authorization", auth(CTX.contractorA.token))
            .field("evidenceId", CTX.evidenceId),
        403,
      ],
      [
        "CONTRACTOR cannot attest",
        () =>
          request(app)
            .post("/api/v1/attestations")
            .set("Authorization", auth(CTX.contractorA.token))
            .send({
              evidenceId: CTX.evidenceId,
              milestoneId: CTX.milestones["Site Preparation"],
              decision: "APPROVED",
            }),
        403,
      ],
      [
        "CONTRACTOR B cannot read the project",
        () =>
          request(app)
            .get(`/api/v1/projects/${CTX.projectId}`)
            .set("Authorization", auth(CTX.contractorB.token)),
        403,
      ],
      [
        "unauthenticated cannot attest",
        () =>
          request(app)
            .post("/api/v1/attestations")
            .send({
              evidenceId: CTX.evidenceId,
              milestoneId: CTX.milestones["Site Preparation"],
              decision: "APPROVED",
            }),
        401,
      ],
      [
        "unauthenticated cannot list projects",
        () => request(app).get("/api/v1/projects"),
        401,
      ],
      [
        "unauthenticated public verification still works",
        () =>
          request(app)
            .post("/api/v1/public/verify")
            .field("evidenceVersionId", CTX.evidenceVersionId)
            .attach("file", EVIDENCE_A, "site-preparation.jpg"),
        200,
      ],
    ];

    for (const [label, run, expected] of matrix) {
      const response = await run();
      expect(`${label}: ${response.status}`).toBe(`${label}: ${expected}`);
    }
  });

  it("no evidence file was ever written to the registry", async () => {
    const events = await prisma.blockchainEvent.findMany({
      where: { projectId: CTX.projectId },
    });
    expect(events.length).toBeGreaterThan(0);
    const serialised = JSON.stringify(events);
    expect(serialised).not.toContain(EVIDENCE_A.toString("utf8"));
    expect(serialised).not.toContain(TAMPERED_B.toString("utf8"));
    for (const event of events) {
      expect(Object.values(event)).not.toContain(EVIDENCE_A.toString());
      if (event.evidenceHash) {
        expect(event.evidenceHash).toMatch(/^[0-9a-f]{64}$/);
      }
    }
    expect(
      events.every((e) =>
        [BlockchainEventType.VERIFICATION, BlockchainEventType.ATTESTATION,
          BlockchainEventType.DISPUTE, BlockchainEventType.CORRECTION].includes(e.eventType),
      ),
    ).toBe(true);
  });
});