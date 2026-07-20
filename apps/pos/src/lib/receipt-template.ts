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

function line(): string {
  return `<div class="line"></div>`;
}

function spacer(): string {
  return `<div class="spacer"></div>`;
}

function cutSpacer(): string {
  return `<div class="cut-spacer"></div>`;
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
      <div class="store-name">${esc(org?.name || "YOUR STORE NAME")}</div>
      ${org?.address ? `<div>${esc(org.address)}</div>` : ""}
      ${org?.phone ? `<div>Tel: ${esc(org.phone)}</div>` : ""}
    </div>
  `;

  const orderInfo = isWide
    ? `<div class="row mb-2"><span>Date: ${esc(formatDateTime(data.dateTime))}</span><span>Cashier: ${esc(data.cashierName)}</span></div>`
    : `<div class="mb-2"><div>Date: ${esc(formatDateTime(data.dateTime))}</div><div>Cashier: ${esc(data.cashierName)}</div></div>`;

  const hasCustomer = !!(data.customerName || data.customerAddress);

  const customer = hasCustomer
      ? `
        <div class="mb-2">
          ${line()}
          <div>CUSTOMER:</div>
          ${data.customerName ? `<div>Name: ${esc(data.customerName)}</div>` : ""}
          ${data.customerAddress ? `<div>Address: ${esc(data.customerAddress)}</div>` : ""}
        </div>
      `
      : "";

  const items = isWide
    ? `
      <div class="item-header">
        <span class="col-name">Item</span>
        <span class="col-amounts">
          <span class="col-qty">Qty</span>
          <span class="col-price">Price</span>
          <span class="col-total">Total</span>
        </span>
      </div>
      ${data.items
        .map(
          (item) => `
        <div class="item-row">
          <span class="col-name">${esc(item.name)}</span>
          <span class="col-amounts">
            <span class="col-qty">${esc(item.quantity)}</span>
            <span class="col-price">${esc(formatCurrency(item.unitPrice))}</span>
            <span class="col-total">${esc(formatCurrency(item.total))}</span>
          </span>
        </div>
      `,
        )
        .join("")}
    `
    : data.items
        .map(
          (item) => `
        <div class="item-narrow">
          <div class="item-name">${esc(item.name)}</div>
          <div class="item-amounts">
            <span class="col-price">${esc(formatCurrency(item.unitPrice))}</span>
            <span class="col-qty">${esc(item.quantity)}</span>
            <span class="col-total">${esc(formatCurrency(item.total))}</span>
          </div>
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
    <div class="total-row">
      ${row("TOTAL:", esc(formatCurrency(data.totalAmount)))}
    </div>
  `;

  const paymentMethodLabel = esc(data.paymentMethod.replace(/_/g, " ").toLowerCase());
  const payment = `
    <div class="mb-2">
      <div>PAYMENT:</div>
      ${row("Method:", paymentMethodLabel)}
      ${data.paymentReference ? row("Ref:", esc(data.paymentReference)) : ""}
      ${data.cashReceived ? row("Cash Received:", esc(formatCurrency(data.cashReceived))) : ""}
      ${
        data.cashReceived && data.change !== undefined && data.change > 0
          ? row("Change:", esc(formatCurrency(data.change)))
          : ""
      }
      ${row("Total Items:", esc(totalItemCount))}
      ${line()}
    </div>
  `;

  return `
    <div class="receipt">
      ${header}
      ${orderInfo}
      ${customer}
      ${hasCustomer ? spacer() : line()}
      ${items}
      ${spacer()}
      ${totals}
      ${payment}
      ${cutSpacer()}
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
      color: #777;
      font-family: Arial, Helvetica, sans-serif;
    }
    .receipt {
      width: ${contentWidthMm}mm;
      margin: 0 auto;
      /* Bottom feed space lives in .cut-spacer after the last line — thermal
         printer drivers often cut at the last rendered content, ignoring @page
         bottom margin, so a dedicated blank block is more reliable than padding. */
      padding: 2mm 1.5mm 2mm 1.5mm;
      font-size: ${isWide ? "7pt" : "8pt"};
      line-height: 1.4;
    }
    .center { text-align: center; }
    .small { font-size: ${isWide ? "6.5pt" : "7pt"}; }
    .mb-1 { margin-bottom: 2px; }
    .mb-2 { margin-bottom: 6px; }
    .spacer { margin: 6px 0; }
    .line { border-top: 0.5px dashed #ccc; margin-bottom: 4px; }
    .cut-spacer { height: 15mm; }
    .row { display: flex; justify-content: space-between; gap: 6px; }
    .store-name { font-size: ${isWide ? "9pt" : "10pt"}; }
    .total-row { border-top: 0.5px dashed #ccc; padding-top: 5px; margin-top: 5px; }
    .item-header { display: flex; gap: 4px; font-size: 6.5pt; margin-bottom: 1px; align-items: baseline; }
    .item-row { display: flex; gap: 4px; margin-bottom: 1px; align-items: flex-start; }
    .col-name { flex: 1; min-width: 0; word-break: break-word; }
    .col-amounts { display: flex; gap: 4px; flex-shrink: 0; white-space: nowrap; text-align: right; margin-left: auto; }
    .col-qty { width: 14px; text-align: right; flex-shrink: 0; }
    .col-price { flex-shrink: 0; }
    .col-total { flex-shrink: 0; min-width: 38px; }
    .item-name { width: 100%; word-break: break-word; margin-bottom: 0; }
    .item-narrow { margin-bottom: 1px; }
    .item-amounts { display: flex; justify-content: flex-end; gap: 6px; align-items: baseline; white-space: nowrap; }
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
