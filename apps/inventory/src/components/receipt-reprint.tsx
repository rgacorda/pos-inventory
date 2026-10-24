"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { printReceipt } from "@/lib/receipt-print";
import {
  buildReceiptDocument,
  ReceiptData,
  ReceiptOrganization,
  ReceiptPaperSize,
} from "@/lib/receipt-template";

const PAPER_SIZE_KEY = "inventory-receipt-paper-size";

function readPaperSize(): ReceiptPaperSize {
  if (typeof window === "undefined") return "80mm";
  return localStorage.getItem(PAPER_SIZE_KEY) === "58mm" ? "58mm" : "80mm";
}

export function orderToReceiptData(
  order: {
    orderNumber?: string;
    items?: Array<{
      name?: string;
      product?: { name?: string };
      quantity?: number | string;
      unitPrice?: number | string;
      total?: number | string;
    }>;
    payments?: Array<{ method?: string; reference?: string }>;
    subtotal?: number | string;
    taxAmount?: number | string;
    discountAmount?: number | string;
    totalAmount?: number | string;
    customerName?: string;
    customerAddress?: string;
    cashier?: { name?: string };
    cashierName?: string;
    terminal?: { name?: string };
    completedAt?: string;
    createdAt?: string;
    pointsRedeemed?: number | string;
  },
  organization: ReceiptOrganization | null,
): ReceiptData {
  const payments = order.payments ?? [];
  const methods = [
    ...new Set(payments.map((payment) => payment.method).filter(Boolean)),
  ] as string[];
  const reference = payments.find((payment) => payment.reference)?.reference;

  return {
    orderNumber: order.orderNumber || "",
    items: (order.items ?? []).map((item) => ({
      name: item.name || item.product?.name || "Item",
      quantity: Number(item.quantity || 0),
      unitPrice: Number(item.unitPrice || 0),
      total: Number(
        item.total ?? Number(item.quantity || 0) * Number(item.unitPrice || 0),
      ),
    })),
    subtotal: Number(order.subtotal || 0),
    taxAmount: Number(order.taxAmount || 0),
    discountAmount: Number(order.discountAmount || 0),
    totalAmount: Number(order.totalAmount || 0),
    paymentMethod: methods.length > 0 ? methods.join(" + ") : "N/A",
    paymentReference: reference,
    customerName: order.customerName || undefined,
    customerAddress: order.customerAddress || undefined,
    cashierName: order.cashier?.name || order.cashierName || "Cashier",
    terminalName: order.terminal?.name,
    dateTime: new Date(order.completedAt || order.createdAt || Date.now()),
    pointsRedeemed: Number(order.pointsRedeemed || 0) || undefined,
    organization,
  };
}

export function ReceiptReprint({
  data,
  onPrintComplete,
}: {
  data: ReceiptData;
  onPrintComplete?: () => void;
}) {
  const [paperSize, setPaperSize] = useState<ReceiptPaperSize>("80mm");
  const html = buildReceiptDocument(data, paperSize);

  useEffect(() => {
    setPaperSize(readPaperSize());
  }, []);

  const selectSize = (size: ReceiptPaperSize) => {
    setPaperSize(size);
    localStorage.setItem(PAPER_SIZE_KEY, size);
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-center gap-2">
        {(["58mm", "80mm"] as const).map((size) => (
          <Button
            key={size}
            type="button"
            size="sm"
            variant={paperSize === size ? "default" : "outline"}
            onClick={() => selectSize(size)}
          >
            {size}
          </Button>
        ))}
      </div>
      <div className="flex justify-center overflow-auto">
        <iframe
          title="Receipt preview"
          srcDoc={html}
          className="border bg-white"
          style={{
            width: paperSize === "80mm" ? "92mm" : "70mm",
            height: "520px",
          }}
          onLoad={(event) => {
            const frame = event.currentTarget;
            const body = frame.contentDocument?.body;
            if (!body) return;
            frame.style.height = `${body.scrollHeight}px`;
          }}
        />
      </div>
      <Button
        type="button"
        className="w-full"
        onClick={() => printReceipt(data, paperSize, onPrintComplete)}
      >
        Print Receipt
      </Button>
    </div>
  );
}
