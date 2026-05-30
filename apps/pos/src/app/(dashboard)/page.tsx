"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  showSuccessToast,
  showErrorToast,
  SUCCESS_MESSAGES,
  ERROR_MESSAGES,
} from "@/lib/toast-utils";
import { Plus, CreditCard, QrCode, Search, Eye, EyeOff, Ban, Delete } from "lucide-react";
import { useProducts, useTodaysOrders } from "@/hooks/useDatabase";
import { LocalProduct, db, dbHelpers } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import { OrderStatus, PaymentMethod, PaymentStatus, ProductStatus } from "@pos/shared-types";
import { calculateEffectivePrice, calculateLineSubtotalWithTieredPrice } from "@pos/shared-utils";
import { Receipt } from "@/components/receipt";

interface OrderItem {
  product: LocalProduct;
  quantity: number;
}

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
  const [showCashDialog, setShowCashDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [cashReceived, setCashReceived] = useState<string>("");
  const [customerName, setCustomerName] = useState<string>("");
  const [customerAddress, setCustomerAddress] = useState<string>("");
  const [referenceNumber, setReferenceNumber] = useState<string>("");
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<any>(null);
  const [barcodeInput, setBarcodeInput] = useState<string>("");
  const [showQuantityDialog, setShowQuantityDialog] = useState(false);
  const [showProductSelectionDialog, setShowProductSelectionDialog] = useState(false);
  const [matchingProducts, setMatchingProducts] = useState<LocalProduct[]>([]);
  const [productToAdd, setProductToAdd] = useState<LocalProduct | null>(null);
  const [quantityToAdd, setQuantityToAdd] = useState<string>("1");
  const [includeAddon, setIncludeAddon] = useState<boolean>(false);
  const [includeConvenience, setIncludeConvenience] = useState<boolean>(false);
  const [showManualItemDialog, setShowManualItemDialog] = useState(false);
  const [manualItemName, setManualItemName] = useState<string>("");
  const [manualItemPrice, setManualItemPrice] = useState<string>("");
  const [manualItemQuantity, setManualItemQuantity] = useState<string>("1");
  const [manualItemSearch, setManualItemSearch] = useState<string>("");
  const [manualItemBarcode, setManualItemBarcode] = useState<string>("");
  const [manualItemBarcodeError, setManualItemBarcodeError] = useState<string>("");
  const [showItemCounts, setShowItemCounts] = useState(false);
  const [showVoidPinDialog, setShowVoidPinDialog] = useState(false);
  const [voidPinEntry, setVoidPinEntry] = useState("");
  const [voidPinError, setVoidPinError] = useState("");
  const cartEndRef = useRef<HTMLDivElement>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const quantityInputRef = useRef<HTMLInputElement>(null);
  const manualItemNameRef = useRef<HTMLInputElement>(null);
  const manualItemBarcodeRef = useRef<HTMLInputElement>(null);
  const barcodeBufferRef = useRef<string>("");
  const barcodeTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Extract categories from products
  useEffect(() => {
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

  // Global barcode scanner listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if dialogs are open (including the void PIN dialog)
      if (showQuantityDialog || showCashDialog || showPaymentDialog ||
          showManualItemDialog || showReceiptDialog || showProductSelectionDialog ||
          showVoidPinDialog) {
        return;
      }

      // Ignore if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
      const isBarcodeInput = target === barcodeInputRef.current;
      
      // If barcode input is focused, let it handle its own input naturally
      // Otherwise, if any other input is focused, ignore
      if (isInput) {
        return;
      }

      // Handle Enter key - trigger scan
      if (e.key === 'Enter' && barcodeBufferRef.current.length > 0) {
        e.preventDefault();
        const barcode = barcodeBufferRef.current;
        barcodeBufferRef.current = "";
        setBarcodeInput("");
        handleBarcodeScan(barcode);
        return;
      }

      // Accumulate characters for barcode
      // Ignore special keys (except numbers and letters)
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault(); // Prevent default to avoid typing in inputs
        barcodeBufferRef.current += e.key;
        
        // Update visual feedback in barcode input
        setBarcodeInput(barcodeBufferRef.current);
        
        // Clear buffer after 100ms of inactivity (barcode scanners are faster)
        if (barcodeTimerRef.current) {
          clearTimeout(barcodeTimerRef.current);
        }
        barcodeTimerRef.current = setTimeout(() => {
          barcodeBufferRef.current = "";
          setBarcodeInput("");
        }, 100);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (barcodeTimerRef.current) {
        clearTimeout(barcodeTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showQuantityDialog, showCashDialog, showPaymentDialog, showManualItemDialog,
      showReceiptDialog, showProductSelectionDialog, showVoidPinDialog, products]);

  // Keyboard support for the void PIN numpad dialog
  useEffect(() => {
    if (!showVoidPinDialog) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        handleVoidPinInput(e.key);
      } else if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        handleVoidPinBackspace();
      } else if (e.key === "Escape") {
        setVoidPinEntry("");
        setVoidPinError("");
        setShowVoidPinDialog(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showVoidPinDialog, voidPinEntry]);

  // Auto-scroll to latest item in cart
  useEffect(() => {
    if (orderItems.length > 0) {
      cartEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [orderItems]);

  // Auto-focus quantity input when dialog opens
  useEffect(() => {
    if (showQuantityDialog) {
      setTimeout(() => quantityInputRef.current?.focus(), 100);
    }
  }, [showQuantityDialog]);

  // Show quantity dialog for product
  const addToOrder = (product: LocalProduct) => {
    setProductToAdd(product);
    setQuantityToAdd("1");
    setShowQuantityDialog(true);
  };

  // Add product with specified quantity
  const confirmAddToOrder = () => {
    if (!productToAdd) return;
    const qty = parseInt(quantityToAdd) || 1;
    if (qty <= 0) return;

    // Apply convenience markup and addon price if checkboxes are checked
    let priceAdjustment = 0;
    
    if (includeConvenience) {
      // Calculate convenience markup from percentage and fixed amount
      const basePrice = productToAdd.price;
      if (productToAdd.convenienceMarkupPercentage && productToAdd.convenienceMarkupPercentage > 0) {
        priceAdjustment += (basePrice * productToAdd.convenienceMarkupPercentage / 100);
      }
      if (productToAdd.convenienceMarkup && productToAdd.convenienceMarkup > 0) {
        priceAdjustment += productToAdd.convenienceMarkup;
      }
    }
    
    if (includeAddon && productToAdd.addonPrice) {
      priceAdjustment += productToAdd.addonPrice;
    }
    
    const productWithPrice = priceAdjustment > 0
      ? { ...productToAdd, price: productToAdd.price + priceAdjustment }
      : productToAdd;

    const existingItem = orderItems.find(
      (item) => item.product.id === productToAdd.id,
    );
    if (existingItem) {
      setOrderItems(
        orderItems.map((item) =>
          item.product.id === productToAdd.id
            ? { ...item, quantity: item.quantity + qty }
            : item,
        ),
      );
    } else {
      setOrderItems([...orderItems, { product: productWithPrice, quantity: qty }]);
    }

    const markupNotes = [];
    if (includeConvenience && ((productToAdd.convenienceMarkupPercentage && productToAdd.convenienceMarkupPercentage > 0) || 
                                (productToAdd.convenienceMarkup && productToAdd.convenienceMarkup > 0))) {
      markupNotes.push('Convenience');
    }
    if (includeAddon && productToAdd.addonPrice) markupNotes.push('Refrigeration');
    const markupText = markupNotes.length > 0 ? ` (+ ${markupNotes.join(' + ')})` : '';

    showSuccessToast(SUCCESS_MESSAGES.ADDED("Product"), {
      description: `${qty}x ${productToAdd.name}${markupText} added to cart`,
    });

    setShowQuantityDialog(false);
    setProductToAdd(null);
    setQuantityToAdd("1");
    setIncludeAddon(false);
    setIncludeConvenience(false);

    // Blur barcode input to let global listener handle next scan
    barcodeInputRef.current?.blur();
  };

  // Add manual item with custom price
  const addManualItem = () => {
    const itemName = manualItemName.trim();
    const price = parseFloat(manualItemPrice);
    const qty = parseInt(manualItemQuantity) || 1;

    if (!itemName || !manualItemPrice || isNaN(price) || price <= 0) {
      showErrorToast("Invalid Input", {
        description: "Please enter a valid item name and price",
      });
      return;
    }

    if (qty <= 0) {
      showErrorToast("Invalid Quantity", {
        description: "Quantity must be at least 1",
      });
      return;
    }

    // Create a temporary product object for manual items
    const manualProduct: LocalProduct = {
      id: `manual-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: itemName,
      sku: "MANUAL",
      price: price,
      cost: 0,
      taxRate: 0,
      stockQuantity: 999999, // Manual items don't affect stock
      status: ProductStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSyncedAt: new Date(),
    };

    setOrderItems([...orderItems, { product: manualProduct, quantity: qty }]);

    showSuccessToast(SUCCESS_MESSAGES.ADDED("Manual Item"), {
      description: `${qty}x ${itemName} @ ₱${price.toFixed(2)}`,
    });

    // Reset form
    setManualItemName("");
    setManualItemPrice("");
    setManualItemQuantity("1");
    setManualItemBarcode("");
    setManualItemBarcodeError("");
    setShowManualItemDialog(false);

    // Blur barcode input to let global listener handle next scan
    barcodeInputRef.current?.blur();
  };

  // Open manual item dialog
  const openManualItemDialog = () => {
    setManualItemName("");
    setManualItemPrice("");
    setManualItemQuantity("1");
    setManualItemSearch("");
    setManualItemBarcode("");
    setManualItemBarcodeError("");
    setShowManualItemDialog(true);
    setTimeout(() => manualItemBarcodeRef.current?.focus(), 100);
  };

  // Handle barcode scan inside manual item dialog
  const handleManualItemBarcodeScan = async (barcode: string) => {
    const trimmed = barcode.trim();
    if (!trimmed || !products) return;

    const matched = products.filter((p) => p.barcode === trimmed);

    if (matched.length === 0) {
      // Persist the unmatched barcode so managers can register it later
      await dbHelpers.saveUnknownBarcode(trimmed);
      setManualItemBarcodeError(
        `No product found for barcode: ${trimmed}. Barcode saved for manager review.`
      );
      return;
    }

    // Prefer product with stock; otherwise use first match
    const product = matched.sort((a, b) => b.stockQuantity - a.stockQuantity)[0];

    setManualItemBarcodeError("");
    setManualItemName(product.name);
    setManualItemPrice(product.price.toFixed(2));
    setManualItemSearch("");
    setTimeout(() => document.getElementById("manual-quantity-input")?.focus(), 100);
  };

  // Use product as price reference
  const useProductReference = (product: LocalProduct) => {
    setManualItemName(product.name + " (Individual)");
    setManualItemSearch("");
    // Don't auto-set price, let cashier decide based on the reference
    setTimeout(() => document.getElementById('manual-price-input')?.focus(), 100);
  };

  // Filter products for manual item search
  const manualItemSearchResults = manualItemSearch.trim() && products
    ? products.filter((p) => {
        const query = manualItemSearch.toLowerCase();
        return (
          p.name.toLowerCase().includes(query) ||
          p.sku?.toLowerCase().includes(query) ||
          p.barcode?.toLowerCase().includes(query)
        );
      }).slice(0, 5)
    : [];

  // Handle barcode scan
  const handleBarcodeScan = (barcode: string) => {
    if (!barcode.trim() || !products) return;

    // Search for all products with this barcode
    const matchedProducts = products.filter(
      (p) => p.barcode === barcode.trim()
    );

    if (matchedProducts.length === 0) {
      showErrorToast(ERROR_MESSAGES.NOT_FOUND("Product"), {
        description: `No product with barcode: ${barcode}`,
      });
      setBarcodeInput("");
      barcodeInputRef.current?.blur();
      return;
    }

    // Sort by stock (products with stock first)
    const sortedProducts = matchedProducts.sort((a, b) => {
      if (a.stockQuantity > 0 && b.stockQuantity === 0) return -1;
      if (a.stockQuantity === 0 && b.stockQuantity > 0) return 1;
      return b.stockQuantity - a.stockQuantity;
    });

    if (sortedProducts.length === 1) {
      // Only one product found, add directly
      addToOrder(sortedProducts[0]);
      setBarcodeInput("");
      barcodeInputRef.current?.blur();
    } else {
      // Multiple products found, show selection dialog
      setMatchingProducts(sortedProducts);
      setShowProductSelectionDialog(true);
      setBarcodeInput("");
      barcodeInputRef.current?.blur();
    }
  };

  // Handle product selection from dialog
  const handleProductSelection = (product: LocalProduct) => {
    addToOrder(product);
    setShowProductSelectionDialog(false);
    setMatchingProducts([]);
    barcodeInputRef.current?.blur();
  };

  // Handle barcode input key press
  const handleBarcodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleBarcodeScan(barcodeInput);
    }
  };

  // Clear cart
  const clearCart = () => {
    setOrderItems([]);
    setSelectedPaymentMethod(null);
    setCustomerName("");
    setCustomerAddress("");
    setReferenceNumber("");
  };

  // Handle void PIN numpad input
  const handleVoidPinInput = async (digit: string) => {
    if (voidPinEntry.length >= 4) return;
    const newPin = voidPinEntry + digit;
    setVoidPinEntry(newPin);

    if (newPin.length === 4) {
      const storedPin = await dbHelpers.getVoidPin();
      if (newPin === storedPin) {
        clearCart();
        setShowVoidPinDialog(false);
        setVoidPinEntry("");
        setVoidPinError("");
        showSuccessToast("Order Voided", {
          description: "The current order has been cleared.",
        });
      } else {
        setVoidPinError("Incorrect PIN. Try again.");
        setTimeout(() => setVoidPinEntry(""), 600);
      }
    }
  };

  const handleVoidPinBackspace = () => {
    setVoidPinEntry((prev) => prev.slice(0, -1));
    setVoidPinError("");
  };

  const openVoidDialog = () => {
    setVoidPinEntry("");
    setVoidPinError("");
    setShowVoidPinDialog(true);
  };

  // Calculate totals with tiered pricing
  const subtotal = orderItems.reduce((sum, item) => {
    const itemSubtotal = calculateLineSubtotalWithTieredPrice(
      item.quantity,
      item.product.price,
      item.product.packPrice,
      item.product.packQuantity,
    );
    return sum + itemSubtotal;
  }, 0);

  const tax = orderItems.reduce((sum, item) => {
    const itemSubtotal = calculateLineSubtotalWithTieredPrice(
      item.quantity,
      item.product.price,
      item.product.packPrice,
      item.product.packQuantity,
    );
    const itemTax = itemSubtotal * (item.product.taxRate || 0);
    return sum + itemTax;
  }, 0);

  const total = subtotal + tax;

  // Filter products by category and search
  const filteredProducts =
    products?.filter((p) => {
      const matchesCategory =
        selectedCategory === "All" || p.category === selectedCategory;
      
      // Split search query into individual terms for multi-word search
      const searchTerms = searchQuery.toLowerCase().trim().split(/\s+/).filter(term => term.length > 0);
      const matchesSearch =
        searchQuery === "" ||
        searchTerms.every(term => 
          p.name.toLowerCase().includes(term) ||
          p.sku.toLowerCase().includes(term) ||
          (p.description && p.description.toLowerCase().includes(term)) ||
          (p.barcode && p.barcode.toLowerCase().includes(term))
        );
      return matchesCategory && matchesSearch;
    }) || [];
  // Open cash dialog or process other payments
  const handlePaymentClick = (paymentMethod: PaymentMethod) => {
    setSelectedPaymentMethod(paymentMethod);
    if (paymentMethod === PaymentMethod.CASH) {
      setShowCashDialog(true);
      setCashReceived("");
    } else {
      setShowPaymentDialog(true);
    }
  };

  // Quick cash amount buttons
  const handleQuickAmount = (amount: number) => {
    setCashReceived(amount.toString());
  };

  // Calculate change
  const cashAmount = parseFloat(cashReceived) || 0;
  const change = cashAmount - total;
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

      // Prepare order items with tiered pricing
      const items = orderItems.map((item) => {
        const effectivePrice = calculateEffectivePrice(
          item.quantity,
          item.product.price,
          item.product.packPrice,
          item.product.packQuantity,
        );
        const subtotal = calculateLineSubtotalWithTieredPrice(
          item.quantity,
          item.product.price,
          item.product.packPrice,
          item.product.packQuantity,
        );
        const itemTax = subtotal * (item.product.taxRate || 0);
        return {
          id: uuidv4(),
          orderId: orderPosLocalId,
          productId: item.product.id!,
          sku: item.product.sku,
          name: item.product.name,
          quantity: item.quantity,
          unitPrice: effectivePrice,
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
        customerName: customerName.trim() || undefined,
        customerAddress: customerAddress.trim() || undefined,
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
        reference: referenceNumber.trim() || undefined,
        processedAt: now,
        syncStatus: "pending",
        localCreatedAt: now,
        localUpdatedAt: now,
      });

      console.log(`Order created: ${orderNumber}, Payment: ${paymentMethod}`);

      // Get terminal and user info
      const terminal = await dbHelpers.getTerminalId();
      const userStr = localStorage.getItem("user");
      const userData = userStr ? JSON.parse(userStr) : null;

      // Store receipt data
      setLastReceipt({
        orderNumber,
        items: items.map(item => ({
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
        })),
        subtotal,
        taxAmount: tax,
        discountAmount: 0,
        totalAmount: total,
        paymentMethod: paymentMethod,
        paymentReference: referenceNumber.trim() || undefined,
        customerName: customerName.trim() || undefined,
        customerAddress: customerAddress.trim() || undefined,
        cashReceived: paymentMethod === PaymentMethod.CASH ? cashAmount : undefined,
        change: paymentMethod === PaymentMethod.CASH ? change : undefined,
        cashierName: userData?.name || "Cashier",
        terminalName: terminal || "TERMINAL-001",
        dateTime: now,
      });

      // Clear cart after successful order
      clearCart();
      setShowCashDialog(false);
      setShowPaymentDialog(false);
      setCashReceived("");
      setCustomerName("");
      setCustomerAddress("");
      setReferenceNumber("");

      // Show receipt dialog
      setShowReceiptDialog(true);

      // Show success feedback
      if (paymentMethod === PaymentMethod.CASH && change > 0) {
        showSuccessToast(SUCCESS_MESSAGES.COMPLETED("Order"), {
          description: `Change: ₱${change.toFixed(2)}`,
        });
      } else {
        showSuccessToast(SUCCESS_MESSAGES.COMPLETED("Order"), {
          description: `Total: ₱${total.toFixed(2)}`,
        });
      }
    } catch (error) {
      console.error("Checkout failed:", error);
      showErrorToast("Checkout Failed", {
        description: "Failed to process order. Please try again.",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      {/* Main Content - Center Area with Order Items */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <div className="border-b p-4">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-2xl font-semibold">Point of Sale</h1>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => setShowProductSearch(true)}
                className="flex items-center gap-2 px-4"
              >
                <Search className="h-4 w-4" />
                Search Products
              </Button>
              <Button
                variant="outline"
                onClick={openManualItemDialog}
                className="flex items-center gap-2 px-4 border-green-200 hover:bg-green-50"
              >
                <Plus className="h-4 w-4" />
                Manual Item
              </Button>
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                  />
                </svg>
                <input
                  ref={barcodeInputRef}
                  type="text"
                  placeholder="Scan barcode..."
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={handleBarcodeKeyDown}
                  className="w-64 pl-9 pr-4 py-2.5 border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-blue-50"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Order Items / Cart Display */}
        <div className="flex-1 overflow-auto">
          <div className="p-6">
            {orderItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-gray-400">
                <div className="text-center space-y-4">
                  <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center">
                    <Search className="h-12 w-12 text-gray-300" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-600">No Items in Order</h3>
                    <p className="text-sm text-gray-500 mt-2">
                      Click &quot;Search Products&quot; or scan a barcode to add items
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-center">Qty</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orderItems.map((item, index) => (
                      <TableRow key={`${item.product.id}-${index}`}>
                        <TableCell>
                          <div>
                            <div className="font-semibold text-gray-900">
                              {item.product.name}
                            </div>
                            <div className="text-sm text-gray-600">
                              SKU: {item.product.sku}
                              {item.product.category && (
                                <span className="ml-2">• {item.product.category}</span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-base font-semibold">{item.quantity}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div>
                            <div className="font-semibold">
                              ₱{calculateEffectivePrice(
                                item.quantity,
                                item.product.price,
                                item.product.packPrice,
                                item.product.packQuantity,
                              ).toFixed(2)}
                            </div>
                            {item.product.packPrice &&
                             item.product.packQuantity &&
                             item.quantity >= item.product.packQuantity && (
                              <div className="text-xs text-green-600 font-medium">
                                Pack price
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-bold text-lg">
                            ₱{calculateLineSubtotalWithTieredPrice(
                              item.quantity,
                              item.product.price,
                              item.product.packPrice,
                              item.product.packQuantity,
                            ).toFixed(2)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div ref={cartEndRef} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Sidebar - Totals and Payment */}
      <div className="flex w-96 flex-col border-l h-screen bg-gray-50">
        {/* Total Summary at Top */}
        <div className="border-b bg-white shadow-sm p-6 flex-shrink-0">
          <div className="space-y-3">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal</span>
              <span>₱{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>Tax</span>
              <span>₱{tax.toFixed(2)}</span>
            </div>
            <Separator />
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold text-gray-900">Total</span>
              <span className="text-3xl font-bold text-gray-900">
                ₱{total.toFixed(2)}
              </span>
            </div>
            {orderItems.length > 0 && (
              <div className="mt-2 pt-2 border-t border-gray-200">
                <div className="flex justify-between text-sm text-gray-500">
                  <span className="flex items-center gap-1.5">
                    Total Items
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 hover:bg-gray-100"
                      onClick={() => setShowItemCounts(!showItemCounts)}
                    >
                      {showItemCounts ? (
                        <EyeOff className="h-3.5 w-3.5 text-gray-600" />
                      ) : (
                        <Eye className="h-3.5 w-3.5 text-gray-600" />
                      )}
                    </Button>
                  </span>
                  <span className="font-medium">
                    {showItemCounts
                      ? orderItems.reduce((sum, item) => sum + item.quantity, 0)
                      : "•••"}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Payment Methods at Bottom */}
        <div className="border-t bg-white shadow-sm p-6 flex-shrink-0">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Payment Method
            </h3>
            <div className="grid grid-cols-1 gap-3">
              <Button
                variant="outline"
                className={`flex h-auto items-center justify-between p-4 border-2 ${
                  selectedPaymentMethod === PaymentMethod.CASH
                    ? "border-green-500 bg-green-50"
                    : "hover:border-gray-300"
                }`}
                onClick={() => handlePaymentClick(PaymentMethod.CASH)}
                disabled={orderItems.length === 0 || isProcessing}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                    <span className="font-semibold text-green-600 text-lg">₱</span>
                  </div>
                  <span className="font-semibold">Cash</span>
                </div>
                {selectedPaymentMethod === PaymentMethod.CASH && (
                  <div className="h-5 w-5 rounded-full bg-green-500 flex items-center justify-center">
                    <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 12 12">
                      <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" fill="none" />
                    </svg>
                  </div>
                )}
              </Button>
              <Button
                variant="outline"
                className={`flex h-auto items-center justify-between p-4 border-2 ${
                  selectedPaymentMethod === PaymentMethod.CARD
                    ? "border-blue-500 bg-blue-50"
                    : "hover:border-gray-300"
                }`}
                onClick={() => handlePaymentClick(PaymentMethod.CARD)}
                disabled={orderItems.length === 0 || isProcessing}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                    <CreditCard className="h-5 w-5 text-blue-600" />
                  </div>
                  <span className="font-semibold">Card</span>
                </div>
                {selectedPaymentMethod === PaymentMethod.CARD && (
                  <div className="h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center">
                    <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 12 12">
                      <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" fill="none" />
                    </svg>
                  </div>
                )}
              </Button>
              <Button
                variant="outline"
                className={`flex h-auto items-center justify-between p-4 border-2 ${
                  selectedPaymentMethod === PaymentMethod.DIGITAL_WALLET
                    ? "border-purple-500 bg-purple-50"
                    : "hover:border-gray-300"
                }`}
                onClick={() => handlePaymentClick(PaymentMethod.DIGITAL_WALLET)}
                disabled={orderItems.length === 0 || isProcessing}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                    <QrCode className="h-5 w-5 text-purple-600" />
                  </div>
                  <span className="font-semibold">E-Wallet</span>
                </div>
                {selectedPaymentMethod === PaymentMethod.DIGITAL_WALLET && (
                  <div className="h-5 w-5 rounded-full bg-purple-500 flex items-center justify-center">
                    <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 12 12">
                      <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" fill="none" />
                    </svg>
                  </div>
                )}
              </Button>
            </div>
            {orderItems.length > 0 && (
              <Button
                variant="outline"
                className="w-full border-red-300 text-red-600 hover:text-red-700 hover:bg-red-50 hover:border-red-400"
                onClick={openVoidDialog}
              >
                <Ban className="h-4 w-4 mr-2" />
                Void Order
              </Button>
            )}
            {isProcessing && (
              <p className="text-center text-sm text-gray-600">
                Processing payment...
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Product Search Modal */}
      <Dialog open={showProductSearch} onOpenChange={setShowProductSearch}>
        <DialogContent className="!max-w-7xl h-[85vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Search Products</DialogTitle>
            <DialogDescription>
              Browse and select products to add to the order
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 flex flex-col space-y-4 overflow-hidden">
            {/* Search and Filter */}
            <div className="flex gap-3 flex-shrink-0">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-9 pl-9 pr-4 border border-gray-200 rounded-lg focus:outline-none "
                  autoFocus
                />
              </div>
              <Select
                value={selectedCategory}
                onValueChange={setSelectedCategory}
              >
                <SelectTrigger className="w-[200px] h-10">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                className="h-10 px-3 flex items-center gap-2"
                onClick={() => setShowItemCounts(!showItemCounts)}
              >
                {showItemCounts ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
                Stock
              </Button>
            </div>

            {/* Products Table */}
            <div className="flex-1 border rounded-lg overflow-hidden">
              <ScrollArea className="h-full">
                {!products ? (
                  <div className="text-center text-gray-600 py-8">
                    Loading products...
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="text-center text-gray-600 py-8">
                    No products found
                  </div>
                ) : (
                  <Table>
                  <TableHeader className="sticky top-0 bg-white z-10">
                    <TableRow>
                      <TableHead>Product Name</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      {showItemCounts && (
                        <TableHead className="text-right">Stock</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map((product) => (
                      <TableRow
                        key={product.id}
                        onClick={() => addToOrder(product)}
                        className="hover:bg-blue-50 cursor-pointer transition-colors"
                      >
                        <TableCell className="font-medium">
                          {product.name}
                        </TableCell>
                        <TableCell>{product.sku}</TableCell>
                        <TableCell>{product.category}</TableCell>
                        <TableCell className="text-right">
                          <div>
                            <div className="font-semibold">
                              ₱{product.price.toFixed(2)}
                            </div>
                            {product.packPrice && product.packQuantity && (
                              <div className="text-xs text-green-600">
                                ₱{product.packPrice.toFixed(2)}/{product.packQuantity}pc
                              </div>
                            )}
                          </div>
                        </TableCell>
                        {showItemCounts && (
                          <TableCell className="text-right">
                            {product.stockQuantity}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              </ScrollArea>
            </div>
          </div>
          <DialogFooter className="flex-shrink-0">
            <Button
              variant="outline"
              onClick={() => {
                setShowProductSearch(false);
                setSearchQuery("");
                setSelectedCategory("All");
              }}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quantity Selection Dialog */}
      <Dialog open={showQuantityDialog} onOpenChange={setShowQuantityDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Product</DialogTitle>
            <DialogDescription>
              How many items would you like to add?
            </DialogDescription>
          </DialogHeader>
          {productToAdd && (
            <div className="space-y-4 py-4">
              <div className="bg-gray-50 border rounded-lg p-3">
                <div className="font-semibold text-gray-900">
                  {productToAdd.name}
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  SKU: {productToAdd.sku}
                </div>
                <div className="mt-2 space-y-1">
                  <div className="text-sm text-gray-700">
                    Per piece: <span className="font-semibold">₱{productToAdd.price.toFixed(2)}</span>
                  </div>
                  {productToAdd.packPrice && productToAdd.packQuantity && (
                    <div className="text-sm text-green-600">
                      Pack price: <span className="font-semibold">₱{productToAdd.packPrice.toFixed(2)}</span> ({productToAdd.packQuantity} pcs)
                    </div>
                  )}
                  {((productToAdd.convenienceMarkupPercentage && productToAdd.convenienceMarkupPercentage > 0) || 
                    (productToAdd.convenienceMarkup && productToAdd.convenienceMarkup > 0)) && (
                    <div className="text-sm text-purple-600">
                      Convenience markup: <span className="font-semibold">
                        {productToAdd.convenienceMarkupPercentage && productToAdd.convenienceMarkupPercentage > 0 
                          ? `${productToAdd.convenienceMarkupPercentage}%` 
                          : ''}
                        {productToAdd.convenienceMarkupPercentage && productToAdd.convenienceMarkupPercentage > 0 && 
                         productToAdd.convenienceMarkup && productToAdd.convenienceMarkup > 0 
                          ? ' + ' : ''}
                        {productToAdd.convenienceMarkup && productToAdd.convenienceMarkup > 0 
                          ? `₱${productToAdd.convenienceMarkup.toFixed(2)}` 
                          : ''}
                      </span>
                    </div>
                  )}
                  {productToAdd.addonPrice && productToAdd.addonPrice > 0 && (
                    <div className="text-sm text-blue-600">
                      Refrigeration fee: <span className="font-semibold">₱{productToAdd.addonPrice.toFixed(2)}</span>
                    </div>
                  )}
                </div>
                {(() => {
                  const qty = parseInt(quantityToAdd) || 0;
                  const basePrice = calculateEffectivePrice(
                    qty,
                    productToAdd.price,
                    productToAdd.packPrice,
                    productToAdd.packQuantity,
                  );
                  let effectivePrice = basePrice;
                  
                  // Calculate convenience markup from percentage and fixed amount
                  if (includeConvenience) {
                    let calculatedConvenienceMarkup = 0;
                    if (productToAdd.convenienceMarkupPercentage && productToAdd.convenienceMarkupPercentage > 0) {
                      calculatedConvenienceMarkup += (basePrice * productToAdd.convenienceMarkupPercentage / 100);
                    }
                    if (productToAdd.convenienceMarkup && productToAdd.convenienceMarkup > 0) {
                      calculatedConvenienceMarkup += productToAdd.convenienceMarkup;
                    }
                    effectivePrice += calculatedConvenienceMarkup;
                  }
                  
                  if (includeAddon && productToAdd.addonPrice) {
                    effectivePrice += productToAdd.addonPrice;
                  }
                  const lineTotal = effectivePrice * qty;
                  const isUsingPackPrice = productToAdd.packPrice && 
                    productToAdd.packQuantity && 
                    qty >= productToAdd.packQuantity;
                  
                  return qty > 0 ? (
                    <div className="mt-3 pt-3 border-t border-gray-300">
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="text-sm text-gray-600">
                            Effective price: ₱{effectivePrice.toFixed(2)}
                          </div>
                          {isUsingPackPrice && (
                            <div className="text-xs text-green-600 font-medium">
                              Using pack price
                            </div>
                          )}
                          {includeConvenience && ((productToAdd.convenienceMarkupPercentage && productToAdd.convenienceMarkupPercentage > 0) || 
                                                   (productToAdd.convenienceMarkup && productToAdd.convenienceMarkup > 0)) && (
                            <div className="text-xs text-purple-600 font-medium">
                              + Convenience markup
                            </div>
                          )}
                          {includeAddon && productToAdd.addonPrice && productToAdd.addonPrice > 0 && (
                            <div className="text-xs text-blue-600 font-medium">
                              + Refrigeration fee
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-gray-900">
                            ₱{lineTotal.toFixed(2)}
                          </div>
                          <div className="text-xs text-gray-500">
                            Total
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null;
                })()}
              </div>

              {/* CONVENIENCE MARKUP CHECKBOX */}
              {((productToAdd.convenienceMarkupPercentage && productToAdd.convenienceMarkupPercentage > 0) ||
                (productToAdd.convenienceMarkup && productToAdd.convenienceMarkup > 0)) && (
                <div className="flex items-start space-x-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <input
                    type="checkbox"
                    id="include-convenience"
                    checked={includeConvenience}
                    onChange={(e) => setIncludeConvenience(e.target.checked)}
                    className="mt-1 h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                  />
                  <label 
                    htmlFor="include-convenience" 
                    className="text-sm text-gray-700 cursor-pointer flex-1"
                  >
                    <span className="font-medium">
                      Add Convenience Markup (
                      {productToAdd.convenienceMarkupPercentage && productToAdd.convenienceMarkupPercentage > 0 
                        ? `${productToAdd.convenienceMarkupPercentage}%` 
                        : ''}
                      {productToAdd.convenienceMarkupPercentage && productToAdd.convenienceMarkupPercentage > 0 && 
                       productToAdd.convenienceMarkup && productToAdd.convenienceMarkup > 0 
                        ? ' + ' : ''}
                      {productToAdd.convenienceMarkup && productToAdd.convenienceMarkup > 0 
                        ? `+₱${productToAdd.convenienceMarkup.toFixed(2)}` 
                        : ''}
                      )
                    </span>
                    <p className="text-xs text-gray-500 mt-1">
                      For convenience store markup
                    </p>
                  </label>
                </div>
              )}

              {/* ADD-ON CHECKBOX SECTION */}
              {productToAdd.addonPrice && productToAdd.addonPrice > 0 && (
                <div className="flex items-start space-x-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <input
                    type="checkbox"
                    id="include-addon"
                    checked={includeAddon}
                    onChange={(e) => setIncludeAddon(e.target.checked)}
                    className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label 
                    htmlFor="include-addon" 
                    className="text-sm text-gray-700 cursor-pointer flex-1"
                  >
                    <span className="font-medium">Add Refrigeration Fee (+₱{productToAdd.addonPrice.toFixed(2)})</span>
                    <p className="text-xs text-gray-500 mt-1">
                      For refrigerated/chilled products
                    </p>
                  </label>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Quantity</label>
                <Input
                  ref={quantityInputRef}
                  type="number"
                  value={quantityToAdd}
                  onChange={(e) => setQuantityToAdd(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      confirmAddToOrder();
                    }
                  }}
                  placeholder="1"
                  className="text-lg h-12 text-center"
                  min="1"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-4 gap-2">
                <Button
                  variant="outline"
                  onClick={() => setQuantityToAdd("1")}
                  className="h-10"
                >
                  1
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setQuantityToAdd("2")}
                  className="h-10"
                >
                  2
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setQuantityToAdd("5")}
                  className="h-10"
                >
                  5
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setQuantityToAdd(
                    productToAdd.packQuantity ? productToAdd.packQuantity.toString() : "10"
                  )}
                  className={`h-10 ${
                    productToAdd.packQuantity && productToAdd.packPrice
                      ? "border-green-500 text-green-700 hover:bg-green-50"
                      : ""
                  }`}
                >
                  {productToAdd.packQuantity || "10"}
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowQuantityDialog(false);
                setProductToAdd(null);
                setQuantityToAdd("1");
                setIncludeAddon(false);
                setIncludeConvenience(false);
                // Blur barcode input to let global listener handle next scan
                barcodeInputRef.current?.blur();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmAddToOrder}
              disabled={!quantityToAdd || parseInt(quantityToAdd) <= 0}
            >
              Add to Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Product Selection Dialog (Multiple Barcode Matches) */}
      <Dialog open={showProductSelectionDialog} onOpenChange={setShowProductSelectionDialog}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>Select Product</DialogTitle>
                <DialogDescription>
                  Multiple products found with this barcode. Choose one to add to order.
                </DialogDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 flex items-center gap-2 flex-shrink-0"
                onClick={() => setShowItemCounts(!showItemCounts)}
              >
                {showItemCounts ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
                Stock
              </Button>
            </div>
          </DialogHeader>
          <div className="max-h-[500px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  {showItemCounts && (
                    <TableHead className="text-right">Stock</TableHead>
                  )}
                  <TableHead className="text-center">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matchingProducts.map((product) => (
                  <TableRow 
                    key={product.id}
                    className={showItemCounts && product.stockQuantity === 0 ? "opacity-50" : ""}
                  >
                    <TableCell className="font-medium">
                      <div>
                        {product.name}
                        {showItemCounts && product.stockQuantity === 0 && (
                          <span className="ml-2 text-xs text-red-600 font-semibold">
                            OUT OF STOCK
                          </span>
                        )}
                        {showItemCounts && product.stockQuantity > 0 && matchingProducts.findIndex(p => p.stockQuantity > 0) === matchingProducts.findIndex(p => p.id === product.id) && (
                          <span className="ml-2 text-xs text-green-600 font-semibold">
                            ✓ HAS STOCK
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                    <TableCell>{product.category}</TableCell>
                    <TableCell className="text-right">
                      <div>
                        <div className="font-semibold">
                          ₱{product.price.toFixed(2)}
                        </div>
                        {product.packPrice && product.packQuantity && (
                          <div className="text-xs text-green-600">
                            ₱{product.packPrice.toFixed(2)}/{product.packQuantity}pc
                          </div>
                        )}
                      </div>
                    </TableCell>
                    {showItemCounts && (
                      <TableCell className="text-right">
                        <span className={product.stockQuantity > 0 ? "text-green-600 font-semibold" : "text-red-600"}>
                          {product.stockQuantity}
                        </span>
                      </TableCell>
                    )}
                    <TableCell className="text-center">
                      <Button
                        size="sm"
                        onClick={() => handleProductSelection(product)}
                        className="h-8"
                        variant={product.stockQuantity > 0 ? "default" : "outline"}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowProductSelectionDialog(false);
                setMatchingProducts([]);
                barcodeInputRef.current?.blur();
              }}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cash Payment Dialog */}
      <Dialog open={showCashDialog} onOpenChange={setShowCashDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cash Payment</DialogTitle>
            <DialogDescription>
              Enter amount received from customer
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Amount Received</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                  ₱
                </span>
                <Input
                  type="number"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && cashAmount >= total && !isProcessing) {
                      e.preventDefault();
                      handleCheckout(PaymentMethod.CASH);
                    }
                  }}
                  placeholder="0.00"
                  className="pl-7 text-lg h-12"
                  step="0.01"
                  autoFocus
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                onClick={() => handleQuickAmount(Math.ceil(total))}
                className="h-12"
              >
                ₱{Math.ceil(total)}
              </Button>
              <Button
                variant="outline"
                onClick={() => handleQuickAmount(Math.ceil(total / 10) * 10)}
                className="h-12"
              >
                ₱{Math.ceil(total / 10) * 10}
              </Button>
              <Button
                variant="outline"
                onClick={() => handleQuickAmount(Math.ceil(total / 50) * 50)}
                className="h-12"
              >
                ₱{Math.ceil(total / 50) * 50}
              </Button>
            </div>
            {cashAmount >= total && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-green-800 font-medium">Change:</span>
                  <span className="text-green-900 font-bold text-2xl">
                    ₱{change.toFixed(2)}
                  </span>
                </div>
              </div>
            )}
            {cashAmount > 0 && cashAmount < total && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-800 text-sm text-center">
                  Insufficient amount. Need ₱{(total - cashAmount).toFixed(2)}{" "}
                  more
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCashDialog(false);
                setCashReceived("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => handleCheckout(PaymentMethod.CASH)}
              disabled={cashAmount < total || isProcessing}
              className="bg-green-600 hover:bg-green-700"
            >
              {isProcessing ? "Processing..." : "Complete Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Card/E-Wallet Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedPaymentMethod === PaymentMethod.CARD ? "Card" : 
               selectedPaymentMethod === PaymentMethod.DIGITAL_WALLET ? "E-Wallet" : 
               "Store Credit"} Payment
            </DialogTitle>
            <DialogDescription>
              Enter customer details (optional) and confirm payment
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total:</span>
                <span className="font-semibold text-lg">
                  ₱{total.toFixed(2)}
                </span>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                  Reference Number <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      document.getElementById('payment-customer-name')?.focus();
                    }
                  }}
                  placeholder="Enter transaction reference"
                  className="h-10"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                  Customer Name <span className="text-gray-400">(Optional)</span>
                </label>
                <Input
                  id="payment-customer-name"
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      document.getElementById('payment-customer-address')?.focus();
                    }
                  }}
                  placeholder="Enter customer name"
                  className="h-10"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                  Customer Address <span className="text-gray-400">(Optional)</span>
                </label>
                <Input
                  id="payment-customer-address"
                  type="text"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && selectedPaymentMethod && referenceNumber.trim() && !isProcessing) {
                      e.preventDefault();
                      handleCheckout(selectedPaymentMethod);
                    }
                  }}
                  placeholder="Enter customer address"
                  className="h-10"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowPaymentDialog(false);
                setSelectedPaymentMethod(null);
                setReferenceNumber("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => selectedPaymentMethod && handleCheckout(selectedPaymentMethod)}
              disabled={isProcessing || !referenceNumber.trim()}
              className={
                selectedPaymentMethod === PaymentMethod.CARD
                  ? "bg-blue-600 hover:bg-blue-700"
                  : selectedPaymentMethod === PaymentMethod.DIGITAL_WALLET
                  ? "bg-purple-600 hover:bg-purple-700"
                  : "bg-gray-600 hover:bg-gray-700"
              }
            >
              {isProcessing ? "Processing..." : "Complete Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt Dialog */}
      <Dialog open={showReceiptDialog} onOpenChange={setShowReceiptDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Order Completed</DialogTitle>
            <DialogDescription>
              Print receipt for this transaction
            </DialogDescription>
          </DialogHeader>
          
          {/* Change Due Banner */}
          {lastReceipt?.change && lastReceipt.change > 0 && (
            <div className="bg-green-100 border-2 border-green-500 rounded-lg p-6 mb-4 mt-4">
              <div className="text-center">
                <p className="text-sm text-green-700 font-semibold uppercase tracking-wide mb-2">
                  Change Due
                </p>
                <p className="text-5xl font-bold text-green-700">
                  ₱{lastReceipt.change.toFixed(2)}
                </p>
              </div>
            </div>
          )}
          
          <div className="py-4">
            {lastReceipt && (
              <Receipt
                orderNumber={lastReceipt.orderNumber}
                items={lastReceipt.items}
                subtotal={lastReceipt.subtotal}
                taxAmount={lastReceipt.taxAmount}
                discountAmount={lastReceipt.discountAmount}
                totalAmount={lastReceipt.totalAmount}
                paymentMethod={lastReceipt.paymentMethod}
                paymentReference={lastReceipt.paymentReference}
                customerName={lastReceipt.customerName}
                customerAddress={lastReceipt.customerAddress}
                cashReceived={lastReceipt.cashReceived}
                change={lastReceipt.change}
                cashierName={lastReceipt.cashierName}
                terminalName={lastReceipt.terminalName}
                dateTime={lastReceipt.dateTime}
                onPrintComplete={() => {
                  // Optional: close dialog after print
                  // setShowReceiptDialog(false);
                }}
              />
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowReceiptDialog(false)}
              className="w-full"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Void Order PIN Dialog */}
      <Dialog
        open={showVoidPinDialog}
        onOpenChange={(open) => {
          if (!open) {
            setVoidPinEntry("");
            setVoidPinError("");
          }
          setShowVoidPinDialog(open);
        }}
      >
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-center">Supervisor Authorization</DialogTitle>
            <DialogDescription className="text-center">
              Enter the 4-digit void PIN to cancel this order
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-5">
            {/* PIN dot display */}
            <div className="flex justify-center gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`w-12 h-12 border-2 rounded-xl flex items-center justify-center text-2xl transition-colors ${
                    i < voidPinEntry.length
                      ? voidPinError
                        ? "border-red-500 bg-red-50 text-red-600"
                        : "border-red-500 bg-red-50 text-red-600"
                      : "border-gray-300 bg-gray-50"
                  }`}
                >
                  {i < voidPinEntry.length ? "●" : ""}
                </div>
              ))}
            </div>

            {voidPinError && (
              <p className="text-center text-sm text-red-600 font-medium animate-pulse">
                {voidPinError}
              </p>
            )}

            {/* Numpad */}
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <Button
                  key={n}
                  variant="outline"
                  className="h-14 text-xl font-semibold hover:bg-gray-100"
                  onClick={() => handleVoidPinInput(n.toString())}
                  disabled={voidPinEntry.length >= 4}
                >
                  {n}
                </Button>
              ))}
              <Button
                variant="outline"
                className="h-14 hover:bg-gray-100"
                onClick={handleVoidPinBackspace}
              >
                <Delete className="h-5 w-5" />
              </Button>
              <Button
                variant="outline"
                className="h-14 text-xl font-semibold hover:bg-gray-100"
                onClick={() => handleVoidPinInput("0")}
                disabled={voidPinEntry.length >= 4}
              >
                0
              </Button>
              <Button
                variant="ghost"
                className="h-14 text-sm text-gray-500 hover:bg-gray-100"
                onClick={() => {
                  setVoidPinEntry("");
                  setVoidPinError("");
                  setShowVoidPinDialog(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manual Item Dialog */}
      <Dialog open={showManualItemDialog} onOpenChange={setShowManualItemDialog}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Manual Item</DialogTitle>
            <DialogDescription>
              Add custom item with manual pricing for refrigeration fees, individual sales, etc.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Barcode Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
                Scan Barcode to Identify Product <span className="text-red-500">*</span>
              </label>
              <Input
                ref={manualItemBarcodeRef}
                type="text"
                value={manualItemBarcode}
                onChange={(e) => {
                  setManualItemBarcode(e.target.value);
                  setManualItemBarcodeError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleManualItemBarcodeScan(manualItemBarcode);
                  }
                }}
                placeholder="Scan or type barcode, then press Enter..."
                className={`h-11 font-mono ${manualItemBarcodeError ? "border-red-400 bg-red-50 focus-visible:ring-red-400" : "border-gray-300"}`}
              />
              {manualItemBarcodeError && (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                  {manualItemBarcodeError}
                </p>
              )}
              {manualItemName && !manualItemBarcodeError && manualItemBarcode && (
                <p className="text-xs text-green-700 flex items-center gap-1 font-medium">
                  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                  Product identified: {manualItemName}
                </p>
              )}
            </div>

            <Separator />

            {/* Product Price Reference Search */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-blue-700">Or Search Product for Price Reference</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  value={manualItemSearch}
                  onChange={(e) => setManualItemSearch(e.target.value)}
                  placeholder="Search products to see prices..."
                  className="pl-9 border-blue-200 bg-blue-50"
                />
              </div>
              {manualItemSearchResults.length > 0 && (
                <div className="border rounded-lg divide-y max-h-[200px] overflow-y-auto">
                  {manualItemSearchResults.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => useProductReference(product)}
                      className="w-full px-3 py-2 text-left hover:bg-gray-50 flex justify-between items-center gap-2"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{product.name}</div>
                        <div className="text-xs text-gray-500">{product.sku}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-green-600">₱{product.price.toFixed(2)}</div>
                        {product.packPrice && product.packQuantity && (
                          <div className="text-xs text-blue-600">
                            ₱{product.packPrice.toFixed(2)}/{product.packQuantity}pcs
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-2">
              <label className="text-sm font-medium">Item Name *</label>
              <Input
                ref={manualItemNameRef}
                type="text"
                value={manualItemName}
                onChange={(e) => setManualItemName(e.target.value)}
                placeholder="e.g., Refrigeration Fee, Individual Item"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    document.getElementById('manual-price-input')?.focus();
                  }
                }}
              />
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setManualItemName("Refrigeration Fee")}
                >
                  Refrigeration Fee
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setManualItemName("Additional Item")}
                >
                  Additional Item
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setManualItemName("Service Fee")}
                >
                  Service Fee
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Price *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                  ₱
                </span>
                <Input
                  id="manual-price-input"
                  type="number"
                  value={manualItemPrice}
                  onChange={(e) => setManualItemPrice(e.target.value)}
                  placeholder="0.00"
                  className="pl-7"
                  step="0.01"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      document.getElementById('manual-quantity-input')?.focus();
                    }
                  }}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Quantity</label>
              <Input
                id="manual-quantity-input"
                type="number"
                value={manualItemQuantity}
                onChange={(e) => setManualItemQuantity(e.target.value)}
                placeholder="1"
                min="1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addManualItem();
                  }
                }}
              />
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-blue-800 text-sm">
                <span className="font-semibold">Quick Tip:</span> Manual items are one-time charges that don&apos;t affect inventory. Perfect for refrigeration fees, add-ons, or selling individual items from packs.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowManualItemDialog(false);
                setManualItemName("");
                setManualItemPrice("");
                setManualItemQuantity("1");
                setManualItemSearch("");
                setManualItemBarcode("");
                setManualItemBarcodeError("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={addManualItem}>
              Add to Cart
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
