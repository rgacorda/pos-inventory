"use client";

import { formatCurrency, formatDateTime } from "@pos/shared-utils";
import type { ReceiptPaperSize } from "@/lib/db";
import type { ReceiptData } from "@/lib/receipt-template";

export type { ReceiptItem, ReceiptOrganization, ReceiptData } from "@/lib/receipt-template";

interface ReceiptContentProps extends ReceiptData {
  paperSize: ReceiptPaperSize;
  className?: string;
}

const SPACER = <div className="my-2" />;
const LINE = <div className="border-t border-dashed border-gray-300 mb-2 [border-top-width:0.5px]" />;

/**
 * On-screen preview of the receipt shown inside dialogs (checkout,
 * transactions reprint, test printer). This is Tailwind-based and purely
 * for display — the actual print output is generated separately from plain
 * data by `buildReceiptDocument()` in `@/lib/receipt-template`, so this
 * component's markup/CSS never affects what gets printed.
 *
 * Layout differs meaningfully by paper size:
 * - 58mm: product name on its own full-width line; qty, unit price, and total grouped on the right.
 * - 80mm: product name on the left; qty, unit price, and total grouped on the right.
 */
export function ReceiptContent({
  paperSize,
  organization,
  items,
  subtotal,
  taxAmount,
  discountAmount,
  totalAmount,
  paymentMethod,
  paymentReference,
  customerName,
  customerAddress,
  cashReceived,
  change,
  cashierName,
  dateTime,
  pointsRedeemed,
  className,
}: ReceiptContentProps) {
  const isWide = paperSize === "80mm";
  const hasCustomer = !!(customerName || customerAddress);
  const totalItemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div
      className={`w-full font-sans bg-white text-gray-500 ${
        isWide
          ? "max-w-[68mm] px-2 pt-2 pb-4 text-[7pt] leading-snug"
          : "max-w-[46mm] px-1.5 pt-2 pb-4 text-[8pt] leading-snug"
      } ${className ?? ""}`}
    >
      {/* Header */}
      <div className="text-center mb-2">
        <div className={isWide ? "text-[9pt]" : "text-[10pt]"}>
          {organization?.name || "YOUR STORE NAME"}
        </div>
        {organization?.address && <div>{organization.address}</div>}
        {organization?.phone && <div>Tel: {organization.phone}</div>}
      </div>

      {/* Order Info */}
      {isWide ? (
        <div className="flex justify-between mb-2 gap-2">
          <span>Date: {formatDateTime(dateTime)}</span>
          <span>Cashier: {cashierName}</span>
        </div>
      ) : (
        <div className="mb-2">
          <div>Date: {formatDateTime(dateTime)}</div>
          <div>Cashier: {cashierName}</div>
        </div>
      )}

      {/* Customer Info */}
      {hasCustomer && (
        <div className="mb-2">
          {LINE}
          <div>CUSTOMER:</div>
          {customerName && <div>Name: {customerName}</div>}
          {customerAddress && <div>Address: {customerAddress}</div>}
        </div>
      )}

      {/* Items */}
      {hasCustomer ? SPACER : LINE}
      {isWide ? (
        <div>
          <div className="flex gap-1 text-[6.5pt] mb-0.5 items-baseline">
            <span className="flex-1 min-w-0">Item</span>
            <span className="flex gap-1 shrink-0 whitespace-nowrap text-right">
              <span className="w-5 text-right">Qty</span>
              <span>Price</span>
              <span className="min-w-[38px]">Total</span>
            </span>
          </div>
          {items.map((item, index) => (
            <div key={index} className="flex gap-1 mb-0.5 tabular-nums items-start">
              <span className="flex-1 min-w-0 break-words">{item.name}</span>
              <span className="flex gap-1 shrink-0 whitespace-nowrap text-right">
                <span className="w-5 text-right">{item.quantity}</span>
                <span>{formatCurrency(item.unitPrice)}</span>
                <span className="min-w-[38px]">{formatCurrency(item.total)}</span>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div>
          {items.map((item, index) => (
            <div key={index} className="mb-0.5">
              <div className="break-words w-full">{item.name}</div>
              <div className="flex justify-end gap-1.5 whitespace-nowrap tabular-nums text-[7pt]">
                <span>{formatCurrency(item.unitPrice)}</span>
                <span className="w-4 text-right">{item.quantity}</span>
                <span className="min-w-[38px] text-right">{formatCurrency(item.total)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Totals */}
      {SPACER}
      <div>
        <div className="flex justify-between mb-1">
          <span>Subtotal:</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        <div className="flex justify-between mb-1">
          <span>Tax:</span>
          <span>{formatCurrency(taxAmount)}</span>
        </div>
        {discountAmount > 0 && (
          <div className="flex justify-between mb-1">
            <span>Discount:</span>
            <span>-{formatCurrency(discountAmount)}</span>
          </div>
        )}
        {pointsRedeemed && pointsRedeemed > 0 ? (
          <div className="flex justify-between mb-1">
            <span>Points Redeemed ({pointsRedeemed} pts):</span>
            <span>-{formatCurrency(pointsRedeemed)}</span>
          </div>
        ) : null}
        <div className="border-t border-dashed border-gray-300 pt-1.5 mt-1.5 [border-top-width:0.5px]">
          <div className="flex justify-between">
            <span>TOTAL:</span>
            <span>{formatCurrency(totalAmount)}</span>
          </div>
        </div>
      </div>

      {/* Payment Info */}
      <div className="mb-2 space-y-0.5">
        <div className="mb-0.5">PAYMENT:</div>
        <div className="flex justify-between">
          <span>Method:</span>
          <span className="capitalize">
            {paymentMethod.replace(/_/g, " ").toLowerCase()}
          </span>
        </div>
        {paymentReference && (
          <div className="flex justify-between">
            <span>Ref:</span>
            <span>{paymentReference}</span>
          </div>
        )}
        {cashReceived && (
          <>
            <div className="flex justify-between">
              <span>Cash Received:</span>
              <span>{formatCurrency(cashReceived)}</span>
            </div>
            {change !== undefined && change > 0 && (
              <div className="flex justify-between">
                <span>Change:</span>
                <span>{formatCurrency(change)}</span>
              </div>
            )}
          </>
        )}
        <div className="flex justify-between">
          <span>Total Items:</span>
          <span>{totalItemCount}</span>
        </div>
        {LINE}
        <div className="h-[15mm]" aria-hidden="true" />
      </div>
    </div>
  );
}
