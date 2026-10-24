"use client";

import { barcodeModules } from "@/lib/code128";

export function ReceiptBarcode({ value }: { value: string }) {
  const modules = barcodeModules(value);
  if (modules.length === 0) return null;

  const total = modules.reduce((sum, module) => sum + module.width, 0);
  const bars: { x: number; width: number }[] = [];
  let cursor = 0;
  for (const module of modules) {
    if (module.bar) bars.push({ x: cursor, width: module.width });
    cursor += module.width;
  }

  return (
    <div className="mt-1">
      <svg
        viewBox={`0 0 ${total} 40`}
        width="100%"
        height="40"
        preserveAspectRatio="none"
        role="img"
        aria-label={value}
      >
        {bars.map((bar) => (
          <rect
            key={bar.x}
            x={bar.x}
            y={0}
            width={bar.width}
            height={40}
            fill="#000"
          />
        ))}
      </svg>
      <div className="text-center">{value}</div>
    </div>
  );
}
