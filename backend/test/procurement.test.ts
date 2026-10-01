import { Role } from "@prisma/client";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { sandboxNestAdapter } from "../src/integrations/nest";
import { prisma } from "../src/repositories/prisma";
import { setNestProcurementAdapterFactory } from "../src/services/procurement.service";
import { cleanupQaUsers, privileged, registerClient, registerContractor } from "./qa/fixtures";

const createdRecordIds: string[] = [];

async function cleanupProcurement(): Promise<void> {
  if (createdRecordIds.length) {
    await prisma.procurementLink.deleteMany({ where: { procurementRecordId: { in: createdRecordIds } } });
    await prisma.procurementObservation.deleteMany({ where: { procurementRecordId: { in: createdRecordIds } } });
    await prisma.procurementRecord.deleteMany({ where: { id: { in: createdRecordIds } } });
  }
  createdRecordIds.length = 0;
}

async function syncDemoRecord(token: string) {
  const response = await request(app)
    .post("/api/v1/procurement/sync")
    .set("Authorization", `Bearer ${token}`)
    .send({ ocid: "ocds-sandbox-001" });
  expect(response.status).toBe(201);
  const record = response.body.data.record;
  createdRecordIds.push(record.id as string);
  return record as { id: string; sourceSystem: string; externalReference: string; observations: Array<{ releaseId: string; sourceDigest: string }> };
}

describe("NeST procurement access, provenance, and history", () => {
  afterEach(async () => {
    setNestProcurementAdapterFactory();
    await cleanupProcurement();
    await cleanupQaUsers();
  });

  it("syncs public/sandbox records only for procurement administrators and preserves all release provenance", async () => {
    setNestProcurementAdapterFactory(() => sandboxNestAdapter);
    const contractor = await registerContractor("DEMO Fictional Builder Ltd");
    const staff = await privileged(Role.PROCUREMENT_OFFICER, "Procurement Operator");
    const forbidden = await request(app)
      .post("/api/v1/procurement/sync")
      .set("Authorization", `Bearer ${contractor.token}`)
      .send({ ocid: "ocds-sandbox-001" });
    expect(forbidden.status).toBe(403);

    const record = await syncDemoRecord(staff.token);
    expect(record).toMatchObject({ sourceSystem: "SANDBOX_DEMO", externalReference: "ocds-sandbox-001" });
    expect(record.observations.map((item) => item.releaseId)).toEqual([
      "release-001-initial",
      "release-001-award",
    ]);
    expect(record.observations.every((item) => /^[0-9a-f]{64}$/.test(item.sourceDigest))).toBe(true);

    const beforeLink = await request(app)
      .get(`/api/v1/contractors/${contractor.contractorId}/procurement`)
      .set("Authorization", `Bearer ${contractor.token}`);
    expect(beforeLink.status).toBe(200);
    expect(beforeLink.body.data.records).toEqual([]);
    expect(record.observations[1]?.releaseId).not.toContain(contractor.contractorId);

    const deniedLink = await request(app)
      .post(`/api/v1/contractors/${contractor.contractorId}/procurement/${record.id}/link`)
      .set("Authorization", `Bearer ${contractor.token}`);
    expect(deniedLink.status).toBe(403);

    const linked = await request(app)
      .post(`/api/v1/contractors/${contractor.contractorId}/procurement/${record.id}/link`)
      .set("Authorization", `Bearer ${staff.token}`);
    expect(linked.status).toBe(201);
    expect(linked.body.data.link).toMatchObject({
      contractorId: contractor.contractorId,
      procurementRecordId: record.id,
      linkedById: staff.userId,
    });

    const own = await request(app)
      .get(`/api/v1/contractors/${contractor.contractorId}/procurement`)
      .set("Authorization", `Bearer ${contractor.token}`);
    expect(own.status).toBe(200);
    expect(own.body.data.records[0]).toMatchObject({
      record: {
        sourceSystem: "SANDBOX_DEMO",
        sourceRecordId: "sandbox-record-001",
        externalReference: "ocds-sandbox-001",
        observations: expect.arrayContaining([
          expect.objectContaining({ releaseId: "release-001-award", contractorName: "DEMO Fictional Builder Ltd" }),
        ]),
      },
      linkedById: staff.userId,
    });
    const serialized = JSON.stringify(own.body);
    expect(serialized).not.toMatch(/TRUSTED|REPUTATION|RISK SCORE|VERIFIED CONTRACTOR/i);
    expect(await prisma.blockchainEvent.findMany({
      where: { referenceId: { in: [record.id, record.externalReference] } },
    })).toEqual([]);
  });

  it("limits client procurement reads to contractors on the client's own projects and exposes linked context in Passport", async () => {
    setNestProcurementAdapterFactory(() => sandboxNestAdapter);
    const client = await registerClient("Related Procurement Client");
    const unrelatedClient = await registerClient("Unrelated Procurement Client");
    const contractor = await registerContractor("DEMO Procurement Contractor");
    const procurementOfficer = await privileged(Role.PROCUREMENT_OFFICER, "Procurement Linker");
    const record = await syncDemoRecord(procurementOfficer.token);

    const linked = await request(app)
      .post(`/api/v1/contractors/${contractor.contractorId}/procurement/${record.id}/link`)
      .set("Authorization", `Bearer ${procurementOfficer.token}`);
    expect(linked.status).toBe(201);

    const unrelated = await request(app)
      .get(`/api/v1/contractors/${contractor.contractorId}/procurement`)
      .set("Authorization", `Bearer ${unrelatedClient.token}`);
    expect(unrelated.status).toBe(403);

    const project = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${client.token}`)
      .send({ name: "Procurement passport project", contractorId: contractor.contractorId });
    expect(project.status).toBe(201);
    const projectId = project.body.data.project.id as string;

    const related = await request(app)
      .get(`/api/v1/contractors/${contractor.contractorId}/procurement`)
      .set("Authorization", `Bearer ${client.token}`);
    expect(related.status).toBe(200);
    expect(related.body.data.records).toHaveLength(1);

    const passport = await request(app)
      .get(`/api/v1/passports/${projectId}`)
      .set("Authorization", `Bearer ${client.token}`);
    expect(passport.status).toBe(200);
    expect(passport.body.data.passport.contractor.procurementRecords[0]).toMatchObject({
      sourceSystem: "SANDBOX_DEMO",
      externalReference: "ocds-sandbox-001",
      sourceReference: "SANDBOX_DEMO:ocds-sandbox-001",
      observations: expect.arrayContaining([
        expect.objectContaining({ releaseId: "release-001-award", sourceDigest: expect.stringMatching(/^[0-9a-f]{64}$/) }),
      ]),
    });
  });

  it("rejects a fabricated/unlinked read and preserves normal admin oversight", async () => {
    const contractor = await registerContractor();
    const admin = await privileged(Role.ADMIN);
    const absentRecord = await request(app)
      .post(`/api/v1/contractors/${contractor.contractorId}/procurement/not-a-record/link`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(absentRecord.status).toBe(404);

    const records = await request(app)
      .get(`/api/v1/contractors/${contractor.contractorId}/procurement`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(records.status).toBe(200);
    expect(records.body.data.records).toEqual([]);
  });
});