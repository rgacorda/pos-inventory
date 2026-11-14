import { EntityManager, In } from 'typeorm';
import { ProductEntity } from '../entities/product.entity';

export interface SaleCostLine {
  productId?: string | null;
  quantity?: number | string | null;
  unitCost?: number | string | null;
}

/** A non-negative money amount, or null when the value was never recorded. */
export function moneyCost(value: unknown): number | null {
  if (value == null || value === '') return null;
  const amount = typeof value === 'number' ? value : parseFloat(String(value));
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100) / 100;
}

/**
 * Weighted unit cost of each product on a sale. Lines with no recorded
 * cost are skipped so they do not wipe out a line that has one.
 */
export function unitCostByProduct(lines: SaleCostLine[]): Map<string, number> {
  const totals = new Map<string, { quantity: number; cost: number }>();
  for (const line of lines) {
    const productId = line.productId?.trim();
    if (!productId || productId.startsWith('manual-')) continue;
    const quantity = Number(line.quantity);
    const unitCost = moneyCost(line.unitCost);
    if (!Number.isFinite(quantity) || quantity <= 0 || unitCost == null) continue;
    const current = totals.get(productId) ?? { quantity: 0, cost: 0 };
    current.quantity += quantity;
    current.cost += quantity * unitCost;
    totals.set(productId, current);
  }

  const costs = new Map<string, number>();
  for (const [productId, total] of totals) {
    costs.set(
      productId,
      Math.round((total.cost / total.quantity) * 100) / 100,
    );
  }
  return costs;
}

export function unitCostForProduct(
  productId: string | null | undefined,
  costs: Map<string, number | null>,
): number | null {
  if (!productId || productId.startsWith('manual-')) return null;
  const cost = costs.get(productId);
  return cost === undefined ? null : cost;
}

/**
 * Cost to store on a new sale line. The register's snapshot wins, because
 * an offline sale may sync after the product cost has already changed.
 * Manual lines have no product cost.
 */
export function recordedUnitCost(
  productId: string | null | undefined,
  clientCost: unknown,
  costs: Map<string, number | null>,
): number | null {
  if (!productId || productId.startsWith('manual-')) return null;
  const fromClient = moneyCost(clientCost);
  if (fromClient != null) return fromClient;
  return unitCostForProduct(productId, costs);
}

export function stampReturnUnitCosts<T extends { productId?: string }>(
  returnedItems: T[],
  costs: Map<string, number>,
): Array<T & { unitCost?: number }> {
  return returnedItems.map((item) => {
    const unitCost = costs.get(item.productId?.trim() ?? '');
    if (unitCost == null) return { ...item };
    return { ...item, unitCost };
  });
}

/** Current product costs for the organization, keyed by product id. */
export async function loadProductUnitCosts(
  manager: EntityManager,
  organizationId: string | null | undefined,
  productIds: Array<string | null | undefined>,
): Promise<Map<string, number | null>> {
  const ids = [
    ...new Set(
      productIds.filter(
        (id): id is string => !!id && !id.startsWith('manual-'),
      ),
    ),
  ];
  const costs = new Map<string, number | null>();
  if (!organizationId || ids.length === 0) return costs;

  const products = await manager.find(ProductEntity, {
    where: { id: In(ids), organizationId },
    select: { id: true, cost: true },
  });
  for (const product of products) {
    costs.set(product.id, moneyCost(product.cost));
  }
  return costs;
}
