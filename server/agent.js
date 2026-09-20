import { toDataSuffix } from "@celo/attribution-tags";
import dotenv from "dotenv";

dotenv.config();

/**
 * SokoPay Conversational Agent Engine
 * Powered by OpenRouter free AI models (openrouter/free auto-router & deepseek-v4-flash)
 * with deterministic offline NLP fallback.
 * Parses natural language commerce prompts, manages escrow lifecycle,
 * and serializes transactions with ERC-8021 Attribution Tags.
 */

// Default project attribution tag (assigned upon registration via celobuilders.xyz)
export const DEFAULT_ATTRIBUTION_TAG = process.env.CELO_ATTRIBUTION_TAG || "celo_sokopay1234";

// Token addresses on Celo Mainnet
export const CELO_MAINNET_TOKENS = {
  cUSD: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
  cEUR: "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73",
  cREAL: "0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787",
  cNGN: "0x4b786f1e8f237f3ff7a65977114389df95b364a2", // cNGN on Celo
  USAT: "0xD2ab3C9A02DBBAB236BfEC45D1d755DF4267F771", // USA₮ (Self x Tether)
  USDT: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e", // Tether USD
  USDC: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C", // Circle USDC
};

// Token addresses on Celo Sepolia
export const CELO_SEPOLIA_TOKENS = {
  cUSD: "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1",
  cEUR: "0x10c892A6EC43a53E45D0B916B4b7D383B1b78C0F",
  cREAL: "0xE4D517785D091D3c54818832dB606C3cA5241471",
  cNGN: "0x4b786f1e8f237f3ff7a65977114389df95b364a2",
  USAT: "0xD2ab3C9A02DBBAB236BfEC45D1d755DF4267F771",
  USDT: "0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B",
  USDC: "0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B",
};

// OpenRouter AI Configuration (DeepSeek V4 Flash - 100% Free, 1M context)
export const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
export const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "openrouter/auto";

if (OPENROUTER_API_KEY) {
  console.log(`[Agent] OpenRouter Free AI active using model: ${OPENROUTER_MODEL}`);
}

export function isOpenRouterActive() {
  return Boolean(OPENROUTER_API_KEY);
}

export function isAiActive() {
  return Boolean(OPENROUTER_API_KEY);
}

export function getAiEngineInfo() {
  if (OPENROUTER_API_KEY) {
    return {
      active: true,
      provider: "OpenRouter Free",
      model: OPENROUTER_MODEL,
    };
  }
  return {
    active: false,
    provider: "Local Regex NLP",
    model: "deterministic-nlp-v1",
  };
}

const COMMERCE_PROMPT_TEMPLATE = (message) => `You are SokoBot, the elite AI social commerce assistant for SokoPay on Celo L2.
Analyze the following natural language social commerce message (which might be in English, Nigerian Pidgin, Swahili, Sheng, French, Portuguese, or WhatsApp shorthand):

"${message}"

Extract the intent and parameters and reply strictly in valid JSON format with no markdown wrappers or backticks:
{
  "intent": "CREATE_INVOICE" | "CHECK_STATUS" | "CONFIRM_DISPATCH" | "CONFIRM_DELIVERY" | "RAISE_DISPUTE" | "CANCEL_DEAL" | "ASSISTANT_QUERY",
  "params": {
    "counterparty": "username or address without @" or "",
    "amount": number or 0,
    "tokenSymbol": "cUSD" | "cNGN" | "USAT" | "cEUR" | "cREAL" | "USDT" | "USDC",
    "description": "item title or description",
    "deliveryDays": number of delivery days (default 3),
    "dealRef": "e.g. SKP-8821" or "",
    "trackingRef": "e.g. GIG-1234, SND-5678, DHL992" or "",
    "reason": "dispute reason if any" or ""
  },
  "explanation": "concise friendly explanation of the action taken",
  "confidence": 0.99
}`;

/**
 * Parses commerce messages with OpenRouter Free DeepSeek V4 Flash
 */
async function parseWithOpenRouter(message, modelToUse = OPENROUTER_MODEL) {
  if (!OPENROUTER_API_KEY) return null;

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://sokopay.xyz",
        "X-Title": "SokoPay Social Commerce Escrow",
      },
      signal: AbortSignal.timeout(25000),
      body: JSON.stringify({
        model: modelToUse,
        messages: [
          {
            role: "system",
            content: "You are SokoBot on Celo. You process multilingual African commerce transactions. You must strictly output valid JSON only without markdown code fences or backticks.",
          },
          {
            role: "user",
            content: COMMERCE_PROMPT_TEMPLATE(message),
          },
        ],
        max_tokens: 500,
        temperature: 0.1,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.warn(`[Agent] OpenRouter request to ${modelToUse} failed with status ${res.status}:`, errBody.slice(0, 200));
      return null;
    }

    const data = await res.json();
    const rawText = data.choices?.[0]?.message?.content;
    if (!rawText) return null;

    // Clean code block ticks and extract JSON
    const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);

    if (parsed && parsed.intent) {
      return {
        ...parsed,
        source: "OPENROUTER_FREE_AI",
        model: modelToUse,
      };
    }
  } catch (err) {
    console.warn(`[Agent] OpenRouter exception with model ${modelToUse}:`, err.message);
  }
  return null;
}

/**
 * Local deterministic commerce intent parser for offline / instant fallback
 */
export function parseCommerceIntentLocal(message) {
  const clean = message.trim();
  const lower = clean.toLowerCase();

  // Pattern 1: Invoice / Create Escrow
  const invoiceRegex = /(?:invoice|bill|create deal|create escrow|escrow|request|charge)(?:\s+(?:to\s+)?(@[a-zA-Z0-9_\.\-]+|[a-zA-Z][a-zA-Z0-9_\.\-]*))?\s+(\d+(?:\.\d+)?)\s*([a-zA-Z$₮]+)(?:\s+to\s+(@?[\w\d\.\-]+))?\s*(?:for|for item)?\s*(.+?)(?:\s+with\s+(\d+)\s*(?:day|days|h|hours|d)(?:\s+delivery)?)?$/i;
  const matchInvoice = clean.match(invoiceRegex);

  if (matchInvoice) {
    let targetParty = matchInvoice[1] || matchInvoice[4] || "";
    let amount = parseFloat(matchInvoice[2]);
    let rawCurrency = matchInvoice[3].toUpperCase().replace("$", "CUSD").replace("₮", "USDT");
    let description = matchInvoice[5] ? matchInvoice[5].trim() : "Social Commerce Item";
    description = description.replace(/^to\s+@?[\w\d\.\-]+\s+(?:for\s+)?/i, "");
    let deliveryDays = matchInvoice[6] ? parseInt(matchInvoice[6]) : 3;

    // Normalize currency symbols
    let token = "cUSD";
    if (rawCurrency.includes("NGN")) token = "cNGN";
    else if (rawCurrency.includes("USAT") || rawCurrency.includes("USA")) token = "USAT";
    else if (rawCurrency.includes("USDT")) token = "USDT";
    else if (rawCurrency.includes("USDC")) token = "USDC";
    else if (rawCurrency.includes("EUR")) token = "cEUR";
    else if (rawCurrency.includes("REAL") || rawCurrency.includes("BRL")) token = "cREAL";

    return {
      intent: "CREATE_INVOICE",
      params: {
        counterparty: targetParty.replace(/^@/, ""),
        amount,
        tokenSymbol: token,
        description,
        deliveryDays,
      },
      confidence: 0.95,
      source: "LOCAL_NLP",
    };
  }

  // Pattern 2: Check status
  const statusMatch = clean.match(/(?:status|check|track|where is|order)\s*(?:of|for)?\s*(?:#)?(skp-[\w\d\-]+)/i);
  if (statusMatch) {
    return {
      intent: "CHECK_STATUS",
      params: {
        dealRef: statusMatch[1].toUpperCase(),
      },
      confidence: 0.92,
      source: "LOCAL_NLP",
    };
  }

  // Pattern 3: Mark Dispatched
  const dispatchMatch = clean.match(/(?:dispatch|dispatched|shipped|sent)\s*(?:#)?(skp-[\w\d\-]+)\s*(?:with tracking|tracking|ref)?\s*([a-zA-Z0-9\-]+)?/i);
  if (dispatchMatch) {
    return {
      intent: "CONFIRM_DISPATCH",
      params: {
        dealRef: dispatchMatch[1].toUpperCase(),
        trackingRef: dispatchMatch[2] ? dispatchMatch[2].toUpperCase() : `TRK-${Date.now().toString().slice(-6)}`,
      },
      confidence: 0.9,
      source: "LOCAL_NLP",
    };
  }

  // Pattern 4: Release / Confirm Delivery
  const releaseMatch = lower.match(/(?:release|confirm delivery|delivered|received|accept item)\s*(?:for|of)?\s*(?:#)?(skp-[\w\d\-]+)/i);
  if (releaseMatch) {
    return {
      intent: "CONFIRM_DELIVERY",
      params: {
        dealRef: releaseMatch[1].toUpperCase(),
      },
      confidence: 0.9,
      source: "LOCAL_NLP",
    };
  }

  // Pattern 5: Dispute
  const disputeMatch = lower.match(/(?:dispute|report|scam|claim)\s*(?:#)?(skp-[\w\d\-]+)\s*(.*)/i);
  if (disputeMatch) {
    return {
      intent: "RAISE_DISPUTE",
      params: {
        dealRef: disputeMatch[1].toUpperCase(),
        reason: disputeMatch[2] || "Unfulfilled or defective item",
      },
      confidence: 0.88,
      source: "LOCAL_NLP",
    };
  }

  // Pattern 6: Cancel deal
  const cancelMatch = clean.match(/(?:cancel|cancel deal|abort)\s*(?:for|of)?\s*(?:#)?(skp-[\w\d\-]+)/i);
  if (cancelMatch) {
    return {
      intent: "CANCEL_DEAL",
      params: {
        dealRef: cancelMatch[1].toUpperCase(),
      },
      confidence: 0.9,
      source: "LOCAL_NLP",
    };
  }

  // Fallback: Assistant query
  return {
    intent: "ASSISTANT_QUERY",
    params: { text: message },
    confidence: 0.5,
    source: "LOCAL_NLP",
  };
}

/**
 * Universal Natural Language Commerce Intent Parser
 * Powered directly by DeepSeek V4 Flash on OpenRouter (100% Free, 1M context)
 * with deterministic offline local NLP engine as safe backup.
 */
export async function parseCommerceIntent(message) {
  if (isOpenRouterActive()) {
    const aiResult = await parseWithOpenRouter(message, OPENROUTER_MODEL);
    if (aiResult) return aiResult;
  }

  // Deterministic local NLP fallback if network offline
  return parseCommerceIntentLocal(message);
}

/**
 * Attaches ERC-8021 Attribution calldata suffix
 */
export function appendAttributionTag(calldataHex, attributionTag = DEFAULT_ATTRIBUTION_TAG) {
  try {
    const suffix = toDataSuffix(attributionTag);
    const cleanSuffix = suffix.startsWith("0x") ? suffix.slice(2) : suffix;
    const cleanCall = calldataHex.startsWith("0x") ? calldataHex : `0x${calldataHex}`;
    return `${cleanCall}${cleanSuffix}`;
  } catch (err) {
    console.warn("[Attribution] Warning:", err.message);
    return calldataHex;
  }
}

/**
 * Creates an interactive MiniPay & social chat deep-link for a deal
 */
export function formatSocialShareMessage(deal) {
  const baseUrl = process.env.APP_URL || "https://sokopay.xyz";
  const dealUrl = `${baseUrl}/deal/${deal.dealRef}`;
  const miniPayUrl = `celo://wallet/dapp?url=${encodeURIComponent(dealUrl)}`;

  return {
    text: `🛡️ *SokoPay Protected Invoice: ${deal.dealRef}*
📦 Item: *${deal.description || deal.title}*
💰 Amount: *${deal.amount} ${deal.tokenSymbol}*
⏳ Auto-release: ${deal.deliveryDays} days after dispatch

🔒 *Buyer Funds are safe in SokoEscrow until delivery is confirmed.*
👉 Tap to view & pay in Opera MiniPay / Web:
${dealUrl}

📲 MiniPay direct link: ${miniPayUrl}`,
    dealUrl,
    miniPayUrl,
  };
}
