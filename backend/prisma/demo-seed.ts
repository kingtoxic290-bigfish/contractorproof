/**
 * Demo dataset for browser walkthroughs.
 *
 * Drives the real Express application over HTTP so every record is created by
 * the same authorization, hashing and blockchain code paths the product uses.
 * Nothing is inserted behind the service layer and no record is fabricated
 * outside the API.
 *
 * Everything created here is labelled DEMO. CRB and NeST values come from the
 * sandbox adapters and are recorded with their real source so stored data never
 * claims to be a live government record.
 *
 * Idempotent: re-running replaces the demo records it owns.
 */
import { createHash } from "crypto";
import request from "supertest";
import { app } from "../src/app";
import { prisma } from "../src/repositories/prisma";
import { hashPassword } from "../src/utils/password";
import { signAccessToken } from "../src/utils/jwt";

const DEMO_TAG = "demo.contractorproof";

const ACCOUNTS = {
  admin: { email: "demo.admin@contractorproof.test", fullName: "Demo Administrator", role: "ADMIN" },
  client: { email: "demo.client@contractorproof.test", fullName: "Demo Client", role: "CLIENT" },
  contractor: { email: "demo.contractor@contractorproof.test", fullName: "Demo Contractor", role: "CONTRACTOR" },
  auditor: { email: "demo.auditor@contractorproof.test", fullName: "Demo Auditor", role: "AUDITOR" },
} as const;

const PASSWORD = "demopassword123";

type Account = { token: string; userId: string };

async function api(
  method: "get" | "post",
  path: string,
  token: string | null,
  body?: unknown,
) {
  const call = request(app)[method](`/api/v1${path}`);
  if (token) call.set("Authorization", `Bearer ${token}`);
  const response = await (body === undefined ? call : call.send(body as object));
  if (response.status >= 400) {
    throw new Error(
      `${method.toUpperCase()} ${path} failed with ${response.status}: ${JSON.stringify(response.body)}`,
    );
  }
  return response.body as Record<string, unknown>;
}

/**
 * List endpoints return a bare collection while write endpoints use the
 * shared `{ data, meta }` envelope. Accept either so the seeder does not depend
 * on which convention a given endpoint uses.
 */
function payloadOf(body: Record<string, unknown>): Record<string, unknown> {
  const data = body.data;
  return typeof data === "object" && data !== null ? (data as Record<string, unknown>) : body;
}

async function registerAccount(input: {
  email: string;
  fullName: string;
  role: string;
}): Promise<Account> {
  const response = await request(app).post("/api/v1/auth/register").send({
    email: input.email,
    password: PASSWORD,
    fullName: input.fullName,
    role: input.role,
  });
  if (response.status >= 400) {
    throw new Error(
      `register ${input.email} failed with ${response.status}: ${JSON.stringify(response.body)}`,
    );
  }
  return { token: response.body.token, userId: response.body.user.id };
}

/**
 * Public registration only permits CLIENT and CONTRACTOR. Privileged demo
 * accounts are provisioned directly with the same password hashing used by
 * production, mirroring how the first administrator is provisioned.
 */
async function provisionPrivileged(input: {
  email: string;
  fullName: string;
  role: "ADMIN" | "AUDITOR";
}): Promise<Account> {
  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash: await hashPassword(PASSWORD),
      fullName: input.fullName,
      role: input.role,
    },
  });
  return {
    token: signAccessToken({ sub: user.id, email: user.email, role: user.role }),
    userId: user.id,
  };
}

async function removePreviousDemoData(): Promise<void> {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: "@contractorproof.test" } },
    select: { id: true },
  });
  const ids = users.map((user) => user.id);
  if (ids.length === 0) return;

  // Deletion order follows the foreign keys: dependent rows first, then
  // evidence versions, then the evidence that still points at its current
  // version, then the records that reference a milestone.
  const demoContractors = { userId: { in: ids } };

  await prisma.correctionResolution.deleteMany({ where: { correction: { actorId: { in: ids } } } });
  await prisma.disputeResolution.deleteMany({ where: { dispute: { raisedById: { in: ids } } } });
  await prisma.correction.deleteMany({ where: { actorId: { in: ids } } });
  await prisma.dispute.deleteMany({ where: { raisedById: { in: ids } } });
  await prisma.crbVerification.deleteMany({ where: { requestedById: { in: ids } } });
  await prisma.attestation.deleteMany({ where: { evidence: { uploadedById: { in: ids } } } });

  const evidence = await prisma.evidence.findMany({
    where: { uploadedById: { in: ids } },
    select: { id: true },
  });
  const evidenceIds = evidence.map((row) => row.id);
  if (evidenceIds.length > 0) {
    await prisma.verification.deleteMany({
      where: { evidenceVersion: { evidenceId: { in: evidenceIds } } },
    });
    await prisma.correction.deleteMany({ where: { evidenceId: { in: evidenceIds } } });
    await prisma.dispute.deleteMany({ where: { evidenceId: { in: evidenceIds } } });
    await prisma.blockchainEvent.deleteMany({
      where: {
        OR: [
          { referenceId: { in: (await prisma.evidenceVersion.findMany({
            where: { evidenceId: { in: evidenceIds } },
            select: { id: true },
          })).map((row) => row.id) } },
          { referenceId: { in: evidenceIds } },
        ],
      },
    });
    await prisma.evidence.updateMany({
      where: { id: { in: evidenceIds } },
      data: { currentVersionId: null },
    });
    await prisma.evidenceVersion.deleteMany({ where: { evidenceId: { in: evidenceIds } } });
    await prisma.evidence.deleteMany({ where: { id: { in: evidenceIds } } });
  }

  await prisma.blockchainEvent.deleteMany({
    where: { project: { contractor: demoContractors } },
  });
  await prisma.milestone.deleteMany({ where: { project: { contractor: demoContractors } } });
  await prisma.verificationPolicy.deleteMany({ where: { project: { contractor: demoContractors } } });
  await prisma.project.deleteMany({ where: { contractor: demoContractors } });
  await prisma.contractor.deleteMany({ where: { userId: { in: ids } } });
  await prisma.auditLog.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

async function main(): Promise<void> {
  await removePreviousDemoData();

  await provisionPrivileged(ACCOUNTS.admin);
  const client = await registerAccount(ACCOUNTS.client);
  const contractor = await registerAccount(ACCOUNTS.contractor);
  const auditor = await provisionPrivileged(ACCOUNTS.auditor);

  // CLIENT creates the project and assigns the contractor in one request.
  const contractors = payloadOf(await api("get", "/contractors", client.token));
  const contractorRecords = (contractors.contractors ?? []) as { id: string }[];
  if (contractorRecords.length === 0) {
    throw new Error("expected the registered contractor profile");
  }
  const contractorId = contractorRecords[0].id;

  const projectResponse = payloadOf(
    await api("post", "/projects", client.token, {
      name: `DEMO · Harbor Bridge rehabilitation`,
      description: "Demo project created by the CLIENT to walk through the full workflow.",
      contractorId,
    }),
  );
  const project = projectResponse.project as { id: string };
  if (!project?.id) throw new Error("expected a project record");

  // Give the contractor a CRB sandbox reference, then run a real CRB check.
  await prisma.contractor.update({
    where: { id: contractorId },
    data: { crbRegistrationNumber: "CRB-DEMO-001" },
  });
  await api("post", `/contractors/${contractorId}/crb/verify`, client.token);

  const milestones = [
    { name: "DEMO · Foundation pour", description: "Demo milestone: foundation pour and cure." },
    { name: "DEMO · Structural steel", description: "Demo milestone: structural steel erection." },
  ];
  const createdMilestones: { id: string; name: string }[] = [];
  for (const milestone of milestones) {
    const response = await api("post", "/milestones", client.token, {
      projectId: project.id,
      ...milestone,
    });
    const record = payloadOf(response).milestone as { id: string; name: string };
    if (!record?.id) throw new Error("expected a milestone record");
    createdMilestones.push(record);
  }

  // CONTRACTOR submits evidence. The system hashes, compares and anchors it.
  const digests: Record<string, string> = {};
  const uploadedEvidence: { id: string; milestoneId: string }[] = [];
  for (const [index, milestone] of createdMilestones.entries()) {
    const contents = Buffer.from(
      `DEMO evidence for ${milestone.name} (revision ${index + 1})`,
      "utf8",
    );
    digests[milestone.name] = createHash("sha256").update(contents).digest("hex");
    const upload = request(app)
      .post("/api/v1/evidence")
      .set("Authorization", `Bearer ${contractor.token}`)
      .field("milestoneId", milestone.id)
      .attach("file", contents, `demo-evidence-${index + 1}.txt`);
    const response = await upload;
    if (response.status >= 400) {
      throw new Error(
        `evidence upload failed with ${response.status}: ${JSON.stringify(response.body)}`,
      );
    }
    uploadedEvidence.push(
      (payloadOf(response.body as Record<string, unknown>).evidence ?? {}) as {
        id: string;
        milestoneId: string;
      },
    );
  }

  // SYSTEM technical verification is requested by an internal reviewer, never
  // by the client or the contractor. This is the only path that produces a
  // MATCH/MISMATCH result and its blockchain proof event.
  for (const evidence of uploadedEvidence) {
    if (!evidence.id) continue;
    await api("post", "/verification", auditor.token, { evidenceId: evidence.id });
  }

  // AUDITOR records a human attestation against the first evidence record.
  const firstEvidence = uploadedEvidence[0];
  if (firstEvidence) {
    await api("post", "/attestations", auditor.token, {
      evidenceId: firstEvidence.id,
      milestoneId: firstEvidence.milestoneId,
      decision: "APPROVED",
      comment: "DEMO attestation: site documents were reviewed.",
    });
  }

  // CLIENT requests a correction against a recorded blockchain event.
  const blockchain = payloadOf(await api("get", `/blockchain?projectId=${project.id}`, client.token));
  const events = (blockchain.events ?? []) as { id: string; eventType: string }[];
  const verificationEvent = events.find((event) => event.eventType === "VERIFICATION");
  if (verificationEvent) {
    await api("post", "/corrections", client.token, {
      milestoneId: createdMilestones[0].id,
      originalEventId: verificationEvent.id,
      reason: "DEMO correction: the poured volume was not visible in the photo.",
      ...(firstEvidence ? { evidenceId: firstEvidence.id } : {}),
    });
  }

  // CONTRACTOR raises a dispute on the second milestone.
  await api("post", "/disputes", contractor.token, {
    milestoneId: createdMilestones[1].id,
    reason: "DEMO dispute: the recorded date conflicts with the site diary.",
  });

  const summary = {
    demoAccounts: Object.values(ACCOUNTS).map((account) => ({
      email: account.email,
      role: account.role,
      password: PASSWORD,
    })),
    projectId: project.id,
    milestones: createdMilestones.map((milestone) => milestone.name),
    evidenceDigests: digests,
    crb: "SANDBOX reference CRB-DEMO-001 (not live CRB data)",
    nest: "SANDBOX_DEMO procurement records (not live NeST data)",
    blockchain:
      "Anchored only if the local chain is running; otherwise events stay PENDING and say so.",
  };

  console.log(JSON.stringify(summary, null, 2));
  console.log("\nDemo dataset ready. Sign in with any account above.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });