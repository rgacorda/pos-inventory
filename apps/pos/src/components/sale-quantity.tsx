"use client";

import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  calculatePriceBreakdown,
  formatPriceBreakdownLabel,
} from "@pos/shared-utils";

export interface SaleQuantitySource {
  packPrice?: number | null;
  packQuantity?: number | null;
  halfPackPrice?: number | null;
  halfPackQuantity?: number | null;
}

function tierSize(price?: number | null, quantity?: number | null): number {
  const size = Number(quantity) || 0;
  const amount = Number(price) || 0;
  return amount > 0 && size > 0 ? size : 0;
}

/**
 * Add one pack, half-pack, or piece.
 * The dialog starts at one piece. The first pack or half-pack replaces that
 * piece so a single tap sells the bundle, not the bundle plus a loose item.
 */
export function addSaleTier(
  current: string,
  tier: "pack" | "half" | "piece",
  source: SaleQuantitySource,
): string {
  const qty = Math.max(0, parseInt(current, 10) || 0);
  const packQty = tierSize(source.packPrice, source.packQuantity);
  const halfQty = tierSize(source.halfPackPrice, source.halfPackQuantity);
  const breakdown = calculatePriceBreakdown(
    qty,
    0,
    packQty ? Number(source.packPrice) : undefined,
    packQty || undefined,
    halfQty ? Number(source.halfPackPrice) : undefined,
    halfQty || undefined,
  );

  if (tier === "piece") return String(Math.max(1, qty + 1));

  const size = tier === "pack" ? packQty : halfQty;
  if (!size) return String(Math.max(1, qty + 1));
  const untouchedPiece =
    breakdown.packs === 0 && breakdown.halfPacks === 0 && breakdown.units === 1;
  if (untouchedPiece) return String(size);
  return String(qty + size);
}

/**
 * Arrow keys while the add-product dialog is open.
 * Up/down change loose pieces. Right adds a pack. Left adds a half-pack,
 * or removes a pack when the product has no half-pack price.
 */
export function saleQuantityStep(
  current: string,
  direction: "up" | "down" | "left" | "right",
  source: SaleQuantitySource,
): string {
  const qty = parseInt(current, 10) || 0;
  const packQty = tierSize(source.packPrice, source.packQuantity);
  const halfQty = tierSize(source.halfPackPrice, source.halfPackQuantity);
  const breakdown = calculatePriceBreakdown(
    qty,
    0,
    packQty ? Number(source.packPrice) : undefined,
    packQty || undefined,
    halfQty ? Number(source.halfPackPrice) : undefined,
    halfQty || undefined,
  );

  if (direction === "up") return String(qty + 1);
  if (direction === "down") {
    if (breakdown.units <= 0) return String(Math.max(1, qty));
    return String(Math.max(1, qty - 1));
  }
  if (direction === "right") {
    return addSaleTier(current, packQty ? "pack" : "piece", source);
  }
  if (halfQty) return addSaleTier(current, "half", source);
  if (packQty && breakdown.packs > 0) return String(Math.max(1, qty - packQty));
  return String(Math.max(1, qty - 1));
}

interface SaleQuantityPickerProps extends SaleQuantitySource {
  quantity: string;
  onChange: (next: string) => void;
  unitPrice: number;
}

export function SaleQuantityPicker({
  quantity,
  onChange,
  unitPrice,
  packPrice,
  packQuantity,
  halfPackPrice,
  halfPackQuantity,
}: SaleQuantityPickerProps) {
  const qty = Math.max(0, parseInt(quantity, 10) || 0);
  const packQty = tierSize(packPrice, packQuantity);
  const halfQty = tierSize(halfPackPrice, halfPackQuantity);
  const breakdown = calculatePriceBreakdown(
    qty,
    unitPrice,
    packQty ? Number(packPrice) : undefined,
    packQty || undefined,
    halfQty ? Number(halfPackPrice) : undefined,
    halfQty || undefined,
  );
  const hasTiers = packQty > 0 || halfQty > 0;
  const label = formatPriceBreakdownLabel(breakdown);

  const source = { packPrice, packQuantity, halfPackPrice, halfPackQuantity };
  const step = (delta: number) => {
    onChange(String(Math.max(1, qty + delta)));
  };

  return (
    <div className="space-y-2">
      {packQty > 0 && (
        <TierRow
          label="Pack"
          detail={`${packQty} pcs · ₱${Number(packPrice).toFixed(2)}`}
          count={breakdown.packs}
          activeClassName="border-green-500 bg-green-50"
          onAdd={() => onChange(addSaleTier(quantity, "pack", source))}
          onRemove={() => step(-packQty)}
          removeDisabled={breakdown.packs <= 0}
        />
      )}
      {halfQty > 0 && (
        <TierRow
          label="Half pack"
          detail={`${halfQty} pcs · ₱${Number(halfPackPrice).toFixed(2)}`}
          count={breakdown.halfPacks}
          activeClassName="border-indigo-400 bg-indigo-50"
          onAdd={() => onChange(addSaleTier(quantity, "half", source))}
          onRemove={() => step(-halfQty)}
          removeDisabled={breakdown.halfPacks <= 0}
        />
      )}
      <TierRow
        label={hasTiers ? "Piece" : "Quantity"}
        detail={hasTiers ? `₱${unitPrice.toFixed(2)} each` : undefined}
        count={hasTiers ? breakdown.units : qty}
        activeClassName="border-gray-900 bg-gray-50"
        onAdd={() => onChange(addSaleTier(quantity, "piece", source))}
        onRemove={() => step(-1)}
        removeDisabled={hasTiers ? breakdown.units <= 0 || qty <= 1 : qty <= 1}
      />

      {!hasTiers && (
        <div className="grid grid-cols-4 gap-2">
          {[1, 2, 5, 10].map((amount) => (
            <Button
              key={amount}
              type="button"
              variant={qty === amount ? "default" : "outline"}
              className="h-10"
              onClick={() => onChange(String(amount))}
            >
              {amount}
            </Button>
          ))}
        </div>
      )}

      <div className="flex items-end justify-between border-t pt-2">
        <div>
          <div className="text-sm text-gray-600">
            {qty} pc{qty === 1 ? "" : "s"}
          </div>
          {label && (
            <div className="text-xs font-medium text-green-700">{label}</div>
          )}
        </div>
        <div className="text-right">
          <div className="text-xl font-bold text-gray-900">
            ₱{breakdown.total.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500">Total</div>
        </div>
      </div>
    </div>
  );
}

function TierRow({
  label,
  detail,
  count,
  activeClassName,
  onAdd,
  onRemove,
  removeDisabled,
}: {
  label: string;
  detail?: string;
  count: number;
  activeClassName: string;
  onAdd: () => void;
  onRemove: () => void;
  removeDisabled: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
        count > 0 ? activeClassName : "border-gray-200 bg-white"
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="font-medium text-gray-900">{label}</div>
        {detail && <div className="text-xs text-gray-500">{detail}</div>}
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-11 w-11 bg-white"
          onClick={onRemove}
          disabled={removeDisabled}
          aria-label={`Remove one ${label.toLowerCase()}`}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <span className="w-8 text-center text-lg font-semibold tabular-nums">
          {count}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-11 w-11 bg-white"
          onClick={onAdd}
          aria-label={`Add one ${label.toLowerCase()}`}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
