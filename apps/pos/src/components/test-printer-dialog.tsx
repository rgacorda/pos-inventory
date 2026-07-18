"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { dbHelpers, PAPER_SIZE_CHANGE_EVENT, ReceiptPaperSize } from "@/lib/db";
import {
  ReceiptContent,
  getReceiptPrintStyles,
  measureReceiptHeightMm,
} from "@/components/receipt-content";

interface TestPrinterDialogProps {
  children?: React.ReactNode;
}

// Sample product templates
const sampleProducts = [
  { name: "Coffee - Espresso", unitPrice: 85.00 },
  { name: "Coffee - Americano", unitPrice: 95.00 },
  { name: "Coffee - Cappuccino", unitPrice: 110.00 },
  { name: "Coffee - Latte", unitPrice: 115.00 },
  { name: "Coffee - Mocha", unitPrice: 125.00 },
  { name: "Pastry - Croissant", unitPrice: 65.00 },
  { name: "Pastry - Danish", unitPrice: 70.00 },
  { name: "Sandwich - Club", unitPrice: 145.00 },
  { name: "Sandwich - Ham & Cheese", unitPrice: 135.00 },
  { name: "Sandwich - Tuna", unitPrice: 140.00 },
  { name: "Cake - Chocolate", unitPrice: 95.00 },
  { name: "Cake - Red Velvet", unitPrice: 105.00 },
  { name: "Tea - Green", unitPrice: 75.00 },
  { name: "Tea - Earl Grey", unitPrice: 75.00 },
  { name: "Juice - Orange", unitPrice: 85.00 },
  { name: "Juice - Mango", unitPrice: 90.00 },
  { name: "Smoothie - Berry", unitPrice: 125.00 },
  { name: "Smoothie - Tropical", unitPrice: 130.00 },
  { name: "Water - Bottled", unitPrice: 35.00 },
  { name: "Soda - Cola", unitPrice: 45.00 },
];

export function TestPrinterDialog({ children }: TestPrinterDialogProps) {
  const [open, setOpen] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [testItems, setTestItems] = useState<Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>>([]);
  const [organizationData, setOrganizationData] = useState<{
    name: string;
    address?: string;
    phone?: string;
  } | null>(null);
  const [paperSize, setPaperSize] = useState<ReceiptPaperSize>("58mm");
  const [testOrderNumber, setTestOrderNumber] = useState("");

  useEffect(() => {
    const loadOrganization = async () => {
      const org = await dbHelpers.getOrganization();
      if (org) {
        setOrganizationData(org);
      }
    };
    loadOrganization();

    const loadPaperSize = async () => {
      setPaperSize(await dbHelpers.getPaperSize());
    };
    loadPaperSize();

    // Stay in sync if the paper size is changed in Settings while this
    // dialog's component tree is already mounted (e.g. sidebar stays alive
    // across navigation) — no page reload required.
    const handlePaperSizeChange = (e: Event) => {
      const size = (e as CustomEvent<ReceiptPaperSize>).detail;
      if (size) setPaperSize(size);
    };
    window.addEventListener(PAPER_SIZE_CHANGE_EVENT, handlePaperSizeChange);
    return () =>
      window.removeEventListener(
        PAPER_SIZE_CHANGE_EVENT,
        handlePaperSizeChange,
      );
  }, []);

  // Re-check the saved paper size every time the dialog is opened, as a
  // fallback in case the change event was missed for any reason.
  useEffect(() => {
    if (!open) return;
    const refreshPaperSize = async () => {
      setPaperSize(await dbHelpers.getPaperSize());
    };
    refreshPaperSize();
  }, [open]);

  useEffect(() => {
    // Base print visibility rules (hide everything except the receipt).
    // The exact @page size is computed and injected separately right
    // before printing, once the receipt content is fully rendered.
    const styleId = "test-receipt-print-styles";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
        @media print {
          body * { visibility: hidden; }
          .test-receipt-print-container,
          .test-receipt-print-container * { visibility: visible; }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  const generateTestReceipt = (productCount: 5 | 10 | 20) => {
    // Generate test items
    const items = sampleProducts.slice(0, productCount).map((product) => {
      const quantity = Math.floor(Math.random() * 3) + 1; // Random quantity 1-3
      return {
        name: product.name,
        quantity,
        unitPrice: product.unitPrice,
        total: product.unitPrice * quantity,
      };
    });

    setTestItems(items);
    setTestOrderNumber(`TEST-${Date.now()}`);
    setShowReceipt(true);
  };

  const calculateTotals = () => {
    const subtotal = testItems.reduce((sum, item) => sum + item.total, 0);
    const taxAmount = subtotal * 0.12; // 12% tax
    const totalAmount = subtotal + taxAmount;

    return { subtotal, taxAmount, totalAmount };
  };

  const handlePrint = () => {
    // Measure the actual rendered receipt height so we can request an
    // exact-fit page size instead of relying on the CSS `auto` keyword —
    // see getReceiptPrintStyles() for why this matters on some thermal
    // printer drivers (e.g. ones that only expose fixed page lengths like
    // 210mm/297mm/3276mm and pad the remainder with blank paper).
    const styleId = "test-receipt-page-size-style";
    let pageStyle = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!pageStyle) {
      pageStyle = document.createElement("style");
      pageStyle.id = styleId;
      document.head.appendChild(pageStyle);
    }
    const containerEl = document.querySelector(
      ".test-receipt-print-container"
    );
    const exactHeightMm = containerEl
      ? measureReceiptHeightMm(containerEl)
      : undefined;
    pageStyle.textContent = getReceiptPrintStyles(
      paperSize,
      ".test-receipt-print-container",
      exactHeightMm
    );

    window.print();
    setTimeout(() => {
      setShowReceipt(false);
      setOpen(false);
    }, 500);
  };

  const { subtotal, taxAmount, totalAmount } = showReceipt
    ? calculateTotals()
    : { subtotal: 0, taxAmount: 0, totalAmount: 0 };
  const cashReceived = Math.ceil(totalAmount / 100) * 100;
  const change = cashReceived - totalAmount;
  const testDate = new Date();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" className="w-full">
            <Printer className="h-4 w-4 mr-2" />
            Test Printer
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Test Thermal Printer</DialogTitle>
          <DialogDescription>
            Print a test receipt to verify your thermal printer configuration
            (currently set to {paperSize})
          </DialogDescription>
        </DialogHeader>

        {!showReceipt ? (
          <div className="space-y-3 py-4">
            <p className="text-sm text-gray-600">
              Select the number of sample products to test:
            </p>
            <div className="grid grid-cols-3 gap-3">
              <Button
                onClick={() => generateTestReceipt(5)}
                variant="outline"
                className="h-20 flex flex-col items-center justify-center"
              >
                <Printer className="h-6 w-6 mb-2" />
                <span className="font-semibold">5 Items</span>
                <span className="text-xs text-gray-500">Short receipt</span>
              </Button>
              <Button
                onClick={() => generateTestReceipt(10)}
                variant="outline"
                className="h-20 flex flex-col items-center justify-center"
              >
                <Printer className="h-6 w-6 mb-2" />
                <span className="font-semibold">10 Items</span>
                <span className="text-xs text-gray-500">Medium receipt</span>
              </Button>
              <Button
                onClick={() => generateTestReceipt(20)}
                variant="outline"
                className="h-20 flex flex-col items-center justify-center"
              >
                <Printer className="h-6 w-6 mb-2" />
                <span className="font-semibold">20 Items</span>
                <span className="text-xs text-gray-500">Long receipt</span>
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-4">
              Paper size: {paperSize} × auto (change in Settings)
            </p>
          </div>
        ) : (
          <>
            <div className="max-h-[500px] overflow-y-auto">
              {/* Receipt content for printing */}
              <div className="test-receipt-print-container">
                <ReceiptContent
                  paperSize={paperSize}
                  organization={organizationData}
                  orderNumber={testOrderNumber}
                  items={testItems}
                  subtotal={subtotal}
                  taxAmount={taxAmount}
                  discountAmount={0}
                  totalAmount={totalAmount}
                  paymentMethod="cash"
                  customerName="Sample Customer"
                  customerAddress="123 Test Street, Test City"
                  cashReceived={cashReceived}
                  change={change}
                  cashierName="Test Cashier"
                  dateTime={testDate}
                />
              </div>
            </div>

            {/* Print button */}
            <Button onClick={handlePrint} className="w-full mt-2">
              Print Receipt
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
