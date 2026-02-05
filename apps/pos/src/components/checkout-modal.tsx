'use client';

import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { db, dbHelpers, LocalOrder } from '@/lib/db';
import { CartItem } from './cart';
import { calculateLineSubtotal, calculateTax, calculateOrderTotal } from '@pos/shared-utils';
import { PaymentMethod, OrderStatus, PaymentStatus } from '@pos/shared-types';

interface CheckoutModalProps {
  items: CartItem[];
  onClose: () => void;
  onComplete: () => void;
}

export function CheckoutModal({ items, onClose, onComplete }: CheckoutModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [isProcessing, setIsProcessing] = useState(false);

  const subtotal = items.reduce((sum, item) => {
    return sum + calculateLineSubtotal(item.quantity, Number(item.product.price));
  }, 0);

  const taxAmount = items.reduce((sum, item) => {
    const lineSubtotal = calculateLineSubtotal(item.quantity, Number(item.product.price));
    return sum + calculateTax(lineSubtotal, Number(item.product.taxRate));
  }, 0);

  const total = calculateOrderTotal(subtotal, taxAmount, 0);

  const handleCheckout = async () => {
    setIsProcessing(true);
    try {
      const terminalId = await dbHelpers.getTerminalId();
      if (!terminalId) {
        alert('Terminal ID not set. Please configure terminal first.');
        return;
      }

      const posLocalId = uuidv4();
      const now = new Date();

      // Create order
      const order: Omit<LocalOrder, 'id'> = {
        orderNumber: `ORD-${Date.now()}`,
        posLocalId,
        terminalId,
        cashierId: 'default-cashier', // TODO: Get from auth
        subtotal,
        taxAmount,
        discountAmount: 0,
        totalAmount: total,
        status: OrderStatus.COMPLETED,
        completedAt: now,
        syncedAt: undefined,
        items: items.map(item => ({
          id: uuidv4(),
          orderId: posLocalId,
          productId: item.product.id,
          sku: item.product.sku,
          name: item.product.name,
          quantity: item.quantity,
          unitPrice: Number(item.product.price),
          taxRate: Number(item.product.taxRate),
          discountAmount: 0,
          subtotal: calculateLineSubtotal(item.quantity, Number(item.product.price)),
          total: calculateOrderTotal(
            calculateLineSubtotal(item.quantity, Number(item.product.price)),
            calculateTax(calculateLineSubtotal(item.quantity, Number(item.product.price)), Number(item.product.taxRate)),
            0
          ),
        })),
        syncStatus: 'pending',
        localCreatedAt: now,
        localUpdatedAt: now,
      };

      await db.orders.add(order);

      // Create payment
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
        syncStatus: 'pending',
        localCreatedAt: now,
        localUpdatedAt: now,
      });

      alert('Order completed successfully!');
      onComplete();
      onClose();
    } catch (error) {
      console.error('Checkout failed:', error);
      alert('Failed to complete order. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">💳 Checkout</h2>

        <div className="space-y-4 mb-6">
          <div className="bg-gradient-to-br from-blue-50 to-green-50 p-4 rounded-xl border-2 border-blue-200">
            <div className="flex justify-between mb-2">
              <span className="text-gray-700">Subtotal:</span>
              <span className="font-semibold text-gray-800">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="text-gray-700">Tax:</span>
              <span className="font-semibold text-gray-800">${taxAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-2xl font-bold border-t-2 border-green-300 pt-2 mt-2">
              <span className="text-gray-800">Total:</span>
              <span className="text-green-600">${total.toFixed(2)}</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700">Payment Method</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={PaymentMethod.CASH}>Cash</option>
              <option value={PaymentMethod.CARD}>Card</option>
              <option value={PaymentMethod.DIGITAL_WALLET}>Digital Wallet</option>
              <option value={PaymentMethod.STORE_CREDIT}>Store Credit</option>
            </select>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 disabled:opacity-50 font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCheckout}
            disabled={isProcessing}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 disabled:opacity-50 font-bold shadow-lg"
          >
            {isProcessing ? '⏳ Processing...' : '✓ Complete Order'}
          </button>
        </div>
      </div>
    </div>
  );
}
