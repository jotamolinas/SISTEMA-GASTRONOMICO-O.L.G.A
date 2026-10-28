import { db } from './firebase';
import { auth } from './auth';
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  increment,
  serverTimestamp,
  query,
  orderBy,
  Unsubscribe
} from 'firebase/firestore';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const currentUser = auth?.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid,
      email: currentUser?.email,
      emailVerified: currentUser?.emailVerified,
      isAnonymous: currentUser?.isAnonymous,
      tenantId: currentUser?.tenantId,
      providerInfo: currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export interface ProductItem {
  id: string;
  name: string;
  category: 'Comidas' | 'Bebidas' | string;
  price: number;
  stock: number;
  boxSize: number;
  unit: string;
  barcode?: string;
  icon?: string;
  badge?: string;
  minAlert?: number;
  type?: string;
  createdAt?: any;
  updatedAt?: any;
}

/**
 * Catálogo Inicial Gastronómico para Seed automático en Firestore si la colección está vacía
 */
export const INITIAL_GASTRO_PRODUCTS: Omit<ProductItem, 'id'>[] = [
  {
    name: 'Hamburguesa Doble Smash',
    category: 'Comidas',
    price: 45000,
    stock: 35,
    boxSize: 24,
    unit: 'porciones',
    barcode: '7840001001',
    icon: 'burger',
    badge: 'Popular',
    type: 'meat',
    minAlert: 15
  },
  {
    name: 'Pizza Artesanal Margherita',
    category: 'Comidas',
    price: 60000,
    stock: 20,
    boxSize: 10,
    unit: 'unidades',
    barcode: '7840001002',
    icon: 'pizza',
    badge: 'Horno',
    type: 'bread',
    minAlert: 8
  },
  {
    name: 'Papas Rústicas Trufadas',
    category: 'Comidas',
    price: 28000,
    stock: 40,
    boxSize: 20,
    unit: 'porciones',
    barcode: '7840001003',
    icon: 'fries',
    badge: 'Entrada',
    type: 'bread',
    minAlert: 12
  },
  {
    name: 'Cerveza IPA Tirada 500ml',
    category: 'Bebidas',
    price: 25000,
    stock: 72,
    boxSize: 24,
    unit: 'latas',
    barcode: '7840001004',
    icon: 'beer',
    badge: 'Tirada',
    type: 'beer',
    minAlert: 24
  },
  {
    name: 'Limonada con Menta',
    category: 'Bebidas',
    price: 18000,
    stock: 50,
    boxSize: 24,
    unit: 'vasos',
    barcode: '7840001005',
    icon: 'lemonade',
    badge: 'Natural',
    type: 'soda',
    minAlert: 15
  },
  {
    name: 'Cocktail Gin Tonic Frutos Rojos',
    category: 'Bebidas',
    price: 35000,
    stock: 30,
    boxSize: 12,
    unit: 'copas',
    barcode: '7840001006',
    icon: 'cocktail',
    badge: 'Especial',
    type: 'beer',
    minAlert: 10
  },
  {
    name: 'Cerveza Patagonia 710ml',
    category: 'Bebidas',
    price: 25000,
    stock: 48,
    boxSize: 24,
    unit: 'botellas',
    barcode: '123456789',
    icon: 'beer',
    badge: 'Especial',
    type: 'beer',
    minAlert: 24
  }
];

/**
 * Si la colección 'productos' está vacía en Firestore, inyecta los productos iniciales.
 */
export async function seedInitialProductsIfEmpty(): Promise<boolean> {
  const collectionPath = 'productos';
  try {
    const colRef = collection(db, collectionPath);
    const snap = await getDocs(colRef);
    if (snap.empty) {
      console.log('Colección productos vacía. Sembrando catálogo inicial en Firestore...');
      const batch = writeBatch(db);
      for (const item of INITIAL_GASTRO_PRODUCTS) {
        const newDocRef = doc(colRef);
        batch.set(newDocRef, {
          ...item,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      await batch.commit();
      console.log('¡Catálogo inicial sembrado con éxito en Firestore!');
      return true;
    }
    return false;
  } catch (error) {
    console.warn('Advertencia al sembrar catálogo inicial:', error);
    return false;
  }
}

/**
 * Suscripción en Tiempo Real (onSnapshot) a la colección 'productos'
 * Garantiza que tanto POS como Inventario vean los mismos datos en vivo.
 */
export function subscribeToProducts(
  onData: (products: ProductItem[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'productos';
  const colRef = collection(db, path);

  return onSnapshot(
    colRef,
    (snapshot) => {
      if (snapshot.empty) {
        // Sembrar en background si está vacío
        seedInitialProductsIfEmpty().then((seeded) => {
          if (!seeded) {
            onData([]);
          }
        });
        return;
      }

      const products: ProductItem[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        products.push({
          id: d.id,
          name: data.name || 'Sin nombre',
          category: data.category || 'Comidas',
          price: Number(data.price) || 0,
          stock: Number(data.stock ?? data.currentStock ?? 0),
          boxSize: Number(data.boxSize) || 24,
          unit: data.unit || 'unidades',
          barcode: data.barcode || '',
          icon: data.icon || (data.category === 'Bebidas' ? 'beer' : 'burger'),
          badge: data.badge || '',
          minAlert: Number(data.minAlert) || 12,
          type: data.type || (data.category === 'Bebidas' ? 'beer' : 'meat'),
          createdAt: data.createdAt,
          updatedAt: data.updatedAt
        });
      });

      // Ordenar alfabéticamente
      products.sort((a, b) => a.name.localeCompare(b.name));
      onData(products);
    },
    (err) => {
      console.error('Error en onSnapshot productos:', err);
      if (onError) onError(err);
      handleFirestoreError(err, OperationType.GET, path);
    }
  );
}

/**
 * Obtener productos una sola vez (getDocs)
 */
export async function getProductsOnce(): Promise<ProductItem[]> {
  const path = 'productos';
  try {
    const colRef = collection(db, path);
    let snapshot = await getDocs(colRef);
    if (snapshot.empty) {
      await seedInitialProductsIfEmpty();
      snapshot = await getDocs(colRef);
    }

    const products: ProductItem[] = [];
    snapshot.forEach((d) => {
      const data = d.data();
      products.push({
        id: d.id,
        name: data.name || 'Sin nombre',
        category: data.category || 'Comidas',
        price: Number(data.price) || 0,
        stock: Number(data.stock ?? data.currentStock ?? 0),
        boxSize: Number(data.boxSize) || 24,
        unit: data.unit || 'unidades',
        barcode: data.barcode || '',
        icon: data.icon || (data.category === 'Bebidas' ? 'beer' : 'burger'),
        badge: data.badge || '',
        minAlert: Number(data.minAlert) || 12,
        type: data.type || (data.category === 'Bebidas' ? 'beer' : 'meat'),
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
      });
    });

    products.sort((a, b) => a.name.localeCompare(b.name));
    return products;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

/**
 * Alta de Producto en Firestore (addDoc)
 */
export async function createProductInFirestore(productData: {
  name: string;
  category: string;
  price: number;
  stock: number;
  boxSize?: number;
  unit?: string;
  barcode?: string;
  icon?: string;
  badge?: string;
  minAlert?: number;
}): Promise<string> {
  const path = 'productos';
  try {
    const colRef = collection(db, path);
    const docRef = await addDoc(colRef, {
      name: productData.name.trim(),
      category: productData.category || 'Comidas',
      price: Number(productData.price) || 0,
      stock: Number(productData.stock) || 0,
      boxSize: Number(productData.boxSize) || 24,
      unit: productData.unit || 'unidades',
      barcode: (productData.barcode || '').trim(),
      icon: productData.icon || (productData.category === 'Bebidas' ? 'beer' : 'burger'),
      badge: productData.badge || '',
      minAlert: Number(productData.minAlert) || 12,
      type: productData.category === 'Bebidas' ? 'beer' : 'meat',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

/**
 * Edición de Producto en Firestore (updateDoc)
 */
export async function updateProductInFirestore(
  productId: string,
  productData: Partial<{
    name: string;
    category: string;
    price: number;
    stock: number;
    boxSize: number;
    unit: string;
    barcode: string;
    icon: string;
    badge: string;
    minAlert: number;
  }>
): Promise<void> {
  const path = `productos/${productId}`;
  try {
    const docRef = doc(db, 'productos', productId);
    await updateDoc(docRef, {
      ...productData,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Eliminación de Producto en Firestore (deleteDoc)
 */
export async function deleteProductFromFirestore(productId: string): Promise<void> {
  const path = `productos/${productId}`;
  try {
    const docRef = doc(db, 'productos', productId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Actualización Rápida de Stock (para +1 caja o +1/-1 unidad en InventoryManager)
 */
export async function updateProductStockInFirestore(productId: string, newStock: number): Promise<void> {
  const path = `productos/${productId}`;
  try {
    const docRef = doc(db, 'productos', productId);
    await updateDoc(docRef, {
      stock: Math.max(0, newStock),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * COBRO Y DESCUENTO AUTOMÁTICO (BATCH WRITE - CRÍTICO)
 * 1. Crea un nuevo documento en la colección 'ventas' con items, total, mesa y fecha.
 * 2. En el MISMO batch, hace el descuento atómico de la propiedad 'stock' en la colección 'productos'.
 * 3. Ejecuta batch.commit().
 */
export async function executeCheckoutBatch(params: {
  cart: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
    category?: string;
  }>;
  total: number;
  table: string;
  note?: string;
  cashierEmail?: string;
}): Promise<{ saleId: string; total: number }> {
  const { cart, total, table, note, cashierEmail } = params;
  if (!cart || cart.length === 0) {
    throw new Error('El carrito está vacío. No se puede cobrar.');
  }

  const batch = writeBatch(db);

  // A) Crear nuevo documento en colección 'ventas'
  const ventasCol = collection(db, 'ventas');
  const ventaRef = doc(ventasCol);
  const saleId = ventaRef.id;

  const salePayload = {
    id: saleId,
    mesa: table || 'Mesa General',
    total: Number(total) || 0,
    items: cart.map((i) => ({
      id: i.id,
      name: i.name,
      price: Number(i.price) || 0,
      quantity: Number(i.quantity) || 1,
      subtotal: (Number(i.price) || 0) * (Number(i.quantity) || 1),
      category: i.category || 'General'
    })),
    fecha: new Date().toISOString(),
    timestamp: serverTimestamp(),
    cajero: cashierEmail || 'Mozo Salón',
    nota: (note || '').trim(),
    estado: 'completado'
  };

  batch.set(ventaRef, salePayload);

  // B) Iterar sobre los productos vendidos y descontar la propiedad 'stock' en 'productos'
  for (const item of cart) {
    if (item.id) {
      const prodRef = doc(db, 'productos', item.id);
      batch.update(prodRef, {
        stock: increment(-Number(item.quantity || 1)),
        updatedAt: serverTimestamp()
      });
    }
  }

  // C) Ejecutar batch.commit()
  try {
    await batch.commit();
    return { saleId, total };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'ventas_and_productos_batch');
  }
}
