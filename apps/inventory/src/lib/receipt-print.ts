import {
  buildReceiptDocument,
  ReceiptData,
  ReceiptPaperSize,
} from "@/lib/receipt-template";

/** Prints a receipt from an isolated document so the page around it is not included. */
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
