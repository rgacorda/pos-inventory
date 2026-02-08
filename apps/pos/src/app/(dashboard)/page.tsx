"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  CreditCard,
  QrCode,
  Minus,
  Search,
} from "lucide-react";
import { useProducts, useTodaysOrders } from "@/hooks/useDatabase";
import { LocalProduct, db, dbHelpers } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import { OrderStatus, PaymentMethod, PaymentStatus } from "@pos/shared-types";

interface OrderItem {
  product: LocalProduct;
  quantity: number;
}

// Category mapping with emojis
const categoryIcons: Record<string, string> = {
  Beverages: "🥤",
  Snacks: "🍿",
  Food: "🍜",
  Dairy: "🥛",
  Candy: "🍬",
  Frozen: "🍦",
  Bakery: "🍞",
  "Hot Beverages": "☕",
  All: "🏪",
};

export default function Page() {
  const products = useProducts();
  const todaysOrders = useTodaysOrders();

  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [categories, setCategories] = useState<string[]>(["All"]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<PaymentMethod | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Initialize terminal ID and extract categories
  useEffect(() => {
    dbHelpers.getTerminalId().then((terminalId) => {
      if (!terminalId) {
        dbHelpers.setTerminalId("TERMINAL-001");
      }
    });

    if (products && products.length > 0) {
      const uniqueCategories = [
        "All",
        ...Array.from(
          new Set(
            products
              .map((p) => p.category)
              .filter((category): category is string => Boolean(category)),
          ),
        ),
      ];
      setCategories(uniqueCategories);
    }
  }, [products]);

  // Add product to order
  const addToOrder = (product: LocalProduct) => {
    const existingItem = orderItems.find(
      (item) => item.product.id === product.id,
    );
    if (existingItem) {
      setOrderItems(
        orderItems.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        ),
      );
    } else {
      setOrderItems([...orderItems, { product, quantity: 1 }]);
    }
  };

  // Remove item from order
  const removeFromOrder = (productId: string) => {
    setOrderItems(orderItems.filter((item) => item.product.id !== productId));
  };

  // Update item quantity
  const updateQuantity = (productId: string, delta: number) => {
    setOrderItems(
      orderItems
        .map((item) => {
          if (item.product.id === productId) {
            const newQuantity = item.quantity + delta;
            return newQuantity > 0 ? { ...item, quantity: newQuantity } : item;
          }
          return item;
        })
        .filter((item) => item.quantity > 0),
    );
  };

  // Clear cart
  const clearCart = () => {
    setOrderItems([]);
    setSelectedPaymentMethod(null);
  };

  // Calculate totals
  const subtotal = orderItems.reduce((sum, item) => {
    const itemPrice = item.product.price * item.quantity;
    return sum + itemPrice;
  }, 0);

  const tax = orderItems.reduce((sum, item) => {
    const itemPrice = item.product.price * item.quantity;
    const itemTax = itemPrice * (item.product.taxRate || 0);
    return sum + itemTax;
  }, 0);

  const total = subtotal + tax;

  // Filter products by category and search
  const filteredProducts =
    products?.filter((p) => {
      const matchesCategory =
        selectedCategory === "All" || p.category === selectedCategory;
      const matchesSearch =
        searchQuery === "" ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.description &&
          p.description.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    }) || [];

  // Process checkout
  const handleCheckout = async (paymentMethod: PaymentMethod) => {
    if (orderItems.length === 0) return;
    if (isProcessing) return;

    setIsProcessing(true);
    setSelectedPaymentMethod(paymentMethod);

    try {
      const terminalId = await dbHelpers.getTerminalId();
      const user =
        typeof window !== "undefined"
          ? JSON.parse(localStorage.getItem("user") || "{}")
          : {};

      if (!terminalId) {
        throw new Error("Terminal ID not set");
      }

      const orderPosLocalId = uuidv4();
      const orderNumber = `ORD-${Date.now()}`;
      const now = new Date();

      // Prepare order items
      const items = orderItems.map((item) => {
        const subtotal = item.product.price * item.quantity;
        const itemTax = subtotal * (item.product.taxRate || 0);
        return {
          id: uuidv4(),
          orderId: orderPosLocalId,
          productId: item.product.id!,
          sku: item.product.sku,
          name: item.product.name,
          quantity: item.quantity,
          unitPrice: item.product.price,
          taxRate: item.product.taxRate || 0,
          discountAmount: 0,
          subtotal,
          total: subtotal + itemTax,
        };
      });

      // Create order in IndexedDB
      const orderId = await db.orders.add({
        posLocalId: orderPosLocalId,
        orderNumber,
        terminalId,
        cashierId: user.id || "unknown",
        items,
        subtotal,
        taxAmount: tax,
        discountAmount: 0,
        totalAmount: total,
        status: OrderStatus.COMPLETED,
        completedAt: now,
        syncStatus: "pending",
        localCreatedAt: now,
        localUpdatedAt: now,
      });

      // Create payment in IndexedDB
      const paymentPosLocalId = uuidv4();
      const paymentNumber = `PAY-${Date.now()}`;
      await db.payments.add({
        posLocalId: paymentPosLocalId,
        paymentNumber,
        orderId: orderPosLocalId,
        terminalId,
        method: paymentMethod,
        amount: total,
        status: PaymentStatus.COMPLETED,
        processedAt: now,
        syncStatus: "pending",
        localCreatedAt: now,
        localUpdatedAt: now,
      });

      console.log(`Order created: ${orderNumber}, Payment: ${paymentMethod}`);

      // Clear cart after successful order
      clearCart();

      // Show success feedback
      toast.success("Order Completed", {
        description: `Total: $${total.toFixed(2)}`,
      });
    } catch (error) {
      console.error("Checkout failed:", error);
      toast.error("Checkout Failed", {
        description: "Failed to process order. Please try again.",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      {/* Main Content */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <div className="border-b p-4">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-xl font-semibold">Point of Sale</h1>
            <div className="flex-1 max-w-md relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Categories */}
        <div className="border-b p-4">
          <div className="flex gap-4 overflow-x-auto">
            {categories.map((category, index) => (
              <div
                key={index}
                className={`hover:bg-gray-50 flex min-w-[80px] cursor-pointer flex-col items-center rounded-lg p-2 transition-colors ${
                  selectedCategory === category
                    ? "border-2 border-gray-900"
                    : "border-2 border-transparent"
                }`}
                onClick={() => setSelectedCategory(category)}
              >
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-2xl">
                  {categoryIcons[category] || "📦"}
                </div>
                <span className="text-gray-700 text-center text-xs">
                  {category}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Menu Items Grid */}
        <div className="flex-1 overflow-auto p-6">
          {!products ? (
            <div className="text-center text-gray-600 py-8 text-lg">
              ⏳ Loading products...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center text-gray-600 py-8 text-lg">
              📭 No products available in this category
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
              {filteredProducts.map((product) => (
                <Card
                  key={product.id}
                  className="cursor-pointer transition-shadow hover:shadow-lg"
                  onClick={() => addToOrder(product)}
                >
                  <CardContent className="p-0">
                    <div className="relative aspect-video overflow-hidden rounded-t-lg bg-gradient-to-br from-gray-100 to-gray-200">
                      <div className="flex items-center justify-center h-full text-6xl">
                        {categoryIcons[product.category ?? "All"] || "📦"}
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="mb-1 font-semibold">{product.name}</h3>
                      <p className="text-muted-foreground mb-2 text-sm">
                        {product.category}
                      </p>
                      <div className="flex items-center justify-between">
                        <p className="text-lg font-bold text-gray-900">
                          ${product.price.toFixed(2)}
                        </p>
                        <span className="text-xs text-gray-500">
                          Stock: {product.stockQuantity}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Sidebar - Order Summary */}
      <div className="flex w-80 flex-col border-l h-screen">
        <div className="border-b p-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Current Order</h2>
            <div className="flex items-center gap-2">
              <Trash2
                className="text-muted-foreground h-4 w-4 cursor-pointer hover:text-red-500"
                onClick={clearCart}
              />
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4">
            {orderItems.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <p className="text-sm">Cart is empty</p>
                <p className="text-xs mt-2">Add items to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {orderItems.map((item, index) => (
                  <div
                    key={`${item.product.id}-${index}`}
                    className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50"
                  >
                    <div className="bg-muted flex h-12 w-12 items-center justify-center rounded-lg flex-shrink-0">
                      <span className="text-lg">
                        {categoryIcons[item.product.category || "All"] || "📦"}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium truncate">
                        {item.product.name}
                      </h4>
                      <p className="text-muted-foreground text-xs">
                        ${item.product.price.toFixed(2)} × {item.quantity}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 w-6 p-0"
                          onClick={() => updateQuantity(item.product.id!, -1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="text-xs font-medium w-6 text-center">
                          {item.quantity}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 w-6 p-0"
                          onClick={() => updateQuantity(item.product.id!, 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-semibold text-sm">
                        ${(item.product.price * item.quantity).toFixed(2)}
                      </p>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-5 w-5 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 mt-1"
                        onClick={() => removeFromOrder(item.product.id!)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="border-t p-4 flex-shrink-0">
          <div className="mb-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Tax</span>
              <span>${tax.toFixed(2)}</span>
            </div>
            <Separator />
            <div className="flex justify-between font-semibold text-lg">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-3 gap-2">
            <Button
              variant="outline"
              className={`flex h-auto flex-col items-center bg-transparent p-4 ${
                selectedPaymentMethod === PaymentMethod.CASH
                  ? "ring-2 ring-green-500"
                  : ""
              }`}
              onClick={() => handleCheckout(PaymentMethod.CASH)}
              disabled={orderItems.length === 0 || isProcessing}
            >
              <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-green-100">
                <span className="font-semibold text-green-600">$</span>
              </div>
              <span className="text-xs">Cash</span>
            </Button>
            <Button
              variant="outline"
              className={`flex h-auto flex-col items-center bg-transparent p-4 ${
                selectedPaymentMethod === PaymentMethod.CARD
                  ? "ring-2 ring-blue-500"
                  : ""
              }`}
              onClick={() => handleCheckout(PaymentMethod.CARD)}
              disabled={orderItems.length === 0 || isProcessing}
            >
              <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                <CreditCard className="h-4 w-4 text-blue-600" />
              </div>
              <span className="text-xs">Card</span>
            </Button>
            <Button
              variant="outline"
              className={`flex h-auto flex-col items-center bg-transparent p-4 ${
                selectedPaymentMethod === PaymentMethod.DIGITAL_WALLET
                  ? "ring-2 ring-purple-500"
                  : ""
              }`}
              onClick={() => handleCheckout(PaymentMethod.DIGITAL_WALLET)}
              disabled={orderItems.length === 0 || isProcessing}
            >
              <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100">
                <QrCode className="h-4 w-4 text-purple-600" />
              </div>
              <span className="text-xs">E-Wallet</span>
            </Button>
          </div>

          {isProcessing && (
            <p className="text-center text-sm text-gray-600 mb-2">
              Processing...
            </p>
          )}
        </div>
      </div>
    </>
  );
}
