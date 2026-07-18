"use client";

import { formatCurrency, formatDateTime } from "@pos/shared-utils";
import type { ReceiptPaperSize } from "@/lib/db";

export interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface ReceiptData {
  orderNumber: string;
  items: ReceiptItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  paymentMethod: string;
  paymentReference?: string;
  customerName?: string;
  customerAddress?: string;
  cashReceived?: number;
  change?: number;
  cashierName: string;
  terminalName?: string;
  dateTime: Date;
  pointsRedeemed?: number;
  pointsEarned?: number;
  loyaltyCustomerName?: string;
}

interface OrganizationData {
  name: string;
  address?: string;
  phone?: string;
}

interface ReceiptContentProps extends ReceiptData {
  paperSize: ReceiptPaperSize;
  organization: OrganizationData | null;
  className?: string;
}

/** Printable page/container widths per paper size (usable print area, not the raw roll width). */
export const PAPER_DIMENSIONS: Record<
  ReceiptPaperSize,
  { rollWidth: string; containerWidth: string }
> = {
  "58mm": { rollWidth: "58mm", containerWidth: "50mm" },
  "80mm": { rollWidth: "80mm", containerWidth: "72mm" },
};

/** CSS injected into the print iframe/page — shared by the live receipt and the test-printer dialog. */
export function getReceiptPrintStyles(
  paperSize: ReceiptPaperSize,
  containerSelector: string,
): string {
  const { rollWidth, containerWidth } = PAPER_DIMENSIONS[paperSize];
  return `
    @page { size: ${rollWidth} auto; margin: 2mm; }
    html, body { margin: 0; padding: 0; height: auto; }
    @media print {
      body * { visibility: visible !important; }
      ${containerSelector} {
        position: absolute !important;
        left: 0 !important;
        top: 0 !important;
        width: ${containerWidth} !important;
        max-width: ${containerWidth} !important;
      }
    }
  `;
}

const DASH = (
  <div className="border-b border-dashed border-gray-400 my-2" />
);

/**
 * Renders the printable receipt body. Layout differs meaningfully by paper size:
 * - 58mm: narrow roll, so each line item stacks onto two short lines (name+total,
 *   then qty x price) to avoid squeezing columns into an unreadably tight space.
 * - 80mm: wider roll, so line items use a proper 4-column inline table
 *   (qty / item / unit price / total) with tabular numerals for clean alignment,
 *   plus a two-column header row for date/cashier to make better use of the width.
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
  loyaltyCustomerName,
  className,
}: ReceiptContentProps) {
  const isWide = paperSize === "80mm";
  const totalItemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div
      className={`w-full font-sans bg-white ${
        isWide
          ? "max-w-[72mm] px-2 py-2 text-[10.5pt] leading-snug"
          : "max-w-[50mm] px-1 py-2 text-[11pt] leading-snug"
      } ${className ?? ""}`}
    >
      {/* Header */}
      <div className="text-center mb-2">
        <div className={isWide ? "font-semibold text-[12pt]" : ""}>
          {organization?.name || "YOUR STORE NAME"}
        </div>
        {organization?.address && <div>{organization.address}</div>}
        {organization?.phone && <div>Tel: {organization.phone}</div>}
        {DASH}
      </div>

      {/* Order Info */}
      {isWide ? (
        <div className="flex justify-between mb-2 gap-2 text-[9.5pt]">
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
      {(customerName || customerAddress) && (
        <div className="mb-2">
          {DASH}
          <div className="font-medium">CUSTOMER:</div>
          {customerName && <div>Name: {customerName}</div>}
          {customerAddress && <div>Address: {customerAddress}</div>}
        </div>
      )}

      {/* Items */}
      {DASH}
      {isWide ? (
        <div>
          <div className="flex gap-2 text-[9pt] font-semibold text-gray-600 mb-1">
            <span className="w-5 text-right shrink-0">Qty</span>
            <span className="flex-1 min-w-0">Item</span>
            <span className="w-14 text-right shrink-0">Price</span>
            <span className="w-16 text-right shrink-0">Total</span>
          </div>
          <div className="border-b border-gray-300 mb-1" />
          {items.map((item, index) => (
            <div
              key={index}
              className="flex gap-2 mb-1 tabular-nums"
            >
              <span className="w-5 text-right shrink-0">{item.quantity}</span>
              <span className="flex-1 min-w-0 break-words">{item.name}</span>
              <span className="w-14 text-right shrink-0 text-gray-500">
                {formatCurrency(item.unitPrice)}
              </span>
              <span className="w-16 text-right shrink-0 font-medium">
                {formatCurrency(item.total)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div>
          {items.map((item, index) => (
            <div key={index} className="mb-1">
              <div className="flex justify-between gap-2">
                <span className="break-words flex-1 min-w-0">
                  {item.name}
                </span>
                <span className="whitespace-nowrap flex-shrink-0">
                  {formatCurrency(item.total)}
                </span>
              </div>
              <div className="text-gray-500 text-[9pt]">
                {formatCurrency(item.unitPrice)} x {item.quantity}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Totals */}
      {DASH}
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
        <div className="border-t border-black pt-2 mt-2">
          <div
            className={`flex justify-between ${isWide ? "text-[12pt] font-bold" : "font-semibold"}`}
          >
            <span>TOTAL:</span>
            <span>{formatCurrency(totalAmount)}</span>
          </div>
        </div>
      </div>

      {/* Loyalty member name */}
      {loyaltyCustomerName && (
        <>
          {DASH}
          <div className="text-center">
            <div>Member: {loyaltyCustomerName}</div>
          </div>
        </>
      )}

      {/* Payment Info */}
      {DASH}
      <div className="mb-2">
        <div className="font-medium">PAYMENT:</div>
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
      </div>
    </div>
  );
}
