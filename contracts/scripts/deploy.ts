import { ethers, network } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("=================================================");
  console.log(`Deploying Taskra System Contracts on network: ${network.name}`);
  console.log(`Deployer address: ${deployer.address}`);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Deployer balance: ${ethers.formatEther(balance)} native tokens`);
  console.log("=================================================");

  const initialOwner = process.env.TASKFACTORY_OWNER || deployer.address;
  console.log(`Initial Owner set to: ${initialOwner}`);

  // 1. Deploy AgentRegistry
  console.log("\nDeploying AgentRegistry...");
  const AgentRegistry = await ethers.getContractFactory("AgentRegistry");
  const agentRegistry = await AgentRegistry.deploy(initialOwner);
  await agentRegistry.waitForDeployment();
  const agentRegistryAddress = await agentRegistry.getAddress();
  console.log(`AgentRegistry successfully deployed to: ${agentRegistryAddress}`);

  // 2. Deploy ReputationRegistry
  console.log("\nDeploying ReputationRegistry...");
  const ReputationRegistry = await ethers.getContractFactory("ReputationRegistry");
  const reputationRegistry = await ReputationRegistry.deploy(initialOwner);
  await reputationRegistry.waitForDeployment();
  const reputationRegistryAddress = await reputationRegistry.getAddress();
  console.log(`ReputationRegistry successfully deployed to: ${reputationRegistryAddress}`);

  // 3. Deploy TaskFactory
  console.log("\nDeploying TaskFactory...");
  const TaskFactory = await ethers.getContractFactory("TaskFactory");
  const taskFactory = await TaskFactory.deploy(initialOwner, agentRegistryAddress, reputationRegistryAddress);
  await taskFactory.waitForDeployment();
  const taskFactoryAddress = await taskFactory.getAddress();
  console.log(`TaskFactory successfully deployed to: ${taskFactoryAddress}`);

  // 4. Set cross-contract permissions
  console.log("\nConfiguring cross-contract permissions...");
  
  console.log("Authorizing TaskFactory as validator in ReputationRegistry...");
  const txVal = await reputationRegistry.setValidator(taskFactoryAddress, true);
  await txVal.wait();
  console.log(`Success! Tx hash: ${txVal.hash}`);

  console.log("Authorizing TaskFactory as controller in AgentRegistry...");
  const txCtrl = await agentRegistry.setController(taskFactoryAddress, true);
  await txCtrl.wait();
  console.log(`Success! Tx hash: ${txCtrl.hash}`);

  console.log("=================================================");
  console.log("ALL SYSTEM CONTRACTS DEPLOYED AND INTEGRATED SUCCESSFULLY!");
  console.log("-------------------------------------------------");
  console.log(`AgentRegistry:      ${agentRegistryAddress}`);
  console.log(`ReputationRegistry: ${reputationRegistryAddress}`);
  console.log(`TaskFactory:        ${taskFactoryAddress}`);
  console.log("=================================================");

  // Output hardhat-verify tips
  if (network.name !== "hardhat" && network.name !== "localhost") {
    console.log("\nVerification Commands:");
    console.log(`npx hardhat verify --network ${network.name} ${agentRegistryAddress} "${initialOwner}"`);
    console.log(`npx hardhat verify --network ${network.name} ${reputationRegistryAddress} "${initialOwner}"`);
    console.log(`npx hardhat verify --network ${network.name} ${taskFactoryAddress} "${initialOwner}" "${agentRegistryAddress}" "${reputationRegistryAddress}"`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
