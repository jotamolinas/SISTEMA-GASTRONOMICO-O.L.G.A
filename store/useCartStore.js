import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Store Zustand para el Carrito/Ticket de GastroPOS con arquitectura Local-First.
 * Persiste automáticamente en localStorage para garantizar disponibilidad offline en salón.
 */
export const useCartStore = create(
  persist(
    (set, get) => ({
      cart: [],

      /**
       * Añade un producto al ticket.
       * Si el producto ya existe, incrementa su cantidad en 1.
       * Si no existe, lo agrega con cantidad 1.
       */
      addToCart: (product) => {
        set((state) => {
          const existingItemIndex = state.cart.findIndex((item) => item.id === product.id);

          if (existingItemIndex > -1) {
            const updatedCart = [...state.cart];
            updatedCart[existingItemIndex] = {
              ...updatedCart[existingItemIndex],
              quantity: updatedCart[existingItemIndex].quantity + 1,
            };
            return { cart: updatedCart };
          }

          return {
            cart: [
              ...state.cart,
              {
                id: product.id,
                name: product.name,
                price: product.price,
                category: product.category,
                quantity: 1,
              },
            ],
          };
        });
      },

      /**
       * Disminuye la cantidad de un ítem en 1.
       * Si la cantidad llega a 0 (o menor o igual a 1), se elimina completamente del array.
       */
      removeFromCart: (productId) => {
        set((state) => {
          const item = state.cart.find((i) => i.id === productId);
          if (!item) return state;

          if (item.quantity <= 1) {
            return {
              cart: state.cart.filter((i) => i.id !== productId),
            };
          }

          return {
            cart: state.cart.map((i) =>
              i.id === productId ? { ...i, quantity: i.quantity - 1 } : i
            ),
          };
        });
      },

      /**
       * Vacía completamente el ticket actual.
       */
      clearCart: () => {
        set({ cart: [] });
      },

      /**
       * Función derivada para calcular automáticamente la suma total del pedido.
       */
      cartTotal: () => {
        const { cart } = get();
        return cart.reduce((total, item) => total + (item.price || 0) * (item.quantity || 1), 0);
      },
    }),
    {
      name: 'gastropos_cart_localfirst', // Clave en localStorage
    }
  )
);

export default useCartStore;
