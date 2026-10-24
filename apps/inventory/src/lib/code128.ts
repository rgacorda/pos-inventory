/**
 * CODE128 barcode for receipt transaction numbers.
 *
 * `ORD-<digits>` is encoded as Code Set B for the "ORD-" prefix, then Code
 * Set C for the digits (two digits per symbol) so the bars stay wide enough
 * to scan on 58mm paper. Any other value is encoded entirely in Code Set B.
 *
 * Bar patterns are the CODE128 symbol table (107 symbols, stop included).
 */

const START_B = 104;
const CODE_C = 99;
const STOP = 106;

const BARS = [
  "11011001100", "11001101100", "11001100110", "10010011000", "10010001100",
  "10001001100", "10011001000", "10011000100", "10001100100", "11001001000",
  "11001000100", "11000100100", "10110011100", "10011011100", "10011001110",
  "10111001100", "10011101100", "10011100110", "11001110010", "11001011100",
  "11001001110", "11011100100", "11001110100", "11101101110", "11101001100",
  "11100101100", "11100100110", "11101100100", "11100110100", "11100110010",
  "11011011000", "11011000110", "11000110110", "10100011000", "10001011000",
  "10001000110", "10110001000", "10001101000", "10001100010", "11010001000",
  "11000101000", "11000100010", "10110111000", "10110001110", "10001101110",
  "10111011000", "10111000110", "10001110110", "11101110110", "11010001110",
  "11000101110", "11011101000", "11011100010", "11011101110", "11101011000",
  "11101000110", "11100010110", "11101101000", "11101100010", "11100011010",
  "11101111010", "11001000010", "11110001010", "10100110000", "10100001100",
  "10010110000", "10010000110", "10000101100", "10000100110", "10110010000",
  "10110000100", "10011010000", "10011000010", "10000110100", "10000110010",
  "11000010010", "11001010000", "11110111010", "11000010100", "10001111010",
  "10100111100", "10010111100", "10010011110", "10111100100", "10011110100",
  "10011110010", "11110100100", "11110010100", "11110010010", "11011011110",
  "11011110110", "11110110110", "10101111000", "10100011110", "10001011110",
  "10111101000", "10111100010", "11110101000", "11110100010", "10111011110",
  "10111101110", "11101011110", "11110101110", "11010000100", "11010010000",
  "11010011100", "1100011101011",
];

export interface BarModule {
  bar: boolean;
  width: number;
}

function setBValue(char: string): number {
  const code = char.charCodeAt(0);
  if (code < 32 || code > 127) {
    throw new Error(`Cannot encode "${char}" in CODE128`);
  }
  return code - 32;
}

function withChecksum(symbols: number[]): number[] {
  let sum = symbols[0];
  for (let i = 1; i < symbols.length; i++) {
    sum += symbols[i] * i;
  }
  return [...symbols, sum % 103, STOP];
}

/** Symbol values including the start code, checksum, and stop code. */
export function encodeCode128(value: string): number[] {
  const orderMatch = /^ORD-(\d+)$/.exec(value);
  if (orderMatch) {
    const symbols = [START_B];
    for (const char of "ORD-") symbols.push(setBValue(char));

    let digits = orderMatch[1];
    if (digits.length % 2 === 1) {
      symbols.push(setBValue(digits[0]));
      digits = digits.slice(1);
    }
    if (digits.length > 0) {
      symbols.push(CODE_C);
      for (let i = 0; i < digits.length; i += 2) {
        symbols.push(Number(digits.slice(i, i + 2)));
      }
    }
    return withChecksum(symbols);
  }

  const symbols = [START_B];
  for (const char of value) symbols.push(setBValue(char));
  return withChecksum(symbols);
}

export function barcodeModules(value: string): BarModule[] {
  if (!value) return [];
  let symbols: number[];
  try {
    symbols = encodeCode128(value);
  } catch {
    return [];
  }

  const modules: BarModule[] = [{ bar: false, width: 10 }];
  for (const symbol of symbols) {
    const pattern = BARS[symbol];
    if (!pattern) return [];
    let isBar = pattern[0] === "1";
    let width = 0;
    for (const bit of pattern) {
      const bar = bit === "1";
      if (bar === isBar) {
        width += 1;
      } else {
        modules.push({ bar: isBar, width });
        isBar = bar;
        width = 1;
      }
    }
    if (width > 0) modules.push({ bar: isBar, width });
  }
  modules.push({ bar: false, width: 10 });
  return modules;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Inline SVG used by the printable receipt document. */
export function renderBarcodeSvg(value: string): string {
  const modules = barcodeModules(value);
  if (modules.length === 0) return "";

  let x = 0;
  const rects: string[] = [];
  for (const module of modules) {
    if (module.bar) {
      rects.push(
        `<rect x="${x}" y="0" width="${module.width}" height="40" fill="#000"/>`,
      );
    }
    x += module.width;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${x} 40" width="100%" height="12mm" preserveAspectRatio="none" role="img" aria-label="${escapeHtml(value)}">${rects.join("")}</svg>`;
}
