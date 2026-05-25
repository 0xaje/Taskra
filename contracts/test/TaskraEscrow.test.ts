import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { TaskraEscrow } from "../typechain-types";

describe("TaskraEscrow", function () {
  let taskraEscrow: TaskraEscrow;
  let owner: HardhatEthersSigner;
  let depositor: HardhatEthersSigner;
  let agent: HardhatEthersSigner;
  let arbitrator: HardhatEthersSigner;
  let treasury: HardhatEthersSigner;
  let otherAccount: HardhatEthersSigner;

  const taskId = ethers.keccak256(ethers.toUtf8Bytes("task-123"));
  const escrowAmount = ethers.parseEther("2.0"); // 2.0 native tokens
  const zeroAddress = ethers.ZeroAddress;

  const EscrowStatus = {
    ACTIVE: 0,
    RELEASED: 1,
    SLASHED: 2,
    REFUNDED: 3,
  };

  beforeEach(async function () {
    [owner, depositor, agent, arbitrator, treasury, otherAccount] = await ethers.getSigners();

    const TaskraEscrowFactory = await ethers.getContractFactory("TaskraEscrow");
    taskraEscrow = await TaskraEscrowFactory.deploy(
      owner.address,
      arbitrator.address,
      treasury.address
    );
    await taskraEscrow.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the correct owner, arbitrator, and treasury", async function () {
      expect(await taskraEscrow.owner()).to.equal(owner.address);
      expect(await taskraEscrow.arbitrator()).to.equal(arbitrator.address);
      expect(await taskraEscrow.treasury()).to.equal(treasury.address);
    });

    it("Should start with 0 for global accounting tracking variables", async function () {
      expect(await taskraEscrow.totalDeposited()).to.equal(0n);
      expect(await taskraEscrow.totalReleased()).to.equal(0n);
      expect(await taskraEscrow.totalSlashed()).to.equal(0n);
      expect(await taskraEscrow.totalRefunded()).to.equal(0n);
    });

    it("Should revert if deploying with zero address initial owner", async function () {
      const TaskraEscrowFactory = await ethers.getContractFactory("TaskraEscrow");
      await expect(
        TaskraEscrowFactory.deploy(zeroAddress, arbitrator.address, treasury.address)
      ).to.be.revertedWithCustomError(taskraEscrow, "OwnableInvalidOwner");
    });

    it("Should revert if deploying with zero address arbitrator or treasury", async function () {
      const TaskraEscrowFactory = await ethers.getContractFactory("TaskraEscrow");
      await expect(
        TaskraEscrowFactory.deploy(owner.address, zeroAddress, treasury.address)
      ).to.be.revertedWithCustomError(taskraEscrow, "InvalidAddress");

      await expect(
        TaskraEscrowFactory.deploy(owner.address, arbitrator.address, zeroAddress)
      ).to.be.revertedWithCustomError(taskraEscrow, "InvalidAddress");
    });
  });

  describe("Escrow Creation", function () {
    it("Should allow creation of an active escrow and update accounting", async function () {
      const initialContractBalance = await ethers.provider.getBalance(await taskraEscrow.getAddress());

      const tx = await taskraEscrow.connect(depositor).createEscrow(taskId, agent.address, {
        value: escrowAmount,
      });

      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        (log: any) => log.fragment && log.fragment.name === "EscrowCreated"
      ) as any;

      expect(event).to.not.be.undefined;
      expect(event.args[0]).to.equal(taskId);
      expect(event.args[1]).to.equal(depositor.address);
      expect(event.args[2]).to.equal(agent.address);
      expect(event.args[3]).to.equal(escrowAmount);

      // Verify global accounting
      expect(await taskraEscrow.totalDeposited()).to.equal(escrowAmount);

      const postContractBalance = await ethers.provider.getBalance(await taskraEscrow.getAddress());
      expect(postContractBalance - initialContractBalance).to.equal(escrowAmount);

      // Verify individual escrow details
      const escrow = await taskraEscrow.getEscrow(taskId);
      expect(escrow.taskId).to.equal(taskId);
      expect(escrow.depositor).to.equal(depositor.address);
      expect(escrow.agent).to.equal(agent.address);
      expect(escrow.amount).to.equal(escrowAmount);
      expect(escrow.slashedAmount).to.equal(0n);
      expect(escrow.status).to.equal(EscrowStatus.ACTIVE);
      expect(escrow.exists).to.be.true;
    });

    it("Should revert if depositing 0 value", async function () {
      await expect(
        taskraEscrow.connect(depositor).createEscrow(taskId, agent.address, { value: 0n })
      ).to.be.revertedWithCustomError(taskraEscrow, "InvalidAmount");
    });

    it("Should revert if agent is the zero address", async function () {
      await expect(
        taskraEscrow.connect(depositor).createEscrow(taskId, zeroAddress, { value: escrowAmount })
      ).to.be.revertedWithCustomError(taskraEscrow, "InvalidAddress");
    });

    it("Should revert if the escrow for the task already exists", async function () {
      await taskraEscrow.connect(depositor).createEscrow(taskId, agent.address, {
        value: escrowAmount,
      });

      await expect(
        taskraEscrow.connect(depositor).createEscrow(taskId, agent.address, { value: escrowAmount })
      ).to.be.revertedWithCustomError(taskraEscrow, "EscrowAlreadyExists");
    });
  });

  describe("Releasing Payments", function () {
    beforeEach(async function () {
      await taskraEscrow.connect(depositor).createEscrow(taskId, agent.address, {
        value: escrowAmount,
      });
    });

    it("Should allow the depositor to release full payment to the agent", async function () {
      const agentInitialBalance = await ethers.provider.getBalance(agent.address);

      const tx = await taskraEscrow.connect(depositor).releasePayment(taskId);
      const receipt = await tx.wait();
      
      const event = receipt?.logs.find(
        (log: any) => log.fragment && log.fragment.name === "EscrowReleased"
      ) as any;

      expect(event).to.not.be.undefined;
      expect(event.args[0]).to.equal(taskId);
      expect(event.args[1]).to.equal(agent.address);
      expect(event.args[2]).to.equal(escrowAmount);

      // Verify status update
      const escrow = await taskraEscrow.getEscrow(taskId);
      expect(escrow.status).to.equal(EscrowStatus.RELEASED);

      // Verify payment receipt
      const agentPostBalance = await ethers.provider.getBalance(agent.address);
      expect(BigInt(agentPostBalance) - BigInt(agentInitialBalance)).to.equal(escrowAmount);

      // Verify accounting variables
      expect(await taskraEscrow.totalReleased()).to.equal(escrowAmount);
    });

    it("Should allow the arbitrator or owner to release payment", async function () {
      const agentInitialBalance = await ethers.provider.getBalance(agent.address);

      // Release by arbitrator
      await taskraEscrow.connect(arbitrator).releasePayment(taskId);

      const agentPostBalance = await ethers.provider.getBalance(agent.address);
      expect(BigInt(agentPostBalance) - BigInt(agentInitialBalance)).to.equal(escrowAmount);
    });

    it("Should revert if an unauthorized caller attempts to release", async function () {
      await expect(
        taskraEscrow.connect(otherAccount).releasePayment(taskId)
      ).to.be.revertedWithCustomError(taskraEscrow, "Unauthorized");
    });

    it("Should revert if attempting to release an escrow that is not active", async function () {
      await taskraEscrow.connect(depositor).releasePayment(taskId);

      await expect(
        taskraEscrow.connect(depositor).releasePayment(taskId)
      ).to.be.revertedWithCustomError(taskraEscrow, "EscrowNotActive");
    });
  });

  describe("Agent Slashing (Dispute Settlement)", function () {
    beforeEach(async function () {
      await taskraEscrow.connect(depositor).createEscrow(taskId, agent.address, {
        value: escrowAmount,
      });
    });

    it("Should allow arbitrator to perform partial slashing", async function () {
      const slashAmount = ethers.parseEther("0.8"); // slash 0.8 native tokens
      const remainingPayout = escrowAmount - slashAmount;

      const depositorInitialBalance = await ethers.provider.getBalance(depositor.address);
      const agentInitialBalance = await ethers.provider.getBalance(agent.address);

      const tx = await taskraEscrow.connect(arbitrator).slashAgent(taskId, slashAmount, depositor.address);
      const receipt = await tx.wait();

      const event = receipt?.logs.find(
        (log: any) => log.fragment && log.fragment.name === "EscrowSlashed"
      ) as any;

      expect(event).to.not.be.undefined;
      expect(event.args[0]).to.equal(taskId);
      expect(event.args[1]).to.equal(agent.address);
      expect(event.args[2]).to.equal(slashAmount);
      expect(event.args[3]).to.equal(depositor.address);

      // Verify status and details
      const escrow = await taskraEscrow.getEscrow(taskId);
      expect(escrow.status).to.equal(EscrowStatus.SLASHED);
      expect(escrow.slashedAmount).to.equal(slashAmount);

      // Verify accounting balances
      const depositorPostBalance = await ethers.provider.getBalance(depositor.address);
      expect(BigInt(depositorPostBalance) - BigInt(depositorInitialBalance)).to.equal(slashAmount);

      const agentPostBalance = await ethers.provider.getBalance(agent.address);
      expect(BigInt(agentPostBalance) - BigInt(agentInitialBalance)).to.equal(remainingPayout);

      // Verify historical stats
      expect(await taskraEscrow.totalSlashed()).to.equal(slashAmount);
      expect(await taskraEscrow.totalReleased()).to.equal(remainingPayout);
    });

    it("Should allow arbitrator to slash the entire escrow amount", async function () {
      const depositorInitialBalance = await ethers.provider.getBalance(depositor.address);
      const agentInitialBalance = await ethers.provider.getBalance(agent.address);

      // Slash 100%
      await taskraEscrow.connect(arbitrator).slashAgent(taskId, escrowAmount, depositor.address);

      const depositorPostBalance = await ethers.provider.getBalance(depositor.address);
      expect(BigInt(depositorPostBalance) - BigInt(depositorInitialBalance)).to.equal(escrowAmount);

      const agentPostBalance = await ethers.provider.getBalance(agent.address);
      expect(BigInt(agentPostBalance) - BigInt(agentInitialBalance)).to.equal(0n);
    });

    it("Should revert slashAgent if slashAmount exceeds total escrow deposit", async function () {
      const excessiveAmount = escrowAmount + 1n;
      await expect(
        taskraEscrow.connect(arbitrator).slashAgent(taskId, excessiveAmount, depositor.address)
      ).to.be.revertedWithCustomError(taskraEscrow, "SlashAmountExceedsDeposit");
    });

    it("Should revert slashAgent if caller is not the arbitrator or owner", async function () {
      await expect(
        taskraEscrow.connect(depositor).slashAgent(taskId, escrowAmount, depositor.address)
      ).to.be.revertedWithCustomError(taskraEscrow, "Unauthorized");
    });

    it("Should revert slashAgent if recipient is zero address", async function () {
      await expect(
        taskraEscrow.connect(arbitrator).slashAgent(taskId, escrowAmount, zeroAddress)
      ).to.be.revertedWithCustomError(taskraEscrow, "InvalidAddress");
    });
  });

  describe("Refunds & Cancellations", function () {
    beforeEach(async function () {
      await taskraEscrow.connect(depositor).createEscrow(taskId, agent.address, {
        value: escrowAmount,
      });
    });

    it("Should allow depositor to cancel task and claim full refund", async function () {
      const depositorInitialBalance = await ethers.provider.getBalance(depositor.address);

      const tx = await taskraEscrow.connect(depositor).refundEscrow(taskId);
      const receipt = await tx.wait();
      
      const gasUsed = receipt ? receipt.gasUsed * receipt.gasPrice : 0n;

      const event = receipt?.logs.find(
        (log: any) => log.fragment && log.fragment.name === "EscrowRefunded"
      ) as any;

      expect(event).to.not.be.undefined;
      expect(event.args[0]).to.equal(taskId);
      expect(event.args[1]).to.equal(depositor.address);
      expect(event.args[2]).to.equal(escrowAmount);

      // Verify status update
      const escrow = await taskraEscrow.getEscrow(taskId);
      expect(escrow.status).to.equal(EscrowStatus.REFUNDED);

      // Verify refund transfer
      const depositorPostBalance = await ethers.provider.getBalance(depositor.address);
      expect(BigInt(depositorPostBalance) - BigInt(depositorInitialBalance)).to.equal(escrowAmount - BigInt(gasUsed));

      // Verify accounting tracker
      expect(await taskraEscrow.totalRefunded()).to.equal(escrowAmount);
    });

    it("Should allow the arbitrator or owner to trigger a refund", async function () {
      const depositorInitialBalance = await ethers.provider.getBalance(depositor.address);

      // Refund by arbitrator
      await taskraEscrow.connect(arbitrator).refundEscrow(taskId);

      const depositorPostBalance = await ethers.provider.getBalance(depositor.address);
      expect(BigInt(depositorPostBalance) - BigInt(depositorInitialBalance)).to.equal(escrowAmount);
    });

    it("Should revert refundEscrow if caller is not authorized", async function () {
      await expect(
        taskraEscrow.connect(otherAccount).refundEscrow(taskId)
      ).to.be.revertedWithCustomError(taskraEscrow, "Unauthorized");
    });
  });

  describe("Administrative Parameter Settings", function () {
    it("Should allow owner to change arbitrator address and emit event", async function () {
      const tx = await taskraEscrow.connect(owner).setArbitrator(otherAccount.address);
      const receipt = await tx.wait();

      const event = receipt?.logs.find(
        (log: any) => log.fragment && log.fragment.name === "ArbitratorUpdated"
      ) as any;

      expect(event).to.not.be.undefined;
      expect(event.args[0]).to.equal(arbitrator.address);
      expect(event.args[1]).to.equal(otherAccount.address);

      expect(await taskraEscrow.arbitrator()).to.equal(otherAccount.address);
    });

    it("Should allow owner to change treasury address and emit event", async function () {
      const tx = await taskraEscrow.connect(owner).setTreasury(otherAccount.address);
      const receipt = await tx.wait();

      const event = receipt?.logs.find(
        (log: any) => log.fragment && log.fragment.name === "TreasuryUpdated"
      ) as any;

      expect(event).to.not.be.undefined;
      expect(event.args[0]).to.equal(treasury.address);
      expect(event.args[1]).to.equal(otherAccount.address);

      expect(await taskraEscrow.treasury()).to.equal(otherAccount.address);
    });

    it("Should revert administrator settings if caller is not the owner", async function () {
      await expect(
        taskraEscrow.connect(depositor).setArbitrator(otherAccount.address)
      ).to.be.revertedWithCustomError(taskraEscrow, "OwnableUnauthorizedAccount");

      await expect(
        taskraEscrow.connect(depositor).setTreasury(otherAccount.address)
      ).to.be.revertedWithCustomError(taskraEscrow, "OwnableUnauthorizedAccount");
    });

    it("Should revert if setting arbitrator or treasury to zero address", async function () {
      await expect(
        taskraEscrow.connect(owner).setArbitrator(zeroAddress)
      ).to.be.revertedWithCustomError(taskraEscrow, "InvalidAddress");

      await expect(
        taskraEscrow.connect(owner).setTreasury(zeroAddress)
      ).to.be.revertedWithCustomError(taskraEscrow, "InvalidAddress");
    });
  });

  describe("Emergency Pausing", function () {
    it("Should allow the owner to pause and unpause the contract", async function () {
      // Pause
      await expect(taskraEscrow.connect(owner).pause())
        .to.emit(taskraEscrow, "Paused")
        .withArgs(owner.address);
      expect(await taskraEscrow.paused()).to.equal(true);

      // Unpause
      await expect(taskraEscrow.connect(owner).unpause())
        .to.emit(taskraEscrow, "Unpaused")
        .withArgs(owner.address);
      expect(await taskraEscrow.paused()).to.equal(false);
    });

    it("Should revert if a non-owner attempts to pause or unpause", async function () {
      await expect(taskraEscrow.connect(depositor).pause())
        .to.be.revertedWithCustomError(taskraEscrow, "OwnableUnauthorizedAccount");

      await expect(taskraEscrow.connect(depositor).unpause())
        .to.be.revertedWithCustomError(taskraEscrow, "OwnableUnauthorizedAccount");
    });

    describe("Paused State Constraints", function () {
      beforeEach(async function () {
        await taskraEscrow.connect(owner).pause();
      });

      it("Should revert createEscrow when paused", async function () {
        await expect(
          taskraEscrow.connect(depositor).createEscrow(taskId, agent.address, {
            value: escrowAmount,
          })
        ).to.be.revertedWithCustomError(taskraEscrow, "EnforcedPause");
      });

      it("Should revert releasePayment, slashAgent, and refundEscrow when paused", async function () {
        await expect(
          taskraEscrow.connect(depositor).releasePayment(taskId)
        ).to.be.revertedWithCustomError(taskraEscrow, "EnforcedPause");

        await expect(
          taskraEscrow.connect(arbitrator).slashAgent(taskId, escrowAmount, depositor.address)
        ).to.be.revertedWithCustomError(taskraEscrow, "EnforcedPause");

        await expect(
          taskraEscrow.connect(depositor).refundEscrow(taskId)
        ).to.be.revertedWithCustomError(taskraEscrow, "EnforcedPause");
      });
    });
  });
});
