import { ethers, network } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("=================================================");
  console.log(`Deploying TaskraEscrow contract on network: ${network.name}`);
  console.log(`Deployer address: ${deployer.address}`);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Deployer balance: ${ethers.formatEther(balance)} native tokens`);
  console.log("=================================================");

  // In production, we define distinct administrator, arbitrator, and treasury wallets.
  // Defaults to deployer address for local development but reads from environment variables.
  const initialOwner = process.env.TASKRA_OWNER || deployer.address;
  const initialArbitrator = process.env.TASKRA_ARBITRATOR || deployer.address;
  const initialTreasury = process.env.TASKRA_TREASURY || deployer.address;

  console.log(`Initial Owner: ${initialOwner}`);
  console.log(`Initial Arbitrator: ${initialArbitrator}`);
  console.log(`Initial Treasury: ${initialTreasury}`);

  console.log("Deploying TaskraEscrow...");
  const TaskraEscrow = await ethers.getContractFactory("TaskraEscrow");
  const taskraEscrow = await TaskraEscrow.deploy(initialOwner, initialArbitrator, initialTreasury);
  await taskraEscrow.waitForDeployment();

  const contractAddress = await taskraEscrow.getAddress();
  const txHash = taskraEscrow.deploymentTransaction()?.hash;

  console.log("-------------------------------------------------");
  console.log("SUCCESS!");
  console.log(`TaskraEscrow successfully deployed to: ${contractAddress}`);
  console.log(`Transaction hash: ${txHash}`);
  console.log("=================================================");

  // Output hardhat-verify tips
  if (network.name !== "hardhat" && network.name !== "localhost") {
    console.log("\nVerification Command:");
    console.log(
      `npx hardhat verify --network ${network.name} ${contractAddress} "${initialOwner}" "${initialArbitrator}" "${initialTreasury}"`
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
