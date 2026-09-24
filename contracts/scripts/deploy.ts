import { ethers } from "hardhat";

async function main(): Promise<void> {
  const Factory = await ethers.getContractFactory("ContractorProofRegistry");
  const registry = await Factory.deploy();
  await registry.waitForDeployment();
  const address = await registry.getAddress();
  console.log("ContractorProofRegistry deployed to:", address);
  console.log("Set CONTRACT_ADDRESS to this value in backend/.env");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
