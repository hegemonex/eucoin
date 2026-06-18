const { ethers } = require("hardhat");
const { expect } = require("chai");

describe("EUcoin", function () {
  let token;
  let fundingWallet;
  let addr1;
  let addr2;

  const TOTAL_SUPPLY = ethers.parseUnits("14", 18); // 14 EUC

  beforeEach(async function () {
    [fundingWallet, addr1, addr2] = await ethers.getSigners();

    const EUcoin = await ethers.getContractFactory("EUcoin");
    token = await EUcoin.deploy(fundingWallet.address);
  });

  // ── Deployment ──────────────────────────────────────────────────────────────

  describe("Deployment", function () {
    it("should have the correct name", async function () {
      expect(await token.name()).to.equal("EUcoin");
    });

    it("should have the correct symbol", async function () {
      expect(await token.symbol()).to.equal("EUC");
    });

    it("should have 18 decimals", async function () {
      expect(await token.decimals()).to.equal(18);
    });

    it("should have a total supply of 14 EUC", async function () {
      expect(await token.totalSupply()).to.equal(TOTAL_SUPPLY);
    });

    it("should assign the entire supply to the funding wallet", async function () {
      expect(await token.balanceOf(fundingWallet.address)).to.equal(TOTAL_SUPPLY);
    });

    it("should give addr1 a zero balance at deployment", async function () {
      expect(await token.balanceOf(addr1.address)).to.equal(0n);
    });
  });

  // ── Transfer ─────────────────────────────────────────────────────────────────

  describe("Transfer", function () {
    it("should transfer tokens from funding wallet to addr1", async function () {
      const amount = ethers.parseUnits("5", 18);

      await token.connect(fundingWallet).transfer(addr1.address, amount);

      expect(await token.balanceOf(fundingWallet.address)).to.equal(TOTAL_SUPPLY - amount);
      expect(await token.balanceOf(addr1.address)).to.equal(amount);
    });

    it("should emit a Transfer event", async function () {
      const amount = ethers.parseUnits("3", 18);

      await expect(token.connect(fundingWallet).transfer(addr1.address, amount))
        .to.emit(token, "Transfer")
        .withArgs(fundingWallet.address, addr1.address, amount);
    });

    it("should revert when sender has insufficient balance", async function () {
      const tooMuch = TOTAL_SUPPLY + 1n;

      await expect(
        token.connect(fundingWallet).transfer(addr1.address, tooMuch)
      ).to.be.revertedWithCustomError(token, "ERC20InsufficientBalance");
    });

    it("should revert when transferring to the zero address", async function () {
      await expect(
        token.connect(fundingWallet).transfer(ethers.ZeroAddress, 1n)
      ).to.be.revertedWithCustomError(token, "ERC20InvalidReceiver");
    });
  });

  // ── Approve & Allowance ───────────────────────────────────────────────────────

  describe("Approve & Allowance", function () {
    it("should set the correct allowance", async function () {
      const amount = ethers.parseUnits("4", 18);

      await token.connect(fundingWallet).approve(addr1.address, amount);

      expect(await token.allowance(fundingWallet.address, addr1.address)).to.equal(amount);
    });

    it("should emit an Approval event", async function () {
      const amount = ethers.parseUnits("4", 18);

      await expect(token.connect(fundingWallet).approve(addr1.address, amount))
        .to.emit(token, "Approval")
        .withArgs(fundingWallet.address, addr1.address, amount);
    });
  });

  // ── TransferFrom ──────────────────────────────────────────────────────────────

  describe("TransferFrom", function () {
    it("should allow a spender to transfer on behalf of the funding wallet", async function () {
      const amount = ethers.parseUnits("6", 18);

      await token.connect(fundingWallet).approve(addr1.address, amount);
      await token.connect(addr1).transferFrom(fundingWallet.address, addr2.address, amount);

      expect(await token.balanceOf(fundingWallet.address)).to.equal(TOTAL_SUPPLY - amount);
      expect(await token.balanceOf(addr2.address)).to.equal(amount);
      expect(await token.allowance(fundingWallet.address, addr1.address)).to.equal(0n);
    });

    it("should revert when amount exceeds allowance", async function () {
      const approved = ethers.parseUnits("2", 18);
      const tooMuch  = ethers.parseUnits("3", 18);

      await token.connect(fundingWallet).approve(addr1.address, approved);

      await expect(
        token.connect(addr1).transferFrom(fundingWallet.address, addr2.address, tooMuch)
      ).to.be.revertedWithCustomError(token, "ERC20InsufficientAllowance");
    });
  });
});
