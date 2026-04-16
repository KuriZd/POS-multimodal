// src/renderer/src/vite-env.d.ts
/// <reference types="vite/client" />

interface ProductLookup {
  publicId: string
  sku: string
  barcode: string | null
  name: string
  price: number
  stock: number
  active: number
}

interface Window {
  pos: {
    products: {
      findByCode: (code: string) => Promise<ProductLookup | null>
    }
    sync: {
      pullProducts: () => Promise<{ ok: boolean; count: number }>
    }
  }
}
