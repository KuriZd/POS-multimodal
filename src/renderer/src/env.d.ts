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
      create: (payload: import('./types/pos').CreateProductPayload) => Promise<{ id: number }>
      list: (args: import('./types/pos').ProductsListArgs) => Promise<import('./types/pos').ProductsListResult>
      get: (id: number) => Promise<import('./types/pos').ProductDetails>
      getBySku?: (sku: string) => Promise<import('./types/pos').ProductDetails | null>
      update: (id: number, payload: Partial<import('./types/pos').CreateProductPayload>) => Promise<{ id: number } | void>
      remove: (id: number) => Promise<{ ok: true }>
    }
    services: {
      list: (args: import('./types/pos').ServicesListArgs) => Promise<import('./types/pos').ServicesListResult>
      get: (id: number) => Promise<import('./types/pos').ServiceDetails>
      getByCode?: (code: string) => Promise<import('./types/pos').ServiceDetails | null>
      create: (payload: import('./types/pos').CreateServicePayload) => Promise<{ id: number } | void>
      update: (id: number, payload: Partial<import('./types/pos').CreateServicePayload>) => Promise<{ id: number } | void>
      remove: (id: number) => Promise<{ ok: true }>
    }
    sync: {
      pullProducts: () => Promise<{ ok: boolean; count: number }>
    }
  }
}
