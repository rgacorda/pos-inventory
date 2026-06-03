"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { LocalProduct } from "@/lib/db";
import { PaymentMethod } from "@pos/shared-types";

const CART_STORAGE_KEY = "pos_cart_state";

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

interface PersistedCartState {
  orderItems: OrderItem[];
  selectedPaymentMethod: PaymentMethod | null;
  customerName: string;
  customerAddress: string;
  referenceNumber: string;
  exchangeCredit: number;
  exchangeRef: string | null;
  originalOrderServerId: string | null;
  exchangedItems: ExchangedItem[];
}

function loadCartFromStorage(): PersistedCartState | null {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedCartState;
  } catch {
    return null;
  }
}

function saveCartToStorage(state: PersistedCartState) {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage quota exceeded or unavailable – fail silently
  }
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

// Memoised so localStorage.getItem + JSON.parse happen exactly once at startup
let _cachedInitialState: PersistedCartState | null = null;
function getInitialState(): PersistedCartState {
  if (_cachedInitialState) return _cachedInitialState;
  const saved = loadCartFromStorage();
  _cachedInitialState = {
    orderItems: saved?.orderItems ?? [],
    selectedPaymentMethod: saved?.selectedPaymentMethod ?? null,
    customerName: saved?.customerName ?? "",
    customerAddress: saved?.customerAddress ?? "",
    referenceNumber: saved?.referenceNumber ?? "",
    exchangeCredit: saved?.exchangeCredit ?? 0,
    exchangeRef: saved?.exchangeRef ?? null,
    originalOrderServerId: saved?.originalOrderServerId ?? null,
    exchangedItems: saved?.exchangedItems ?? [],
  };
  return _cachedInitialState;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [orderItems, setOrderItems] = useState<OrderItem[]>(() => getInitialState().orderItems);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(() => getInitialState().selectedPaymentMethod);
  const [customerName, setCustomerName] = useState(() => getInitialState().customerName);
  const [customerAddress, setCustomerAddress] = useState(() => getInitialState().customerAddress);
  const [referenceNumber, setReferenceNumber] = useState(() => getInitialState().referenceNumber);

  const [exchangeCredit, setExchangeCredit] = useState(() => getInitialState().exchangeCredit);
  const [exchangeRef, setExchangeRef] = useState<string | null>(() => getInitialState().exchangeRef);
  const [originalOrderServerId, setOriginalOrderServerId] = useState<string | null>(() => getInitialState().originalOrderServerId);
  const [exchangedItems, setExchangedItems] = useState<ExchangedItem[]>(() => getInitialState().exchangedItems);

  // Persist cart state to localStorage whenever it changes
  useEffect(() => {
    saveCartToStorage({
      orderItems,
      selectedPaymentMethod,
      customerName,
      customerAddress,
      referenceNumber,
      exchangeCredit,
      exchangeRef,
      originalOrderServerId,
      exchangedItems,
    });
  }, [
    orderItems,
    selectedPaymentMethod,
    customerName,
    customerAddress,
    referenceNumber,
    exchangeCredit,
    exchangeRef,
    originalOrderServerId,
    exchangedItems,
  ]);

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
