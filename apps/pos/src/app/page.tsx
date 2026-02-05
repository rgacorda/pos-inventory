'use client';

import { useState, useEffect } from 'react';
import { Navigation } from '@/components/navigation';
import { ProductList } from '@/components/product-list';
import { Cart, CartItem } from '@/components/cart';
import { CheckoutModal } from '@/components/checkout-modal';
import { LocalProduct, dbHelpers } from '@/lib/db';

export default function Home() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCheckout, setShowCheckout] = useState(false);

  useEffect(() => {
    // Set terminal ID if not set
    dbHelpers.getTerminalId().then(terminalId => {
      if (!terminalId) {
        dbHelpers.setTerminalId('TERMINAL-001');
      }
    });
  }, []);

  const handleAddToCart = (product: LocalProduct) => {
    setCart(currentCart => {
      const existingItem = currentCart.find(item => item.product.id === product.id);
      
      if (existingItem) {
        return currentCart.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      
      return [...currentCart, { product, quantity: 1 }];
    });
  };

  const handleUpdateQuantity = (productId: string, quantity: number) => {
    if (quantity < 1) return;
    
    setCart(currentCart =>
      currentCart.map(item =>
        item.product.id === productId
          ? { ...item, quantity }
          : item
      )
    );
  };

  const handleRemoveItem = (productId: string) => {
    setCart(currentCart => currentCart.filter(item => item.product.id !== productId));
  };

  const handleCheckout = () => {
    if (cart.length === 0) return;
    setShowCheckout(true);
  };

  const handleCheckoutComplete = () => {
    setCart([]);
    setShowCheckout(false);
  };

  return (
    <div className="flex flex-col h-screen">
      <Navigation />
      
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 border-r">
          <ProductList onAddToCart={handleAddToCart} />
        </div>
        
        <div className="w-96">
          <Cart
            items={cart}
            onUpdateQuantity={handleUpdateQuantity}
            onRemoveItem={handleRemoveItem}
            onCheckout={handleCheckout}
          />
        </div>
      </div>

      {showCheckout && (
        <CheckoutModal
          items={cart}
          onClose={() => setShowCheckout(false)}
          onComplete={handleCheckoutComplete}
        />
      )}
    </div>
  );
}
