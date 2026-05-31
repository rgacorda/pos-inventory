"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { LocalProduct } from "@/lib/db";
import { PaymentMethod } from "@pos/shared-types";

export interface OrderItem {
  product: LocalProduct;
  quantity: number;
}

export interface ExchangedItem {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface CartContextValue {
  // Regular cart state
  orderItems: OrderItem[];
  setOrderItems: React.Dispatch<React.SetStateAction<OrderItem[]>>;
  selectedPaymentMethod: PaymentMethod | null;
  setSelectedPaymentMethod: React.Dispatch<React.SetStateAction<PaymentMethod | null>>;
  customerName: string;
  setCustomerName: React.Dispatch<React.SetStateAction<string>>;
  customerAddress: string;
  setCustomerAddress: React.Dispatch<React.SetStateAction<string>>;
  referenceNumber: string;
  setReferenceNumber: React.Dispatch<React.SetStateAction<string>>;
  clearCart: () => void;

  // Exchange state
  exchangeCredit: number;
  exchangeRef: string | null;           // original order number (display + stored on new order)
  originalOrderServerId: string | null; // server UUID → used to call POST /orders/{id}/exchange
  exchangedItems: ExchangedItem[];      // items being returned (for receipt/audit)
  startExchange: (data: {
    credit: number;
    orderRef: string;
    serverId: string | null;
    items: ExchangedItem[];
  }) => void;
  clearExchange: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");

  const [exchangeCredit, setExchangeCredit] = useState(0);
  const [exchangeRef, setExchangeRef] = useState<string | null>(null);
  const [originalOrderServerId, setOriginalOrderServerId] = useState<string | null>(null);
  const [exchangedItems, setExchangedItems] = useState<ExchangedItem[]>([]);

  const clearCart = () => {
    setOrderItems([]);
    setSelectedPaymentMethod(null);
    setCustomerName("");
    setCustomerAddress("");
    setReferenceNumber("");
    // Also clear any active exchange when the order is voided/cleared
    setExchangeCredit(0);
    setExchangeRef(null);
    setOriginalOrderServerId(null);
    setExchangedItems([]);
  };

  const startExchange = (data: {
    credit: number;
    orderRef: string;
    serverId: string | null;
    items: ExchangedItem[];
  }) => {
    // Clear the cart first so the cashier starts fresh
    setOrderItems([]);
    setSelectedPaymentMethod(null);
    setCustomerName("");
    setCustomerAddress("");
    setReferenceNumber("");
    // Load exchange data
    setExchangeCredit(data.credit);
    setExchangeRef(data.orderRef);
    setOriginalOrderServerId(data.serverId);
    setExchangedItems(data.items);
  };

  const clearExchange = () => {
    setExchangeCredit(0);
    setExchangeRef(null);
    setOriginalOrderServerId(null);
    setExchangedItems([]);
  };

  return (
    <CartContext.Provider
      value={{
        orderItems,
        setOrderItems,
        selectedPaymentMethod,
        setSelectedPaymentMethod,
        customerName,
        setCustomerName,
        customerAddress,
        setCustomerAddress,
        referenceNumber,
        setReferenceNumber,
        clearCart,
        exchangeCredit,
        exchangeRef,
        originalOrderServerId,
        exchangedItems,
        startExchange,
        clearExchange,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
