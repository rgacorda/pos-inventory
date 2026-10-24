import { OrderStatus } from "@pos/shared-types";
import { apiClient } from "@/lib/api-client";
import { dbHelpers, LocalOrder, LocalPayment } from "@/lib/db";

export const OFFLINE_OR_INVALID_TRANSACTION =
  "Offline Server or Invalid Transaction";

export interface LocatedReceipt {
  order: LocalOrder;
  payments: LocalPayment[];
  alreadyExchanged: boolean;
  exchangeChildOrderNumber?: string;
}

export type LocateReceiptResult =
  | { ok: true; receipt: LocatedReceipt }
  | { ok: false; message: string };

function asNumber(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function httpStatus(error: unknown): number | undefined {
  if (typeof error === "object" && error && "response" in error) {
    const status = (error as { response?: { status?: number } }).response?.status;
    return status;
  }
  return undefined;
}

/** Values a scan or typed entry might use for the same transaction. */
export function candidateOrderNumbers(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  const candidates = new Set<string>([trimmed]);
  const orderPrefix = trimmed.match(/^ord-(.+)$/i);
  if (orderPrefix) candidates.add(`ORD-${orderPrefix[1]}`);
  if (/^\d+$/.test(trimmed)) {
    candidates.add(`ORD-${trimmed}`);
    const stripped = trimmed.replace(/^0+/, "");
    if (stripped && stripped !== trimmed) candidates.add(`ORD-${stripped}`);
  }
  return [...candidates];
}

function mapServerOrder(remote: {
  id: string;
  orderNumber: string;
  posLocalId: string;
  terminalId?: string;
  cashierId?: string;
  cashierName?: string;
  customerName?: string;
  customerAddress?: string;
  customerId?: string;
  pointsEarned?: number;
  pointsRedeemed?: number;
  subtotal: unknown;
  taxAmount: unknown;
  discountAmount: unknown;
  totalAmount: unknown;
  status: LocalOrder["status"];
  completedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  exchangeRef?: string;
  exchangedAt?: string;
  returnedItems?: LocalOrder["returnedItems"];
  items?: Array<Record<string, unknown>>;
  exchangeChildOrderNumber?: string | null;
}): LocalOrder {
  const createdAt = new Date(remote.completedAt || remote.createdAt || Date.now());
  return {
    posLocalId: remote.posLocalId,
    serverId: remote.id,
    orderNumber: remote.orderNumber,
    terminalId: remote.terminalId || "",
    cashierId: remote.cashierId || "",
    cashierName: remote.cashierName,
    customerName: remote.customerName,
    customerAddress: remote.customerAddress,
    customerId: remote.customerId,
    pointsEarned: remote.pointsEarned,
    pointsRedeemed: remote.pointsRedeemed,
    subtotal: asNumber(remote.subtotal),
    taxAmount: asNumber(remote.taxAmount),
    discountAmount: asNumber(remote.discountAmount),
    totalAmount: asNumber(remote.totalAmount),
    status: remote.status,
    completedAt: remote.completedAt ? new Date(remote.completedAt) : undefined,
    exchangeRef: remote.exchangeRef,
    exchangedAt: remote.exchangedAt ? new Date(remote.exchangedAt) : undefined,
    returnedItems: remote.returnedItems ?? undefined,
    items: (remote.items ?? []).map((item) => ({
      id: String(item.id ?? ""),
      orderId: remote.posLocalId,
      productId: String(item.productId ?? ""),
      sku: String(item.sku ?? ""),
      name: String(item.name ?? "Item"),
      quantity: asNumber(item.quantity),
      unitPrice: asNumber(item.unitPrice),
      taxRate: asNumber(item.taxRate),
      discountAmount: asNumber(item.discountAmount),
      subtotal: asNumber(item.subtotal),
      total: asNumber(item.total),
    })),
    syncStatus: "synced",
    localCreatedAt: createdAt,
    localUpdatedAt: new Date(remote.updatedAt || createdAt),
  };
}

function mapServerPayments(
  remote: { payments?: Array<Record<string, unknown>>; posLocalId: string; terminalId?: string },
): LocalPayment[] {
  return (remote.payments ?? []).map((payment) => {
    const createdAt = new Date(String(payment.processedAt || payment.createdAt || Date.now()));
    return {
      posLocalId: String(payment.posLocalId ?? ""),
      serverId: payment.id ? String(payment.id) : undefined,
      paymentNumber: String(payment.paymentNumber ?? ""),
      orderId: remote.posLocalId,
      terminalId: String(payment.terminalId ?? remote.terminalId ?? ""),
      method: payment.method as LocalPayment["method"],
      amount: asNumber(payment.amount),
      status: payment.status as LocalPayment["status"],
      reference: payment.reference ? String(payment.reference) : undefined,
      processedAt: createdAt,
      syncStatus: "synced",
      localCreatedAt: createdAt,
      localUpdatedAt: new Date(String(payment.updatedAt || createdAt)),
    };
  });
}

async function fromLocal(order: LocalOrder): Promise<LocatedReceipt> {
  const [payments, child] = await Promise.all([
    dbHelpers.getPaymentsByOrder(order.posLocalId),
    dbHelpers.getExchangeChildOrder(order.orderNumber),
  ]);
  return {
    order,
    payments,
    alreadyExchanged: Boolean(child) || Boolean(order.exchangedAt),
    exchangeChildOrderNumber: child?.orderNumber,
  };
}

async function fetchRemote(candidates: string[]): Promise<{
  order: Record<string, unknown> | null;
  unreachable: boolean;
}> {
  if (!apiClient.isOnline() || !apiClient.getAccessToken()) {
    return { order: null, unreachable: !apiClient.isOnline() };
  }

  for (const candidate of candidates) {
    try {
      const order = await apiClient.lookupOrderByNumber(candidate);
      return { order, unreachable: false };
    } catch (error) {
      if (httpStatus(error) === 404) continue;
      return { order: null, unreachable: true };
    }
  }

  return { order: null, unreachable: false };
}

export function canExchangeReceipt(receipt: LocatedReceipt): boolean {
  if (receipt.alreadyExchanged) return false;
  const status = receipt.order.status;
  return status === OrderStatus.COMPLETED || status === OrderStatus.SYNCED;
}

/**
 * Online: this terminal first, then the server.
 * Offline: this terminal only. A miss is "Offline Server or Invalid Transaction".
 */
export async function locateReceipt(rawCode: string): Promise<LocateReceiptResult> {
  const candidates = candidateOrderNumbers(rawCode);
  if (candidates.length === 0) {
    return { ok: false, message: "Invalid Transaction" };
  }

  let local: LocalOrder | undefined;
  for (const candidate of candidates) {
    const found = await dbHelpers.getOrderByOrderNumber(candidate);
    if (found) {
      local = found;
      break;
    }
  }

  const online = apiClient.isOnline();

  if (!online) {
    if (!local) return { ok: false, message: OFFLINE_OR_INVALID_TRANSACTION };
    return { ok: true, receipt: await fromLocal(local) };
  }

  if (local) {
    const receipt = await fromLocal(local);
    const remote = await fetchRemote([local.orderNumber]);
    if (remote.order) {
      const serverId = remote.order.id ? String(remote.order.id) : undefined;
      receipt.order = {
        ...receipt.order,
        serverId: receipt.order.serverId || serverId,
      };
      const childNumber = remote.order.exchangeChildOrderNumber
        ? String(remote.order.exchangeChildOrderNumber)
        : undefined;
      if (remote.order.exchangedAt || childNumber) {
        receipt.alreadyExchanged = true;
        receipt.exchangeChildOrderNumber =
          receipt.exchangeChildOrderNumber || childNumber;
      }
    }
    return { ok: true, receipt };
  }

  const remote = await fetchRemote(candidates);
  if (remote.order) {
    const order = mapServerOrder(remote.order as Parameters<typeof mapServerOrder>[0]);
    const childNumber = remote.order.exchangeChildOrderNumber
      ? String(remote.order.exchangeChildOrderNumber)
      : undefined;
    return {
      ok: true,
      receipt: {
        order,
        payments: mapServerPayments(
          remote.order as Parameters<typeof mapServerPayments>[0],
        ),
        alreadyExchanged: Boolean(remote.order.exchangedAt) || Boolean(childNumber),
        exchangeChildOrderNumber: childNumber,
      },
    };
  }

  return {
    ok: false,
    message: remote.unreachable
      ? OFFLINE_OR_INVALID_TRANSACTION
      : "Invalid Transaction",
  };
}
