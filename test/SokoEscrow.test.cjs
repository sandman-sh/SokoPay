const { expect } = require("chai");
const { ethers } = require("hardhat");
const { toDataSuffix } = require("@celo/attribution-tags");

describe("SokoEscrow Protocol on Celo", function () {
  let escrow, mockCUSD, owner, buyer, seller, arbiter, feeRecipient;
  const DEAL_ID = ethers.keccak256(ethers.toUtf8Bytes("DEAL-SKP-101"));
  const DEAL_REF = "SKP-101";
  const AMOUNT = ethers.parseEther("50"); // 50 cUSD
  const ATTRIBUTION_TAG = "celo_a1b2c3d4e5f6";

  beforeEach(async function () {
    [owner, buyer, seller, arbiter, feeRecipient] = await ethers.getSigners();

    // Deploy Mock cUSD
    const MockToken = await ethers.getContractFactory("MockStablecoin");
    mockCUSD = await MockToken.deploy("Celo Dollar", "cUSD", 18);
    await mockCUSD.waitForDeployment();

    // Deploy SokoEscrow
    const SokoEscrow = await ethers.getContractFactory("SokoEscrow");
    escrow = await SokoEscrow.deploy(arbiter.address, feeRecipient.address);
    await escrow.waitForDeployment();

    // Mint tokens to buyer and approve escrow
    await mockCUSD.mint(buyer.address, ethers.parseEther("1000"));
    await mockCUSD.connect(buyer).approve(await escrow.getAddress(), ethers.MaxUint256);
  });

  it("Should create a deal invoice with correct parameters", async function () {
    const tx = await escrow.createDeal(
      DEAL_ID,
      DEAL_REF,
      buyer.address,
      seller.address,
      await mockCUSD.getAddress(),
      AMOUNT,
      3 * 86400 // 3 days auto-release
    );

    const receipt = await tx.wait();
    expect(receipt.status).to.equal(1);

    const deal = await escrow.getDeal(DEAL_ID);
    expect(deal.dealRef).to.equal(DEAL_REF);
    expect(deal.buyer).to.equal(buyer.address);
    expect(deal.seller).to.equal(seller.address);
    expect(deal.amount).to.equal(AMOUNT);
    expect(deal.status).to.equal(0); // EscrowStatus.Created
  });

  it("Should allow buyer to fund the deal with stablecoin", async function () {
    await escrow.createDeal(
      DEAL_ID,
      DEAL_REF,
      buyer.address,
      seller.address,
      await mockCUSD.getAddress(),
      AMOUNT,
      3 * 86400
    );

    const initialBuyerBal = await mockCUSD.balanceOf(buyer.address);
    const initialContractBal = await mockCUSD.balanceOf(await escrow.getAddress());

    await escrow.connect(buyer).deposit(DEAL_ID);

    const deal = await escrow.getDeal(DEAL_ID);
    expect(deal.status).to.equal(1); // EscrowStatus.Funded

    const finalBuyerBal = await mockCUSD.balanceOf(buyer.address);
    const finalContractBal = await mockCUSD.balanceOf(await escrow.getAddress());

    expect(initialBuyerBal - finalBuyerBal).to.equal(AMOUNT);
    expect(finalContractBal - initialContractBal).to.equal(AMOUNT);
  });

  it("Should allow seller to mark order as dispatched with tracking ref", async function () {
    await escrow.createDeal(
      DEAL_ID,
      DEAL_REF,
      buyer.address,
      seller.address,
      await mockCUSD.getAddress(),
      AMOUNT,
      3 * 86400
    );
    await escrow.connect(buyer).deposit(DEAL_ID);

    const trackingCode = "GIG-EXP-992140";
    await escrow.connect(seller).markDispatched(DEAL_ID, trackingCode);

    const deal = await escrow.getDeal(DEAL_ID);
    expect(deal.status).to.equal(2); // EscrowStatus.Dispatched
    expect(deal.trackingRef).to.equal(trackingCode);
  });

  it("Should release net funds to seller and 0.5% fee to protocol on buyer confirmation", async function () {
    await escrow.createDeal(
      DEAL_ID,
      DEAL_REF,
      buyer.address,
      seller.address,
      await mockCUSD.getAddress(),
      AMOUNT,
      3 * 86400
    );
    await escrow.connect(buyer).deposit(DEAL_ID);
    await escrow.connect(seller).markDispatched(DEAL_ID, "TRACK-123");

    const initialSellerBal = await mockCUSD.balanceOf(seller.address);
    const initialFeeBal = await mockCUSD.balanceOf(feeRecipient.address);

    // Expected 0.5% fee = 50 * 0.005 = 0.25 cUSD
    const expectedFee = (AMOUNT * 50n) / 10000n;
    const expectedNet = AMOUNT - expectedFee;

    await escrow.connect(buyer).confirmDeliveryAndRelease(DEAL_ID);

    const finalSellerBal = await mockCUSD.balanceOf(seller.address);
    const finalFeeBal = await mockCUSD.balanceOf(feeRecipient.address);

    expect(finalSellerBal - initialSellerBal).to.equal(expectedNet);
    expect(finalFeeBal - initialFeeBal).to.equal(expectedFee);

    const deal = await escrow.getDeal(DEAL_ID);
    expect(deal.status).to.equal(4); // EscrowStatus.Released
  });

  it("Should execute transactions carrying ERC-8021 Attribution Tags seamlessly", async function () {
    // Suffix calldata using @celo/attribution-tags
    const customSuffix = toDataSuffix(ATTRIBUTION_TAG);
    expect(customSuffix).to.be.a("string");

    // Populate transaction calldata for createAndFundDeal
    const testDealId = ethers.keccak256(ethers.toUtf8Bytes("DEAL-TAG-TEST"));
    const data = escrow.interface.encodeFunctionData("createAndFundDeal", [
      testDealId,
      "TAG-TEST",
      seller.address,
      await mockCUSD.getAddress(),
      ethers.parseEther("10"),
      86400
    ]);

    // Append attribution tag suffix to calldata (ERC-8021 specification)
    const taggedCalldata = ethers.concat([data, customSuffix]);

    // Send tagged transaction
    const tx = await buyer.sendTransaction({
      to: await escrow.getAddress(),
      data: taggedCalldata,
    });
    const receipt = await tx.wait();
    expect(receipt.status).to.equal(1);

    const deal = await escrow.getDeal(testDealId);
    expect(deal.dealRef).to.equal("TAG-TEST");
    expect(deal.status).to.equal(1); // Funded
  });

  it("Should allow arbiter to resolve disputes with customized split", async function () {
    await escrow.createDeal(
      DEAL_ID,
      DEAL_REF,
      buyer.address,
      seller.address,
      await mockCUSD.getAddress(),
      AMOUNT,
      3 * 86400
    );
    await escrow.connect(buyer).deposit(DEAL_ID);

    // Buyer raises dispute
    await escrow.connect(buyer).raiseDispute(DEAL_ID, "Item delivered was damaged");
    let deal = await escrow.getDeal(DEAL_ID);
    expect(deal.status).to.equal(5); // EscrowStatus.Disputed

    const initialBuyerBal = await mockCUSD.balanceOf(buyer.address);
    const initialSellerBal = await mockCUSD.balanceOf(seller.address);

    // Arbiter resolves: 70% refund to buyer, 30% to seller
    await escrow.connect(arbiter).resolveDispute(DEAL_ID, 70);

    deal = await escrow.getDeal(DEAL_ID);
    expect(deal.status).to.equal(4); // EscrowStatus.Released

    const netAmount = AMOUNT - (AMOUNT * 50n) / 10000n;
    const expectedBuyer = (netAmount * 70n) / 100n;
    const expectedSeller = netAmount - expectedBuyer;

    const finalBuyerBal = await mockCUSD.balanceOf(buyer.address);
    const finalSellerBal = await mockCUSD.balanceOf(seller.address);

    expect(finalBuyerBal - initialBuyerBal).to.equal(expectedBuyer);
    expect(finalSellerBal - initialSellerBal).to.equal(expectedSeller);
  });

  it("Should allow buyer or seller to cancel an unfunded deal invoice", async function () {
    const cancelDealId = ethers.keccak256(ethers.toUtf8Bytes("DEAL-CANCEL-UNFUNDED"));
    await escrow.createDeal(
      cancelDealId,
      "SKP-CANCEL-1",
      buyer.address,
      seller.address,
      await mockCUSD.getAddress(),
      AMOUNT,
      3 * 86400
    );

    // Cancel in Created state
    await escrow.connect(buyer).cancelCreated(cancelDealId);
    const deal = await escrow.getDeal(cancelDealId);
    expect(deal.status).to.equal(6); // EscrowStatus.Refunded
  });

  it("Should enforce 7-day seller dispatch window and allow buyer refund thereafter", async function () {
    const unfulfilledDealId = ethers.keccak256(ethers.toUtf8Bytes("DEAL-UNFULFILLED"));
    await escrow.createDeal(
      unfulfilledDealId,
      "SKP-UNFULFILLED",
      buyer.address,
      seller.address,
      await mockCUSD.getAddress(),
      AMOUNT,
      3 * 86400
    );

    // Deposit funds
    await escrow.connect(buyer).deposit(unfulfilledDealId);

    // Attempt cancel immediately - should revert
    await expect(
      escrow.connect(buyer).cancelUnfulfilled(unfulfilledDealId)
    ).to.be.revertedWith("Seller still has dispatch window");

    // Fast-forward EVM time by 7 days + 1 second
    await ethers.provider.send("evm_increaseTime", [7 * 86400 + 1]);
    await ethers.provider.send("evm_mine");

    const balBefore = await mockCUSD.balanceOf(buyer.address);
    await escrow.connect(buyer).cancelUnfulfilled(unfulfilledDealId);
    const balAfter = await mockCUSD.balanceOf(buyer.address);

    expect(balAfter - balBefore).to.equal(AMOUNT);

    const deal = await escrow.getDeal(unfulfilledDealId);
    expect(deal.status).to.equal(6); // EscrowStatus.Refunded
  });

  it("Should allow auto-release of funds once autoReleaseDuration expires after dispatch", async function () {
    const autoReleaseDealId = ethers.keccak256(ethers.toUtf8Bytes("DEAL-AUTORELEASE"));
    const duration = 2 * 86400; // 2 days

    await escrow.createDeal(
      autoReleaseDealId,
      "SKP-AUTO",
      buyer.address,
      seller.address,
      await mockCUSD.getAddress(),
      AMOUNT,
      duration
    );

    await escrow.connect(buyer).deposit(autoReleaseDealId);
    await escrow.connect(seller).markDispatched(autoReleaseDealId, "TRACK-AUTO");

    // Try auto-release immediately - should revert
    await expect(
      escrow.triggerAutoRelease(autoReleaseDealId)
    ).to.be.revertedWith("Auto-release timeout not reached");

    // Fast-forward past duration
    await ethers.provider.send("evm_increaseTime", [duration + 10]);
    await ethers.provider.send("evm_mine");

    const sellerBalBefore = await mockCUSD.balanceOf(seller.address);
    await escrow.triggerAutoRelease(autoReleaseDealId);
    const sellerBalAfter = await mockCUSD.balanceOf(seller.address);

    const expectedFee = (AMOUNT * 50n) / 10000n;
    const expectedNet = AMOUNT - expectedFee;
    expect(sellerBalAfter - sellerBalBefore).to.equal(expectedNet);

    const deal = await escrow.getDeal(autoReleaseDealId);
    expect(deal.status).to.equal(4); // Released
  });

  it("Should prevent unauthorized callers from performing state changes", async function () {
    const secDealId = ethers.keccak256(ethers.toUtf8Bytes("DEAL-SECURITY"));
    await escrow.createDeal(
      secDealId,
      "SKP-SEC",
      buyer.address,
      seller.address,
      await mockCUSD.getAddress(),
      AMOUNT,
      3 * 86400
    );

    // Non-buyer cannot deposit
    await expect(
      escrow.connect(seller).deposit(secDealId)
    ).to.be.revertedWith("Only designated buyer can fund");

    await escrow.connect(buyer).deposit(secDealId);

    // Non-seller cannot mark dispatched
    await expect(
      escrow.connect(buyer).markDispatched(secDealId, "FAKE")
    ).to.be.revertedWith("Only seller can mark dispatched");

    // Non-buyer cannot confirm release
    await escrow.connect(seller).markDispatched(secDealId, "REAL");
    await expect(
      escrow.connect(seller).confirmDeliveryAndRelease(secDealId)
    ).to.be.revertedWith("Only buyer can release");
  });
});
