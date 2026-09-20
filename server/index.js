import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import {
  parseCommerceIntent,
  formatSocialShareMessage,
  DEFAULT_ATTRIBUTION_TAG,
  getAiEngineInfo,
} from "./agent.js";
import {
  getOnchainDeals,
  createDealOnchain,
  depositOnchain,
  dispatchOnchain,
  releaseOnchain,
  cancelOnchain,
  autoReleaseOnchain,
  raiseDisputeOnchain,
  resolveDisputeOnchain,
  faucetMintOnchain,
  getTransactionDetailsOnchain,
  getBalancesOnchain,
  prepareTransactionData,
  attestDeliveryOnchain,
  checkDeliveryAttestationOnchain,
  syncOnchainNetwork,
  deployment,
  buyerSigner,
  sellerSigner,
} from "./onchain.js";
import { getActiveNetwork, setActiveNetwork, NETWORKS } from "./networks.js";
import { getTrackingDetails, processCarrierWebhook } from "./logistics.js";
import { getProfile, saveProfile, getDealMetadata, saveDealMetadata, getCarrierEvents } from "./storage.js";
import { startSettlementWorker, runSettlementSweep } from "./worker.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health check and runtime protocol metadata
app.get("/api/health", async (req, res) => {
  const activeNet = getActiveNetwork();
  const aiInfo = getAiEngineInfo();
  try {
    const deals = await getOnchainDeals();
    res.json({
      status: "online",
      rpcConnected: true,
      protocol: "SokoPay",
      version: "1.0.0",
      network: activeNet.name,
      networkId: activeNet.id,
      chainId: activeNet.chainId,
      escrowContract: activeNet.escrowAddress,
      oracleContract: activeNet.oracleAddress || deployment.oracleAddress || null,
      database: "Supabase PostgreSQL (Live)",
      aiActive: aiInfo.active,
      aiProvider: aiInfo.provider,
      aiModel: aiInfo.model,
      explorerUrl: activeNet.explorerUrl,
      attributionTag: DEFAULT_ATTRIBUTION_TAG,
      erc8004Supported: true,
      totalDealsOnchain: deals.length,
      mode: "LIVE_ONCHAIN",
    });
  } catch (err) {
    res.json({
      status: "offline_rpc",
      rpcConnected: false,
      protocol: "SokoPay",
      version: "1.0.0",
      network: activeNet.name,
      networkId: activeNet.id,
      chainId: activeNet.chainId,
      escrowContract: activeNet.escrowAddress,
      oracleContract: activeNet.oracleAddress || deployment.oracleAddress || null,
      database: "Supabase PostgreSQL (Live)",
      aiActive: aiInfo.active,
      aiProvider: aiInfo.provider,
      aiModel: aiInfo.model,
      explorerUrl: activeNet.explorerUrl,
      error: `RPC node offline or unreachable at ${activeNet.rpcUrl}: ${err.message}`,
      mode: "WAITING_RPC",
    });
  }
});

// Network information and switcher
app.get("/api/network", (req, res) => {
  const current = getActiveNetwork();
  res.json({
    activeNetwork: current,
    availableNetworks: Object.values(NETWORKS).map((n) => ({
      id: n.id,
      name: n.name,
      chainId: n.chainId,
      hexChainId: n.hexChainId,
      rpcUrl: n.rpcUrl,
      explorerUrl: n.explorerUrl,
      escrowAddress: n.escrowAddress,
      nativeCurrency: n.nativeCurrency,
    })),
  });
});

app.post("/api/network/switch", (req, res) => {
  try {
    const { network } = req.body;
    const switched = setActiveNetwork(network);
    // Dynamically rebind onchain provider, contract instances, and signers
    syncOnchainNetwork();
    res.json({ success: true, activeNetwork: switched });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Protocol configuration & tokens
app.get("/api/config", (req, res) => {
  const activeNet = getActiveNetwork();
  const tokenList = Object.values(activeNet.tokens || deployment.tokens || {}).map((t) => ({
    symbol: t.symbol,
    name: t.name || t.symbol,
    decimals: t.decimals,
    address: t.address,
  }));

  res.json({
    attributionTag: DEFAULT_ATTRIBUTION_TAG,
    feeBps: 50, // 0.5%
    feePercentage: "0.5%",
    escrowAddress: activeNet.escrowAddress || deployment.escrowAddress,
    network: activeNet.name,
    chainId: activeNet.chainId,
    explorerUrl: activeNet.explorerUrl,
    supportedTokens: tokenList,
    accounts: {
      buyer: buyerSigner.address,
      seller: sellerSigner.address,
    },
  });
});

// Prepare raw transaction with ERC-8021 suffix for direct Web3 / Opera MiniPay signing
app.post("/api/tx/prepare", async (req, res) => {
  try {
    const { action, params } = req.body;
    const txData = await prepareTransactionData(action, params);
    res.json({ success: true, ...txData });
  } catch (err) {
    console.error("Prepare tx error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Real logistics tracking lookup with live Supabase carrier events
app.get("/api/tracking/:code", async (req, res) => {
  try {
    const code = req.params.code;
    const dealRef = req.query.dealRef || code;
    const events = await getCarrierEvents(dealRef);

    let dispatchedAtMs = Date.now() - 86400000;
    if (dealRef) {
      const meta = getDealMetadata(dealRef);
      if (meta?.dispatchedAt) {
        dispatchedAtMs = new Date(meta.dispatchedAt).getTime();
      } else {
        try {
          const deals = await getOnchainDeals();
          const found = deals.find((d) => d.dealRef === dealRef);
          if (found && found.dispatchedAt > 0) {
            dispatchedAtMs = found.dispatchedAt;
          }
        } catch {}
      }
    }

    const tracking = getTrackingDetails(code, dispatchedAtMs, events);

    // Also check onchain oracle attestation
    const attestation = await checkDeliveryAttestationOnchain(dealRef);
    if (attestation.verified) {
      tracking.isDelivered = true;
      tracking.status = "DELIVERED";
      tracking.oracleAttestation = attestation;
    }

    res.json(tracking);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Live Carrier Webhook receiver
app.post("/api/tracking/webhook", async (req, res) => {
  try {
    const { dealRef, carrier, trackingRef, status, location, milestoneTitle, rawPayload } = req.body;
    if (!dealRef) {
      return res.status(400).json({ error: "dealRef is required" });
    }

    const webhookResult = await processCarrierWebhook({
      dealRef,
      carrier,
      trackingRef: trackingRef || "GIG-LG-882104",
      status: status || "IN_TRANSIT",
      location: location || "Courier Regional Hub",
      milestoneTitle: milestoneTitle || `Carrier Update: ${status}`,
      rawPayload,
    });

    let onchainAttestation = null;
    let autoSettlement = null;

    // If carrier marks package as DELIVERED, attest on-chain using SokoAgentOracle
    if (webhookResult.isDelivered) {
      console.log(`[Webhook] Carrier confirmed delivery for #${dealRef}. Attesting onchain...`);
      onchainAttestation = await attestDeliveryOnchain(dealRef, trackingRef, webhookResult.proofHash);

      // Trigger auto-settlement sweep
      try {
        autoSettlement = await autoReleaseOnchain(dealRef);
        console.log(`[Webhook] Escrow auto-released for #${dealRef} onchain! Tx:`, autoSettlement.txHash);
      } catch (e) {
        console.warn(`[Webhook] Auto-release skipped:`, e.message);
      }
    }

    res.json({
      success: true,
      webhookResult,
      onchainAttestation,
      autoSettlement,
    });
  } catch (err) {
    console.error("Webhook processing error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Seller social profile & dynamic onchain reputation
app.get("/api/profiles/:handle", async (req, res) => {
  try {
    const deals = await getOnchainDeals();
    const profile = getProfile(req.params.handle, deals);
    res.json(profile);
  } catch (err) {
    const profile = getProfile(req.params.handle, []);
    res.json(profile);
  }
});

app.post("/api/profiles", (req, res) => {
  const { handle, profileData } = req.body;
  if (!handle) return res.status(400).json({ error: "Handle is required" });
  const saved = saveProfile(handle, profileData || {});
  res.json(saved);
});

// Manual trigger for automated settlement worker
app.post("/api/worker/run", async (req, res) => {
  try {
    const results = await runSettlementSweep();
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Real onchain token balances
app.get("/api/balances", async (req, res) => {
  try {
    const address = req.query.address || null;
    const balances = await getBalancesOnchain(address);
    res.json(balances);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Faucet endpoint to mint test tokens onchain
app.post("/api/faucet", async (req, res) => {
  try {
    const { address, tokenSymbol = "cUSD", amount = "100" } = req.body;
    const recipient = address || buyerSigner.address;
    const result = await faucetMintOnchain(recipient, tokenSymbol, amount);
    res.json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error("Faucet error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Transaction receipt details with decoded attribution tag
app.get("/api/tx/:hash", async (req, res) => {
  try {
    const details = await getTransactionDetailsOnchain(req.params.hash);
    if (!details) {
      return res.status(404).json({ error: "Transaction not found" });
    }
    res.json(details);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List all deals directly from onchain contract storage
app.get("/api/deals", async (req, res) => {
  try {
    const deals = await getOnchainDeals();
    res.json(deals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get specific deal from onchain
app.get("/api/deals/:id", async (req, res) => {
  try {
    const ref = req.params.id.toUpperCase();
    const deals = await getOnchainDeals();
    const deal = deals.find((d) => d.dealRef === ref);
    if (!deal) {
      return res.status(404).json({ error: "Deal not found" });
    }
    res.json(deal);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new deal onchain with ERC-8021 Attribution calldata
app.post("/api/deals", async (req, res) => {
  try {
    const { title, description, seller, tokenSymbol = "cUSD", amount, deliveryDays = 3 } = req.body;

    if (!title || !amount) {
      return res.status(400).json({ error: "Missing required fields (title, amount)" });
    }

    const refCode = `SKP-${Math.floor(1000 + Math.random() * 9000)}`;

    const onchainResult = await createDealOnchain({
      dealRef: refCode,
      title,
      description: description || "Peer-to-peer social commerce purchase",
      seller: seller || sellerSigner.address,
      tokenSymbol,
      amount,
      deliveryDays,
    });

    const shareDetails = formatSocialShareMessage({
      dealRef: refCode,
      title,
      description,
      amount,
      tokenSymbol,
      deliveryDays,
    });

    res.status(201).json({
      success: true,
      dealRef: refCode,
      txHash: onchainResult.txHash,
      blockNumber: onchainResult.blockNumber,
      share: shareDetails,
      attributionTag: DEFAULT_ATTRIBUTION_TAG,
      onchain: true,
    });
  } catch (err) {
    console.error("Create deal error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Update deal status onchain (deposit, dispatch, release, dispute, resolve)
app.post("/api/deals/:id/status", async (req, res) => {
  try {
    const ref = req.params.id.toUpperCase();
    const { action, trackingRef, reason, buyerPercent = 50 } = req.body;

    let result;
    if (action === "deposit") {
      result = await depositOnchain(ref);
    } else if (action === "dispatch") {
      result = await dispatchOnchain(ref, trackingRef || `GIG-${Math.floor(100000 + Math.random() * 900000)}`);
    } else if (action === "release") {
      result = await releaseOnchain(ref);
    } else if (action === "cancel") {
      result = await cancelOnchain(ref);
    } else if (action === "auto-release") {
      result = await autoReleaseOnchain(ref);
    } else if (action === "dispute") {
      result = await raiseDisputeOnchain(ref, reason || "Item condition or delivery dispute");
    } else if (action === "resolve") {
      result = await resolveDisputeOnchain(ref, buyerPercent);
    } else {
      return res.status(400).json({ error: "Unsupported action" });
    }

    const updatedDeals = await getOnchainDeals();
    const currentDeal = updatedDeals.find((d) => d.dealRef === ref);

    res.json({
      success: true,
      action,
      txHash: result.txHash,
      blockNumber: result.blockNumber,
      deal: currentDeal,
      onchain: true,
    });
  } catch (err) {
    console.error("Deal status error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Conversational Agent Chat endpoint
app.post("/api/agent/chat", async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const parsed = await parseCommerceIntent(message);
    let reply = "";
    let actionData = null;

    switch (parsed.intent) {
      case "CREATE_INVOICE": {
        const { counterparty, amount, tokenSymbol, description, deliveryDays } = parsed.params;
        const refCode = `SKP-${Math.floor(1000 + Math.random() * 9000)}`;

        const onchainResult = await createDealOnchain({
          dealRef: refCode,
          title: description,
          description: `Created via SokoBot for ${counterparty ? `@${counterparty}` : "Social Buyer"}`,
          seller: sellerSigner.address,
          tokenSymbol,
          amount: amount.toString(),
          deliveryDays,
        });

        const share = formatSocialShareMessage({
          dealRef: refCode,
          title: description,
          amount: amount.toString(),
          tokenSymbol,
          deliveryDays,
        });

        reply = `I have created on-chain escrow invoice for ${amount} ${tokenSymbol} (${description}).\n\nDeal Code: ${refCode}\nOn-chain Tx: ${onchainResult.txHash}\nFunds are locked until buyer confirms delivery.`;
        actionData = {
          type: "INVOICE_CREATED",
          dealRef: refCode,
          txHash: onchainResult.txHash,
          share,
        };
        break;
      }

      case "CHECK_STATUS": {
        const deals = await getOnchainDeals();
        const deal = deals.find((d) => d.dealRef === parsed.params.dealRef);
        if (deal) {
          reply = `Deal Status for #${deal.dealRef}: ${deal.status}\nItem: ${deal.title}\nValue: ${deal.amount} ${deal.tokenSymbol}\nTracking: ${deal.trackingRef || "Pending dispatch"}\nAuto-release: ${deal.deliveryDays} days after dispatch.`;
          actionData = { type: "DEAL_STATUS", deal };
        } else {
          reply = `I could not find active escrow with reference #${parsed.params.dealRef} on Celo.`;
        }
        break;
      }

      case "CONFIRM_DISPATCH": {
        const result = await dispatchOnchain(parsed.params.dealRef, parsed.params.trackingRef);
        reply = `Marked #${parsed.params.dealRef} as Dispatched on Celo!\nTracking code: ${parsed.params.trackingRef}\nTx Hash: ${result.txHash}`;
        actionData = { type: "DEAL_UPDATED", txHash: result.txHash };
        break;
      }

      case "CONFIRM_DELIVERY": {
        const result = await releaseOnchain(parsed.params.dealRef);
        reply = `Funds Released on-chain for #${parsed.params.dealRef}!\nPayout transferred to seller and 0.5% protocol fee deducted.\nTx Hash: ${result.txHash}`;
        actionData = { type: "DEAL_RELEASED", txHash: result.txHash };
        break;
      }

      case "RAISE_DISPUTE": {
        const result = await raiseDisputeOnchain(parsed.params.dealRef, parsed.params.reason);
        reply = `Dispute raised on-chain for #${parsed.params.dealRef}.\nArbiter has been alerted to review fulfillment.\nTx Hash: ${result.txHash}`;
        actionData = { type: "DISPUTE_RAISED", txHash: result.txHash };
        break;
      }

      case "CANCEL_DEAL": {
        const result = await cancelOnchain(parsed.params.dealRef);
        reply = `Deal #${parsed.params.dealRef} cancelled on-chain.\nTx Hash: ${result.txHash}`;
        actionData = { type: "DEAL_CANCELLED", txHash: result.txHash };
        break;
      }

      default:
        reply = `Hi, I am SokoBot on Celo.\n\nYou can prompt:\n• Invoice 40 cUSD for Sneakers with 3 days delivery\n• Status of SKP-8821\n• Dispatched SKP-8821 with tracking GIG-1234\n• Release funds for SKP-8821\n• Cancel SKP-8821\n• Dispute SKP-8821 item damaged`;
    }

    res.json({
      reply,
      actionData,
      attributionTag: DEFAULT_ATTRIBUTION_TAG,
      aiEngine: parsed.source || "LOCAL_NLP",
      aiModel: parsed.model || null,
      confidence: parsed.confidence || 0.95,
      onchain: true,
    });
  } catch (err) {
    console.error("Agent chat error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`[SokoPay On-chain Server] Running on http://localhost:${PORT}`);
  console.log(`[Escrow Contract] ${getActiveNetwork().escrowAddress || deployment.escrowAddress}`);
  console.log(`[Attribution Tag] Active: ${DEFAULT_ATTRIBUTION_TAG}`);
  console.log(`[Active Network] ${getActiveNetwork().name} (ChainID: ${getActiveNetwork().chainId})`);
  startSettlementWorker(30000);
});
