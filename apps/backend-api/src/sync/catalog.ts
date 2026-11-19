import { ProductDto } from '@pos/shared-types';

export type CatalogSyncMode = 'unchanged' | 'changes' | 'full';

export interface CatalogRow {
  id?: string | null;
  sku?: string | null;
  name?: string | null;
  description?: string | null;
  category?: string | null;
  price?: unknown;
  cost?: unknown;
  packPrice?: unknown;
  packQuantity?: unknown;
  packMarkupPercentage?: unknown;
  packMarkupFixed?: unknown;
  halfPackPrice?: unknown;
  halfPackQuantity?: unknown;
  halfPackMarkupPercentage?: unknown;
  halfPackMarkupFixed?: unknown;
  addonPrice?: unknown;
  convenienceMarkupPercentage?: unknown;
  convenienceMarkup?: unknown;
  taxRate?: unknown;
  barcode?: string | null;
  status?: string | null;
  stockQuantity?: unknown;
  infiniteStock?: boolean | null;
  deletedAt?: Date | string | null;
}

/**
 * Decide how much of the catalog to send.
 * A count or stock mismatch always downloads everything, so a product that
 * never changed `updatedAt` cannot stay missing on the POS. When the snapshot
 * matches and something was edited, only those rows are sent.
 */
export function catalogSyncMode(options: {
  since: Date | null;
  localCount: number | null;
  localStockSum: number | null;
  sellableCount: number;
  stockSum: number;
  changedCount: number;
}): CatalogSyncMode {
  if (!options.since) return 'full';
  if (
    options.localCount == null ||
    options.localCount !== options.sellableCount
  ) {
    return 'full';
  }
  if (options.changedCount > 0) return 'changes';
  if (
    options.localStockSum == null ||
    options.localStockSum !== options.stockSum
  ) {
    return 'full';
  }
  return 'unchanged';
}

export function clampCatalogLimit(value: unknown, fallback = 500): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(1000, Math.max(100, Math.floor(n)));
}

export function parseOptionalDate(value: unknown): Date | null {
  if (value == null || value === '') return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function parseOptionalCount(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

export function finiteInteger(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

/**
 * Inventory lists every product that has not been archived, including
 * inactive and discontinued ones. The POS catalog uses that same set.
 * Archived rows return null so the caller can drop them.
 */
export function toCatalogProduct(row: CatalogRow): ProductDto | null {
  if (!row?.id || row.deletedAt) return null;

  return {
    id: row.id,
    sku: row.sku || '',
    name: row.name || '',
    description: textOrUndefined(row.description),
    category: textOrUndefined(row.category),
    price: money(row.price),
    cost: optionalMoney(row.cost),
    packPrice: optionalMoney(row.packPrice),
    packQuantity: optionalInteger(row.packQuantity),
    packMarkupPercentage: optionalMoney(row.packMarkupPercentage),
    packMarkupFixed: optionalMoney(row.packMarkupFixed),
    halfPackPrice: optionalMoney(row.halfPackPrice),
    halfPackQuantity: optionalInteger(row.halfPackQuantity),
    halfPackMarkupPercentage: optionalMoney(row.halfPackMarkupPercentage),
    halfPackMarkupFixed: optionalMoney(row.halfPackMarkupFixed),
    addonPrice: optionalMoney(row.addonPrice),
    convenienceMarkupPercentage: optionalMoney(row.convenienceMarkupPercentage),
    convenienceMarkup: optionalMoney(row.convenienceMarkup),
    taxRate: decimal(row.taxRate, 4),
    barcode: textOrUndefined(row.barcode),
    status: row.status || 'ACTIVE',
    stockQuantity: finiteInteger(row.stockQuantity),
    infiniteStock: row.infiniteStock === true,
  };
}

function textOrUndefined(value: unknown): string | undefined {
  if (value == null) return undefined;
  const text = String(value).trim();
  return text.length ? text : undefined;
}

function isZeroOrNumber(value: unknown): boolean {
  if (value == null || value === '') return false;
  return Number.isFinite(Number(value));
}

function money(value: unknown): number {
  return decimal(value, 2);
}

function optionalMoney(value: unknown): number | undefined {
  if (!isZeroOrNumber(value)) return undefined;
  return decimal(value, 2);
}

function decimal(value: unknown, places: number): number {
  if (!isZeroOrNumber(value)) return 0;
  const factor = 10 ** places;
  return Math.round(Number(value) * factor) / factor;
}

function optionalInteger(value: unknown): number | undefined {
  if (!isZeroOrNumber(value)) return undefined;
  return Math.round(Number(value));
}
