"use client";

import { useEffect, useState } from "react";
import { formatCurrency, formatDateTime } from "@pos/shared-utils";
import { dbHelpers } from "@/lib/db";
import { Button } from "@/components/ui/button";

interface ReceiptProps {
  orderNumber: string;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
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
  terminalName: string;
  dateTime: Date;
  onPrintComplete?: () => void;
  pointsRedeemed?: number;
  pointsEarned?: number;
  loyaltyCustomerName?: string;
}

export function Receipt({
  orderNumber,
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
  terminalName,
  dateTime,
  onPrintComplete,
  pointsRedeemed,
  pointsEarned,
  loyaltyCustomerName,
}: ReceiptProps) {
  const [organizationData, setOrganizationData] = useState<{
    name: string;
    address?: string;
    phone?: string;
  } | null>(null);

  useEffect(() => {
    // Load organization data from IndexedDB
    const loadOrganization = async () => {
      const org = await dbHelpers.getOrganization();
      if (org) {
        setOrganizationData(org);
      }
    };
    loadOrganization();
  }, []);

  const handlePrint = () => {
    const receiptEl = document.querySelector(".receipt-print-container");

    // Build an isolated print iframe so @page auto-height equals the receipt
    // content only — not the background page (e.g. a long transaction list).
    const iframe = document.createElement("iframe");
    iframe.style.cssText =
      "position:fixed;right:0;bottom:0;width:0;height:0;border:none;visibility:hidden;";
    document.body.appendChild(iframe);

    const iframeDoc =
      iframe.contentDocument || iframe.contentWindow?.document;

    if (!iframeDoc || !receiptEl) {
      // Fallback to in-page print
      document.body.removeChild(iframe);
      window.print();
      if (onPrintComplete) setTimeout(onPrintComplete, 500);
      return;
    }

    // Copy all <style> and <link rel="stylesheet"> tags from the host page so
    // Tailwind classes render correctly inside the iframe.
    const headStyles = Array.from(
      document.querySelectorAll('style, link[rel="stylesheet"]')
    )
      .map((el) => el.outerHTML)
      .join("\n");

    iframeDoc.open();
    iframeDoc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  ${headStyles}
  <style>
    @page { size: 58mm auto; margin: 2mm; }
    html, body { margin: 0; padding: 0; height: auto; }
    /* Override the host page's print styles so receipt is fully visible
       and in normal flow (so @page auto-height = receipt content height). */
    @media print {
      body * { visibility: visible !important; }
      .receipt-print-container {
        position: static !important;
        left: auto !important;
        top: auto !important;
        width: 58mm !important;
        max-width: 58mm !important;
      }
    }
  </style>
</head>
<body>${receiptEl.outerHTML}</body>
</html>`);
    iframeDoc.close();

    // Give styles a moment to apply before printing.
    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
        if (onPrintComplete) onPrintComplete();
      }, 500);
    }, 300);
  };

  return (
    <>
      {/* Receipt content for printing */}
      <div className="receipt-print-container">
        <div className="w-full max-w-[58mm] px-1 py-2 font-sans text-[11pt] leading-snug bg-white">
          {/* Header */}
          <div className="text-center mb-2">
            <div>
              {organizationData?.name || "YOUR STORE NAME"}
            </div>
            {organizationData?.address && (
              <div>{organizationData.address}</div>
            )}
            {organizationData?.phone && (
              <div>Tel: {organizationData.phone}</div>
            )}
            <div className="border-b border-dashed border-gray-400 my-2" />
          </div>

          {/* Order Info */}
          <div className="mb-2">
            {/* <div>Order: {orderNumber}</div> */}
            <div>Date: {formatDateTime(dateTime)}</div>
            <div>Cashier: {cashierName}</div>
          </div>

          {/* Customer Info */}
          {(customerName || customerAddress) && (
            <div className="mb-2">
              <div className="border-b border-dashed border-gray-400 my-2" />
              <div>CUSTOMER:</div>
              {customerName && <div>Name: {customerName}</div>}
              {customerAddress && <div>Address: {customerAddress}</div>}
            </div>
          )}

          {/* Items */}
          <div className="border-b border-dashed border-gray-400 my-2  text-[9pt]" />
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
                <div className="text-gray-500">
                  {formatCurrency(item.unitPrice)} x {item.quantity}
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="border-b border-dashed border-gray-400 my-2" />
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
              <div className="flex justify-between">
                <span>TOTAL:</span>
                <span>{formatCurrency(totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Loyalty points summary */}
          {(pointsEarned || loyaltyCustomerName) && (
            <>
              <div className="border-b border-dashed border-gray-400 my-2" />
              <div className="text-center">
                {loyaltyCustomerName && (
                  <div>Member: {loyaltyCustomerName}</div>
                )}
                {pointsEarned && pointsEarned > 0 ? (
                  <div>Points Earned: +{pointsEarned} pts</div>
                ) : null}
                <div className="text-[9pt] text-gray-500 mt-1">
                  100 pts = ₱100 off your next purchase
                </div>
              </div>
            </>
          )}

          {/* Payment Info */}
          <div className="border-b border-dashed border-gray-400 my-2" />
          <div className="mb-2">
            <div>PAYMENT:</div>
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
              <span>{items.reduce((sum, item) => sum + item.quantity, 0)}</span>
            </div>
          </div>

          {/* Footer */}
          {/* <div className="border-t border-dashed border-gray-400 pt-3 text-center text-[9pt]">
            <div>Thank you for your purchase!</div>
            <div className="mt-2">Please come again</div>
          </div> */}
        </div>
      </div>

      {/* Print button */}
      <Button
        onClick={handlePrint}
        className="w-full mt-2"
      >
        Print Receipt
      </Button>
    </>
  );
}
