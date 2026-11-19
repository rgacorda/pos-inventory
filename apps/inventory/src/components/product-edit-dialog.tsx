"use client";

import { useEffect, useState, type FormEvent } from "react";
import { apiClient } from "@/lib/api-client";
import { TierMarkupSection } from "@/components/pricing/tier-markup-section";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  showErrorFromException,
  showSuccessToast,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
} from "@/lib/toast-utils";
import {
  belowCostPricingMessage,
  KEEP_SAVED_PRICES,
  type PriceManual,
  type TierPricingFields,
} from "@pos/shared-utils";

type ProductForm = TierPricingFields & {
  sku: string;
  name: string;
};

function text(value: unknown) {
  if (value == null) return "";
  return String(value);
}

function formFromProduct(product: Record<string, unknown>): ProductForm {
  return {
    sku: text(product.sku),
    name: text(product.name),
    cost: text(product.cost),
    price: text(product.price),
    markupPercentage: text(product.markupPercentage),
    markupFixed: text(product.markupFixed),
    packQuantity: text(product.packQuantity),
    packMarkupPercentage: text(product.packMarkupPercentage),
    packMarkupFixed: text(product.packMarkupFixed),
    packPrice: text(product.packPrice),
    halfPackQuantity: text(product.halfPackQuantity),
    halfPackMarkupPercentage: text(product.halfPackMarkupPercentage),
    halfPackMarkupFixed: text(product.halfPackMarkupFixed),
    halfPackPrice: text(product.halfPackPrice),
  };
}

function numberOrNull(value: string) {
  if (!value.trim()) return null;
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function intOrNull(value: string) {
  if (!value.trim()) return null;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function ProductEditDialog({
  product,
  open,
  onOpenChange,
  onSaved,
}: {
  product: Record<string, unknown> | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (product: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState<ProductForm | null>(null);
  const [manual, setManual] = useState<PriceManual>(KEEP_SAVED_PRICES);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !product) return;
    setManual(KEEP_SAVED_PRICES);
    setForm(formFromProduct(product));
  }, [open, product]);

  const pricingError = form ? belowCostPricingMessage(form) : null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!product || !form) return;
    const profitError = belowCostPricingMessage(form);
    if (profitError) {
      showErrorFromException(new Error(profitError), "Pricing");
      return;
    }
    setSaving(true);
    try {
      const saved = await apiClient.updateProduct(String(product.id), {
        sku: form.sku,
        name: form.name,
        price: parseFloat(form.price),
        cost: parseFloat(form.cost),
        markupPercentage: numberOrNull(form.markupPercentage),
        markupFixed: numberOrNull(form.markupFixed),
        packQuantity: intOrNull(form.packQuantity),
        packMarkupPercentage: numberOrNull(form.packMarkupPercentage),
        packMarkupFixed: numberOrNull(form.packMarkupFixed),
        packPrice: numberOrNull(form.packPrice),
        halfPackQuantity: intOrNull(form.halfPackQuantity),
        halfPackMarkupPercentage: numberOrNull(form.halfPackMarkupPercentage),
        halfPackMarkupFixed: numberOrNull(form.halfPackMarkupFixed),
        halfPackPrice: numberOrNull(form.halfPackPrice),
      });
      showSuccessToast(SUCCESS_MESSAGES.UPDATED("Product"));
      onSaved({ ...product, ...(saved ?? {}), id: product.id });
      onOpenChange(false);
    } catch (error) {
      showErrorFromException(error, ERROR_MESSAGES.UPDATE_FAILED("product"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Update product</DialogTitle>
          <DialogDescription>
            {text(product?.name) || "Change the price or cost, then save."}
          </DialogDescription>
        </DialogHeader>
        {form ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="review-edit-sku">SKU</Label>
                <Input
                  id="review-edit-sku"
                  value={form.sku}
                  onChange={(event) => setForm({ ...form, sku: event.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="review-edit-name">Product name</Label>
                <Input
                  id="review-edit-name"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  required
                />
              </div>
            </div>
            <TierMarkupSection
              idPrefix="review-edit"
              fields={form}
              manual={manual}
              showCostInput
              costRequired
              priceRequired
              onChange={(fields, nextManual) => {
                setManual(nextManual);
                setForm((current) => (current ? { ...current, ...fields } : current));
              }}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !!pricingError}>
                {saving ? "Updating..." : "Update product"}
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
