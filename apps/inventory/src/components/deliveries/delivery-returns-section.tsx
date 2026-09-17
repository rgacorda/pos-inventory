"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { showErrorFromException, ERROR_MESSAGES } from "@/lib/toast-utils";
import { format } from "date-fns";
import { IconTruckReturn } from "@tabler/icons-react";
import {
  ReturnItemsEditor,
  ReturnItemProduct,
  ReturnLineItem,
} from "@/components/returns/return-items-editor";

export type ReturnResolutionAction = "FULFILL" | "CREDIT";

export interface ReturnResolutionSelection {
  returnId: string;
  action: ReturnResolutionAction;
  replacementItems?: ReturnLineItem[];
}

export interface OutstandingReturnItem {
  productId: string;
  productName: string;
  productSku?: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
}

export interface OutstandingReturn {
  id: string;
  supplier: string;
  supplierId?: string | null;
  reason?: string | null;
  status: "NOT_RESOLVED" | "RESOLVED";
  returnedItems: OutstandingReturnItem[];
  returnedTotalCost: number;
  createdAt: string;
  resolutionType?: "REPLACEMENT" | "FULFILL" | "CREDIT" | null;
  resolvedDeliveryId?: string | null;
}

interface DeliveryReturnsSectionProps {
  supplierId: string;
  value: ReturnResolutionSelection[];
  onChange: (value: ReturnResolutionSelection[]) => void;
  onCreditAmountChange?: (amount: number) => void;
  /** On edit, keep showing returns already attached to this delivery. */
  includeReturnIds?: string[];
}

function copyItems(items: OutstandingReturnItem[]): ReturnLineItem[] {
  return items.map((item) => ({ ...item }));
}

function creditTotal(returns: OutstandingReturn[], value: ReturnResolutionSelection[]) {
  return value.reduce((sum, selection) => {
    if (selection.action !== "CREDIT") return sum;
    const match = returns.find((item) => item.id === selection.returnId);
    return sum + Number(match?.returnedTotalCost || 0);
  }, 0);
}

export function getReturnCreditAmount(
  returns: OutstandingReturn[],
  value: ReturnResolutionSelection[],
) {
  return Math.round(creditTotal(returns, value) * 100) / 100;
}

export function DeliveryReturnsSection({
  supplierId,
  value,
  onChange,
  onCreditAmountChange,
  includeReturnIds = [],
}: DeliveryReturnsSectionProps) {
  const [returns, setReturns] = useState<OutstandingReturn[]>([]);
  const [products, setProducts] = useState<ReturnItemProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const onCreditAmountChangeRef = useRef(onCreditAmountChange);
  onCreditAmountChangeRef.current = onCreditAmountChange;

  useEffect(() => {
    if (!supplierId) {
      setReturns([]);
      onCreditAmountChangeRef.current?.(0);
      return;
    }

    let cancelled = false;

    async function fetchReturns() {
      try {
        setLoading(true);
        const [openReturns, includedReturns, productsData] = await Promise.all([
          apiClient.getInventoryReturns({
            supplierId,
            status: "NOT_RESOLVED",
          }),
          includeReturnIds.length > 0
            ? Promise.all(
                includeReturnIds.map((id) =>
                  apiClient.getInventoryReturn(id).catch(() => null),
                ),
              )
            : Promise.resolve([]),
          apiClient.getProducts(),
        ]);

        if (cancelled) return;

        const byId = new Map<string, OutstandingReturn>();
        for (const item of openReturns as OutstandingReturn[]) {
          byId.set(item.id, item);
        }
        for (const item of includedReturns) {
          if (
            item &&
            (!item.supplierId || item.supplierId === supplierId)
          ) {
            byId.set(item.id, item);
          }
        }
        setReturns(Array.from(byId.values()));
        setProducts(productsData);
      } catch (error) {
        if (!cancelled) {
          showErrorFromException(
            error,
            ERROR_MESSAGES.LOAD_FAILED("returns"),
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchReturns();
    return () => {
      cancelled = true;
    };
  }, [supplierId, includeReturnIds.join("|")]);

  useEffect(() => {
    onCreditAmountChangeRef.current?.(getReturnCreditAmount(returns, value));
  }, [returns, value]);

  const selectedById = useMemo(() => {
    const map = new Map<string, ReturnResolutionSelection>();
    for (const selection of value) {
      map.set(selection.returnId, selection);
    }
    return map;
  }, [value]);

  function setAction(
    inventoryReturn: OutstandingReturn,
    action: ReturnResolutionAction | "SKIP",
  ) {
    const next = value.filter(
      (selection) => selection.returnId !== inventoryReturn.id,
    );
    if (action === "FULFILL") {
      const existing = selectedById.get(inventoryReturn.id);
      next.push({
        returnId: inventoryReturn.id,
        action,
        replacementItems:
          existing?.replacementItems && existing.replacementItems.length > 0
            ? existing.replacementItems
            : copyItems(inventoryReturn.returnedItems),
      });
    } else if (action === "CREDIT") {
      next.push({ returnId: inventoryReturn.id, action });
    }
    onChange(next);
  }

  function setReplacementItems(returnId: string, items: ReturnLineItem[]) {
    onChange(
      value.map((selection) =>
        selection.returnId === returnId
          ? { ...selection, replacementItems: items }
          : selection,
      ),
    );
  }

  if (!supplierId) {
    return null;
  }

  if (loading) {
    return (
      <div className="space-y-2 border-t pt-6">
        <Label className="text-lg font-semibold">Outstanding Returns</Label>
        <p className="text-sm text-muted-foreground">Loading returns...</p>
      </div>
    );
  }

  if (returns.length === 0) {
    return (
      <div className="space-y-2 border-t pt-6">
        <Label className="text-lg font-semibold">Outstanding Returns</Label>
        <p className="text-sm text-muted-foreground">
          No unresolved returns for this supplier. Returned items will show
          up here so they can be fulfilled or credited on this delivery.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 border-t pt-6">
      <div>
        <Label className="text-lg font-semibold">Outstanding Returns</Label>
        <p className="text-sm text-muted-foreground mt-1">
          Items previously sent back to this supplier. Fulfill if they are
          replacing the product — including with a different product. Credit
          if they are only deducting the returned cost from this invoice.
        </p>
      </div>

      <div className="space-y-3">
        {returns.map((inventoryReturn) => {
          const selection = selectedById.get(inventoryReturn.id);
          const action = selection?.action || "SKIP";
          const returnedTotal = Number(inventoryReturn.returnedTotalCost || 0);
          const replacementItems =
            selection?.replacementItems && selection.replacementItems.length > 0
              ? selection.replacementItems
              : copyItems(inventoryReturn.returnedItems);
          const replacementTotal = replacementItems.reduce(
            (sum, item) => sum + Number(item.totalCost || 0),
            0,
          );
          const costDiff =
            Math.round((replacementTotal - returnedTotal) * 100) / 100;

          return (
            <div
              key={inventoryReturn.id}
              className="rounded-md border p-3 space-y-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <IconTruckReturn className="h-4 w-4 text-muted-foreground" />
                    <p className="font-medium">
                      {format(new Date(inventoryReturn.createdAt), "MMM d, yyyy")}
                    </p>
                    {inventoryReturn.reason && (
                      <Badge variant="outline">{inventoryReturn.reason}</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Returned:{" "}
                    {inventoryReturn.returnedItems
                      .map(
                        (item) =>
                          `${item.productName} × ${item.quantity}`,
                      )
                      .join(", ")}
                  </p>
                  <p className="text-sm font-medium">
                    Returned value: ₱{returnedTotal.toFixed(2)}
                  </p>
                </div>

                <ToggleGroup
                  type="single"
                  variant="outline"
                  size="sm"
                  value={action}
                  onValueChange={(next) => {
                    if (!next) return;
                    setAction(
                      inventoryReturn,
                      next as ReturnResolutionAction | "SKIP",
                    );
                  }}
                  className="flex-wrap"
                >
                  <ToggleGroupItem value="SKIP">Skip</ToggleGroupItem>
                  <ToggleGroupItem value="FULFILL">Fulfill</ToggleGroupItem>
                  <ToggleGroupItem value="CREDIT">
                    Credit ₱{returnedTotal.toFixed(2)}
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>

              {action === "FULFILL" && (
                <div className="space-y-3">
                  <p className="text-xs text-emerald-700">
                    Record what the supplier sent as replacements. Defaults to
                    the same items — change products or quantities if they sent
                    something different. Stock is added for these items when
                    this delivery is received. Do not also add them as paid
                    delivery items unless you are buying extra stock.
                  </p>
                  <ReturnItemsEditor
                    products={products}
                    items={replacementItems}
                    onItemsChange={(items) =>
                      setReplacementItems(inventoryReturn.id, items)
                    }
                    supplierId={supplierId}
                    supplierName={inventoryReturn.supplier}
                    stockEffect="add"
                    itemNounSingular="replacement item"
                    quickAddSource={inventoryReturn.returnedItems}
                    quickAddLabel="Returned items"
                  />
                  <div
                    className={`p-3 rounded border text-sm space-y-1 ${
                      costDiff === 0
                        ? "bg-emerald-50 border-emerald-200"
                        : "bg-amber-50 border-amber-200"
                    }`}
                  >
                    <p>
                      Returned total:{" "}
                      <span className="font-semibold">
                        ₱{returnedTotal.toFixed(2)}
                      </span>
                    </p>
                    <p>
                      Replacement total:{" "}
                      <span className="font-semibold">
                        ₱{replacementTotal.toFixed(2)}
                      </span>
                    </p>
                    {costDiff === 0 ? (
                      <p className="text-emerald-700 font-medium">
                        Replacement cost matches the returned items.
                      </p>
                    ) : (
                      <p className="text-amber-700 font-medium">
                        {costDiff > 0
                          ? `Replacement is ₱${costDiff.toFixed(2)} more than the returned items. The invoice is not charged extra unless you add those products as paid delivery items.`
                          : `Replacement is ₱${Math.abs(costDiff).toFixed(2)} short of the returned items. Use Credit instead if the supplier is deducting the difference.`}
                      </p>
                    )}
                  </div>
                </div>
              )}
              {action === "CREDIT" && (
                <p className="text-xs text-amber-700">
                  ₱{returnedTotal.toFixed(2)} will be deducted from this
                  delivery total. Returned stock stays deducted because no
                  replacement product is coming back.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
