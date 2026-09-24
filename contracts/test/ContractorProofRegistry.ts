import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("ContractorProofRegistry", function () {
  async function deploy() {
    const [owner, recorder, outsider] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("ContractorProofRegistry");
    const registry = await Factory.deploy();
    await registry.waitForDeployment();
    return { registry, owner, recorder, outsider };
  }

  function ids() {
    return {
      projectId: ethers.id("project-1"),
      contractorId: ethers.id("contractor-1"),
      milestoneId: ethers.id("milestone-1"),
      evidenceHash: ethers.sha256(ethers.toUtf8Bytes("synthetic-evidence")),
      actorId: ethers.id("actor-1"),
      eventId: ethers.id("event-1"),
    };
  }

  it("lets the owner register a project", async function () {
    const { registry } = await deploy();
    const { projectId, contractorId } = ids();

    await expect(registry.registerProject(projectId, contractorId))
      .to.emit(registry, "ProjectRegistered")
      .withArgs(projectId, contractorId, anyValue);

    expect(await registry.projectExists(projectId)).to.equal(true);
  });

  it("rejects unauthorized recorders and zero evidence hashes", async function () {
    const { registry, outsider } = await deploy();
    const { projectId, contractorId } = ids();

    await expect(
      registry.connect(outsider).registerProject(projectId, contractorId),
    ).to.be.revertedWith("not authorized");

    const { milestoneId, evidenceHash, actorId, eventId } = ids();
    await registry.registerProject(projectId, contractorId);
    await expect(
      registry
        .connect(outsider)
        .recordVerification(eventId, projectId, milestoneId, evidenceHash, actorId),
    ).to.be.revertedWith("not authorized");
    await expect(
      registry.recordVerification(eventId, projectId, milestoneId, ethers.ZeroHash, actorId),
    ).to.be.revertedWith("evidenceHash required");
  });

  it("records verification, attestation, correction, dispute, resolution, and variation", async function () {
    const { registry, recorder, owner } = await deploy();
    const { projectId, contractorId, milestoneId, evidenceHash, actorId } = ids();

    await registry.setRecorder(recorder.address, true);
    await registry.connect(recorder).registerProject(projectId, contractorId);

    const verificationId = ethers.id("verification-1");
    await expect(
      registry
        .connect(recorder)
        .recordVerification(verificationId, projectId, milestoneId, evidenceHash, actorId),
    ).to.emit(registry, "VerificationRecorded");

    const attestationId = ethers.id("attestation-1");
    await expect(
      registry
        .connect(recorder)
        .recordAttestation(attestationId, projectId, evidenceHash, actorId, true),
    ).to.emit(registry, "AttestationRecorded");

    const correctionId = ethers.id("correction-1");
    await expect(
      registry
        .connect(recorder)
        .recordCorrection(correctionId, verificationId, evidenceHash, actorId),
    ).to.emit(registry, "CorrectionRecorded");

    const disputeId = ethers.id("dispute-1");
    await expect(
      registry.connect(recorder).recordDispute(disputeId, verificationId, actorId),
    ).to.emit(registry, "DisputeRecorded");

    const resolutionId = ethers.id("resolution-1");
    await expect(
      registry.connect(recorder).recordResolution(resolutionId, disputeId, actorId),
    ).to.emit(registry, "ResolutionRecorded");

    const variationId = ethers.id("variation-1");
    const variationRef = ethers.id("VAR-001");
    await expect(
      registry
        .connect(recorder)
        .recordVariation(variationId, verificationId, variationRef, actorId),
    ).to.emit(registry, "VariationRecorded");

    expect(await registry.eventExists(verificationId)).to.equal(true);
    expect(await registry.recorders(owner.address)).to.equal(true);
  });

  it("records a SHA-256 bytes32 digest without keccak of the hex string", async function () {
    const { registry } = await deploy();
    const { projectId, contractorId, milestoneId, actorId } = ids();
    const fileHash = ethers.sha256(ethers.toUtf8Bytes("site-photo-bytes"));
    const keccakOfHex = ethers.id(fileHash.slice(2));

    await registry.registerProject(projectId, contractorId);
    const eventId = ethers.id("sha256-proof");
    await expect(
      registry.recordVerification(eventId, projectId, milestoneId, fileHash, actorId),
    )
      .to.emit(registry, "VerificationRecorded")
      .withArgs(eventId, projectId, milestoneId, fileHash, actorId, anyValue);

    expect(fileHash).to.not.equal(keccakOfHex);
    expect(await registry.eventExists(eventId)).to.equal(true);
  });

  it("encodes application ids deterministically as keccak256(utf8(id))", async function () {
    const first = ethers.id("11111111-1111-4111-8111-111111111111");
    const second = ethers.keccak256(
      ethers.toUtf8Bytes("11111111-1111-4111-8111-111111111111"),
    );
    expect(first).to.equal(second);
  });

  it("does not overwrite an existing event id", async function () {
    const { registry } = await deploy();
    const { projectId, contractorId, milestoneId, evidenceHash, actorId, eventId } = ids();

    await registry.registerProject(projectId, contractorId);
    await registry.recordVerification(eventId, projectId, milestoneId, evidenceHash, actorId);

    await expect(
      registry.recordVerification(eventId, projectId, milestoneId, evidenceHash, actorId),
    ).to.be.revertedWith("event already recorded");
  });
});
