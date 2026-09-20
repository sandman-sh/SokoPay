import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { toDataSuffix } from "@celo/attribution-tags";

import { getDealMetadata, saveDealMetadata } from "./storage.js";
import { getActiveNetwork } from "./networks.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load deployment and ABI info
const deploymentPath = path.join(__dirname, "deployed.json");
const escrowAbiPath = path.join(__dirname, "SokoEscrowABI.json");
const tokenAbiPath = path.join(__dirname, "TokenABI.json");

const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));
const escrowAbi = JSON.parse(fs.readFileSync(escrowAbiPath, "utf-8"));
const tokenAbi = JSON.parse(fs.readFileSync(tokenAbiPath, "utf-8"));

const oracleAbiPath = path.join(__dirname, "SokoAgentOracleABI.json");
let oracleAbi = [];
if (fs.existsSync(oracleAbiPath)) {
  try {
    oracleAbi = JSON.parse(fs.readFileSync(oracleAbiPath, "utf-8"));
  } catch (e) {}
}

import dotenv from "dotenv";
dotenv.config();

export let activeNet = getActiveNetwork();
export let activeRpcUrl = activeNet.rpcUrl || deployment.rpcUrl;
export let provider = new ethers.JsonRpcProvider(activeRpcUrl, undefined, { staticNetwork: true });

// Standard local accounts from Hardhat node or process.env overrides
export const DEPLOYER_KEY =
  process.env.DEPLOYER_PRIVATE_KEY || process.env.PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
export const BUYER_KEY =
  process.env.BUYER_PRIVATE_KEY || (activeNet.id === "localhost" ? "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" : DEPLOYER_KEY);
export const SELLER_KEY =
  process.env.SELLER_PRIVATE_KEY || (activeNet.id === "localhost" ? "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a" : DEPLOYER_KEY);
export const ARBITER_KEY =
  process.env.ARBITER_PRIVATE_KEY || (activeNet.id === "localhost" ? "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6" : DEPLOYER_KEY);

export let deployerSigner = new ethers.Wallet(DEPLOYER_KEY, provider);
export let buyerSigner = new ethers.Wallet(BUYER_KEY, provider);
export let sellerSigner = new ethers.Wallet(SELLER_KEY, provider);
export let arbiterSigner = new ethers.Wallet(ARBITER_KEY, provider);

export let activeEscrowAddress = activeNet.escrowAddress || deployment.escrowAddress;
export let escrowContract = new ethers.Contract(activeEscrowAddress, escrowAbi, provider);

export let activeOracleAddress = activeNet.oracleAddress || deployment.oracleAddress;
export let oracleContract =
  activeOracleAddress && oracleAbi.length > 0
    ? new ethers.Contract(activeOracleAddress, oracleAbi, provider)
    : null;

export const ATTRIBUTION_TAG = process.env.CELO_ATTRIBUTION_TAG || "celo_sokopay1234";

// Token instances mapped dynamically from active network
export let netTokens = activeNet.tokens || deployment.tokens || {};
export const tokens = {};

function initTokens() {
  for (const key of Object.keys(tokens)) delete tokens[key];
  for (const [symbol, config] of Object.entries(netTokens)) {
    if (config && config.address) {
      tokens[symbol] = new ethers.Contract(config.address, tokenAbi, provider);
    }
  }
  if (!tokens.cUSD && deployment.tokens?.cUSD) {
    tokens.cUSD = new ethers.Contract(deployment.tokens.cUSD.address, tokenAbi, provider);
  }
}
initTokens();

/**
 * Rebinds all onchain providers, contracts, and signers when the active network is switched
 */
export function syncOnchainNetwork() {
  activeNet = getActiveNetwork();
  activeRpcUrl = activeNet.rpcUrl || deployment.rpcUrl;
  provider = new ethers.JsonRpcProvider(activeRpcUrl, undefined, { staticNetwork: true });

  const isLocal = activeNet.id === "localhost";
  const defKey = DEPLOYER_KEY;
  deployerSigner = new ethers.Wallet(DEPLOYER_KEY, provider);
  buyerSigner = new ethers.Wallet(process.env.BUYER_PRIVATE_KEY || (isLocal ? "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" : defKey), provider);
  sellerSigner = new ethers.Wallet(process.env.SELLER_PRIVATE_KEY || (isLocal ? "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a" : defKey), provider);
  arbiterSigner = new ethers.Wallet(process.env.ARBITER_PRIVATE_KEY || (isLocal ? "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6" : defKey), provider);

  activeEscrowAddress = activeNet.escrowAddress || deployment.escrowAddress;
  escrowContract = new ethers.Contract(activeEscrowAddress, escrowAbi, provider);

  activeOracleAddress = activeNet.oracleAddress || deployment.oracleAddress;
  oracleContract =
    activeOracleAddress && oracleAbi.length > 0
      ? new ethers.Contract(activeOracleAddress, oracleAbi, provider)
      : null;

  netTokens = activeNet.tokens || deployment.tokens || {};
  initTokens();

  console.log(`[Onchain] Reconnected to ${activeNet.name} (${activeRpcUrl}) | Escrow: ${activeEscrowAddress}`);
  return { activeNet, escrowAddress: activeEscrowAddress };
}

const statusEnum = ["Created", "Funded", "Dispatched", "Delivered", "Released", "Disputed", "Refunded"];

/**
 * Reads all deals directly from onchain contract storage
 */
export async function getOnchainDeals() {
  const dealIds = await escrowContract.getAllDealIds();
  const deals = [];

  for (const dealId of dealIds) {
    const raw = await escrowContract.getDeal(dealId);
    let tokenSymbol = "cUSD";
    let decimals = 18;

    const matchedToken = Object.values(netTokens).find(
      (t) => t?.address && t.address.toLowerCase() === raw.token.toLowerCase()
    );

    if (matchedToken) {
      tokenSymbol = matchedToken.symbol;
      decimals = matchedToken.decimals || 18;
    } else if (deployment.tokens?.cUSD && raw.token.toLowerCase() === deployment.tokens.cUSD.address.toLowerCase()) {
      tokenSymbol = "cUSD";
      decimals = 18;
    }

    const netBigInt = raw.amount >= raw.feeAmount ? raw.amount - raw.feeAmount : 0n;
    const formattedAmount = ethers.formatUnits(raw.amount, decimals);
    const formattedFee = ethers.formatUnits(raw.feeAmount, decimals);
    const netPayout = ethers.formatUnits(netBigInt, decimals);

    const meta = getDealMetadata(raw.dealRef);

    deals.push({
      dealId: raw.dealId,
      dealRef: raw.dealRef,
      title: meta?.title || `Social Commerce Item #${raw.dealRef}`,
      description: meta?.desc || "Trustless peer-to-peer escrow purchase on Celo L2",
      imageUrl: meta?.imageUrl || null,
      sellerHandle: meta?.sellerHandle || null,
      carrier: meta?.carrier || "Standard Courier",
      buyer: raw.buyer,
      seller: raw.seller,
      tokenAddress: raw.token,
      tokenSymbol,
      amount: formattedAmount,
      feeAmount: formattedFee,
      netAmount: netPayout,
      createdAt: Number(raw.createdAt) * 1000,
      dispatchedAt: Number(raw.dispatchedAt) > 0 ? Number(raw.dispatchedAt) * 1000 : 0,
      deliveryDays: Math.round(Number(raw.autoReleaseDuration) / 86400),
      trackingRef: raw.trackingRef,
      status: statusEnum[Number(raw.status)] || "Created",
      onchain: true,
    });
  }

  return deals.reverse(); // Most recent first
}

/**
 * Creates a deal onchain with ERC-8021 calldata suffix
 */
export async function createDealOnchain({ dealRef, title, description, buyer, seller, tokenSymbol, amount, deliveryDays }) {
  const token = tokens[tokenSymbol] || tokens.cUSD;
  const tokenConfig = netTokens[tokenSymbol] || netTokens.cUSD || deployment.tokens[tokenSymbol] || deployment.tokens.cUSD;
  const parsedAmount = ethers.parseUnits(amount.toString(), tokenConfig.decimals);
  const durationSeconds = (parseInt(deliveryDays) || 3) * 86400;

  const dealId = ethers.keccak256(ethers.toUtf8Bytes(dealRef));

  // Ensure buyer and seller are independent addresses
  const sellerAddress = seller || sellerSigner.address;
  let buyerAddress = buyer || buyerSigner.address;
  if (!buyerAddress || buyerAddress.toLowerCase() === sellerAddress.toLowerCase()) {
    buyerAddress = ethers.Wallet.createRandom().address;
  }

  // Save to real persistent storage
  saveDealMetadata(dealRef, {
    title,
    desc: description,
    carrier: "GIG Logistics",
    sellerHandle: "verified_seller",
  });

  // Append ERC-8021 Attribution Tag to calldata
  const suffix = toDataSuffix(ATTRIBUTION_TAG);
  const data = escrowContract.interface.encodeFunctionData("createDeal", [
    dealId,
    dealRef,
    buyerAddress,
    sellerAddress,
    tokenConfig.address,
    parsedAmount,
    durationSeconds,
  ]);

  const taggedData = ethers.concat([data, suffix]);

  const tx = await sellerSigner.sendTransaction({
    to: activeEscrowAddress,
    data: taggedData,
  });

  const receipt = await tx.wait();
  return { txHash: receipt.hash, blockNumber: receipt.blockNumber, dealId, dealRef };
}

/**
 * Buyer deposits real stablecoin onchain
 */
export async function depositOnchain(dealRef) {
  const dealId = ethers.keccak256(ethers.toUtf8Bytes(dealRef));
  const raw = await escrowContract.getDeal(dealId);

  // Ensure buyer has approved escrow
  const token = new ethers.Contract(raw.token, tokenAbi, buyerSigner);
  const allowance = await token.allowance(buyerSigner.address, activeEscrowAddress);
  if (allowance < raw.amount) {
    const approveTx = await token.approve(activeEscrowAddress, ethers.MaxUint256);
    await approveTx.wait();
  }

  // Tagged deposit transaction
  const suffix = toDataSuffix(ATTRIBUTION_TAG);
  const data = escrowContract.interface.encodeFunctionData("deposit", [dealId]);
  const taggedData = ethers.concat([data, suffix]);

  const tx = await buyerSigner.sendTransaction({
    to: activeEscrowAddress,
    data: taggedData,
  });

  const receipt = await tx.wait();
  return { txHash: receipt.hash, blockNumber: receipt.blockNumber };
}

/**
 * Seller marks dispatched onchain
 */
export async function dispatchOnchain(dealRef, trackingRef) {
  const dealId = ethers.keccak256(ethers.toUtf8Bytes(dealRef));
  const suffix = toDataSuffix(ATTRIBUTION_TAG);
  const data = escrowContract.interface.encodeFunctionData("markDispatched", [dealId, trackingRef]);
  const taggedData = ethers.concat([data, suffix]);

  const tx = await sellerSigner.sendTransaction({
    to: activeEscrowAddress,
    data: taggedData,
  });

  const receipt = await tx.wait();
  return { txHash: receipt.hash, blockNumber: receipt.blockNumber };
}

/**
 * Buyer confirms delivery and releases real payout onchain
 */
export async function releaseOnchain(dealRef) {
  const dealId = ethers.keccak256(ethers.toUtf8Bytes(dealRef));
  const suffix = toDataSuffix(ATTRIBUTION_TAG);
  const data = escrowContract.interface.encodeFunctionData("confirmDeliveryAndRelease", [dealId]);
  const taggedData = ethers.concat([data, suffix]);

  const tx = await buyerSigner.sendTransaction({
    to: activeEscrowAddress,
    data: taggedData,
  });

  const receipt = await tx.wait();
  return { txHash: receipt.hash, blockNumber: receipt.blockNumber };
}

/**
 * Fetches real onchain balances for buyer and seller
 */
export async function getBalancesOnchain(userAddress = null) {
  const currentNet = getActiveNetwork();
  const netTokensConfig = currentNet.tokens || deployment.tokens || {};
  const currentEscrow = currentNet.escrowAddress || activeEscrowAddress;

  const targetAddress = userAddress || buyerSigner.address;
  const userBals = { address: targetAddress };
  const escrowBals = { address: currentEscrow };

  try {
    const nativeBal = await provider.getBalance(targetAddress);
    userBals.CELO = ethers.formatEther(nativeBal);
  } catch {
    userBals.CELO = "0.0";
  }

  for (const [sym, config] of Object.entries(netTokensConfig)) {
    if (!config?.address) continue;
    try {
      const tokenContract = tokens[sym] || new ethers.Contract(config.address, tokenAbi, provider);
      const [u, e] = await Promise.all([
        tokenContract.balanceOf(targetAddress),
        tokenContract.balanceOf(currentEscrow),
      ]);
      const dec = config.decimals || 18;
      userBals[sym] = ethers.formatUnits(u, dec);
      escrowBals[sym] = ethers.formatUnits(e, dec);
    } catch {
      userBals[sym] = "0.0";
      escrowBals[sym] = "0.0";
    }
  }

  return {
    user: userBals,
    buyer: userBals,
    seller: userBals,
    escrow: escrowBals,
  };
}

/**
 * Buyer or seller raises dispute onchain
 */
export async function raiseDisputeOnchain(dealRef, reason = "Dispute raised by counterparty") {
  const dealId = ethers.keccak256(ethers.toUtf8Bytes(dealRef));
  const suffix = toDataSuffix(ATTRIBUTION_TAG);
  const data = escrowContract.interface.encodeFunctionData("raiseDispute", [dealId, reason]);
  const taggedData = ethers.concat([data, suffix]);

  const tx = await buyerSigner.sendTransaction({
    to: activeEscrowAddress,
    data: taggedData,
  });

  const receipt = await tx.wait();
  return { txHash: receipt.hash, blockNumber: receipt.blockNumber };
}

/**
 * Arbiter resolves dispute onchain with split
 */
export async function resolveDisputeOnchain(dealRef, buyerPercent = 50) {
  const dealId = ethers.keccak256(ethers.toUtf8Bytes(dealRef));
  const suffix = toDataSuffix(ATTRIBUTION_TAG);
  const data = escrowContract.interface.encodeFunctionData("resolveDispute", [dealId, buyerPercent]);
  const taggedData = ethers.concat([data, suffix]);

  const tx = await arbiterSigner.sendTransaction({
    to: activeEscrowAddress,
    data: taggedData,
  });

  const receipt = await tx.wait();
  return { txHash: receipt.hash, blockNumber: receipt.blockNumber };
}

/**
 * Faucet minting function for testing stablecoins onchain
 */
export async function faucetMintOnchain(recipientAddress, tokenSymbol = "cUSD", amount = "100") {
  const currentNet = getActiveNetwork();
  if (currentNet.id === "celo-mainnet") {
    throw new Error("Faucet minting is disabled on Celo Mainnet. Tokens on Mainnet are real-value assets. Please use Opera MiniPay, Uniswap, or a bridge to fund your account.");
  }
  const token = tokens[tokenSymbol] || tokens.cUSD;
  const tokenConfig = netTokens[tokenSymbol] || netTokens.cUSD || deployment.tokens[tokenSymbol] || deployment.tokens.cUSD;
  const parsedAmount = ethers.parseUnits(amount.toString(), tokenConfig.decimals);

  const tx = await token.connect(deployerSigner).mint(recipientAddress, parsedAmount);
  const receipt = await tx.wait();
  return { txHash: receipt.hash, blockNumber: receipt.blockNumber, recipient: recipientAddress, amount, tokenSymbol };
}

/**
 * Buyer or seller cancels deal onchain (cancelCreated if unfunded, cancelUnfulfilled if > 7 days funded)
 */
export async function cancelOnchain(dealRef) {
  const dealId = ethers.keccak256(ethers.toUtf8Bytes(dealRef));
  const raw = await escrowContract.getDeal(dealId);
  const suffix = toDataSuffix(ATTRIBUTION_TAG);

  let data;
  let signer = buyerSigner;
  if (Number(raw.status) === 0) {
    // Created state -> cancelCreated
    data = escrowContract.interface.encodeFunctionData("cancelCreated", [dealId]);
  } else {
    // Funded state -> cancelUnfulfilled
    data = escrowContract.interface.encodeFunctionData("cancelUnfulfilled", [dealId]);
  }

  const taggedData = ethers.concat([data, suffix]);
  const tx = await signer.sendTransaction({
    to: activeEscrowAddress,
    data: taggedData,
  });

  const receipt = await tx.wait();
  return { txHash: receipt.hash, blockNumber: receipt.blockNumber };
}

/**
 * Trigger auto release if autoReleaseDuration has expired post-dispatch
 */
export async function autoReleaseOnchain(dealRef) {
  const dealId = ethers.keccak256(ethers.toUtf8Bytes(dealRef));
  const suffix = toDataSuffix(ATTRIBUTION_TAG);
  const data = escrowContract.interface.encodeFunctionData("triggerAutoRelease", [dealId]);
  const taggedData = ethers.concat([data, suffix]);

  const tx = await sellerSigner.sendTransaction({
    to: activeEscrowAddress,
    data: taggedData,
  });

  const receipt = await tx.wait();
  return { txHash: receipt.hash, blockNumber: receipt.blockNumber };
}

/**
 * Inspects a real onchain transaction receipt and decodes calldata suffix
 */
export async function getTransactionDetailsOnchain(txHash) {
  try {
    const [tx, receipt] = await Promise.all([
      provider.getTransaction(txHash),
      provider.getTransactionReceipt(txHash),
    ]);

    if (!tx || !receipt) {
      return null;
    }

    // Check if ERC-8021 suffix or magic trailer is in calldata
    const suffix = toDataSuffix(ATTRIBUTION_TAG).slice(2);
    const carriesTag =
      Boolean(tx.data) &&
      (tx.data.toLowerCase().includes(suffix.toLowerCase()) ||
        tx.data.toLowerCase().includes("80218021802180218021802180218021"));

    return {
      hash: tx.hash,
      blockNumber: receipt.blockNumber,
      from: tx.from,
      to: tx.to,
      gasUsed: receipt.gasUsed.toString(),
      status: receipt.status === 1 ? "SUCCESS" : "REVERTED",
      attributionTagPresent: carriesTag,
      calldataSuffix: carriesTag ? ATTRIBUTION_TAG : "none",
    };
  } catch (err) {
    console.warn("getTransactionDetailsOnchain error:", err.message);
    return null;
  }
}

/**
 * Prepares raw calldata with ERC-8021 calldata suffix for direct browser wallet signing (MetaMask / Opera MiniPay)
 */
export async function prepareTransactionData(action, params = {}) {
  const suffix = toDataSuffix(ATTRIBUTION_TAG);
  let to = activeEscrowAddress;
  let data = "0x";
  let value = "0x0";
  let needsApproval = false;
  let approvalTo = null;
  let approvalData = null;

  if (action === "createDeal") {
    const { dealRef, seller, tokenAddress, amount, durationSeconds } = params;
    const dealId = ethers.keccak256(ethers.toUtf8Bytes(dealRef));
    const sellerAddress = seller || sellerSigner.address;
    let buyerAddress = params.buyer || buyerSigner.address;
    if (!buyerAddress || buyerAddress.toLowerCase() === sellerAddress.toLowerCase()) {
      buyerAddress = ethers.Wallet.createRandom().address;
    }
    const raw = escrowContract.interface.encodeFunctionData("createDeal", [
      dealId,
      dealRef,
      buyerAddress,
      sellerAddress,
      tokenAddress,
      amount,
      durationSeconds || 3 * 86400,
    ]);
    data = ethers.concat([raw, suffix]);
  } else if (action === "deposit") {
    const dealId = ethers.keccak256(ethers.toUtf8Bytes(params.dealRef));
    const deal = await escrowContract.getDeal(dealId);
    
    // Check if buyer has sufficient allowance for escrow contract
    if (params.buyer && deal && deal.token) {
      try {
        const tokenContract = new ethers.Contract(deal.token, tokenAbi, provider);
        const allowance = await tokenContract.allowance(params.buyer, activeEscrowAddress);
        if (allowance < deal.amount) {
          needsApproval = true;
          approvalTo = deal.token;
          approvalData = tokenContract.interface.encodeFunctionData("approve", [activeEscrowAddress, ethers.MaxUint256]);
        }
      } catch (err) {
        console.warn("[prepareTransactionData] Allowance check warning:", err.message);
      }
    }

    const raw = escrowContract.interface.encodeFunctionData("deposit", [dealId]);
    data = ethers.concat([raw, suffix]);
  } else if (action === "dispatch") {
    const dealId = ethers.keccak256(ethers.toUtf8Bytes(params.dealRef));
    const raw = escrowContract.interface.encodeFunctionData("markDispatched", [dealId, params.trackingRef]);
    data = ethers.concat([raw, suffix]);
  } else if (action === "release" || action === "releaseFunds") {
    const dealId = ethers.keccak256(ethers.toUtf8Bytes(params.dealRef));
    const raw = escrowContract.interface.encodeFunctionData("confirmDeliveryAndRelease", [dealId]);
    data = ethers.concat([raw, suffix]);
  } else if (action === "cancel") {
    const dealId = ethers.keccak256(ethers.toUtf8Bytes(params.dealRef));
    const deal = await escrowContract.getDeal(dealId);
    const fn = Number(deal.status) === 0 ? "cancelCreated" : "cancelUnfulfilled";
    const raw = escrowContract.interface.encodeFunctionData(fn, [dealId]);
    data = ethers.concat([raw, suffix]);
  } else if (action === "dispute") {
    const dealId = ethers.keccak256(ethers.toUtf8Bytes(params.dealRef));
    const raw = escrowContract.interface.encodeFunctionData("raiseDispute", [dealId, params.reason || "Disputed"]);
    data = ethers.concat([raw, suffix]);
  } else if (action === "auto-release") {
    const dealId = ethers.keccak256(ethers.toUtf8Bytes(params.dealRef));
    const raw = escrowContract.interface.encodeFunctionData("triggerAutoRelease", [dealId]);
    data = ethers.concat([raw, suffix]);
  }

  return {
    to,
    data,
    value,
    attributionTag: ATTRIBUTION_TAG,
    erc8021Suffix: suffix,
    needsApproval,
    approvalTo,
    approvalData,
  };
}

/**
 * Submits an on-chain delivery attestation using SokoAgentOracle
 */
export async function attestDeliveryOnchain(dealRef, trackingRef, proofHash) {
  if (!oracleContract || !activeOracleAddress) {
    return { status: "oracle_not_deployed", dealRef };
  }
  const dealId = ethers.keccak256(ethers.toUtf8Bytes(dealRef));
  const tx = await oracleContract
    .connect(arbiterSigner)
    .attestDelivery(dealId, trackingRef || "CARRIER_VERIFIED", proofHash || `proof:${Date.now()}`);
  const receipt = await tx.wait();
  return {
    txHash: receipt.hash,
    blockNumber: receipt.blockNumber,
    dealRef,
    oracleAddress: activeOracleAddress,
    attestedBy: arbiterSigner.address,
    verified: true,
  };
}

/**
 * Queries SokoAgentOracle onchain for attestation status
 */
export async function checkDeliveryAttestationOnchain(dealRef) {
  if (!oracleContract) return { verified: false };
  const dealId = ethers.keccak256(ethers.toUtf8Bytes(dealRef));
  try {
    const [verified, timestamp, oracleAddr, proofHash] = await oracleContract.isDeliveryAttested(dealId);
    return {
      verified: Boolean(verified),
      timestamp: Number(timestamp) * 1000,
      oracle: oracleAddr,
      proofHash,
    };
  } catch (err) {
    return { verified: false, error: err.message };
  }
}

export { deployment };
