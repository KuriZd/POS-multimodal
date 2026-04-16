/// <reference types="vite/client" />

type AppRole = 'ADMIN' | 'CASHIER' | 'SUPERVISOR'

interface AuthUser {
  id: number
  name: string
  username: string
  role: AppRole
  active: boolean
  source: 'local' | 'remote'
}

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
    auth: {
      login: (username: string, password: string) => Promise<AuthUser | null>
      me: () => Promise<AuthUser | null>
      logout: () => Promise<{ ok: boolean }>
    }
    products: {
      findByCode: (code: string) => Promise<ProductLookup | null>
    }
    sync: {
      pullProducts: () => Promise<{ ok: boolean; count: number }>
    }
  }
}
