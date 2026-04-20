import { ipcMain } from 'electron'
import { getLocalDb } from '../db/local-db'
import { supabase } from '../supabase/client'
import type { SyncAction } from '../sync/sync-queue'

const MAX_RETRIES = 3

export type SyncConflict = {
  entityName: string
  publicId: string
  localUpdatedAt: string
  remoteUpdatedAt: string
  detectedAt: string
}

let lastConflicts: SyncConflict[] = []

type SyncQueueRow = {
  id: number
  entity_name: string
  entity_public_id: string
  action: SyncAction
  payload_json: string
  retries: number
}

type ProductRemote = {
  id: number
  publicId?: string
  sku: string
  barcode: string | null
  name: string
  price: number
  cost: number
  profitPctBp: number
  stock: number
  stockMin: number
  stockMax: number
  imagePath: string | null
  taxRateBp: number
  active: boolean
  categoryId: number | null
  createdAt: string
  updatedAt?: string
  deletedAt?: string | null
}

type CategoryRemote = {
  id: number
  publicId?: string
  name: string
  createdAt: string
  updatedAt?: string
  deletedAt?: string | null
}

type ServiceRemote = {
  id: number
  publicId?: string
  code: string
  name: string
  durationMin?: number
  duration_min?: number
  cost: number
  price: number
  profitPctBp?: number
  profit_pct_bp?: number
  active?: boolean
  createdAt?: string
  updatedAt?: string
  deletedAt?: string | null
}

type ServiceSupplyRemote = {
  id?: number
  serviceId?: number
  service_id?: number
  productId?: number
  product_id?: number
  qty: number
}

export async function pushPending(): Promise<{ pushed: number; failed: number }> {
  const db = getLocalDb()
  const rows = db.prepare(
    `SELECT id, entity_name, entity_public_id, action, payload_json, retries
     FROM sync_queue WHERE status = 'PENDING' ORDER BY created_at ASC`
  ).all() as SyncQueueRow[]

  const markSynced = db.prepare(
    `UPDATE sync_queue SET status = 'SYNCED', updated_at = ? WHERE id = ?`
  )
  const markFailed = db.prepare(
    `UPDATE sync_queue SET status = 'FAILED', retries = ?, last_error = ?, updated_at = ? WHERE id = ?`
  )
  const incrementRetry = db.prepare(
    `UPDATE sync_queue SET retries = retries + 1, last_error = ?, updated_at = ? WHERE id = ?`
  )

  let pushed = 0
  let failed = 0

  for (const row of rows) {
    const now = new Date().toISOString()
    let payload: Record<string, unknown> | Array<Record<string, unknown>>

    try {
      payload = JSON.parse(row.payload_json) as Record<string, unknown>
    } catch {
      markFailed.run(row.retries + 1, 'Invalid JSON in payload', now, row.id)
      failed++
      continue
    }

    try {
      if (row.entity_name === 'ServiceSupply' && row.action === 'REPLACE') {
        const { data: service, error: serviceError } = await supabase
          .from('Service')
          .select('id')
          .eq('publicId', row.entity_public_id)
          .maybeSingle()

        if (serviceError) throw new Error(serviceError.message)
        if (!service?.id) throw new Error(`Service not found for publicId ${row.entity_public_id}`)

        const remoteServiceId = Number(service.id)
        const supplies = Array.isArray(payload) ? payload : []
        const normalizedSupplies = supplies
          .map((item) => ({
            serviceId: remoteServiceId,
            productId: Number(item.productId),
            qty: Number(item.qty)
          }))
          .filter((item) => Number.isFinite(item.productId) && Number.isFinite(item.qty) && item.qty > 0)

        const { error: deleteError } = await supabase
          .from('ServiceSupply')
          .delete()
          .eq('serviceId', remoteServiceId)
        if (deleteError) throw new Error(deleteError.message)

        if (normalizedSupplies.length > 0) {
          const { error: insertError } = await supabase
            .from('ServiceSupply')
            .insert(normalizedSupplies)
          if (insertError) throw new Error(insertError.message)
        }
      } else if (row.action === 'INSERT') {
        const { error } = await supabase.from(row.entity_name).insert(payload)
        if (error) throw new Error(error.message)
      } else if (row.action === 'UPDATE') {
        const { error } = await supabase
          .from(row.entity_name)
          .update(payload)
          .eq('publicId', row.entity_public_id)
        if (error) throw new Error(error.message)
      } else if (row.action === 'DELETE') {
        const { error } = await supabase
          .from(row.entity_name)
          .delete()
          .eq('publicId', row.entity_public_id)
        if (error) throw new Error(error.message)
      } else {
        throw new Error(`Unsupported sync action: ${row.action}`)
      }

      markSynced.run(now, row.id)
      pushed++
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      const newRetries = row.retries + 1

      if (newRetries >= MAX_RETRIES) {
        markFailed.run(newRetries, errorMsg, now, row.id)
        failed++
      } else {
        incrementRetry.run(errorMsg, now, row.id)
      }
    }
  }

  return { pushed, failed }
}

async function fetchRemoteCategories(): Promise<CategoryRemote[]> {
  const { data, error } = await supabase
    .from('Category')
    .select('id, publicId, name, createdAt, updatedAt, deletedAt')

  if (error) throw new Error(`[sync:categories] ${error.message}`)
  return data ?? []
}

async function fetchRemoteProducts(): Promise<ProductRemote[]> {
  const { data, error } = await supabase.from('Product').select(`
    id, publicId, sku, barcode, name, price, cost, profitPctBp, stock,
    stockMin, stockMax, imagePath, taxRateBp, active, categoryId,
    createdAt, updatedAt, deletedAt
  `)

  if (error) throw new Error(`[sync:products] ${error.message}`)
  return data ?? []
}

async function fetchRemoteServices(): Promise<ServiceRemote[]> {
  const { data, error } = await supabase.from('Service').select('*')

  if (error) throw new Error(`[sync:services] ${error.message}`)
  return data ?? []
}

async function fetchRemoteServiceSupplies(): Promise<ServiceSupplyRemote[]> {
  const { data, error } = await supabase.from('ServiceSupply').select('*')

  if (error) throw new Error(`[sync:serviceSupplies] ${error.message}`)
  return data ?? []
}

function replaceLocalCatalogFromRemote(snapshot: {
  categories: CategoryRemote[]
  products: ProductRemote[]
  services: ServiceRemote[]
  serviceSupplies: ServiceSupplyRemote[]
}): void {
  const db = getLocalDb()
  const now = new Date().toISOString()

  const insertCategory = db.prepare(`
    INSERT INTO "Category" (id, "publicId", name, "createdAt", "updatedAt", "deletedAt")
    VALUES (@id, @publicId, @name, @createdAt, @updatedAt, @deletedAt)
  `)

  const insertProduct = db.prepare(`
    INSERT INTO "Product" (
      id, "publicId", sku, barcode, name, price, cost, "profitPctBp", stock,
      "stockMin", "stockMax", "imagePath", "taxRateBp", active,
      "categoryId", "createdAt", "updatedAt", "deletedAt"
    ) VALUES (
      @id, @publicId, @sku, @barcode, @name, @price, @cost, @profitPctBp, @stock,
      @stockMin, @stockMax, @imagePath, @taxRateBp, @active,
      @categoryId, @createdAt, @updatedAt, @deletedAt
    )
  `)

  const insertService = db.prepare(`
    INSERT INTO "Service" (
      id, "publicId", code, name, "durationMin", cost, price,
      "profitPctBp", active, "createdAt", "updatedAt", "deletedAt"
    ) VALUES (
      @id, @publicId, @code, @name, @durationMin, @cost, @price,
      @profitPctBp, @active, @createdAt, @updatedAt, @deletedAt
    )
  `)

  const insertServiceSupply = db.prepare(`
    INSERT OR IGNORE INTO "ServiceSupply" ("serviceId", "productId", qty)
    VALUES (@serviceId, @productId, @qty)
  `)

  db.transaction(() => {
    db.prepare(`DELETE FROM sync_queue WHERE entity_name IN ('Category', 'Product', 'Service', 'ServiceSupply')`).run()
    db.prepare('DELETE FROM "ServiceSupply"').run()
    db.prepare('DELETE FROM "Service"').run()
    db.prepare('DELETE FROM "Product"').run()
    db.prepare('DELETE FROM "Category"').run()

    for (const row of snapshot.categories) {
      insertCategory.run({
        id: row.id,
        publicId: row.publicId ?? crypto.randomUUID(),
        name: row.name,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt ?? row.createdAt,
        deletedAt: row.deletedAt ?? null
      })
    }

    for (const row of snapshot.products) {
      insertProduct.run({
        id: row.id,
        publicId: row.publicId ?? crypto.randomUUID(),
        sku: row.sku,
        barcode: row.barcode,
        name: row.name,
        price: row.price,
        cost: row.cost,
        profitPctBp: row.profitPctBp,
        stock: row.stock,
        stockMin: row.stockMin,
        stockMax: row.stockMax,
        imagePath: row.imagePath,
        taxRateBp: row.taxRateBp,
        active: row.active ? 1 : 0,
        categoryId: row.categoryId,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt ?? row.createdAt,
        deletedAt: row.deletedAt ?? null
      })
    }

    for (const row of snapshot.services) {
      insertService.run({
        id: row.id,
        publicId: row.publicId ?? crypto.randomUUID(),
        code: row.code,
        name: row.name,
        durationMin: row.durationMin ?? row.duration_min ?? 0,
        cost: row.cost,
        price: row.price,
        profitPctBp: row.profitPctBp ?? row.profit_pct_bp ?? 0,
        active: (row.active ?? true) ? 1 : 0,
        createdAt: row.createdAt ?? now,
        updatedAt: row.updatedAt ?? row.createdAt ?? now,
        deletedAt: row.deletedAt ?? null
      })
    }

    for (const row of snapshot.serviceSupplies) {
      const serviceId = row.serviceId ?? row.service_id
      const productId = row.productId ?? row.product_id
      if (serviceId == null || productId == null) continue
      insertServiceSupply.run({ serviceId, productId, qty: row.qty })
    }
  })()
}

async function pullRemoteCatalog(): Promise<{
  categories: number
  products: number
  services: number
  serviceSupplies: number
}> {
  const [categories, products, services, serviceSupplies] = await Promise.all([
    fetchRemoteCategories(),
    fetchRemoteProducts(),
    fetchRemoteServices(),
    fetchRemoteServiceSupplies()
  ])

  replaceLocalCatalogFromRemote({ categories, products, services, serviceSupplies })

  return {
    categories: categories.length,
    products: products.length,
    services: services.length,
    serviceSupplies: serviceSupplies.length
  }
}

export function registerSyncIpc(): void {
  ipcMain.handle('sync:pullProducts', async () => {
    const counts = await pullRemoteCatalog()
    return { ok: true, count: counts.products }
  })

  ipcMain.handle('sync:pushPending', async () => {
    const { pushed, failed } = await pushPending()
    return { ok: true, pushed, failed }
  })

  ipcMain.handle('sync:conflicts', () => lastConflicts)

  ipcMain.handle('sync:pullAll', async () => {
    lastConflicts = []
    const counts = await pullRemoteCatalog()

    return {
      ok: true,
      syncedAt: new Date().toISOString(),
      push: { pushed: 0, failed: 0, skipped: true },
      conflictCount: 0,
      counts
    }
  })
}
