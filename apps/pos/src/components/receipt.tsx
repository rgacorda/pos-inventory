"use client";

import { useEffect, useState } from "react";
import { dbHelpers, PAPER_SIZE_CHANGE_EVENT, ReceiptPaperSize } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { ReceiptContent } from "@/components/receipt-content";
import { printReceipt } from "@/lib/receipt-print";
import { readReceiptOrganization } from "@/lib/receipt-organization";
import {
  cachedOrganizationName,
  type ReceiptData,
  type ReceiptOrganization,
} from "@/lib/receipt-template";

interface ReceiptProps extends Omit<ReceiptData, "organization"> {
  onPrintComplete?: () => void;
}

export function Receipt(props: ReceiptProps) {
  const { onPrintComplete, ...receiptFields } = props;
  const [organization, setOrganization] = useState<ReceiptOrganization | null>(
    () => {
      const name = cachedOrganizationName();
      return name ? { name } : null;
    },
  );
  const [paperSize, setPaperSize] = useState<ReceiptPaperSize>("80mm");

  useEffect(() => {
    let cancelled = false;
    const loadOrganization = async () => {
      const org = await readReceiptOrganization();
      if (!cancelled && org) setOrganization(org);
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
    return () => {
      cancelled = true;
      window.removeEventListener(PAPER_SIZE_CHANGE_EVENT, handlePaperSizeChange);
    };
  }, []);

  const receiptData: ReceiptData = { ...receiptFields, organization };

  const handlePrint = () => {
    void (async () => {
      const resolved = (await readReceiptOrganization(organization)) ?? organization;
      if (resolved) setOrganization(resolved);
      printReceipt(
        { ...receiptFields, organization: resolved },
        paperSize,
        onPrintComplete,
      );
    })();
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
