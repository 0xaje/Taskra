import { expect } from "chai";
import { ethers } from "hardhat";

describe("ReputationRegistry", function () {
  let reputationRegistry: any;
  let owner: any;
  let validator1: any;
  let agent1: any;
  let agent2: any;
  let agent3: any;
  let agentExtra: any[] = [];
  let otherAccount: any;

  const BASELINE_REPUTATION = 750;
  const MAX_REPUTATION = 1000;
  const MIN_REPUTATION = 1;
  const MAX_MANUAL_ADJUSTMENT = 100;
  const VALIDATOR_COOLDOWN = 5 * 60; // 5 minutes in seconds
  const zeroAddress = ethers.ZeroAddress;

  beforeEach(async function () {
    [owner, validator1, , agent1, agent2, agent3, otherAccount] = await ethers.getSigners();

    // Generate extra signers for testing full leaderboard of 10+ agents
    const allSigners = await ethers.getSigners();
    // Use signers starting from index 7 to avoid conflicts
    agentExtra = allSigners.slice(7, 15);

    const ReputationRegistryFactory = await ethers.getContractFactory("ReputationRegistry");
    reputationRegistry = await ReputationRegistryFactory.deploy(owner.address);
    await reputationRegistry.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the correct owner", async function () {
      expect(await reputationRegistry.owner()).to.equal(owner.address);
    });

    it("Should set the owner as a default validator", async function () {
      expect(await reputationRegistry.isValidator(owner.address)).to.be.true;
    });

    it("Should revert if deploying with zero address initial owner", async function () {
      const ReputationRegistryFactory = await ethers.getContractFactory("ReputationRegistry");
      await expect(
        ReputationRegistryFactory.deploy(zeroAddress)
      ).to.be.revertedWithCustomError(reputationRegistry, "OwnableInvalidOwner");
    });
  });

  describe("Administrative: Validator Privilege", function () {
    it("Should allow owner to authorize and revoke validators", async function () {
      // Authorize
      await expect(reputationRegistry.connect(owner).setValidator(validator1.address, true))
        .to.emit(reputationRegistry, "ValidatorStatusUpdated")
        .withArgs(validator1.address, true);
      expect(await reputationRegistry.isValidator(validator1.address)).to.be.true;

      // Revoke
      await expect(reputationRegistry.connect(owner).setValidator(validator1.address, false))
        .to.emit(reputationRegistry, "ValidatorStatusUpdated")
        .withArgs(validator1.address, false);
      expect(await reputationRegistry.isValidator(validator1.address)).to.be.false;
    });

    it("Should revert if non-owner attempts to authorize validator", async function () {
      await expect(
        reputationRegistry.connect(otherAccount).setValidator(validator1.address, true)
      ).to.be.revertedWithCustomError(reputationRegistry, "OwnableUnauthorizedAccount");
    });

    it("Should revert if setting zero address as validator", async function () {
      await expect(
        reputationRegistry.connect(owner).setValidator(zeroAddress, true)
      ).to.be.revertedWithCustomError(reputationRegistry, "InvalidAddress");
    });
  });

  describe("Agent Initialization", function () {
    beforeEach(async function () {
      await reputationRegistry.connect(owner).setValidator(validator1.address, true);
    });

    it("Should allow authorized validator to initialize agent", async function () {
      await expect(reputationRegistry.connect(validator1).initializeAgent(agent1.address))
        .to.emit(reputationRegistry, "AgentInitialized")
        .withArgs(agent1.address, BASELINE_REPUTATION);

      const profile = await reputationRegistry.getAgentProfile(agent1.address);
      expect(profile.isInitialized).to.be.true;
      expect(profile.reputation).to.equal(BASELINE_REPUTATION);
      expect(profile.successfulTasks).to.equal(0);
      expect(profile.failedTasks).to.equal(0);
      expect(profile.totalEarnings).to.equal(0n);
    });

    it("Should revert if agent is already initialized", async function () {
      await reputationRegistry.connect(validator1).initializeAgent(agent1.address);
      await expect(
        reputationRegistry.connect(validator1).initializeAgent(agent1.address)
      ).to.be.revertedWithCustomError(reputationRegistry, "AgentAlreadyInitialized");
    });

    it("Should revert if initializing zero address agent", async function () {
      await expect(
        reputationRegistry.connect(validator1).initializeAgent(zeroAddress)
      ).to.be.revertedWithCustomError(reputationRegistry, "InvalidAddress");
    });

    it("Should revert if unauthorized caller attempts to initialize agent", async function () {
      await expect(
        reputationRegistry.connect(otherAccount).initializeAgent(agent1.address)
      ).to.be.revertedWithCustomError(reputationRegistry, "UnauthorizedValidator");
    });
  });

  describe("Manual Reputation Adjustments", function () {
    beforeEach(async function () {
      await reputationRegistry.connect(owner).setValidator(validator1.address, true);
      await reputationRegistry.connect(validator1).initializeAgent(agent1.address);
    });

    describe("increaseReputation", function () {
      it("Should allow validator to manually increase agent reputation", async function () {
        const increaseVal = 50;
        await expect(
          reputationRegistry.connect(validator1).increaseReputation(agent1.address, increaseVal, "Excellent support")
        )
          .to.emit(reputationRegistry, "ReputationUpdated")
          .withArgs(agent1.address, BASELINE_REPUTATION, BASELINE_REPUTATION + increaseVal, validator1.address, "Excellent support");

        const profile = await reputationRegistry.getAgentProfile(agent1.address);
        expect(profile.reputation).to.equal(BASELINE_REPUTATION + increaseVal);
      });

      it("Should cap reputation increase at MAX_REPUTATION", async function () {
        // First increase
        await reputationRegistry.connect(validator1).increaseReputation(agent1.address, 90, "Inc 1");
        
        // Fast forward cooldown to allow next update from same validator
        await ethers.provider.send("evm_increaseTime", [VALIDATOR_COOLDOWN + 1]);
        await ethers.provider.send("evm_mine", []);

        // Second increase which would overflow MAX_REPUTATION (750 + 90 + 200 = 1040 > 1000)
        await reputationRegistry.connect(validator1).increaseReputation(agent1.address, 90, "Inc 2");

        const profile = await reputationRegistry.getAgentProfile(agent1.address);
        expect(profile.reputation).to.equal(930); // 750 + 90 + 90

        await ethers.provider.send("evm_increaseTime", [VALIDATOR_COOLDOWN + 1]);
        await ethers.provider.send("evm_mine", []);

        await reputationRegistry.connect(validator1).increaseReputation(agent1.address, 90, "Inc 3");
        const profileCapped = await reputationRegistry.getAgentProfile(agent1.address);
        expect(profileCapped.reputation).to.equal(MAX_REPUTATION);
      });

      it("Should revert if increase value exceeds limit or is zero", async function () {
        await expect(
          reputationRegistry.connect(validator1).increaseReputation(agent1.address, MAX_MANUAL_ADJUSTMENT + 1, "Too high")
        ).to.be.revertedWithCustomError(reputationRegistry, "WeightExceedsLimit");

        await expect(
          reputationRegistry.connect(validator1).increaseReputation(agent1.address, 0, "Zero")
        ).to.be.revertedWithCustomError(reputationRegistry, "WeightExceedsLimit");
      });

      it("Should enforce validator cooldown on subsequent manual modifications", async function () {
        await reputationRegistry.connect(validator1).increaseReputation(agent1.address, 10, "First adjustment");

        // Try adjusting again immediately by same validator - should fail
        await expect(
          reputationRegistry.connect(validator1).increaseReputation(agent1.address, 10, "Too soon")
        ).to.be.revertedWithCustomError(reputationRegistry, "CooldownActive");

        // Try adjusting by a different validator - should succeed without cooldown constraint
        await reputationRegistry.connect(owner).increaseReputation(agent1.address, 10, "Owner bypass/separate cooldown");

        // Move time past cooldown
        await ethers.provider.send("evm_increaseTime", [VALIDATOR_COOLDOWN + 1]);
        await ethers.provider.send("evm_mine", []);

        // Validator1 can now adjust again
        await expect(
          reputationRegistry.connect(validator1).increaseReputation(agent1.address, 10, "Post cooldown adjustment")
        ).to.not.be.reverted;
      });
    });

    describe("decreaseReputation", function () {
      it("Should allow validator to manually decrease agent reputation", async function () {
        const decreaseVal = 50;
        await expect(
          reputationRegistry.connect(validator1).decreaseReputation(agent1.address, decreaseVal, "Bad latency")
        )
          .to.emit(reputationRegistry, "ReputationUpdated")
          .withArgs(agent1.address, BASELINE_REPUTATION, BASELINE_REPUTATION - decreaseVal, validator1.address, "Bad latency");

        const profile = await reputationRegistry.getAgentProfile(agent1.address);
        expect(profile.reputation).to.equal(BASELINE_REPUTATION - decreaseVal);
      });

      it("Should floor reputation decrease at MIN_REPUTATION", async function () {
        // Decrease by 100 multiple times, checking cooldowns
        let currentValidator = validator1;
        await reputationRegistry.connect(currentValidator).decreaseReputation(agent1.address, 100, "Dec 1");
        
        await ethers.provider.send("evm_increaseTime", [VALIDATOR_COOLDOWN + 1]);
        await ethers.provider.send("evm_mine", []);
        await reputationRegistry.connect(currentValidator).decreaseReputation(agent1.address, 100, "Dec 2");

        await ethers.provider.send("evm_increaseTime", [VALIDATOR_COOLDOWN + 1]);
        await ethers.provider.send("evm_mine", []);
        await reputationRegistry.connect(currentValidator).decreaseReputation(agent1.address, 100, "Dec 3");

        await ethers.provider.send("evm_increaseTime", [VALIDATOR_COOLDOWN + 1]);
        await ethers.provider.send("evm_mine", []);
        await reputationRegistry.connect(currentValidator).decreaseReputation(agent1.address, 100, "Dec 4");

        await ethers.provider.send("evm_increaseTime", [VALIDATOR_COOLDOWN + 1]);
        await ethers.provider.send("evm_mine", []);
        await reputationRegistry.connect(currentValidator).decreaseReputation(agent1.address, 100, "Dec 5");

        await ethers.provider.send("evm_increaseTime", [VALIDATOR_COOLDOWN + 1]);
        await ethers.provider.send("evm_mine", []);
        await reputationRegistry.connect(currentValidator).decreaseReputation(agent1.address, 100, "Dec 6");

        await ethers.provider.send("evm_increaseTime", [VALIDATOR_COOLDOWN + 1]);
        await ethers.provider.send("evm_mine", []);
        await reputationRegistry.connect(currentValidator).decreaseReputation(agent1.address, 100, "Dec 7");

        await ethers.provider.send("evm_increaseTime", [VALIDATOR_COOLDOWN + 1]);
        await ethers.provider.send("evm_mine", []);
        // At this point rep is 750 - 700 = 50. Let's decrease by 100 again to reach MIN_REPUTATION (1)
        await reputationRegistry.connect(currentValidator).decreaseReputation(agent1.address, 100, "Dec 8");

        const profileFloored = await reputationRegistry.getAgentProfile(agent1.address);
        expect(profileFloored.reputation).to.equal(MIN_REPUTATION);
      });

      it("Should revert if decrease value exceeds limit or is zero", async function () {
        await expect(
          reputationRegistry.connect(validator1).decreaseReputation(agent1.address, MAX_MANUAL_ADJUSTMENT + 1, "Too high")
        ).to.be.revertedWithCustomError(reputationRegistry, "WeightExceedsLimit");

        await expect(
          reputationRegistry.connect(validator1).decreaseReputation(agent1.address, 0, "Zero")
        ).to.be.revertedWithCustomError(reputationRegistry, "WeightExceedsLimit");
      });
    });
  });

  describe("Automated Task Actions", function () {
    beforeEach(async function () {
      await reputationRegistry.connect(owner).setValidator(validator1.address, true);
      await reputationRegistry.connect(validator1).initializeAgent(agent1.address);
    });

    describe("recordTaskSuccess", function () {
      it("Should update successfulTasks count and totalEarnings", async function () {
        const reward = ethers.parseEther("0.5"); // 0.5 ETH
        await expect(reputationRegistry.connect(validator1).recordTaskSuccess(agent1.address, reward))
          .to.emit(reputationRegistry, "TaskRecorded")
          .withArgs(agent1.address, true, reward, BASELINE_REPUTATION + 5 + 5); // 5 base + (0.5/0.1) = 10 total gain

        const profile = await reputationRegistry.getAgentProfile(agent1.address);
        expect(profile.successfulTasks).to.equal(1);
        expect(profile.totalEarnings).to.equal(reward);
        expect(profile.reputation).to.equal(BASELINE_REPUTATION + 10);
      });

      it("Should correctly cap the complexity weight bonus at 20 points", async function () {
        const largeReward = ethers.parseEther("3.0"); // 3.0 ETH reward -> bonus would be 30, but capped at 20
        await reputationRegistry.connect(validator1).recordTaskSuccess(agent1.address, largeReward);

        const profile = await reputationRegistry.getAgentProfile(agent1.address);
        // repGain = 5 base + 20 capped bonus = 25
        expect(profile.reputation).to.equal(BASELINE_REPUTATION + 25);
        expect(profile.totalEarnings).to.equal(largeReward);
      });

      it("Should handle multiple successful tasks accumulating correctly", async function () {
        const reward1 = ethers.parseEther("0.2"); // +2 bonus, total +7
        const reward2 = ethers.parseEther("0.4"); // +4 bonus, total +9

        await reputationRegistry.connect(validator1).recordTaskSuccess(agent1.address, reward1);
        await reputationRegistry.connect(validator1).recordTaskSuccess(agent1.address, reward2);

        const profile = await reputationRegistry.getAgentProfile(agent1.address);
        expect(profile.successfulTasks).to.equal(2);
        expect(profile.reputation).to.equal(BASELINE_REPUTATION + 7 + 9);
        expect(profile.totalEarnings).to.equal(reward1 + reward2);
      });

      it("Should revert if recordTaskSuccess called by unauthorized validator", async function () {
        await expect(
          reputationRegistry.connect(otherAccount).recordTaskSuccess(agent1.address, ethers.parseEther("0.1"))
        ).to.be.revertedWithCustomError(reputationRegistry, "UnauthorizedValidator");
      });
    });

    describe("recordTaskFailure", function () {
      it("Should update failedTasks count and adjust reputation with penalty", async function () {
        const reward = ethers.parseEther("0.5"); // 0.5 ETH -> weight bonus 5 -> penalty = 20 + 2*5 = 30 points
        await expect(reputationRegistry.connect(validator1).recordTaskFailure(agent1.address, reward))
          .to.emit(reputationRegistry, "TaskRecorded")
          .withArgs(agent1.address, false, reward, BASELINE_REPUTATION - 30);

        const profile = await reputationRegistry.getAgentProfile(agent1.address);
        expect(profile.failedTasks).to.equal(1);
        expect(profile.reputation).to.equal(BASELINE_REPUTATION - 30);
      });

      it("Should cap the penalty weight bonus at 20, leading to a maximum penalty of 60 points", async function () {
        const largeReward = ethers.parseEther("5.0"); // 5 ETH -> weight bonus 50, capped at 20 -> penalty = 20 + 2*20 = 60 points
        await reputationRegistry.connect(validator1).recordTaskFailure(agent1.address, largeReward);

        const profile = await reputationRegistry.getAgentProfile(agent1.address);
        expect(profile.reputation).to.equal(BASELINE_REPUTATION - 60);
      });

      it("Should revert if recordTaskFailure called by unauthorized validator", async function () {
        await expect(
          reputationRegistry.connect(otherAccount).recordTaskFailure(agent1.address, ethers.parseEther("0.1"))
        ).to.be.revertedWithCustomError(reputationRegistry, "UnauthorizedValidator");
      });
    });
  });

  describe("Leaderboard Functionality", function () {
    it("Should track, sort, and retrieve top agents correctly", async function () {
      // 1. Initialize 5 agents
      const agents = [agent1, agent2, agent3, ...agentExtra.slice(0, 2)];
      for (const ag of agents) {
        await reputationRegistry.connect(owner).initializeAgent(ag.address);
      }

      // Initial top agents - they all have baseline reputation (750), so order is insertion-based or same-valued
      let topAgents = await reputationRegistry.getTopAgents();
      expect(topAgents.length).to.equal(5);

      // 2. Adjust reputation to create clear order:
      // agent2 -> 900
      // agent1 -> 850
      // agent3 -> 800
      // agentExtra[0] -> 750
      // agentExtra[1] -> 600
      
      // Let's use recordTaskSuccess to update reputations
      // agent2: success with large reward (+25 rep) -> 775
      await reputationRegistry.connect(owner).recordTaskSuccess(agent2.address, ethers.parseEther("3.0"));
      // agent2: success again to get extra rep -> +25 -> 800
      await reputationRegistry.connect(owner).recordTaskSuccess(agent2.address, ethers.parseEther("3.0"));

      // agent1: success with smaller reward (+7 rep) -> 757
      await reputationRegistry.connect(owner).recordTaskSuccess(agent1.address, ethers.parseEther("0.2"));

      // agentExtra[1]: record failure -> -30 -> 720
      await reputationRegistry.connect(owner).recordTaskFailure(agents[4].address, ethers.parseEther("0.5"));

      topAgents = await reputationRegistry.getTopAgents();
      
      // Verify correct order on leaderboard
      // agent2 (800) > agent1 (757) > agent3 (750) = agentExtra[0] (750) > agentExtra[1] (720)
      expect(topAgents[0]).to.equal(agent2.address);
      expect(topAgents[1]).to.equal(agent1.address);
      
      // agentExtra[1] must be at the bottom (index 4)
      expect(topAgents[4]).to.equal(agents[4].address);
    });

    it("Should enforce leaderboard limit of 10 agents", async function () {
      // Initialize 12 agents
      const allAgentsToTest = [agent1, agent2, agent3, ...agentExtra.slice(0, 9)];
      for (const ag of allAgentsToTest) {
        await reputationRegistry.connect(owner).initializeAgent(ag.address);
      }

      // Check that leaderboard length does not exceed 10
      const topAgents = await reputationRegistry.getTopAgents();
      expect(topAgents.length).to.equal(10);
    });

    it("Should correctly maintain sorting when agent reputation increases/decreases", async function () {
      // Initialize 3 agents
      await reputationRegistry.connect(owner).initializeAgent(agent1.address);
      await reputationRegistry.connect(owner).initializeAgent(agent2.address);
      await reputationRegistry.connect(owner).initializeAgent(agent3.address);

      // Make agent3 the highest
      await reputationRegistry.connect(owner).recordTaskSuccess(agent3.address, ethers.parseEther("3.0")); // 775
      // Make agent1 the lowest
      await reputationRegistry.connect(owner).recordTaskFailure(agent1.address, ethers.parseEther("3.0")); // 690
      // agent2 is baseline 750

      let top = await reputationRegistry.getTopAgents();
      expect(top[0]).to.equal(agent3.address);
      expect(top[1]).to.equal(agent2.address);
      expect(top[2]).to.equal(agent1.address);

      // Now decrease agent3 and increase agent1
      // agent3 penalty: 60 points -> 775 - 60 = 715
      await reputationRegistry.connect(owner).recordTaskFailure(agent3.address, ethers.parseEther("3.0"));
      // agent1 success: +25 points -> 690 + 25 = 715
      await reputationRegistry.connect(owner).recordTaskSuccess(agent1.address, ethers.parseEther("3.0"));
      // agent1 success: +25 points -> 715 + 25 = 740
      await reputationRegistry.connect(owner).recordTaskSuccess(agent1.address, ethers.parseEther("3.0"));

      top = await reputationRegistry.getTopAgents();
      // Current ranks should be:
      // agent2 (750) > agent1 (740) > agent3 (715)
      expect(top[0]).to.equal(agent2.address);
      expect(top[1]).to.equal(agent1.address);
      expect(top[2]).to.equal(agent3.address);
    });
  });
});
