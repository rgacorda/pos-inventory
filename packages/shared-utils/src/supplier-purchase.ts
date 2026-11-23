/** How many recent received deliveries are averaged for the next order. */
export const RECENT_PURCHASE_WINDOW = 8;

export type SuggestedQuantityType = "UNIT" | "PACK" | "HALF_PACK";

export interface SupplierPurchaseEvent {
  productId: string;
  deliveryId: string;
  deliveryDate: string | Date;
  createdAt?: string | Date | null;
  quantity: number;
}

export interface SupplierPurchaseAverage {
  productId: string;
  averageQuantity: number;
  deliveryCount: number;
  lastQuantity: number;
  lastDeliveryDate: string;
}

function timestamp(value: string | Date | null | undefined): number {
  if (!value) return 0;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

/**
 * Mean purchase size per product from the newest deliveries.
 * Lines from the same delivery are one purchase, so a split line
 * does not count as two orders.
 */
export function averageRecentPurchases(
  events: SupplierPurchaseEvent[],
  window = RECENT_PURCHASE_WINDOW,
): SupplierPurchaseAverage[] {
  const byDelivery = new Map<string, SupplierPurchaseEvent>();

  for (const event of events) {
    if (!event.productId || !event.deliveryId) continue;
    const quantity = Number(event.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) continue;

    const key = `${event.productId}:${event.deliveryId}`;
    const existing = byDelivery.get(key);
    if (!existing) {
      byDelivery.set(key, { ...event, quantity });
      continue;
    }
    existing.quantity += quantity;
  }

  const byProduct = new Map<string, SupplierPurchaseEvent[]>();
  for (const event of byDelivery.values()) {
    const list = byProduct.get(event.productId) ?? [];
    list.push(event);
    byProduct.set(event.productId, list);
  }

  const results: SupplierPurchaseAverage[] = [];
  for (const [productId, list] of byProduct) {
    const recent = [...list]
      .sort((a, b) => {
        const byDate = timestamp(b.deliveryDate) - timestamp(a.deliveryDate);
        if (byDate !== 0) return byDate;
        return timestamp(b.createdAt) - timestamp(a.createdAt);
      })
      .slice(0, Math.max(1, window));

    const total = recent.reduce((sum, event) => sum + event.quantity, 0);
    const last = recent[0];
    results.push({
      productId,
      averageQuantity: Math.round((total / recent.length) * 100) / 100,
      deliveryCount: recent.length,
      lastQuantity: last.quantity,
      lastDeliveryDate: new Date(last.deliveryDate).toISOString(),
    });
  }

  return results;
}

/**
 * Order quantity closest to the average, in the pack the supplier
 * actually sells. Packs win a tie with loose units so a 12-unit
 * average on a 12-unit pack is suggested as 1 pack.
 */
export function suggestedPurchaseQuantity(
  averageUnits: number,
  product?: {
    packQuantity?: number | null;
    halfPackQuantity?: number | null;
  },
): { quantity: number; quantityType: SuggestedQuantityType } {
  const average = Number(averageUnits);
  if (!Number.isFinite(average) || average <= 0) {
    return { quantity: 0, quantityType: "UNIT" };
  }

  const target = Math.max(1, Math.round(average));
  const candidates: Array<{
    quantity: number;
    quantityType: SuggestedQuantityType;
    units: number;
    rank: number;
  }> = [{ quantity: target, quantityType: "UNIT", units: target, rank: 2 }];

  const pack = Number(product?.packQuantity);
  if (Number.isFinite(pack) && pack > 1) {
    const packs = Math.round(average / pack);
    if (packs >= 1) {
      candidates.push({
        quantity: packs,
        quantityType: "PACK",
        units: packs * pack,
        rank: 0,
      });
    }
  }

  const half = Number(product?.halfPackQuantity);
  if (Number.isFinite(half) && half > 1) {
    const halves = Math.round(average / half);
    if (halves >= 1) {
      candidates.push({
        quantity: halves,
        quantityType: "HALF_PACK",
        units: halves * half,
        rank: 1,
      });
    }
  }

  candidates.sort((a, b) => {
    const distance = Math.abs(a.units - average) - Math.abs(b.units - average);
    if (distance !== 0) return distance;
    return a.rank - b.rank;
  });

  const best = candidates[0];
  return { quantity: best.quantity, quantityType: best.quantityType };
}
