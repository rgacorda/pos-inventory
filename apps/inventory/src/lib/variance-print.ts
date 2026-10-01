export interface VariancePrintLine {
  name: string;
  sku: string;
  oldStock: number;
  newStock: number;
  difference: number;
  unitCost: number;
  potentialCost: number;
  updatedBy: string;
}

export interface VariancePrintData {
  organizationName: string;
  printedAt: string;
  lines: VariancePrintLine[];
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function money(value: number) {
  return `₱${value.toFixed(2)}`;
}

function signed(value: number) {
  if (value > 0) return `+${value}`;
  return String(value);
}

export function buildVariancePrintDocument(data: VariancePrintData) {
  const shorts = data.lines.filter((line) => line.difference < 0);
  const overs = data.lines.filter((line) => line.difference > 0);
  const shortUnits = shorts.reduce((sum, line) => sum + Math.abs(line.difference), 0);
  const overUnits = overs.reduce((sum, line) => sum + line.difference, 0);
  const shortCost = shorts.reduce((sum, line) => sum + line.potentialCost, 0);
  const overCost = overs.reduce((sum, line) => sum + line.potentialCost, 0);

  const rows = data.lines
    .map((line) => {
      const kind = line.difference < 0 ? "short" : line.difference > 0 ? "over" : "match";
      const costLabel =
        line.difference === 0 ? "—" : money(line.potentialCost);
      return `<tr class="${kind}">
        <td>
          <div class="name">${escapeHtml(line.name)}</div>
          <div class="sku">${escapeHtml(line.sku)}</div>
        </td>
        <td class="num">${line.oldStock}</td>
        <td class="num">${line.newStock}</td>
        <td class="num diff">${signed(line.difference)}</td>
        <td class="num">${money(line.unitCost)}</td>
        <td class="num cost">${costLabel}</td>
        <td>${escapeHtml(line.updatedBy)}</td>
      </tr>`;
    })
    .join("");

  const byPerson = new Map<string, VariancePrintLine[]>();
  for (const line of data.lines) {
    const person = line.updatedBy.trim() || "Unknown";
    const current = byPerson.get(person) ?? [];
    current.push(line);
    byPerson.set(person, current);
  }
  const people = [...byPerson.entries()]
    .map(([person, lines]) => {
      const shortLines = lines.filter((line) => line.difference < 0);
      const units = shortLines.reduce((sum, line) => sum + Math.abs(line.difference), 0);
      const amount = shortLines.reduce((sum, line) => sum + line.potentialCost, 0);
      return { person, shortLines, units, amount };
    })
    .sort((a, b) => b.amount - a.amount || a.person.localeCompare(b.person));

  const payRows = people
    .map(
      (person) => `<tr class="${person.amount > 0 ? "short" : ""}">
        <td class="name">${escapeHtml(person.person)}</td>
        <td class="num">${person.units}</td>
        <td class="num cost">${money(person.amount)}</td>
      </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Variance Inventory Summary</title>
  <style>
    @page { size: A4 landscape; margin: 12mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #111;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 12px;
    }
    h1 { margin: 0 0 4px; font-size: 20px; }
    .meta { margin: 0; color: #444; }
    .summary {
      display: flex;
      gap: 12px;
      margin: 16px 0;
    }
    .card {
      flex: 1;
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 10px 12px;
    }
    .card h2 {
      margin: 0;
      font-size: 11px;
      font-weight: 600;
      color: #555;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .card p { margin: 6px 0 0; font-size: 18px; font-weight: 700; }
    .card .sub { margin-top: 2px; font-size: 12px; font-weight: 600; }
    .short, .short .diff, .short .cost, .short-text { color: #b91c1c; }
    .over, .over .diff, .over .cost, .over-text { color: #15803d; }
    table { width: 100%; border-collapse: collapse; }
    th, td {
      border-bottom: 1px solid #e5e5e5;
      padding: 6px 8px;
      text-align: left;
      vertical-align: top;
    }
    th {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      color: #555;
    }
    .num { text-align: right; white-space: nowrap; }
    .name { font-weight: 600; }
    .sku { color: #666; font-size: 11px; }
    thead { display: table-header-group; }
    tr { break-inside: avoid; }
    .pay-page { break-before: page; page-break-before: always; }
    .grand-total {
      margin-top: 20px;
      padding-top: 10px;
      border-top: 2px solid #111;
      text-align: right;
      font-size: 16px;
      font-weight: 700;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <h1>Variance Inventory Summary</h1>
  <p class="meta">${escapeHtml(data.organizationName)}</p>
  <p class="meta">Printed ${escapeHtml(data.printedAt)}</p>
  <div class="summary">
    <div class="card">
      <h2>Counted products</h2>
      <p>${data.lines.length}</p>
    </div>
    <div class="card">
      <h2>Short</h2>
      <p class="short-text">${shortUnits} units</p>
      <p class="sub short-text">${money(shortCost)}</p>
    </div>
    <div class="card">
      <h2>Overstock</h2>
      <p class="over-text">${overUnits} units</p>
      <p class="sub over-text">${money(overCost)}</p>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Product</th>
        <th class="num">Old stock</th>
        <th class="num">New stock</th>
        <th class="num">Difference</th>
        <th class="num">Unit cost</th>
        <th class="num">Potential cost</th>
        <th>Updated by</th>
      </tr>
    </thead>
    <tbody>
      ${rows || `<tr><td colspan="7">No counted products.</td></tr>`}
    </tbody>
  </table>
  <section class="pay-page">
    <h1>Amount each person would pay</h1>
    <p class="meta">${escapeHtml(data.organizationName)}</p>
    <p class="meta">Shortage cost for the products each person updated.</p>
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th class="num">Units short</th>
          <th class="num">Amount to pay</th>
        </tr>
      </thead>
      <tbody>
        ${payRows || `<tr><td colspan="3">No counts to assign.</td></tr>`}
      </tbody>
    </table>
    <p class="grand-total">Total to pay: <span class="short-text">${money(shortCost)}</span></p>
  </section>
</body>
</html>`;
}

export function printVarianceSummary(data: VariancePrintData) {
  const html = buildVariancePrintDocument(data);
  const iframe = document.createElement("iframe");
  iframe.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:none;visibility:hidden;";
  document.body.appendChild(iframe);

  const cleanup = () => {
    iframe.parentNode?.removeChild(iframe);
  };

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) {
    cleanup();
    return;
  }

  iframeDoc.open();
  iframeDoc.write(html);
  iframeDoc.close();

  const printWindow = iframe.contentWindow;
  if (!printWindow) {
    cleanup();
    return;
  }

  const finish = () => {
    printWindow.removeEventListener("afterprint", finish);
    cleanup();
  };
  printWindow.addEventListener("afterprint", finish);
  setTimeout(() => printWindow.print(), 300);
}
