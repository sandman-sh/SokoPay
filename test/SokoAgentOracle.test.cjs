const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SokoAgentOracle on Celo", function () {
  let oracleContract, owner, agentOracle, untrustedUser;
  const DEAL_ID = ethers.keccak256(ethers.toUtf8Bytes("SKP-8821"));

  beforeEach(async function () {
    [owner, agentOracle, untrustedUser] = await ethers.getSigners();

    const SokoAgentOracle = await ethers.getContractFactory("SokoAgentOracle");
    oracleContract = await SokoAgentOracle.deploy();
    await oracleContract.waitForDeployment();
  });

  it("Should allow owner to register a verified AI / carrier oracle", async function () {
    await oracleContract.registerOracle(agentOracle.address, "SokoPay Logistics Oracle");
    expect(await oracleContract.authorizedOracles(agentOracle.address)).to.be.true;
    expect(await oracleContract.oracleNames(agentOracle.address)).to.equal("SokoPay Logistics Oracle");
  });

  it("Should allow registered oracle to submit on-chain delivery attestation", async function () {
    await oracleContract.registerOracle(agentOracle.address, "GIG Logistics Node");

    const tx = await oracleContract
      .connect(agentOracle)
      .attestDelivery(DEAL_ID, "GIG-LG-882104", "sha256:b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9");

    const receipt = await tx.wait();
    expect(receipt.status).to.equal(1);

    const [verified, timestamp, oracleAddr, proofHash] = await oracleContract.isDeliveryAttested(DEAL_ID);
    expect(verified).to.be.true;
    expect(oracleAddr).to.equal(agentOracle.address);
    expect(proofHash).to.contain("sha256:b94d27b");
  });

  it("Should reject un-authorized caller from attesting delivery", async function () {
    await expect(
      oracleContract
        .connect(untrustedUser)
        .attestDelivery(DEAL_ID, "FAKE-999", "proof")
    ).to.be.revertedWith("Not an authorized oracle");
  });
});
