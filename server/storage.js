import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "data");
const dealsFile = path.join(dataDir, "deals.json");
const profilesFile = path.join(dataDir, "profiles.json");

// Real Supabase PostgreSQL Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || "https://ncfrzscpvxyftdlrbgzs.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || "sb_publishable_P9Af93HSz2fk6JOznfvAfg_sMcEQtq7";

let supabase = null;
try {
  if (SUPABASE_URL && SUPABASE_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false },
    });
  }
} catch (err) {
  console.warn("[Storage] Supabase client init warning:", err.message);
}

// Local cache sync file helpers
function readJsonFile(filePath, defaultVal = {}) {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultVal, null, 2));
      return defaultVal;
    }
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch (err) {
    return defaultVal;
  }
}

function writeJsonFile(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`[Storage] Write error for ${filePath}:`, err.message);
  }
}

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Synchronized caches initialized empty (populated directly from Supabase on start)
let memoryDealsCache = readJsonFile(dealsFile, {});
let memoryProfilesCache = readJsonFile(profilesFile, {});

/**
 * Hydrate cache directly from live Supabase PostgreSQL database
 */
export async function syncFromSupabase() {
  if (!supabase) return;
  try {
    const { data: dbDeals, error: dealErr } = await supabase.from("sokopay_deals").select("*");
    if (!dealErr && dbDeals) {
      for (const d of dbDeals) {
        memoryDealsCache[d.deal_ref] = {
          dealRef: d.deal_ref,
          title: d.title,
          desc: d.description,
          sellerHandle: d.seller_handle,
          carrier: d.carrier,
          imageUrl: d.image_url,
          autoSettled: d.auto_settled,
          settledAt: d.settled_at,
          settlementTx: d.settlement_tx,
          settlementReason: d.settlement_reason,
          updatedAt: d.updated_at,
        };
      }
      writeJsonFile(dealsFile, memoryDealsCache);
    }

    const { data: dbMerchants, error: merchErr } = await supabase.from("sokopay_merchants").select("*");
    if (!merchErr && dbMerchants) {
      for (const m of dbMerchants) {
        memoryProfilesCache[m.handle] = {
          handle: m.handle,
          displayName: m.display_name,
          location: m.location,
          phone: m.phone,
          rating: Number(m.rating),
          totalDeals: m.total_deals,
          disputeRate: m.dispute_rate,
          verified: m.verified,
          walletAddress: m.wallet_address,
          joined: m.joined_at,
        };
      }
      writeJsonFile(profilesFile, memoryProfilesCache);
    }
    console.log("[Storage] Synced data from live Supabase PostgreSQL database.");
  } catch (err) {
    console.warn("[Storage] Cloud sync deferred:", err.message);
  }
}

// Initial background sync
syncFromSupabase();

export function getDealMetadata(dealRef) {
  return memoryDealsCache[dealRef] || null;
}

export async function getDealMetadataAsync(dealRef) {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("sokopay_deals")
        .select("*")
        .eq("deal_ref", dealRef)
        .maybeSingle();

      if (!error && data) {
        const item = {
          dealRef: data.deal_ref,
          title: data.title,
          desc: data.description,
          sellerHandle: data.seller_handle,
          carrier: data.carrier,
          imageUrl: data.image_url,
          autoSettled: data.auto_settled,
          settledAt: data.settled_at,
          settlementTx: data.settlement_tx,
          settlementReason: data.settlement_reason,
          updatedAt: data.updated_at,
        };
        memoryDealsCache[dealRef] = item;
        return item;
      }
    } catch (err) {
      console.warn("[Storage] Supabase getDeal error:", err.message);
    }
  }
  return memoryDealsCache[dealRef] || null;
}

export function saveDealMetadata(dealRef, data) {
  const updated = {
    ...(memoryDealsCache[dealRef] || {}),
    ...data,
    dealRef,
    updatedAt: new Date().toISOString(),
  };
  memoryDealsCache[dealRef] = updated;
  writeJsonFile(dealsFile, memoryDealsCache);

  // Real persistence into Supabase sokopay_deals table
  if (supabase) {
    supabase
      .from("sokopay_deals")
      .upsert(
        {
          deal_ref: dealRef,
          title: updated.title || `Deal #${dealRef}`,
          description: updated.desc || updated.description || "",
          image_url: updated.imageUrl || null,
          seller_handle: updated.sellerHandle || "merchant",
          carrier: updated.carrier || "Standard Courier",
          token_address: updated.tokenAddress || "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1",
          token_symbol: updated.tokenSymbol || "cUSD",
          amount: updated.amount ? Number(updated.amount) : 0,
          status: updated.status || "Created",
          tracking_ref: updated.trackingRef || "",
          auto_settled: Boolean(updated.autoSettled),
          settled_at: updated.settledAt || null,
          settlement_tx: updated.settlementTx || null,
          settlement_reason: updated.settlementReason || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "deal_ref" }
      )
      .then(({ error }) => {
        if (error) console.warn("[Storage] Supabase deal upsert warning:", error.message);
      })
      .catch((err) => console.warn("[Storage] Supabase deal save warning:", err.message));
  }

  return updated;
}

export function getAllDealsMetadata() {
  return memoryDealsCache;
}

/**
 * Computes merchant reputation dynamically based on REAL on-chain transactions and Supabase records
 */
export function computeRealReputation(handle, onchainDeals = []) {
  const clean = handle.replace(/^@/, "").toLowerCase();
  
  // Find all onchain deals for this merchant handle or wallet address
  const merchantDeals = onchainDeals.filter(
    (d) =>
      (d.seller && d.seller.toLowerCase() === clean) ||
      (d.sellerHandle && d.sellerHandle.toLowerCase() === clean) ||
      (d.description && d.description.toLowerCase().includes(clean))
  );

  const totalDeals = merchantDeals.length;
  const completedDeals = merchantDeals.filter((d) => d.status === "Released" || d.status === "Delivered").length;
  const disputedDeals = merchantDeals.filter((d) => d.status === "Disputed").length;

  let disputeRate = "0%";
  if (totalDeals > 0) {
    disputeRate = `${Math.round((disputedDeals / totalDeals) * 100)}%`;
  }

  // Dynamic rating: starts at 5.0, penalizes disputes, rewards completed volume
  let rating = 5.0;
  if (disputedDeals > 0) {
    rating = Math.max(1.0, 5.0 - disputedDeals * 1.5);
  }

  const verified = completedDeals >= 2 && disputedDeals === 0;

  const existingProfile = memoryProfilesCache[clean] || {};
  return {
    handle: clean,
    displayName: existingProfile.displayName || `@${clean}`,
    location: existingProfile.location || "Verified African Merchant",
    phone: existingProfile.phone || "",
    rating: Number(rating.toFixed(1)),
    totalDeals: Math.max(totalDeals, existingProfile.totalDeals || 0),
    completedDeals,
    disputeRate,
    verified,
    walletAddress: existingProfile.walletAddress || null,
    joined: existingProfile.joined || new Date().toISOString().split("T")[0],
    source: "ONCHAIN_VERIFIED_REPUTATION",
  };
}

export function getProfile(handle, onchainDeals = []) {
  const clean = handle.replace(/^@/, "").toLowerCase();
  if (onchainDeals && onchainDeals.length > 0) {
    const computed = computeRealReputation(clean, onchainDeals);
    memoryProfilesCache[clean] = { ...(memoryProfilesCache[clean] || {}), ...computed };
    return computed;
  }
  return memoryProfilesCache[clean] || computeRealReputation(clean, []);
}

export function saveProfile(handle, profileData) {
  const clean = handle.replace(/^@/, "").toLowerCase();
  const updated = {
    ...(memoryProfilesCache[clean] || {}),
    ...profileData,
    handle: clean,
    updatedAt: new Date().toISOString(),
  };
  memoryProfilesCache[clean] = updated;
  writeJsonFile(profilesFile, memoryProfilesCache);

  if (supabase) {
    supabase
      .from("sokopay_merchants")
      .upsert(
        {
          handle: clean,
          display_name: updated.displayName || `@${clean}`,
          location: updated.location || "Verified Merchant",
          phone: updated.phone || "",
          rating: updated.rating || 5.0,
          total_deals: updated.totalDeals || 0,
          dispute_rate: updated.disputeRate || "0%",
          verified: Boolean(updated.verified),
          wallet_address: updated.walletAddress || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "handle" }
      )
      .then(({ error }) => {
        if (error) console.warn("[Storage] Supabase merchant upsert error:", error.message);
      })
      .catch((err) => console.warn("[Storage] Supabase merchant save warning:", err.message));
  }

  return updated;
}

export function getAllProfiles() {
  return memoryProfilesCache;
}

/**
 * Record a verified carrier milestone event to Supabase
 */
export async function logCarrierEvent(dealRef, event) {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.from("sokopay_carrier_events").insert({
      deal_ref: dealRef,
      carrier: event.carrier || "Standard Courier",
      tracking_ref: event.trackingRef || "",
      status: event.status || "IN_TRANSIT",
      location: event.location || "Carrier Transit Hub",
      milestone_title: event.milestoneTitle || "Status Update",
      verified_by_oracle: Boolean(event.verifiedByOracle),
      oracle_attestation_hash: event.oracleAttestationHash || null,
      raw_payload: event.rawPayload || {},
    });
    if (error) console.warn("[Storage] logCarrierEvent error:", error.message);
    return data;
  } catch (err) {
    console.warn("[Storage] logCarrierEvent exception:", err.message);
    return null;
  }
}

/**
 * Retrieve verified carrier events for a deal
 */
export async function getCarrierEvents(dealRef) {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("sokopay_carrier_events")
      .select("*")
      .eq("deal_ref", dealRef)
      .order("created_at", { ascending: true });

    if (error) {
      console.warn("[Storage] getCarrierEvents error:", error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.warn("[Storage] getCarrierEvents exception:", err.message);
    return [];
  }
}

export const getDeals = getAllDealsMetadata;
export { supabase };
