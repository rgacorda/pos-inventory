import { formatCurrency, formatDateTime } from "@pos/shared-utils";
import type { ReceiptPaperSize } from "@/lib/db";

export interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface ReceiptOrganization {
  name: string;
  address?: string;
  phone?: string;
}

/**
 * The single canonical shape for "everything needed to render a receipt" —
 * shared by the on-screen preview (`ReceiptContent`) and the printable
 * document built here, so there is exactly one source of truth for receipt
 * data instead of duplicated/diverging prop shapes.
 */
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
  organization: ReceiptOrganization | null;
}

/**
 * Roll width (matches the printer's physical paper) vs. usable content
 * width. Kept a few mm narrower than the printer's nominal printable area —
 * many thermal printers can't actually print all the way to the roll's
 * physical edge, so text sized right up to the nominal width gets clipped on
 * the sides. This leaves a safety margin on both left and right.
 */
export const PAPER_DIMENSIONS: Record<
  ReceiptPaperSize,
  { rollWidthMm: number; contentWidthMm: number }
> = {
  "58mm": { rollWidthMm: 58, contentWidthMm: 46 },
  "80mm": { rollWidthMm: 80, contentWidthMm: 68 },
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escapes any value that ends up as text content in the printable HTML — required since we're building raw markup strings, not JSX. */
function esc(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return "";
  return escapeHtml(String(value));
}

function dash(): string {
  return `<div class="dash"></div>`;
}

function row(label: string, value: string, extraClass = ""): string {
  return `<div class="row ${extraClass}"><span>${label}</span><span>${value}</span></div>`;
}

function buildReceiptBodyHtml(data: ReceiptData, paperSize: ReceiptPaperSize): string {
  const isWide = paperSize === "80mm";
  const org = data.organization;
  const totalItemCount = data.items.reduce((sum, item) => sum + item.quantity, 0);

  const header = `
    <div class="center mb-2">
      <div class="${isWide ? "store-name" : ""}">${esc(org?.name || "YOUR STORE NAME")}</div>
      ${org?.address ? `<div>${esc(org.address)}</div>` : ""}
      ${org?.phone ? `<div>Tel: ${esc(org.phone)}</div>` : ""}
      ${dash()}
    </div>
  `;

  const orderInfo = isWide
    ? `<div class="row mb-2"><span>Date: ${esc(formatDateTime(data.dateTime))}</span><span>Cashier: ${esc(data.cashierName)}</span></div>`
    : `<div class="mb-2"><div>Date: ${esc(formatDateTime(data.dateTime))}</div><div>Cashier: ${esc(data.cashierName)}</div></div>`;

  const customer =
    data.customerName || data.customerAddress
      ? `
        <div class="mb-2">
          ${dash()}
          <div class="bold">CUSTOMER:</div>
          ${data.customerName ? `<div>Name: ${esc(data.customerName)}</div>` : ""}
          ${data.customerAddress ? `<div>Address: ${esc(data.customerAddress)}</div>` : ""}
        </div>
      `
      : "";

  const items = isWide
    ? `
      <div class="item-header">
        <span class="col-qty">Qty</span>
        <span class="col-name">Item</span>
        <span class="col-price">Price</span>
        <span class="col-total">Total</span>
      </div>
      <div class="hr"></div>
      ${data.items
        .map(
          (item) => `
        <div class="item-row">
          <span class="col-qty">${esc(item.quantity)}</span>
          <span class="col-name">${esc(item.name)}</span>
          <span class="col-price muted">${esc(formatCurrency(item.unitPrice))}</span>
          <span class="col-total bold">${esc(formatCurrency(item.total))}</span>
        </div>
      `,
        )
        .join("")}
    `
    : data.items
        .map(
          (item) => `
        <div class="mb-1">
          <div class="row"><span>${esc(item.name)}</span><span>${esc(formatCurrency(item.total))}</span></div>
          <div class="muted small">${esc(formatCurrency(item.unitPrice))} x ${esc(item.quantity)}</div>
        </div>
      `,
        )
        .join("");

  const totals = `
    ${row("Subtotal:", esc(formatCurrency(data.subtotal)), "mb-1")}
    ${row("Tax:", esc(formatCurrency(data.taxAmount)), "mb-1")}
    ${data.discountAmount > 0 ? row("Discount:", `-${esc(formatCurrency(data.discountAmount))}`, "mb-1") : ""}
    ${
      data.pointsRedeemed && data.pointsRedeemed > 0
        ? row(
            `Points Redeemed (${esc(data.pointsRedeemed)} pts):`,
            `-${esc(formatCurrency(data.pointsRedeemed))}`,
            "mb-1",
          )
        : ""
    }
    <div class="total-row ${isWide ? "total-wide" : "bold"}">
      ${row("TOTAL:", esc(formatCurrency(data.totalAmount)))}
    </div>
  `;

  const loyalty = data.loyaltyCustomerName
    ? `${dash()}<div class="center"><div>Member: ${esc(data.loyaltyCustomerName)}</div></div>`
    : "";

  const paymentMethodLabel = esc(data.paymentMethod.replace(/_/g, " ").toLowerCase());
  const payment = `
    <div class="mb-2">
      <div class="bold">PAYMENT:</div>
      ${row("Method:", paymentMethodLabel)}
      ${data.paymentReference ? row("Ref:", esc(data.paymentReference)) : ""}
      ${data.cashReceived ? row("Cash Received:", esc(formatCurrency(data.cashReceived))) : ""}
      ${
        data.cashReceived && data.change !== undefined && data.change > 0
          ? row("Change:", esc(formatCurrency(data.change)))
          : ""
      }
      ${row("Total Items:", esc(totalItemCount))}
    </div>
  `;

  return `
    <div class="receipt">
      ${header}
      ${orderInfo}
      ${customer}
      ${dash()}
      ${items}
      ${dash()}
      ${totals}
      ${loyalty}
      ${dash()}
      ${payment}
    </div>
  `;
}

function buildReceiptCss(paperSize: ReceiptPaperSize): string {
  const { rollWidthMm, contentWidthMm } = PAPER_DIMENSIONS[paperSize];
  const isWide = paperSize === "80mm";
  return `
    @page { size: ${rollWidthMm}mm auto; margin: 3mm; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #000;
      font-family: Arial, Helvetica, sans-serif;
    }
    .receipt {
      width: ${contentWidthMm}mm;
      margin: 0 auto;
      /* Extra bottom padding is intentional: many thermal printer drivers
         only reliably honor the @page top margin on an auto-height page,
         not the bottom one, which left the receipt cut right at the last
         line of text. Baking guaranteed blank space into the content itself
         (rather than relying solely on @page margin) ensures there's always
         a clean gap before the paper is cut, matching the top. */
      padding: 2mm 1.5mm 7mm 1.5mm;
      font-size: ${isWide ? "9pt" : "11pt"};
      line-height: 1.45;
    }
    .center { text-align: center; }
    .bold { font-weight: 700; }
    .muted { color: #555; }
    .small { font-size: ${isWide ? "8pt" : "9pt"}; }
    .mb-1 { margin-bottom: 3px; }
    .mb-2 { margin-bottom: 8px; }
    .dash { border-bottom: 1px dashed #999; margin: 8px 0; }
    .hr { border-bottom: 1px solid #bbb; margin-bottom: 4px; }
    .row { display: flex; justify-content: space-between; gap: 6px; }
    .store-name { font-weight: 700; font-size: ${isWide ? "10pt" : "12pt"}; }
    .total-row { border-top: 1px solid #000; padding-top: 7px; margin-top: 7px; }
    .total-wide .row { font-size: 10.5pt; }
    .item-header { display: flex; gap: 6px; font-size: 8pt; font-weight: 700; color: #555; margin-bottom: 4px; }
    .item-row { display: flex; gap: 6px; margin-bottom: 4px; }
    .col-qty { width: 14px; text-align: right; flex-shrink: 0; }
    .col-name { flex: 1; min-width: 0; word-break: break-word; }
    .col-price { width: 40px; text-align: right; flex-shrink: 0; }
    .col-total { width: 46px; text-align: right; flex-shrink: 0; }
  `;
}

/**
 * Builds a complete, self-contained HTML document for printing a receipt —
 * plain HTML + inline CSS only (no Tailwind, no dependency on the host
 * page's stylesheets or DOM). This is intentional: printing this document in
 * an isolated iframe can never accidentally include surrounding page/dialog
 * content, since nothing but the receipt itself exists in the document.
 */
export function buildReceiptDocument(
  data: ReceiptData,
  paperSize: ReceiptPaperSize,
): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>${buildReceiptCss(paperSize)}</style>
</head>
<body>${buildReceiptBodyHtml(data, paperSize)}</body>
</html>`;
}
