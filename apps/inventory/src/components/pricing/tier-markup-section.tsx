"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  belowCostPricingMessage,
  changeTierMarkup,
  changeTierPrice,
  changeTierQuantity,
  changeUnitCost,
  parsePricingNumber,
  PriceManual,
  PriceTierKey,
  pricingUnitCost,
  roundMoney,
  TierPricingFields,
  tierQuantity,
} from "@pos/shared-utils";

function formatPeso(amount: number) {
  return `₱${amount.toFixed(2)}`;
}

function TierSummary({
  label,
  quantity,
  unitCost,
  sellPrice,
}: {
  label: string;
  quantity: number;
  unitCost: number;
  sellPrice: number;
}) {
  const cost = roundMoney(pricingUnitCost(unitCost) * quantity);
  const profit = roundMoney(sellPrice - cost);
  const perItemSell = quantity > 0 ? sellPrice / quantity : 0;
  const marginPct = sellPrice > 0 ? (profit / sellPrice) * 100 : 0;

  return (
    <div className="rounded-md border bg-muted/40 p-3">
      <p className="text-xs font-medium text-muted-foreground mb-2">
        {label} of {quantity} {quantity === 1 ? "pc" : "pcs"}
      </p>
      <div className="grid grid-cols-3 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Cost</p>
          <p className="font-medium tabular-nums">{formatPeso(cost)}</p>
          {quantity > 1 && (
            <p className="text-xs text-muted-foreground tabular-nums">
              {formatPeso(pricingUnitCost(unitCost))} / item
            </p>
          )}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Sell price</p>
          <p className="font-medium tabular-nums">{formatPeso(sellPrice)}</p>
          {quantity > 1 && sellPrice > 0 && (
            <p className="text-xs text-muted-foreground tabular-nums">
              {formatPeso(perItemSell)} / item
            </p>
          )}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Potential profit</p>
          <p
            className={cn(
              "font-semibold tabular-nums",
              profit >= 0 ? "text-green-700" : "text-red-700",
            )}
          >
            {formatPeso(profit)}
          </p>
          {sellPrice > 0 && (
            <p className="text-xs text-muted-foreground tabular-nums">
              {marginPct.toFixed(1)}% margin
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function TierMarkupSection({
  idPrefix,
  fields,
  manual,
  unitCost,
  showCostInput = false,
  costRequired = false,
  priceRequired = false,
  onChange,
}: {
  idPrefix: string;
  fields: TierPricingFields;
  manual: PriceManual;
  /** Per-unit cost when this section does not include the cost input. */
  unitCost?: number;
  showCostInput?: boolean;
  costRequired?: boolean;
  priceRequired?: boolean;
  onChange: (fields: TierPricingFields, manual: PriceManual) => void;
}) {
  const effectiveUnitCost = showCostInput
    ? parsePricingNumber(fields.cost)
    : unitCost ?? 0;
  const pricingError = belowCostPricingMessage(fields, effectiveUnitCost);

  const emit = (result: { fields: TierPricingFields; manual: PriceManual }) => {
    onChange(result.fields, result.manual);
  };

  const onMarkup = (tier: PriceTierKey, kind: "percentage" | "fixed", raw: string) => {
    emit(changeTierMarkup(fields, manual, tier, kind, raw, effectiveUnitCost));
  };

  return (
    <div className="border-t pt-4 space-y-3">
      <div>
        <h4 className="text-sm font-semibold">Selling price</h4>
        <p className="text-xs text-muted-foreground">
          Add a percent, a fixed amount, or both. The sell price is the tier
          cost plus that markup. A price you type stays until you change the
          cost of a tier that has a markup, the quantity, or the markup.
        </p>
      </div>

      <div className="rounded-md border p-3 space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Per unit
        </p>
        <div className="grid grid-cols-2 gap-3">
          {showCostInput && (
            <div className="space-y-1">
              <Label htmlFor={`${idPrefix}-cost`}>
                Cost{costRequired ? " *" : ""}
              </Label>
              <Input
                id={`${idPrefix}-cost`}
                type="number"
                min="0"
                step="0.01"
                value={fields.cost}
                onChange={(event) => emit(changeUnitCost(fields, manual, event.target.value))}
                placeholder="10.00"
                required={costRequired}
              />
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor={`${idPrefix}-markup-percent`}>Markup (%)</Label>
            <Input
              id={`${idPrefix}-markup-percent`}
              type="number"
              min="0"
              step="0.01"
              value={fields.markupPercentage}
              onChange={(event) => onMarkup("unit", "percentage", event.target.value)}
              placeholder="20"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${idPrefix}-markup-fixed`}>Fixed markup (₱)</Label>
            <Input
              id={`${idPrefix}-markup-fixed`}
              type="number"
              min="0"
              step="0.01"
              value={fields.markupFixed}
              onChange={(event) => onMarkup("unit", "fixed", event.target.value)}
              placeholder="1.50"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${idPrefix}-price`}>
              Sell price{priceRequired ? " *" : ""}
            </Label>
            <Input
              id={`${idPrefix}-price`}
              type="number"
              min="0"
              step="0.01"
              value={fields.price}
              onChange={(event) =>
                emit(changeTierPrice(fields, manual, "unit", event.target.value))
              }
              placeholder="0.00"
              required={priceRequired}
            />
          </div>
        </div>
        {(fields.price !== "" || fields.cost !== "" || effectiveUnitCost > 0) && (
          <TierSummary
            label="Unit"
            quantity={1}
            unitCost={effectiveUnitCost}
            sellPrice={parsePricingNumber(fields.price)}
          />
        )}
      </div>

      <PackTier
        idPrefix={idPrefix}
        tier="pack"
        title="Pack"
        quantityLabel="Items in pack"
        quantityPlaceholder="12"
        fields={fields}
        manual={manual}
        unitCost={effectiveUnitCost}
        onChange={onChange}
      />
      <PackTier
        idPrefix={idPrefix}
        tier="halfPack"
        title="Half pack"
        quantityLabel="Items in half pack"
        quantityPlaceholder="6"
        fields={fields}
        manual={manual}
        unitCost={effectiveUnitCost}
        onChange={onChange}
      />

      {pricingError && <p className="text-sm text-red-600">{pricingError}</p>}
    </div>
  );
}

function PackTier({
  idPrefix,
  tier,
  title,
  quantityLabel,
  quantityPlaceholder,
  fields,
  manual,
  unitCost,
  onChange,
}: {
  idPrefix: string;
  tier: "pack" | "halfPack";
  title: string;
  quantityLabel: string;
  quantityPlaceholder: string;
  fields: TierPricingFields;
  manual: PriceManual;
  unitCost: number;
  onChange: (fields: TierPricingFields, manual: PriceManual) => void;
}) {
  const quantityKey = tier === "pack" ? "packQuantity" : "halfPackQuantity";
  const percentKey = tier === "pack" ? "packMarkupPercentage" : "halfPackMarkupPercentage";
  const fixedKey = tier === "pack" ? "packMarkupFixed" : "halfPackMarkupFixed";
  const priceKey = tier === "pack" ? "packPrice" : "halfPackPrice";
  const quantity = tierQuantity(fields, tier);
  const prefix = `${idPrefix}-${tier}`;

  const emit = (result: { fields: TierPricingFields; manual: PriceManual }) => {
    onChange(result.fields, result.manual);
  };

  return (
    <div className="rounded-md border p-3 space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {title}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor={`${prefix}-qty`}>{quantityLabel}</Label>
          <Input
            id={`${prefix}-qty`}
            type="number"
            min="1"
            step="1"
            value={fields[quantityKey]}
            onChange={(event) =>
              emit(changeTierQuantity(fields, manual, tier, event.target.value, unitCost))
            }
            placeholder={quantityPlaceholder}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${prefix}-percent`}>Markup (%)</Label>
          <Input
            id={`${prefix}-percent`}
            type="number"
            min="0"
            step="0.01"
            value={fields[percentKey]}
            onChange={(event) =>
              emit(
                changeTierMarkup(
                  fields,
                  manual,
                  tier,
                  "percentage",
                  event.target.value,
                  unitCost,
                ),
              )
            }
            placeholder="10"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${prefix}-fixed`}>Fixed markup (₱)</Label>
          <Input
            id={`${prefix}-fixed`}
            type="number"
            min="0"
            step="0.01"
            value={fields[fixedKey]}
            onChange={(event) =>
              emit(changeTierMarkup(fields, manual, tier, "fixed", event.target.value, unitCost))
            }
            placeholder="5.00"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${prefix}-price`}>Sell price</Label>
          <Input
            id={`${prefix}-price`}
            type="number"
            min="0"
            step="0.01"
            value={fields[priceKey]}
            onChange={(event) =>
              emit(changeTierPrice(fields, manual, tier, event.target.value))
            }
            placeholder="0.00"
          />
        </div>
      </div>
      {quantity > 0 && (fields[priceKey] !== "" || unitCost > 0) && (
        <TierSummary
          label={title}
          quantity={quantity}
          unitCost={unitCost}
          sellPrice={parsePricingNumber(fields[priceKey])}
        />
      )}
    </div>
  );
}
