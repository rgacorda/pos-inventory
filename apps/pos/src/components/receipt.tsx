"use client";

import { useEffect } from "react";
import { formatCurrency, formatDateTime } from "@pos/shared-utils";

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
}: ReceiptProps) {
  useEffect(() => {
    // Inject print styles into document head
    const styleId = "receipt-print-styles";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
        @media print {
          body * {
            visibility: hidden;
          }
          .receipt-print-container,
          .receipt-print-container * {
            visibility: visible;
          }
          .receipt-print-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          @page {
            size: 58mm auto;
            margin: 0;
          }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  const handlePrint = () => {
    window.print();
    if (onPrintComplete) {
      // Delay callback to ensure print dialog is processed
      setTimeout(onPrintComplete, 500);
    }
  };

  return (
    <>
      {/* Receipt content for printing */}
      <div className="receipt-print-container">
        <div className="max-w-[58mm] mx-auto p-2 font-mono text-xs leading-tight bg-white">
          {/* Header */}
          <div className="text-center mb-2">
            <div className="text-base font-bold">YOUR STORE NAME</div>
            <div className="text-[8pt]">123 Store Address</div>
            <div className="text-[8pt]">Tel: (123) 456-7890</div>
            <div className="border-b border-dashed border-gray-400 my-2" />
          </div>

          {/* Order Info */}
          <div className="text-[9pt] mb-2">
            <div>Order: {orderNumber}</div>
            <div>Date: {formatDateTime(dateTime)}</div>
          </div>

          {/* Customer Info */}
          {(customerName || customerAddress) && (
            <div className="text-[9pt] mb-2">
              <div className="border-b border-dashed border-gray-400 my-2" />
              <div className="font-bold">CUSTOMER:</div>
              {customerName && <div>Name: {customerName}</div>}
              {customerAddress && <div>Address: {customerAddress}</div>}
            </div>
          )}

          {/* Items */}
          <div className="border-b border-dashed border-gray-400 my-2" />
          <div className="text-[7pt]">
            {items.map((item, index) => (
              <div key={index} className="flex justify-between gap-1 mb-1">
                <span className="flex-1 min-w-0">
                  {item.name}
                </span>
                <span className="whitespace-nowrap">
                  x{item.quantity}
                </span>
                <span className="font-bold whitespace-nowrap">
                  {formatCurrency(item.total)}
                </span>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="border-b border-dashed border-gray-400 my-2" />
          <div className="text-[10pt]">
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
            <div className="border-t border-black pt-2 mt-2">
              <div className="flex justify-between text-base font-bold">
                <span>TOTAL:</span>
                <span>{formatCurrency(totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Payment Info */}
          <div className="border-b border-dashed border-gray-400 my-2" />
          <div className="text-[9pt] mb-2">
            <div className="font-bold">PAYMENT:</div>
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
                  <div className="flex justify-between font-bold">
                    <span>Change:</span>
                    <span>{formatCurrency(change)}</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-dashed border-gray-400 pt-3 text-center text-[9pt]">
            <div>Thank you for your purchase!</div>
            <div className="mt-2">Please come again</div>
          </div>
        </div>
      </div>

      {/* Print button */}
      <button
        onClick={handlePrint}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded mt-2"
      >
        🖨️ Print Receipt
      </button>
    </>
  );
}
