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
import { formatCurrency, formatDateTime } from "@pos/shared-utils";
import { dbHelpers } from "@/lib/db";

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

  useEffect(() => {
    // Load organization data from IndexedDB
    const loadOrganization = async () => {
      const org = await dbHelpers.getOrganization();
      if (org) {
        setOrganizationData(org);
      }
    };
    loadOrganization();
  }, []);

  useEffect(() => {
    // Inject print styles into document head
    const styleId = "test-receipt-print-styles";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
        @media print {
          body * {
            visibility: hidden;
          }
          .test-receipt-print-container,
          .test-receipt-print-container * {
            visibility: visible;
          }
          .test-receipt-print-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            max-width: 58mm;
          }
          @page {
            size: 58mm auto;
            margin: 0;
          }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  const generateTestReceipt = (productCount: 5 | 10 | 20) => {
    // Generate test items
    const items = sampleProducts.slice(0, productCount).map((product, index) => {
      const quantity = Math.floor(Math.random() * 3) + 1; // Random quantity 1-3
      return {
        name: product.name,
        quantity,
        unitPrice: product.unitPrice,
        total: product.unitPrice * quantity,
      };
    });

    setTestItems(items);
    setShowReceipt(true);
  };

  const calculateTotals = () => {
    const subtotal = testItems.reduce((sum, item) => sum + item.total, 0);
    const taxAmount = subtotal * 0.12; // 12% tax
    const totalAmount = subtotal + taxAmount;
    
    return { subtotal, taxAmount, totalAmount };
  };

  const handlePrint = () => {
    window.print();
    setTimeout(() => {
      setShowReceipt(false);
      setOpen(false);
    }, 500);
  };

  const { subtotal, taxAmount, totalAmount } = showReceipt ? calculateTotals() : { subtotal: 0, taxAmount: 0, totalAmount: 0 };
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
              Paper size: 48mm × auto (supports 210mm, 297mm, 600mm, 1200mm)
            </p>
          </div>
        ) : (
          <>
            <div className="max-h-[500px] overflow-y-auto">
              {/* Receipt content for printing */}
              <div className="test-receipt-print-container">
                <div className="w-full max-w-[58mm] px-1 py-2 font-sans text-[11pt] leading-snug bg-white">
                  {/* Header */}
                  <div className="text-center mb-2">
                    <div>
                      {organizationData?.name || "YOUR STORE NAME"}
                    </div>
                    {organizationData?.address && (
                      <div>{organizationData.address}</div>
                    )}
                    {organizationData?.phone && (
                      <div>Tel: {organizationData.phone}</div>
                    )}
                    <div className="border-b border-dashed border-gray-400 my-2" />
                  </div>

                  {/* Order Info */}
                  <div className="mb-2">
                    <div>Order: TEST-{Date.now()}</div>
                    <div>Date: {formatDateTime(testDate)}</div>
                  </div>

                  {/* Customer Info */}
                  <div className="mb-2">
                    <div className="border-b border-dashed border-gray-400 my-2" />
                    <div>CUSTOMER:</div>
                    <div>Name: Sample Customer</div>
                    <div>Address: 123 Test Street, Test City</div>
                  </div>

                  {/* Items */}
                  <div className="border-b border-dashed border-gray-400 my-2" />
                  <div>
                    {testItems.map((item, index) => (
                      <div key={index} className="flex justify-between gap-1 mb-1">
                        <span className="flex-1 min-w-0">
                          {item.name}
                        </span>
                        <span className="whitespace-nowrap">
                          x{item.quantity}
                        </span>
                        <span className="whitespace-nowrap">
                          {formatCurrency(item.total)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Totals */}
                  <div className="border-b border-dashed border-gray-400 my-2" />
                  <div>
                    <div className="flex justify-between mb-1">
                      <span>Subtotal:</span>
                      <span>{formatCurrency(subtotal)}</span>
                    </div>
                    <div className="flex justify-between mb-1">
                      <span>Tax:</span>
                      <span>{formatCurrency(taxAmount)}</span>
                    </div>
                    <div className="border-t border-black pt-2 mt-2">
                      <div className="flex justify-between">
                        <span>TOTAL:</span>
                        <span>{formatCurrency(totalAmount)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Payment Info */}
                  <div className="border-b border-dashed border-gray-400 my-2" />
                  <div className="mb-2">
                    <div>PAYMENT:</div>
                    <div className="flex justify-between">
                      <span>Method:</span>
                      <span className="capitalize">cash</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Cash Received:</span>
                      <span>{formatCurrency(cashReceived)}</span>
                    </div>
                    {change > 0 && (
                      <div className="flex justify-between">
                        <span>Change:</span>
                        <span>{formatCurrency(change)}</span>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="border-t border-dashed border-gray-400 pt-3 text-center text-[13pt]">
                    <div>Thank you for your purchase!</div>
                    <div className="mt-2">Please come again</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Print button */}
            <Button
              onClick={handlePrint}
              className="w-full mt-2"
            >
              Print Receipt
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
