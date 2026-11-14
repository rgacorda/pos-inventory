import {
  changeExternalUnitCost,
  deliveryPriceOverrides,
  PriceManual,
  TierPricingFields,
  tierPricingFromProduct,
  tierPricingPayload,
} from "@pos/shared-utils";

export interface DeliveryItemPricing {
  sellingPrice: string;
  markupPercentage: string;
  markupFixed: string;
  packQuantity: string;
  packMarkupPercentage: string;
  packMarkupFixed: string;
  packPrice: string;
  halfPackQuantity: string;
  halfPackMarkupPercentage: string;
  halfPackMarkupFixed: string;
  halfPackPrice: string;
}

export function emptyDeliveryItemPricing(): DeliveryItemPricing {
  return {
    sellingPrice: "",
    markupPercentage: "",
    markupFixed: "",
    packQuantity: "",
    packMarkupPercentage: "",
    packMarkupFixed: "",
    packPrice: "",
    halfPackQuantity: "",
    halfPackMarkupPercentage: "",
    halfPackMarkupFixed: "",
    halfPackPrice: "",
  };
}

export function fieldsFromDeliveryItemPricing(item: DeliveryItemPricing): TierPricingFields {
  return {
    cost: "",
    price: item.sellingPrice,
    markupPercentage: item.markupPercentage,
    markupFixed: item.markupFixed,
    packQuantity: item.packQuantity,
    packMarkupPercentage: item.packMarkupPercentage,
    packMarkupFixed: item.packMarkupFixed,
    packPrice: item.packPrice,
    halfPackQuantity: item.halfPackQuantity,
    halfPackMarkupPercentage: item.halfPackMarkupPercentage,
    halfPackMarkupFixed: item.halfPackMarkupFixed,
    halfPackPrice: item.halfPackPrice,
  };
}

export function deliveryItemPricingFromFields(fields: TierPricingFields): DeliveryItemPricing {
  return {
    sellingPrice: fields.price,
    markupPercentage: fields.markupPercentage,
    markupFixed: fields.markupFixed,
    packQuantity: fields.packQuantity,
    packMarkupPercentage: fields.packMarkupPercentage,
    packMarkupFixed: fields.packMarkupFixed,
    packPrice: fields.packPrice,
    halfPackQuantity: fields.halfPackQuantity,
    halfPackMarkupPercentage: fields.halfPackMarkupPercentage,
    halfPackMarkupFixed: fields.halfPackMarkupFixed,
    halfPackPrice: fields.halfPackPrice,
  };
}

export function deliveryItemPricingFromProduct(
  product: Parameters<typeof tierPricingFromProduct>[0],
): DeliveryItemPricing {
  return deliveryItemPricingFromFields(tierPricingFromProduct(product));
}

export function applyDeliveryCostToPrices(
  item: DeliveryItemPricing,
  manual: PriceManual,
  unitCost: number,
) {
  const result = changeExternalUnitCost(
    fieldsFromDeliveryItemPricing(item),
    manual,
    unitCost,
  );
  return {
    pricing: deliveryItemPricingFromFields(result.fields),
    manual: result.manual,
  };
}

export { deliveryPriceOverrides, tierPricingPayload };
