import { getOnchainDeals, autoReleaseOnchain } from "./onchain.js";
import { getDealMetadata, saveDealMetadata, getCarrierEvents } from "./storage.js";
import { getTrackingDetails } from "./logistics.js";

/**
 * SokoPay Automated Settlement Worker
 * Monitors onchain escrow deals, verifies logistics courier status,
 * and triggers automated auto-release once fulfillment conditions or timers are met.
 */

let workerInterval = null;
let isRunningSweep = false;

export async function runSettlementSweep() {
  if (isRunningSweep) return { status: "already_running" };
  isRunningSweep = true;

  const results = {
    timestamp: new Date().toISOString(),
    checked: 0,
    settled: [],
    errors: [],
  };

  try {
    const deals = await getOnchainDeals();
    results.checked = deals.length;

    for (const deal of deals) {
      // Only Dispatched deals are eligible for auto-release
      if (deal.status !== "Dispatched") continue;

      const nowSeconds = Math.floor(Date.now() / 1000);
      const dispatchedSeconds = Math.floor(deal.dispatchedAt / 1000);
      const autoReleaseSeconds = (deal.deliveryDays || 3) * 86400;

      const timerExpired = dispatchedSeconds > 0 && (nowSeconds >= dispatchedSeconds + autoReleaseSeconds);

      // Query real carrier events from Supabase
      let carrierDelivered = false;
      if (deal.trackingRef) {
        const carrierEvents = await getCarrierEvents(deal.dealRef);
        const trackingInfo = getTrackingDetails(deal.trackingRef, deal.dispatchedAt, carrierEvents);
        carrierDelivered = trackingInfo.isDelivered;
      }

      if (timerExpired || carrierDelivered) {
        console.log(`[Settlement Worker] Triggering auto-release onchain for #${deal.dealRef}...`);
        try {
          const res = await autoReleaseOnchain(deal.dealRef);
          saveDealMetadata(deal.dealRef, {
            autoSettled: true,
            settledAt: new Date().toISOString(),
            settlementTx: res.txHash,
            settlementReason: carrierDelivered ? "VERIFIED_CARRIER_DELIVERY" : "TIMEOUT_EXPIRED",
          });

          results.settled.push({
            dealRef: deal.dealRef,
            txHash: res.txHash,
            reason: carrierDelivered ? "Carrier Delivery Verified" : "Auto-release Timeout",
          });
        } catch (err) {
          // If contract reverted because timeout not reached onchain block timestamp
          console.warn(`[Settlement Worker] Deal #${deal.dealRef} skipped: ${err.message}`);
          results.errors.push({ dealRef: deal.dealRef, error: err.message });
        }
      }
    }
  } catch (err) {
    console.warn(`[Settlement Worker] Sweep error: ${err.message}`);
    results.errors.push({ global: err.message });
  } finally {
    isRunningSweep = false;
  }

  return results;
}

export function startSettlementWorker(intervalMs = 45000) {
  if (workerInterval) clearInterval(workerInterval);
  console.log(`[Settlement Worker] Background daemon active (checking every ${intervalMs / 1000}s)`);
  // Run once after 5s startup delay
  setTimeout(runSettlementSweep, 5000);
  workerInterval = setInterval(runSettlementSweep, intervalMs);
  return workerInterval;
}

export function stopSettlementWorker() {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
  }
}
