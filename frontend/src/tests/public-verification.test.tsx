import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PublicVerificationPage } from "../pages/PublicVerificationPage";
import { createPublicVerification } from "../features/verification/api/publicVerificationApi";
import { render } from "@testing-library/react";

vi.mock("../features/verification/api/publicVerificationApi", async (importOriginal) => {
  const original = await importOriginal<typeof import("../features/verification/api/publicVerificationApi")>();
  return { ...original, createPublicVerification: vi.fn() };
});

const versionId = "11111111-1111-4111-8111-111111111111";
const result = (status: "MATCH" | "MISMATCH" | "PENDING" | "UNAVAILABLE") => ({
  status,
  evidenceVersionId: versionId,
  meaning: `Backend ${status.toLowerCase()} meaning.`,
  blockchainProof: status === "MATCH"
    ? { confirmed: true as const, transactionHash: "0xabc", blockNumber: 42 }
    : { confirmed: false as const },
});

describe("public verification page", () => {
  it("renders the public form without a result or sign-in requirement", () => {
    render(<PublicVerificationPage />);
    expect(screen.getByRole("heading", { name: "ContractorProof Verification" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Evidence ID/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Evidence version ID/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Evidence file/)).toBeInTheDocument();
    expect(screen.queryByText("MATCH")).not.toBeInTheDocument();
    expect(screen.queryByText(/sign in/i)).not.toBeInTheDocument();
  });

  it("validates the required reference and file before submitting", async () => {
    const user = userEvent.setup();
    render(<PublicVerificationPage />);
    await user.click(screen.getByRole("button", { name: "Verify evidence" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Enter an evidence ID or evidence version ID.");
    expect(createPublicVerification).not.toHaveBeenCalled();
  });

  it("submits the reference and file, showing a disabled loading state then MATCH proof", async () => {
    let resolveRequest: (value: ReturnType<typeof result>) => void = () => undefined;
    vi.mocked(createPublicVerification).mockImplementationOnce(() => new Promise((resolve) => { resolveRequest = resolve; }));
    const user = userEvent.setup();
    render(<PublicVerificationPage />);
    await user.type(screen.getByLabelText(/Evidence version ID/), versionId);
    await user.upload(screen.getByLabelText(/Evidence file/), new File(["proof"], "proof.txt"));
    await user.click(screen.getByRole("button", { name: "Verify evidence" }));
    expect(screen.getByRole("button", { name: "Verifying evidence…" })).toBeDisabled();
    expect(createPublicVerification).toHaveBeenCalledWith({ evidenceId: undefined, evidenceVersionId: versionId, file: expect.any(File) });

    resolveRequest(result("MATCH"));
    expect(await screen.findByText("MATCH")).toBeInTheDocument();
    expect(screen.getByText(/Status:/)).toHaveTextContent("CONFIRMED");
    expect(screen.getByText("0xabc")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it.each(["MISMATCH", "PENDING", "UNAVAILABLE"] as const)("renders %s without a confirmed proof", async (status) => {
    vi.mocked(createPublicVerification).mockResolvedValueOnce(result(status));
    const user = userEvent.setup();
    render(<PublicVerificationPage />);
    await user.type(screen.getByLabelText(/Evidence version ID/), versionId);
    await user.upload(screen.getByLabelText(/Evidence file/), new File(["proof"], "proof.txt"));
    await user.click(screen.getByRole("button", { name: "Verify evidence" }));
    expect(await screen.findByText(status)).toBeInTheDocument();
    expect(screen.getByText(/Status:/)).toHaveTextContent("NOT CONFIRMED");
    expect(screen.queryByText(/fraudulent|dishonest|unsafe|trustworthy/i)).not.toBeInTheDocument();
  });

  it("shows network errors as errors, not as a verification state", async () => {
    vi.mocked(createPublicVerification).mockRejectedValueOnce(new TypeError("network"));
    const user = userEvent.setup();
    render(<PublicVerificationPage />);
    await user.type(screen.getByLabelText(/Evidence version ID/), versionId);
    await user.upload(screen.getByLabelText(/Evidence file/), new File(["proof"], "proof.txt"));
    await user.click(screen.getByRole("button", { name: "Verify evidence" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't reach the verification service.");
    expect(screen.queryByText("UNAVAILABLE")).not.toBeInTheDocument();
  });
});
