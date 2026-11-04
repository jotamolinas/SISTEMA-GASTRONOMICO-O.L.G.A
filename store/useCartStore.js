import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Store Zustand para el Carrito/Ticket y Estado de GastroPOS con arquitectura Local-First.
 * Estado inicial estricto: literalmente { 'Mesa 1': [], 'Mesa 2': [], 'Mesa 3': [] }.
 * Sin bucles de generación masiva. Creación y renombrado dinámico mediante modal.
 */
export const useCartStore = create(
  persist(
    (set, get) => ({
      // 1. Estado inicial estricto y estático
      tableCarts: {
        'Mesa 1': [],
        'Mesa 2': [],
        'Mesa 3': []
      },
      // 2. Mesa Activa (por defecto 'Mesa 1')
      activeTable: 'Mesa 1',
      products: [],
      isLoadingProducts: false,

      /**
       * Cambia la mesa activa actual y asegura que exista su array en tableCarts
       */
      setActiveTable: (table) => {
        set((state) => ({
          activeTable: table,
          tableCarts: {
            ...state.tableCarts,
            [table]: state.tableCarts[table] || []
          }
        }));
      },

      /**
       * Agrega una nueva mesa/cuenta de forma inmutable y la selecciona de inmediato
       */
      addTable: (tableName) => {
        if (!tableName || !tableName.trim()) return;
        const formattedName = tableName.trim();
        set((state) => ({
          activeTable: formattedName,
          tableCarts: {
            ...state.tableCarts,
            [formattedName]: state.tableCarts[formattedName] || []
          }
        }));
      },

      /**
       * Renombra una mesa existente de forma inmutable:
       * - Copia los ítems de oldName a newName
       * - Elimina la clave oldName
       * - Si activeTable === oldName, actualiza activeTable a newName
       */
      renameTable: (oldName, newName) => {
        if (!oldName || !newName) return;
        const formattedNew = newName.trim();
        if (!formattedNew || formattedNew === oldName) return;

        set((state) => {
          if (!state.tableCarts[oldName]) return state;

          const updatedTableCarts = { ...state.tableCarts };
          updatedTableCarts[formattedNew] = updatedTableCarts[oldName] || [];
          delete updatedTableCarts[oldName];

          return {
            tableCarts: updatedTableCarts,
            activeTable: state.activeTable === oldName ? formattedNew : state.activeTable
          };
        });
      },

      /**
       * Actualiza la lista de productos en el store sincronizada desde Firestore
       */
      setProducts: (products) => {
        set({ products, isLoadingProducts: false });
      },

      /**
       * Establece estado de carga de productos
       */
      setLoadingProducts: (isLoading) => {
        set({ isLoadingProducts: isLoading });
      },

      /**
       * Añade un producto al ticket de la mesa activa actual de forma inmutable.
       * Si el producto ya existe en la mesa, incrementa su cantidad en 1.
       * Si no existe, lo agrega con cantidad 1.
       */
      addToCart: (product, targetTable) => {
        set((state) => {
          const table = targetTable || state.activeTable || 'Mesa 1';
          const currentTableCart = state.tableCarts[table] || [];
          const existingItemIndex = currentTableCart.findIndex((item) => item.id === product.id);

          let updatedTableCart;
          if (existingItemIndex > -1) {
            updatedTableCart = [...currentTableCart];
            updatedTableCart[existingItemIndex] = {
              ...updatedTableCart[existingItemIndex],
              quantity: (updatedTableCart[existingItemIndex].quantity || 1) + 1,
            };
          } else {
            updatedTableCart = [
              ...currentTableCart,
              {
                id: product.id,
                name: product.name,
                price: Number(product.price) || 0,
                category: product.category,
                stock: product.stock,
                unit: product.unit || 'u',
                quantity: 1,
              },
            ];
          }

          return {
            tableCarts: {
              ...state.tableCarts,
              [table]: updatedTableCart,
            },
          };
        });
      },

      /**
       * Disminuye la cantidad de un ítem en 1 para la mesa activa.
       * Si la cantidad llega a 0 (o menor o igual a 1), se elimina completamente del ticket.
       */
      removeFromCart: (productId, targetTable) => {
        set((state) => {
          const table = targetTable || state.activeTable || 'Mesa 1';
          const currentTableCart = state.tableCarts[table] || [];
          const item = currentTableCart.find((i) => i.id === productId);
          if (!item) return state;

          let updatedTableCart;
          if (item.quantity <= 1) {
            updatedTableCart = currentTableCart.filter((i) => i.id !== productId);
          } else {
            updatedTableCart = currentTableCart.map((i) =>
              i.id === productId ? { ...i, quantity: i.quantity - 1 } : i
            );
          }

          return {
            tableCarts: {
              ...state.tableCarts,
              [table]: updatedTableCart,
            },
          };
        });
      },

      /**
       * Vacía completamente el ticket EXCLUSIVAMENTE de la mesa activa seleccionada.
       */
      clearCart: (targetTable) => {
        set((state) => {
          const table = targetTable || state.activeTable || 'Mesa 1';
          return {
            tableCarts: {
              ...state.tableCarts,
              [table]: [],
            },
          };
        });
      },

      /**
       * Función para obtener el carrito activo actual
       */
      getActiveCart: () => {
        const { tableCarts, activeTable } = get();
        return tableCarts[activeTable] || [];
      },

      /**
       * Función para calcular automáticamente la suma total del pedido de la mesa activa.
       */
      cartTotal: (targetTable) => {
        const { tableCarts, activeTable } = get();
        const table = targetTable || activeTable;
        const currentCart = tableCarts[table] || [];
        return currentCart.reduce((total, item) => total + (item.price || 0) * (item.quantity || 1), 0);
      },
    }),
    {
      name: 'gastropos_tables_v3', // Versión 3 para limpiar el caché de localStorage que tenía 17 mesas
      partialize: (state) => ({ 
        tableCarts: state.tableCarts,
        activeTable: state.activeTable
      }),
      merge: (persistedState, currentState) => ({
        ...currentState,
        activeTable: persistedState?.activeTable || 'Mesa 1',
        tableCarts: persistedState?.tableCarts && Object.keys(persistedState.tableCarts).length > 0
          ? persistedState.tableCarts
          : { 'Mesa 1': [], 'Mesa 2': [], 'Mesa 3': [] }
      })
    }
  )
);

export default useCartStore;
