"use client";

import { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { db, dbHelpers, LocalOrder } from "@/lib/db";
import { CartItem } from "./cart";
import {
  calculateLineSubtotal,
  calculateTax,
  calculateOrderTotal,
} from "@pos/shared-utils";
import { PaymentMethod, OrderStatus, PaymentStatus } from "@pos/shared-types";

interface CheckoutModalProps {
  items: CartItem[];
  onClose: () => void;
  onComplete: () => void;
}

export function CheckoutModal({
  items,
  onClose,
  onComplete,
}: CheckoutModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [showCashModal, setShowCashModal] = useState(false);
  const [cashTendered, setCashTendered] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const subtotal = items.reduce((sum, item) => {
    return (
      sum + calculateLineSubtotal(item.quantity, Number(item.product.price))
    );
  }, 0);

  const taxAmount = items.reduce((sum, item) => {
    const lineSubtotal = calculateLineSubtotal(
      item.quantity,
      Number(item.product.price),
    );
    return sum + calculateTax(lineSubtotal, Number(item.product.taxRate));
  }, 0);

  const total = calculateOrderTotal(subtotal, taxAmount, 0);

  const handlePaymentMethodClick = (method: PaymentMethod) => {
    setPaymentMethod(method);
  };

  const handleProceedToPayment = () => {
    if (!paymentMethod) {
      alert("Please select a payment method");
      return;
    }

    if (paymentMethod === PaymentMethod.CASH) {
      setShowCashModal(true);
    } else {
      handleCheckout();
    }
  };

  const handleCashPayment = () => {
    const tendered = parseFloat(cashTendered);
    if (isNaN(tendered) || tendered < total) {
      alert(`Insufficient amount. Total is $${total.toFixed(2)}`);
      return;
    }
    handleCheckout();
  };

  const handleCheckout = async () => {
    if (!paymentMethod) {
      alert("Please select a payment method");
      return;
    }

    setIsProcessing(true);
    try {
      const terminalId = await dbHelpers.getTerminalId();
      if (!terminalId) {
        alert("Terminal ID not set. Please configure terminal first.");
        setIsProcessing(false);
        return;
      }

      const posLocalId = uuidv4();
      const now = new Date();

      const cashierId =
        typeof window !== "undefined"
          ? localStorage.getItem("userId") || "default-cashier"
          : "default-cashier";

      const order: Omit<LocalOrder, "id"> = {
        orderNumber: `ORD-${Date.now()}`,
        posLocalId,
        terminalId,
        cashierId,
        customerName: customerName.trim() || undefined,
        customerAddress: customerAddress.trim() || undefined,
        subtotal,
        taxAmount,
        discountAmount: 0,
        totalAmount: total,
        status: OrderStatus.COMPLETED,
        completedAt: now,
        syncedAt: undefined,
        items: items.map((item) => ({
          id: uuidv4(),
          orderId: posLocalId,
          productId: item.product.id,
          sku: item.product.sku,
          name: item.product.name,
          quantity: item.quantity,
          unitPrice: Number(item.product.price),
          taxRate: Number(item.product.taxRate),
          discountAmount: 0,
          subtotal: calculateLineSubtotal(
            item.quantity,
            Number(item.product.price),
          ),
          total: calculateOrderTotal(
            calculateLineSubtotal(item.quantity, Number(item.product.price)),
            calculateTax(
              calculateLineSubtotal(item.quantity, Number(item.product.price)),
              Number(item.product.taxRate),
            ),
            0,
          ),
        })),
        syncStatus: "pending",
        localCreatedAt: now,
        localUpdatedAt: now,
      };

      await db.orders.add(order);

      const paymentLocalId = uuidv4();
      await db.payments.add({
        paymentNumber: `PAY-${Date.now()}`,
        posLocalId: paymentLocalId,
        orderId: posLocalId,
        terminalId,
        method: paymentMethod,
        amount: total,
        status: PaymentStatus.COMPLETED,
        reference: undefined,
        processedAt: now,
        syncedAt: undefined,
        syncStatus: "pending",
        localCreatedAt: now,
        localUpdatedAt: now,
      });

      alert("Order completed successfully!");
      onComplete();
      onClose();
    } catch (error) {
      console.error("Checkout failed:", error);
      alert("Failed to complete order. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const change = cashTendered ? parseFloat(cashTendered) - total : 0;

  if (showCashModal) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
          <h2 className="text-2xl font-bold mb-4 text-gray-800">💵 Cash Payment</h2>
          
          <div className="space-y-4 mb-6">
            <div className="bg-gradient-to-br from-green-50 to-blue-50 p-4 rounded-xl border-2 border-green-200">
              <div className="flex justify-between text-xl font-bold mb-3">
                <span className="text-gray-800">Total Amount:</span>
                <span className="text-green-600">${total.toFixed(2)}</span>
              </div>
              
              <div className="mb-3">
                <label className="block text-sm font-medium mb-2 text-gray-700">
                  Cash Tendered
                </label>
                <input
                  type="number"
                  value={cashTendered}
                  onChange={(e) => setCashTendered(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  min={total}
                  autoFocus
                  className="w-full px-4 py-3 text-lg border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>

              {cashTendered && parseFloat(cashTendered) >= total && (
                <div className="flex justify-between text-2xl font-bold border-t-2 border-green-300 pt-3 mt-3">
                  <span className="text-gray-800">Change:</span>
                  <span className="text-blue-600">${change.toFixed(2)}</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">
                Quick Amount
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[10, 20, 50, 100].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setCashTendered(amount.toString())}
                    className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 font-semibold text-sm"
                  >
                    ${amount}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                setShowCashModal(false);
                setCashTendered("");
              }}
              disabled={isProcessing}
              className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 disabled:opacity-50 font-semibold"
            >
              Back
            </button>
            <button
              onClick={handleCashPayment}
              disabled={isProcessing || !cashTendered || parseFloat(cashTendered) < total}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-bold shadow-lg"
            >
              {isProcessing ? "⏳ Processing..." : "✓ Complete"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">💳 Checkout</h2>

        <div className="space-y-4 mb-6">
          <div className="bg-gradient-to-br from-blue-50 to-green-50 p-4 rounded-xl border-2 border-blue-200">
            <div className="flex justify-between mb-2">
              <span className="text-gray-700">Subtotal:</span>
              <span className="font-semibold text-gray-800">
                ${subtotal.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="text-gray-700">Tax:</span>
              <span className="font-semibold text-gray-800">
                ${taxAmount.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-2xl font-bold border-t-2 border-green-300 pt-2 mt-2">
              <span className="text-gray-800">Total:</span>
              <span className="text-green-600">${total.toFixed(2)}</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-3 text-gray-700">
              Select Payment Method
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handlePaymentMethodClick(PaymentMethod.CASH)}
                className={`p-4 rounded-lg border-2 font-semibold transition-all ${
                  paymentMethod === PaymentMethod.CASH
                    ? "bg-blue-500 text-white border-blue-600 shadow-lg"
                    : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
                }`}
              >
                💵 Cash
              </button>
              <button
                onClick={() => handlePaymentMethodClick(PaymentMethod.CARD)}
                className={`p-4 rounded-lg border-2 font-semibold transition-all ${
                  paymentMethod === PaymentMethod.CARD
                    ? "bg-blue-500 text-white border-blue-600 shadow-lg"
                    : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
                }`}
              >
                💳 Card
              </button>
              <button
                onClick={() => handlePaymentMethodClick(PaymentMethod.DIGITAL_WALLET)}
                className={`p-4 rounded-lg border-2 font-semibold transition-all ${
                  paymentMethod === PaymentMethod.DIGITAL_WALLET
                    ? "bg-blue-500 text-white border-blue-600 shadow-lg"
                    : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
                }`}
              >
                📱 E-Wallet
              </button>
              <button
                onClick={() => handlePaymentMethodClick(PaymentMethod.STORE_CREDIT)}
                className={`p-4 rounded-lg border-2 font-semibold transition-all ${
                  paymentMethod === PaymentMethod.STORE_CREDIT
                    ? "bg-blue-500 text-white border-blue-600 shadow-lg"
                    : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
                }`}
              >
                🎟️ Store Credit
              </button>
            </div>
          </div>

          {paymentMethod && (
            <>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">
                  Customer Name <span className="text-gray-400">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Enter customer name"
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">
                  Customer Address <span className="text-gray-400">(Optional)</span>
                </label>
                <textarea
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder="Enter customer address"
                  rows={2}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 disabled:opacity-50 font-semibold transition-colors"
          >
            Cancel
          </button>
          {paymentMethod && (
            <button
              onClick={handleProceedToPayment}
              disabled={isProcessing}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 disabled:opacity-50 font-bold shadow-lg"
            >
              {paymentMethod === PaymentMethod.CASH ? "💵 Enter Cash Amount" : "✓ Complete Order"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
