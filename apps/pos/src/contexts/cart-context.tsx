"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { LocalProduct } from "@/lib/db";
import { PaymentMethod } from "@pos/shared-types";

export interface OrderItem {
  product: LocalProduct;
  quantity: number;
}

interface CartContextValue {
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
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");

  const clearCart = () => {
    setOrderItems([]);
    setSelectedPaymentMethod(null);
    setCustomerName("");
    setCustomerAddress("");
    setReferenceNumber("");
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
