import { ethers, network } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("=================================================");
  console.log(`Deploying ReputationRegistry contract on network: ${network.name}`);
  console.log(`Deployer address: ${deployer.address}`);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Deployer balance: ${ethers.formatEther(balance)} native tokens`);
  console.log("=================================================");

  // Determine initial owner
  // In production, we default to the deployer's address, or can read from environment variables.
  const initialOwner = process.env.REPUTATION_OWNER || deployer.address;
  console.log(`Initial Owner set to: ${initialOwner}`);

  // Deploying ReputationRegistry
  console.log("Deploying ReputationRegistry...");
  const ReputationRegistry = await ethers.getContractFactory("ReputationRegistry");
  const reputationRegistry = await ReputationRegistry.deploy(initialOwner);
  await reputationRegistry.waitForDeployment();

  const contractAddress = await reputationRegistry.getAddress();
  const txHash = reputationRegistry.deploymentTransaction()?.hash;

  console.log("-------------------------------------------------");
  console.log("SUCCESS!");
  console.log(`ReputationRegistry successfully deployed to: ${contractAddress}`);
  console.log(`Transaction hash: ${txHash}`);
  console.log("=================================================");

  // Output hardhat-verify tips
  if (network.name !== "hardhat" && network.name !== "localhost") {
    console.log("\nVerification Command:");
    console.log(`npx hardhat verify --network ${network.name} ${contractAddress} "${initialOwner}"`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
