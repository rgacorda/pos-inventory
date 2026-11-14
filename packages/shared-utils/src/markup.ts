/**
 * Selling prices for a unit, a pack, and a half-pack.
 *
 * price = round(round(unit cost) × quantity + percent + fixed amount)
 *
 * A typed sell price is kept until the cost changes (when that tier has a
 * markup), the quantity changes, or the markup changes. Percent and fixed
 * markup are both applied to the tier cost. They are not stacked on top of
 * a price that was typed by hand.
 */

export type PriceTierKey = "unit" | "pack" | "halfPack";

export interface TierPricingFields {
  cost: string;
  markupPercentage: string;
  markupFixed: string;
  price: string;
  packQuantity: string;
  packMarkupPercentage: string;
  packMarkupFixed: string;
  packPrice: string;
  halfPackQuantity: string;
  halfPackMarkupPercentage: string;
  halfPackMarkupFixed: string;
  halfPackPrice: string;
}

/** True when the sell price was saved or typed and should survive a cost edit that has no markup. */
export interface PriceManual {
  unit: boolean;
  pack: boolean;
  halfPack: boolean;
}

export const EMPTY_TIER_PRICING: TierPricingFields = {
  cost: "",
  markupPercentage: "",
  markupFixed: "",
  price: "",
  packQuantity: "",
  packMarkupPercentage: "",
  packMarkupFixed: "",
  packPrice: "",
  halfPackQuantity: "",
  halfPackMarkupPercentage: "",
  halfPackMarkupFixed: "",
  halfPackPrice: "",
};

/** New product: sell prices follow the cost until someone types a price. */
export const TRACK_COST: PriceManual = {
  unit: false,
  pack: false,
  halfPack: false,
};

/** Existing product: keep the saved sell prices until cost, quantity, or markup is edited. */
export const KEEP_SAVED_PRICES: PriceManual = {
  unit: true,
  pack: true,
  halfPack: true,
};

const UNIT_BELOW_COST =
  "Unit price cannot be below cost. A profit of zero is allowed.";
const PACK_BELOW_COST =
  "Pack price cannot be below the cost of that pack. A profit of zero is allowed.";
const HALF_BELOW_COST =
  "Half-pack price cannot be below the cost of that half-pack. A profit of zero is allowed.";

const TIER_FIELDS = {
  unit: {
    quantityKey: null,
    pctKey: "markupPercentage",
    fixedKey: "markupFixed",
    priceKey: "price",
  },
  pack: {
    quantityKey: "packQuantity",
    pctKey: "packMarkupPercentage",
    fixedKey: "packMarkupFixed",
    priceKey: "packPrice",
  },
  halfPack: {
    quantityKey: "halfPackQuantity",
    pctKey: "halfPackMarkupPercentage",
    fixedKey: "halfPackMarkupFixed",
    priceKey: "halfPackPrice",
  },
} as const;

export function roundMoney(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export function parsePricingNumber(
  value: string | number | null | undefined,
): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value == null) return 0;
  const trimmed = String(value).trim();
  if (trimmed === "" || trimmed === "-" || trimmed === "." || trimmed === "-.") {
    return 0;
  }
  const parsed = parseFloat(trimmed);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Per-unit cost stored on the product (two decimal places). */
export function pricingUnitCost(unitCost: number): number {
  return roundMoney(Number.isFinite(unitCost) ? unitCost : 0);
}

/**
 * Sell price from a cost base plus an optional percent and/or fixed markup.
 * Both markups are added to the base. A missing markup counts as zero.
 */
export function applyMarkup(
  base: number,
  markupPercentage?: number | null,
  markupFixed?: number | null,
): number {
  const amount = Number.isFinite(base) ? base : 0;
  const percent = Number(markupPercentage) || 0;
  const fixed = Number(markupFixed) || 0;
  return roundMoney(amount + (amount * percent) / 100 + fixed);
}

export function tierQuantity(fields: TierPricingFields, tier: PriceTierKey): number {
  if (tier === "unit") return 1;
  const key = TIER_FIELDS[tier].quantityKey;
  const parsed = parseInt(fields[key], 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function tierHasMarkup(fields: TierPricingFields, tier: PriceTierKey): boolean {
  const { pctKey, fixedKey } = TIER_FIELDS[tier];
  return (
    parsePricingNumber(fields[pctKey]) !== 0 ||
    parsePricingNumber(fields[fixedKey]) !== 0
  );
}

function textValue(value: unknown): string {
  if (value == null || value === "") return "";
  return String(value);
}

export function tierPricingFromProduct(product?: {
  cost?: number | string | null;
  price?: number | string | null;
  markupPercentage?: number | string | null;
  markupFixed?: number | string | null;
  packQuantity?: number | string | null;
  packMarkupPercentage?: number | string | null;
  packMarkupFixed?: number | string | null;
  packPrice?: number | string | null;
  halfPackQuantity?: number | string | null;
  halfPackMarkupPercentage?: number | string | null;
  halfPackMarkupFixed?: number | string | null;
  halfPackPrice?: number | string | null;
} | null): TierPricingFields {
  return {
    cost: textValue(product?.cost),
    markupPercentage: textValue(product?.markupPercentage),
    markupFixed: textValue(product?.markupFixed),
    price: textValue(product?.price),
    packQuantity: textValue(product?.packQuantity),
    packMarkupPercentage: textValue(product?.packMarkupPercentage),
    packMarkupFixed: textValue(product?.packMarkupFixed),
    packPrice: textValue(product?.packPrice),
    halfPackQuantity: textValue(product?.halfPackQuantity),
    halfPackMarkupPercentage: textValue(product?.halfPackMarkupPercentage),
    halfPackMarkupFixed: textValue(product?.halfPackMarkupFixed),
    halfPackPrice: textValue(product?.halfPackPrice),
  };
}

function writeTierPrice(
  fields: TierPricingFields,
  tier: PriceTierKey,
  unitCost: number,
): void {
  const { pctKey, fixedKey, priceKey } = TIER_FIELDS[tier];
  const quantity = tierQuantity(fields, tier);
  if (tier !== "unit" && quantity <= 0) {
    fields[priceKey] = "";
    return;
  }
  const price = applyMarkup(
    pricingUnitCost(unitCost) * quantity,
    parsePricingNumber(fields[pctKey]),
    parsePricingNumber(fields[fixedKey]),
  );
  fields[priceKey] = price > 0 ? price.toFixed(2) : "";
}

function tierBasis(unitCost: number, quantity: number): number {
  return roundMoney(pricingUnitCost(unitCost) * quantity);
}

/**
 * Recalculate sell prices after the per-unit cost changes.
 * A tier with a markup always follows the cost. A tier without a markup
 * keeps a typed or saved price, and fills a blank price from the cost.
 */
export function changeExternalUnitCost(
  fields: TierPricingFields,
  manual: PriceManual,
  unitCost: number,
): { fields: TierPricingFields; manual: PriceManual } {
  const next: TierPricingFields = { ...fields };
  const nextManual: PriceManual = { ...manual };
  (["unit", "pack", "halfPack"] as const).forEach((tier) => {
    const priceKey = TIER_FIELDS[tier].priceKey;
    if (tier !== "unit" && tierQuantity(next, tier) <= 0) {
      next[priceKey] = "";
      return;
    }
    const followCost = !nextManual[tier] || tierHasMarkup(next, tier) || next[priceKey].trim() === "";
    if (followCost) {
      writeTierPrice(next, tier, unitCost);
      nextManual[tier] = false;
    }
  });
  return { fields: next, manual: nextManual };
}

export function changeUnitCost(
  fields: TierPricingFields,
  manual: PriceManual,
  rawCost: string,
): { fields: TierPricingFields; manual: PriceManual } {
  return changeExternalUnitCost(
    { ...fields, cost: rawCost },
    manual,
    parsePricingNumber(rawCost),
  );
}

export function changeTierMarkup(
  fields: TierPricingFields,
  manual: PriceManual,
  tier: PriceTierKey,
  kind: "percentage" | "fixed",
  raw: string,
  unitCost: number,
): { fields: TierPricingFields; manual: PriceManual } {
  const { pctKey, fixedKey, priceKey } = TIER_FIELDS[tier];
  const next: TierPricingFields = {
    ...fields,
    [kind === "percentage" ? pctKey : fixedKey]: raw,
  };
  if (tier !== "unit" && tierQuantity(next, tier) <= 0) {
    next[priceKey] = "";
    return { fields: next, manual };
  }
  if (!tierHasMarkup(next, tier) && next[priceKey].trim() !== "") {
    return { fields: next, manual: { ...manual, [tier]: true } };
  }
  writeTierPrice(next, tier, unitCost);
  return { fields: next, manual: { ...manual, [tier]: false } };
}

export function changeTierQuantity(
  fields: TierPricingFields,
  manual: PriceManual,
  tier: "pack" | "halfPack",
  raw: string,
  unitCost: number,
): { fields: TierPricingFields; manual: PriceManual } {
  const quantityKey = TIER_FIELDS[tier].quantityKey;
  const next: TierPricingFields = { ...fields, [quantityKey]: raw };
  writeTierPrice(next, tier, unitCost);
  return { fields: next, manual: { ...manual, [tier]: false } };
}

export function changeTierPrice(
  fields: TierPricingFields,
  manual: PriceManual,
  tier: PriceTierKey,
  raw: string,
): { fields: TierPricingFields; manual: PriceManual } {
  const priceKey = TIER_FIELDS[tier].priceKey;
  return {
    fields: { ...fields, [priceKey]: raw },
    manual: { ...manual, [tier]: true },
  };
}

export function belowCostPricingMessage(
  fields: TierPricingFields,
  unitCost = parsePricingNumber(fields.cost),
): string | null {
  if (fields.price.trim() !== "") {
    const price = roundMoney(parsePricingNumber(fields.price));
    if (Math.round((price - tierBasis(unitCost, 1)) * 100) < 0) {
      return UNIT_BELOW_COST;
    }
  }

  const packQty = tierQuantity(fields, "pack");
  if (packQty > 0 && parsePricingNumber(fields.packPrice) > 0) {
    const packPrice = roundMoney(parsePricingNumber(fields.packPrice));
    if (Math.round((packPrice - tierBasis(unitCost, packQty)) * 100) < 0) {
      return PACK_BELOW_COST;
    }
  }

  const halfQty = tierQuantity(fields, "halfPack");
  if (halfQty > 0 && parsePricingNumber(fields.halfPackPrice) > 0) {
    const halfPrice = roundMoney(parsePricingNumber(fields.halfPackPrice));
    if (Math.round((halfPrice - tierBasis(unitCost, halfQty)) * 100) < 0) {
      return HALF_BELOW_COST;
    }
  }

  return null;
}

export function nullablePricingNumber(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function nullablePricingInt(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function positiveIntOrNull(value: string): number | null {
  const parsed = nullablePricingInt(value);
  return parsed != null && parsed > 0 ? parsed : null;
}

function positiveMoneyOrNull(value: string): number | null {
  const parsed = nullablePricingNumber(value);
  return parsed != null && parsed > 0 ? roundMoney(parsed) : null;
}

export function tierPricingPayload(fields: TierPricingFields) {
  return {
    cost: parsePricingNumber(fields.cost),
    price: parsePricingNumber(fields.price),
    markupPercentage: nullablePricingNumber(fields.markupPercentage),
    markupFixed: nullablePricingNumber(fields.markupFixed),
    packQuantity: positiveIntOrNull(fields.packQuantity),
    packMarkupPercentage: nullablePricingNumber(fields.packMarkupPercentage),
    packMarkupFixed: nullablePricingNumber(fields.packMarkupFixed),
    packPrice: positiveMoneyOrNull(fields.packPrice),
    halfPackQuantity: positiveIntOrNull(fields.halfPackQuantity),
    halfPackMarkupPercentage: nullablePricingNumber(fields.halfPackMarkupPercentage),
    halfPackMarkupFixed: nullablePricingNumber(fields.halfPackMarkupFixed),
    halfPackPrice: positiveMoneyOrNull(fields.halfPackPrice),
  };
}

/**
 * Prices and markups to store on a delivery line. Null clears a pack,
 * half-pack, or markup when the delivery is received. A blank unit price
 * is omitted so it cannot wipe the product's selling price.
 */
export function deliveryPriceOverrides(fields: TierPricingFields) {
  const price = positiveMoneyOrNull(fields.price);
  return {
    ...(price != null ? { priceOverride: price } : {}),
    packQuantityOverride: positiveIntOrNull(fields.packQuantity),
    packPriceOverride: positiveMoneyOrNull(fields.packPrice),
    halfPackQuantityOverride: positiveIntOrNull(fields.halfPackQuantity),
    halfPackPriceOverride: positiveMoneyOrNull(fields.halfPackPrice),
    markupPercentage: nullablePricingNumber(fields.markupPercentage),
    markupFixed: nullablePricingNumber(fields.markupFixed),
    packMarkupPercentage: nullablePricingNumber(fields.packMarkupPercentage),
    packMarkupFixed: nullablePricingNumber(fields.packMarkupFixed),
    halfPackMarkupPercentage: nullablePricingNumber(fields.halfPackMarkupPercentage),
    halfPackMarkupFixed: nullablePricingNumber(fields.halfPackMarkupFixed),
  };
}
