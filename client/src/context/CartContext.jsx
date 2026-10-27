import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const CartContext = createContext(null);
const STORAGE_KEY = 'merch-cart-v2'; // v2: lines are per option (variantId), not per size

// localStorage can throw (private mode, blocked storage) — never let that break the app.
function loadCart() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

export const lineKey = (productId, variantId) => `${productId}:${variantId || ''}`;

export function CartProvider({ children }) {
  const [items, setItems] = useState(loadCart);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* ignore */
    }
  }, [items]);

  /**
   * product: the product object from the API. variant: the chosen option, if the product has options.
   * Price is only used for display — the server re-prices.
   */
  const addItem = useCallback((product, quantity = 1, variant) => {
    const { price, stock } = variant || product;
    setItems((prev) => {
      const key = lineKey(product._id, variant?._id);
      const existing = prev.find((i) => lineKey(i.productId, i.variantId) === key);
      if (existing) {
        return prev.map((i) =>
          i === existing ? { ...i, quantity: Math.min(i.quantity + quantity, stock || 20) } : i
        );
      }
      return [
        ...prev,
        {
          productId: product._id,
          slug: product.slug,
          name: product.name,
          price,
          image: product.image,
          stock,
          ...(variant && { variantId: variant._id, optionType: product.optionType, optionLabel: variant.label }),
          quantity,
        },
      ];
    });
  }, []);

  const updateQuantity = useCallback((productId, variantId, quantity) => {
    setItems((prev) =>
      prev
        .map((i) => (lineKey(i.productId, i.variantId) === lineKey(productId, variantId) ? { ...i, quantity } : i))
        .filter((i) => i.quantity > 0)
    );
  }, []);

  const removeItem = useCallback((productId, variantId) => {
    setItems((prev) => prev.filter((i) => lineKey(i.productId, i.variantId) !== lineKey(productId, variantId)));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const value = useMemo(
    () => ({
      items,
      addItem,
      updateQuantity,
      removeItem,
      clearCart,
      count: items.reduce((n, i) => n + i.quantity, 0),
      subtotal: items.reduce((sum, i) => sum + i.price * i.quantity, 0),
    }),
    [items, addItem, updateQuantity, removeItem, clearCart]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>');
  return ctx;
}
