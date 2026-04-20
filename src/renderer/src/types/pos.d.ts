// src/renderer/src/types/pos.d.ts
export {}

export type DataSource = 'local' | 'supabase'

export type CreateProductPayload = {
  sku: string
  name: string
  price: number
  cost: number
  /** Profit margin in basis points. 1 bp = 0.01%, so 1000 bp = 10% (factor 0.10). */
  profitPctBp: number
  stock: number
  stockMin: number
  stockMax: number
  imageDataUrl: string | null
}

export type ProductDetails = {
  id: number
  sku: string
  barcode: string | null
  name: string
  price: number
  cost: number
  profitPctBp: number
  stock: number
  stockMin: number
  stockMax: number
  active: boolean
  imageUrl?: string | null
  imagePath?: string | null
  source?: DataSource
}

export type ProductsListArgs = {
  page: number
  pageSize: number
  search?: string
  active?: boolean
}

export type ProductListItem = {
  id: number
  publicId: string
  sku: string
  barcode: string | null
  name: string
  price: number
  stock: number | null
  active: boolean
  source?: DataSource
}

export type ProductsListResult = {
  items: ProductListItem[]
  total: number
  page: number
  pageSize: number
}

export type ServiceSupplyInput = {
  productId: number
  qty: number
}

export type CreateServicePayload = {
  code: string
  name: string
  durationMin: number
  cost: number
  price: number
  /** Profit margin in basis points. 1 bp = 0.01%, so 1000 bp = 10% (factor 0.10). */
  profitPctBp: number
  supplies: ServiceSupplyInput[]
}

export type ServiceDetails = {
  id: number
  code: string
  name: string
  durationMin: number
  cost: number
  price: number
  profitPctBp: number
  active?: boolean
  createdAt?: string
  supplies?: ServiceSupplyInput[]
  source?: DataSource
}

export type ServicesListArgs = {
  page: number
  pageSize: number
  search?: string
  active?: boolean
}

export type ServiceListItem = {
  id: number
  publicId?: string
  code: string
  name: string
  price: number
  cost: number
  profitPctBp: number
  durationMin: number
  active: boolean
  createdAt: string
  source?: DataSource
}

export type ServicesListResult = {
  items: ServiceListItem[]
  total: number
  page: number
  pageSize: number
}

// Window.pos is declared in src/renderer/src/env.d.ts (single source of truth)
