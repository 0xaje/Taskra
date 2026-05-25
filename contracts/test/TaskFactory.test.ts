import { expect } from "chai";
import { ethers } from "hardhat";

describe("TaskFactory", function () {
  let taskFactory: any;
  let owner: any;
  let creator: any;
  let agent: any;
  let otherAccount: any;
  let agentRegistry: any;
  let reputationRegistry: any;

  const metadataURI = "ipfs://QmXoypizjW3WknFixtdKLBU6g72k2vQsPBXGLWZ5uQH6Hk";
  const rewardAmount = ethers.parseEther("1.5"); // 1.5 Somnia native tokens
  const zeroAddress = ethers.ZeroAddress;

  // Task Status Enum from contract (matches Status enum)
  const Status = {
    OPEN: 0,
    ASSIGNED: 1,
    IN_PROGRESS: 2,
    COMPLETED: 3,
    SETTLED: 4,
    CANCELLED: 5,
  };

  beforeEach(async function () {
    // Get signers
    [owner, creator, agent, otherAccount] = await ethers.getSigners();

    // Deploy AgentRegistry
    const AgentRegistryFactory = await ethers.getContractFactory("AgentRegistry");
    agentRegistry = await AgentRegistryFactory.deploy(owner.address);
    await agentRegistry.waitForDeployment();

    // Deploy ReputationRegistry
    const ReputationRegistryFactory = await ethers.getContractFactory("ReputationRegistry");
    reputationRegistry = await ReputationRegistryFactory.deploy(owner.address);
    await reputationRegistry.waitForDeployment();

    // Deploy TaskFactory
    const TaskFactoryFactory = await ethers.getContractFactory("TaskFactory");
    taskFactory = await TaskFactoryFactory.deploy(
      owner.address,
      await agentRegistry.getAddress(),
      await reputationRegistry.getAddress()
    );
    await taskFactory.waitForDeployment();

    // Authorize TaskFactory in registries
    await reputationRegistry.connect(owner).setValidator(await taskFactory.getAddress(), true);
    await agentRegistry.connect(owner).setController(await taskFactory.getAddress(), true);

    // Initialize agent in reputation registry
    await reputationRegistry.connect(owner).initializeAgent(agent.address);
  });

  describe("Deployment", function () {
    it("Should set the correct owner", async function () {
      expect(await taskFactory.owner()).to.equal(owner.address);
    });

    it("Should start with taskCount as 0", async function () {
      expect(await taskFactory.taskCount()).to.equal(0n);
    });

    it("Should revert if deploying with zero address owner", async function () {
      const TaskFactoryFactory = await ethers.getContractFactory("TaskFactory");
      await expect(
        TaskFactoryFactory.deploy(
          zeroAddress,
          await agentRegistry.getAddress(),
          await reputationRegistry.getAddress()
        )
      ).to.be.revertedWithCustomError(
        taskFactory,
        "OwnableInvalidOwner"
      );
    });
  });

  describe("Task Creation", function () {
    it("Should successfully create a task and lock native funds", async function () {
      const initialContractBalance = await ethers.provider.getBalance(await taskFactory.getAddress());

      const tx = await taskFactory.connect(creator).createTask(metadataURI, {
        value: rewardAmount,
      });

      // Verify taskCount increments
      expect(await taskFactory.taskCount()).to.equal(1n);

      // Verify event emission
      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        (log: any) => log.fragment && log.fragment.name === "TaskCreated"
      ) as any;

      expect(event).to.not.be.undefined;
      const taskId = event.args[0];
      expect(event.args[1]).to.equal(creator.address);
      expect(event.args[2]).to.equal(metadataURI);
      expect(event.args[3]).to.equal(rewardAmount);

      // Verify locked balance
      const postContractBalance = await ethers.provider.getBalance(await taskFactory.getAddress());
      expect(postContractBalance - initialContractBalance).to.equal(rewardAmount);

      // Verify task details retrieved via getTask
      const task = await taskFactory.getTask(taskId);
      expect(task.id).to.equal(taskId);
      expect(task.creator).to.equal(creator.address);
      expect(task.metadataURI).to.equal(metadataURI);
      expect(task.rewardAmount).to.equal(rewardAmount);
      expect(task.assignedAgent).to.equal(zeroAddress);
      expect(task.status).to.equal(Status.OPEN);
      expect(task.createdAt).to.be.gt(0n);
      expect(task.completedAt).to.equal(0n);
    });

    it("Should revert if reward amount is 0", async function () {
      await expect(
        taskFactory.connect(creator).createTask(metadataURI, { value: 0n })
      ).to.be.revertedWithCustomError(taskFactory, "RewardAmountRequired");
    });

    it("Should revert if metadataURI is empty", async function () {
      await expect(
        taskFactory.connect(creator).createTask("", { value: rewardAmount })
      ).to.be.revertedWithCustomError(taskFactory, "InvalidAddress");
    });
  });

  describe("Task Assignment", function () {
    let taskId: string;

    beforeEach(async function () {
      const tx = await taskFactory.connect(creator).createTask(metadataURI, {
        value: rewardAmount,
      });
      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        (log: any) => log.fragment && log.fragment.name === "TaskCreated"
      ) as any;
      taskId = event.args[0];
    });

    it("Should allow the creator to assign an agent to an OPEN task", async function () {
      const tx = await taskFactory.connect(creator).assignTask(taskId, agent.address);
      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        (log: any) => log.fragment && log.fragment.name === "TaskAssigned"
      ) as any;

      expect(event).to.not.be.undefined;
      expect(event.args[0]).to.equal(taskId);
      expect(event.args[1]).to.equal(agent.address);

      const task = await taskFactory.getTask(taskId);
      expect(task.assignedAgent).to.equal(agent.address);
      expect(task.status).to.equal(Status.ASSIGNED);
    });

    it("Should revert if caller is not the task creator", async function () {
      await expect(
        taskFactory.connect(otherAccount).assignTask(taskId, agent.address)
      ).to.be.revertedWithCustomError(taskFactory, "Unauthorized");
    });

    it("Should revert if assigning zero address as agent", async function () {
      await expect(
        taskFactory.connect(creator).assignTask(taskId, zeroAddress)
      ).to.be.revertedWithCustomError(taskFactory, "InvalidAddress");
    });

    it("Should revert if the task is not in OPEN status", async function () {
      await taskFactory.connect(creator).assignTask(taskId, agent.address);
      // Try assigning again
      await expect(
        taskFactory.connect(creator).assignTask(taskId, otherAccount.address)
      ).to.be.revertedWithCustomError(taskFactory, "TaskNotOpen");
    });
  });

  describe("Task Execution Lifecycle", function () {
    let taskId: string;

    beforeEach(async function () {
      const tx = await taskFactory.connect(creator).createTask(metadataURI, {
        value: rewardAmount,
      });
      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        (log: any) => log.fragment && log.fragment.name === "TaskCreated"
      ) as any;
      taskId = event.args[0];
      await taskFactory.connect(creator).assignTask(taskId, agent.address);
    });

    it("Should allow the assigned agent to mark task in progress", async function () {
      const tx = await taskFactory.connect(agent).markInProgress(taskId);
      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        (log: any) => log.fragment && log.fragment.name === "TaskStarted"
      ) as any;

      expect(event).to.not.be.undefined;
      expect(event.args[0]).to.equal(taskId);

      const task = await taskFactory.getTask(taskId);
      expect(task.status).to.equal(Status.IN_PROGRESS);
    });

    it("Should revert markInProgress if caller is not the assigned agent", async function () {
      await expect(
        taskFactory.connect(creator).markInProgress(taskId)
      ).to.be.revertedWithCustomError(taskFactory, "Unauthorized");
    });

    it("Should revert markInProgress if status is not ASSIGNED", async function () {
      // Mark open task (before assignment)
      const txOpen = await taskFactory.connect(creator).createTask(metadataURI, {
        value: rewardAmount,
      });
      const receiptOpen = await txOpen.wait();
      const eventOpen = receiptOpen?.logs.find(
        (log: any) => log.fragment && log.fragment.name === "TaskCreated"
      ) as any;
      const openTaskId = eventOpen.args[0];

      await expect(
        taskFactory.connect(agent).markInProgress(openTaskId)
      ).to.be.revertedWithCustomError(taskFactory, "Unauthorized"); // Because agent is address(0)
    });

    it("Should allow the assigned agent to mark task as completed", async function () {
      await taskFactory.connect(agent).markInProgress(taskId);

      const tx = await taskFactory.connect(agent).completeTask(taskId);
      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        (log: any) => log.fragment && log.fragment.name === "TaskCompleted"
      ) as any;

      expect(event).to.not.be.undefined;
      expect(event.args[0]).to.equal(taskId);

      const task = await taskFactory.getTask(taskId);
      expect(task.status).to.equal(Status.COMPLETED);
      expect(task.completedAt).to.be.gt(0n);
    });

    it("Should revert completeTask if caller is not the assigned agent", async function () {
      await taskFactory.connect(agent).markInProgress(taskId);
      await expect(
        taskFactory.connect(creator).completeTask(taskId)
      ).to.be.revertedWithCustomError(taskFactory, "Unauthorized");
    });

    it("Should revert completeTask if task is not IN_PROGRESS", async function () {
      await expect(
        taskFactory.connect(agent).completeTask(taskId)
      ).to.be.revertedWithCustomError(taskFactory, "TaskNotInProgress");
    });
  });

  describe("Task Settlement & Escrow Payout", function () {
    let taskId: string;

    beforeEach(async function () {
      const tx = await taskFactory.connect(creator).createTask(metadataURI, {
        value: rewardAmount,
      });
      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        (log: any) => log.fragment && log.fragment.name === "TaskCreated"
      ) as any;
      taskId = event.args[0];
      await taskFactory.connect(creator).assignTask(taskId, agent.address);
      await taskFactory.connect(agent).markInProgress(taskId);
      await taskFactory.connect(agent).completeTask(taskId);
    });

    it("Should allow creator to settle task and transfer payout to the agent", async function () {
      const agentInitialBalance = await ethers.provider.getBalance(agent.address);
      const contractInitialBalance = await ethers.provider.getBalance(await taskFactory.getAddress());

      // Advance blockchain time past the dispute period deadline (1 hour)
      await ethers.provider.send("evm_increaseTime", [3600]);
      await ethers.provider.send("evm_mine", []);

      const tx = await taskFactory.connect(creator).settleTask(taskId);
      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        (log: any) => log.fragment && log.fragment.name === "TaskSettled"
      ) as any;

      expect(event).to.not.be.undefined;
      expect(event.args[0]).to.equal(taskId);
      expect(event.args[1]).to.equal(agent.address);
      expect(event.args[2]).to.equal(rewardAmount);

      // Verify task state
      const task = await taskFactory.getTask(taskId);
      expect(task.status).to.equal(Status.SETTLED);

      // Verify balance transfer
      const agentPostBalance = await ethers.provider.getBalance(agent.address);
      expect(BigInt(agentPostBalance) - BigInt(agentInitialBalance)).to.equal(rewardAmount);

      const contractPostBalance = await ethers.provider.getBalance(await taskFactory.getAddress());
      expect(BigInt(contractInitialBalance) - BigInt(contractPostBalance)).to.equal(rewardAmount);
    });

    it("Should revert settleTask if caller is not the task creator", async function () {
      await expect(
        taskFactory.connect(otherAccount).settleTask(taskId)
      ).to.be.revertedWithCustomError(taskFactory, "Unauthorized");
    });

    it("Should revert settleTask if task is not in COMPLETED status", async function () {
      // Create new task and leave it open
      const txOpen = await taskFactory.connect(creator).createTask(metadataURI, {
        value: rewardAmount,
      });
      const receiptOpen = await txOpen.wait();
      const eventOpen = receiptOpen?.logs.find(
        (log: any) => log.fragment && log.fragment.name === "TaskCreated"
      ) as any;
      const openTaskId = eventOpen.args[0];

      await expect(
        taskFactory.connect(creator).settleTask(openTaskId)
      ).to.be.revertedWithCustomError(taskFactory, "TaskNotCompleted");
    });
  });

  describe("Task Cancellation & Refunds", function () {
    let taskId: string;

    beforeEach(async function () {
      const tx = await taskFactory.connect(creator).createTask(metadataURI, {
        value: rewardAmount,
      });
      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        (log: any) => log.fragment && log.fragment.name === "TaskCreated"
      ) as any;
      taskId = event.args[0];
    });

    it("Should allow creator to cancel an OPEN task and get refund", async function () {
      const creatorInitialBalance = await ethers.provider.getBalance(creator.address);

      const tx = await taskFactory.connect(creator).cancelTask(taskId);
      const receipt = await tx.wait();
      
      // Compute gas costs
      const gasUsed = receipt ? receipt.gasUsed * receipt.gasPrice : 0n;

      const event = receipt?.logs.find(
        (log: any) => log.fragment && log.fragment.name === "TaskCancelled"
      ) as any;

      expect(event).to.not.be.undefined;
      expect(event.args[0]).to.equal(taskId);
      expect(event.args[1]).to.equal(creator.address);
      expect(event.args[2]).to.equal(rewardAmount);

      // Verify task state
      const task = await taskFactory.getTask(taskId);
      expect(task.status).to.equal(Status.CANCELLED);

      // Verify refund
      const creatorPostBalance = await ethers.provider.getBalance(creator.address);
      expect(BigInt(creatorPostBalance) - BigInt(creatorInitialBalance)).to.equal(rewardAmount - BigInt(gasUsed));
    });

    it("Should allow creator to cancel an ASSIGNED task", async function () {
      await taskFactory.connect(creator).assignTask(taskId, agent.address);

      const tx = await taskFactory.connect(creator).cancelTask(taskId);
      await tx.wait();

      const task = await taskFactory.getTask(taskId);
      expect(task.status).to.equal(Status.CANCELLED);
    });

    it("Should revert cancelTask if caller is not the task creator", async function () {
      await expect(
        taskFactory.connect(otherAccount).cancelTask(taskId)
      ).to.be.revertedWithCustomError(taskFactory, "Unauthorized");
    });

    it("Should revert cancelTask if task is IN_PROGRESS", async function () {
      await taskFactory.connect(creator).assignTask(taskId, agent.address);
      await taskFactory.connect(agent).markInProgress(taskId);

      await expect(
        taskFactory.connect(creator).cancelTask(taskId)
      ).to.be.revertedWithCustomError(taskFactory, "CannotCancelActiveTask");
    });

    it("Should revert cancelTask if task is COMPLETED", async function () {
      await taskFactory.connect(creator).assignTask(taskId, agent.address);
      await taskFactory.connect(agent).markInProgress(taskId);
      await taskFactory.connect(agent).completeTask(taskId);

      await expect(
        taskFactory.connect(creator).cancelTask(taskId)
      ).to.be.revertedWithCustomError(taskFactory, "CannotCancelActiveTask");
    });
  });

  describe("Administrative Recovery", function () {
    it("Should allow owner to recover stuck ERC20 tokens", async function () {
      const MockERC20Factory = await ethers.getContractFactory("MockERC20");
      const mockERC20: any = await MockERC20Factory.deploy();
      await mockERC20.waitForDeployment();

      const stuckAmount = ethers.parseUnits("500", 18);
      // Transfer tokens to TaskFactory to mock stuck tokens
      await mockERC20.connect(owner).transfer(await taskFactory.getAddress(), stuckAmount);

      const ownerInitialBalance = await mockERC20.balanceOf(owner.address);

      // Perform recovery
      const tx = await taskFactory.connect(owner).recoverERC20(await mockERC20.getAddress(), stuckAmount);
      await tx.wait();

      const ownerPostBalance = await mockERC20.balanceOf(owner.address);
      expect(BigInt(ownerPostBalance) - BigInt(ownerInitialBalance)).to.equal(stuckAmount);
      expect(await mockERC20.balanceOf(await taskFactory.getAddress())).to.equal(0n);
    });

    it("Should revert recover stuck ERC20 tokens if caller is not the owner", async function () {
      const MockERC20Factory = await ethers.getContractFactory("MockERC20");
      const mockERC20: any = await MockERC20Factory.deploy();
      await mockERC20.waitForDeployment();

      await expect(
        taskFactory.connect(creator).recoverERC20(await mockERC20.getAddress(), 100n)
      ).to.be.revertedWithCustomError(taskFactory, "OwnableUnauthorizedAccount");
    });
  });
});
