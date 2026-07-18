"use client";

import { useEffect, useState } from "react";
import { dbHelpers, PAPER_SIZE_CHANGE_EVENT, ReceiptPaperSize } from "@/lib/db";
import { Button } from "@/components/ui/button";
import {
  ReceiptContent,
  getReceiptPrintStyles,
  measureReceiptHeightMm,
} from "@/components/receipt-content";

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

export function Receipt(props: ReceiptProps) {
  const { onPrintComplete } = props;
  const [organizationData, setOrganizationData] = useState<{
    name: string;
    address?: string;
    phone?: string;
  } | null>(null);
  const [paperSize, setPaperSize] = useState<ReceiptPaperSize>("58mm");

  useEffect(() => {
    const loadOrganization = async () => {
      const org = await dbHelpers.getOrganization();
      if (org) {
        setOrganizationData(org);
      }
    };
    loadOrganization();

    const loadPaperSize = async () => {
      setPaperSize(await dbHelpers.getPaperSize());
    };
    loadPaperSize();

    // Stay in sync if the paper size is changed in Settings elsewhere in the
    // app while this receipt is already mounted — no page reload required.
    const handlePaperSizeChange = (e: Event) => {
      const size = (e as CustomEvent<ReceiptPaperSize>).detail;
      if (size) setPaperSize(size);
    };
    window.addEventListener(PAPER_SIZE_CHANGE_EVENT, handlePaperSizeChange);
    return () =>
      window.removeEventListener(
        PAPER_SIZE_CHANGE_EVENT,
        handlePaperSizeChange,
      );
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

    // Measure the actual rendered receipt height so we can request an
    // exact-fit page size instead of relying on the CSS `auto` keyword —
    // see getReceiptPrintStyles() for why this matters on some thermal
    // printer drivers.
    const exactHeightMm = measureReceiptHeightMm(receiptEl);

    const printStyles = getReceiptPrintStyles(
      paperSize,
      ".receipt-print-container",
      exactHeightMm
    );

    iframeDoc.open();
    iframeDoc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  ${headStyles}
  <style>${printStyles}</style>
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
        <ReceiptContent
          {...props}
          paperSize={paperSize}
          organization={organizationData}
        />
      </div>

      {/* Print button */}
      <Button onClick={handlePrint} className="w-full mt-2">
        Print Receipt
      </Button>
    </>
  );
}
