import { describe, expect, it } from "vitest";
import { validateAttestationInput, validateVerificationTarget } from "./validation";

describe("verification validation", () => {
  it("requires evidenceId or evidenceVersionId", () => {
    expect(validateVerificationTarget({})).toEqual({ ok: false, reason: "missing_target" });
  });

  it("rejects a malformed UUID", () => {
    expect(validateVerificationTarget({ evidenceId: "not-a-uuid" })).toEqual({
      ok: false,
      reason: "invalid_uuid",
    });
  });

  it("accepts a valid evidenceId", () => {
    expect(
      validateVerificationTarget({ evidenceId: "11111111-1111-4111-8111-111111111111" }),
    ).toEqual({
      ok: true,
      evidenceId: "11111111-1111-4111-8111-111111111111",
      evidenceVersionId: undefined,
    });
  });
});

describe("attestation validation", () => {
  it("requires evidenceId and milestoneId", () => {
    expect(validateAttestationInput({ decision: "APPROVED" })).toEqual({
      ok: false,
      reason: "missing_ids",
    });
  });

  it("rejects an invalid decision", () => {
    expect(
      validateAttestationInput({
        evidenceId: "11111111-1111-4111-8111-111111111111",
        milestoneId: "22222222-2222-4222-8222-222222222222",
        decision: "SAFE",
      }),
    ).toEqual({ ok: false, reason: "invalid_decision" });
  });

  it("accepts APPROVED", () => {
    expect(
      validateAttestationInput({
        evidenceId: "11111111-1111-4111-8111-111111111111",
        milestoneId: "22222222-2222-4222-8222-222222222222",
        decision: "APPROVED",
      }),
    ).toMatchObject({ ok: true, decision: "APPROVED" });
  });
});
