import { buildReceiptDocument, ReceiptData } from "@/lib/receipt-template";
import type { ReceiptPaperSize } from "@/lib/db";

/**
 * Prints a receipt using a fully self-contained, isolated document built
 * from plain data — not from the live page's DOM/CSS/dialog wrappers. This
 * is the single print entry point for the whole app (live checkout receipts
 * and the test-printer dialog both go through this), so the printed output
 * can never accidentally include surrounding page or dialog content.
 */
export function printReceipt(
  data: ReceiptData,
  paperSize: ReceiptPaperSize,
  onDone?: () => void,
): void {
  const html = buildReceiptDocument(data, paperSize);

  const iframe = document.createElement("iframe");
  iframe.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:none;visibility:hidden;";
  document.body.appendChild(iframe);

  const cleanup = () => {
    iframe.parentNode?.removeChild(iframe);
    onDone?.();
  };
  //asd

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) {
    cleanup();
    return;
  }

  iframeDoc.open();
  iframeDoc.write(html);
  iframeDoc.close();

  // Give the isolated document a moment to lay out before printing.
  setTimeout(() => {
    iframe.contentWindow?.print();
    setTimeout(cleanup, 500);
  }, 300);
}
