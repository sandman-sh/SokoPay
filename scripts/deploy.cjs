const { ethers, artifacts } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const isMainnet = network.name === "celo";
  const isSepolia = network.name === "celoSepolia";
  const isLocal = !isMainnet && !isSepolia;

  console.log(`[Deploy] Target Network: ${network.name.toUpperCase()} (Chain ID: ${network.config.chainId})`);

  const signers = await ethers.getSigners();
  if (signers.length === 0) {
    throw new Error(`No private key configured for network ${network.name}. Please set PRIVATE_KEY in .env`);
  }

  const deployer = signers[0];
  console.log("Deployer Address:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer Balance:", ethers.formatEther(balance), "CELO");

  if (balance === 0n && !isLocal) {
    console.warn("\n⚠️ WARNING: Deployer account has 0 CELO. Transactions will fail without gas.");
    console.warn("Please send a small amount of CELO (e.g. 0.1 CELO) to:", deployer.address);
  }

  const arbiterAddress = process.env.ARBITER_ADDRESS || deployer.address;
  const feeRecipientAddress = process.env.FEE_RECIPIENT_ADDRESS || deployer.address;

  // 1. Deploy SokoEscrow
  console.log("\n[1/3] Deploying SokoEscrow Protocol...");
  const SokoEscrow = await ethers.getContractFactory("SokoEscrow");
  const escrow = await SokoEscrow.deploy(arbiterAddress, feeRecipientAddress);
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();
  console.log(`✓ SokoEscrow successfully deployed to: ${escrowAddress}`);

  // 2. Deploy SokoAgentOracle (ERC-8004 Attestation Protocol)
  console.log("\n[2/3] Deploying SokoAgentOracle...");
  const SokoAgentOracle = await ethers.getContractFactory("SokoAgentOracle");
  const oracle = await SokoAgentOracle.deploy();
  await oracle.waitForDeployment();
  const oracleAddress = await oracle.getAddress();
  console.log(`✓ SokoAgentOracle successfully deployed to: ${oracleAddress}`);

  // 3. Register logistics oracle agent
  console.log("\n[3/3] Registering SokoPay Logistics Oracle...");
  const oracleAgent = process.env.ORACLE_AGENT_ADDRESS || deployer.address;
  const regTx = await oracle.registerOracle(oracleAgent, "SokoPay Autonomous Logistics Oracle");
  await regTx.wait();
  console.log(`✓ Registered ${oracleAgent} as authorized logistics oracle.`);

  let tokens = {};

  if (isLocal) {
    const buyer = signers[1] || deployer;
    const seller = signers[2] || deployer;

    console.log("\nDeploying local devnet stablecoins...");
    const MockToken = await ethers.getContractFactory("MockStablecoin");

    const cUSD = await MockToken.deploy("Celo Dollar", "cUSD", 18);
    await cUSD.waitForDeployment();
    const cUSDAddress = await cUSD.getAddress();

    const cNGN = await MockToken.deploy("cNGN Stablecoin", "cNGN", 18);
    await cNGN.waitForDeployment();
    const cNGNAddress = await cNGN.getAddress();

    const USAT = await MockToken.deploy("USA₮ (Self x Tether)", "USAT", 6);
    await USAT.waitForDeployment();
    const USATAddress = await USAT.getAddress();

    tokens = {
      cUSD: { address: cUSDAddress, symbol: "cUSD", decimals: 18 },
      cNGN: { address: cNGNAddress, symbol: "cNGN", decimals: 18 },
      USAT: { address: USATAddress, symbol: "USAT", decimals: 6 },
    };

    // Fund test buyer & seller
    await cUSD.mint(buyer.address, ethers.parseEther("5000"));
    await cNGN.mint(buyer.address, ethers.parseEther("500000"));
    await USAT.mint(buyer.address, 5000n * 10n ** 6n);
    await cUSD.mint(seller.address, ethers.parseEther("500"));

    await cUSD.connect(buyer).approve(escrowAddress, ethers.MaxUint256);
    await cNGN.connect(buyer).approve(escrowAddress, ethers.MaxUint256);
    await USAT.connect(buyer).approve(escrowAddress, ethers.MaxUint256);

    // Seed local deal
    const dealId = ethers.keccak256(ethers.toUtf8Bytes("SKP-8821"));
    await escrow.createDeal(
      dealId,
      "SKP-8821",
      buyer.address,
      seller.address,
      cUSDAddress,
      ethers.parseEther("65"),
      3 * 86400
    );
    await escrow.connect(buyer).deposit(dealId);
    console.log("Seeded local onchain deal #SKP-8821 (Funded with 65 cUSD)");
  } else if (isMainnet) {
    // Official Celo Mainnet verified token addresses
    tokens = {
      cUSD: { address: "0x765DE816845861e75A25fCA122bb6898B8B1282a", symbol: "cUSD", decimals: 18 },
      USDT: { address: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e", symbol: "USDT", decimals: 6 },
      USDC: { address: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C", symbol: "USDC", decimals: 6 },
      cEUR: { address: "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73", symbol: "cEUR", decimals: 18 },
      cREAL: { address: "0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787", symbol: "cREAL", decimals: 18 },
    };
    console.log("\nConfigured official Celo Mainnet token contracts:");
    Object.entries(tokens).forEach(([s, t]) => console.log(`  - ${s}: ${t.address}`));
  } else if (isSepolia) {
    // Official Celo Sepolia L2 token addresses
    tokens = {
      cUSD: { address: "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1", symbol: "cUSD", decimals: 18 },
      cEUR: { address: "0x10c892A6EC43a53E45D0B916B4b7D383B1b78C0F", symbol: "cEUR", decimals: 18 },
      cREAL: { address: "0xE4D517785D091D3c54818832dB606C3cA5241471", symbol: "cREAL", decimals: 18 },
      USDT: { address: "0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B", symbol: "USDT", decimals: 18 },
    };
    console.log("\nConfigured official Celo Sepolia L2 token contracts:");
    Object.entries(tokens).forEach(([s, t]) => console.log(`  - ${s}: ${t.address}`));
  }

  // Save deployment file
  const deploymentData = {
    network: network.name,
    chainId: network.config.chainId,
    rpcUrl: network.config.url || "http://127.0.0.1:8545",
    escrowAddress,
    oracleAddress,
    arbiterAddress,
    feeRecipientAddress,
    tokens,
    deployedAt: new Date().toISOString(),
  };

  const filename = isMainnet ? "deployed-mainnet.json" : isSepolia ? "deployed-sepolia.json" : "deployed.json";
  const outputPath = path.join(__dirname, "..", "server", filename);
  fs.writeFileSync(outputPath, JSON.stringify(deploymentData, null, 2));
  console.log(`\nDeployment metadata saved to: ${outputPath}`);

  // Also save ABIs
  const escrowArtifact = await artifacts.readArtifact("SokoEscrow");
  fs.writeFileSync(path.join(__dirname, "..", "server", "SokoEscrowABI.json"), JSON.stringify(escrowArtifact.abi, null, 2));

  const oracleArtifact = await artifacts.readArtifact("SokoAgentOracle");
  fs.writeFileSync(path.join(__dirname, "..", "server", "SokoAgentOracleABI.json"), JSON.stringify(oracleArtifact.abi, null, 2));

  console.log("\n========================================================");
  console.log(`  🎉 DEPLOYMENT SUCCESSFUL ON ${network.name.toUpperCase()}!`);
  console.log(`  Escrow Contract: ${escrowAddress}`);
  console.log(`  Oracle Contract: ${oracleAddress}`);
  if (isMainnet) {
    console.log(`  Celoscan Explorer: https://celoscan.io/address/${escrowAddress}`);
    console.log(`\n  👉 To activate in your app .env:`);
    console.log(`     ACTIVE_NETWORK=celo-mainnet`);
    console.log(`     ESCROW_ADDRESS_MAINNET=${escrowAddress}`);
  } else if (isSepolia) {
    console.log(`  Blockscout: https://celo-sepolia.blockscout.com/address/${escrowAddress}`);
    console.log(`\n  👉 To activate in your app .env:`);
    console.log(`     ACTIVE_NETWORK=celo-sepolia`);
    console.log(`     ESCROW_ADDRESS_SEPOLIA=${escrowAddress}`);
  }
  console.log("========================================================\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
