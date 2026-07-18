"use client";

import { useEffect, useState } from "react";
import { dbHelpers, PAPER_SIZE_CHANGE_EVENT, ReceiptPaperSize } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { ReceiptContent } from "@/components/receipt-content";
import { printReceipt } from "@/lib/receipt-print";
import type { ReceiptData, ReceiptOrganization } from "@/lib/receipt-template";

interface ReceiptProps extends Omit<ReceiptData, "organization"> {
  onPrintComplete?: () => void;
}

export function Receipt(props: ReceiptProps) {
  const { onPrintComplete, ...receiptFields } = props;
  const [organization, setOrganization] = useState<ReceiptOrganization | null>(null);
  const [paperSize, setPaperSize] = useState<ReceiptPaperSize>("58mm");

  useEffect(() => {
    const loadOrganization = async () => {
      const org = await dbHelpers.getOrganization();
      if (org) setOrganization(org);
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
      window.removeEventListener(PAPER_SIZE_CHANGE_EVENT, handlePaperSizeChange);
  }, []);

  const receiptData: ReceiptData = { ...receiptFields, organization };

  const handlePrint = () => {
    printReceipt(receiptData, paperSize, onPrintComplete);
  };

  return (
    <>
      <ReceiptContent {...receiptData} paperSize={paperSize} />

      <Button onClick={handlePrint} className="w-full mt-2">
        Print Receipt
      </Button>
    </>
  );
}
