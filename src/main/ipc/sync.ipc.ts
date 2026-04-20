import { ipcMain } from 'electron'
import { getLocalDb } from '../db/local-db'
import { supabase } from '../supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────

const MAX_RETRIES = 3

export type SyncConflict = {
  entityName: string
  publicId: string
  localUpdatedAt: string
  remoteUpdatedAt: string
  detectedAt: string
}

/** Conflicts detected during the most recent pullAll; reset on each pullAll call. */
let lastConflicts: SyncConflict[] = []

type SyncQueueRow = {
  id: number
  entity_name: string
  entity_public_id: string
  action: 'INSERT' | 'UPDATE' | 'DELETE'
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

// ─── Push pending ─────────────────────────────────────────────────────────────

async function pushPending(): Promise<{ pushed: number; failed: number }> {
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
    let payload: Record<string, unknown>

    try {
      payload = JSON.parse(row.payload_json) as Record<string, unknown>
    } catch {
      markFailed.run(row.retries + 1, 'Invalid JSON in payload', now, row.id)
      failed++
      continue
    }

    try {
      if (row.action === 'INSERT') {
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

// ─── Conflict detection ───────────────────────────────────────────────────────

type LocalTimestamp = { updatedAt: string }

function detectConflict(
  db: ReturnType<typeof getLocalDb>,
  entityName: string,
  publicId: string,
  remoteUpdatedAt: string,
  conflicts: SyncConflict[]
): boolean {
  const local = db.prepare(
    `SELECT "updatedAt" FROM "${entityName}" WHERE "publicId" = ?`
  ).get(publicId) as LocalTimestamp | undefined

  if (!local) return false

  if (local.updatedAt <= remoteUpdatedAt) return false

  const hasPending = db.prepare(
    `SELECT 1 FROM sync_queue
     WHERE entity_name = ? AND entity_public_id = ? AND status = 'PENDING' LIMIT 1`
  ).get(entityName, publicId)

  if (!hasPending) return false

  conflicts.push({
    entityName,
    publicId,
    localUpdatedAt: local.updatedAt,
    remoteUpdatedAt,
    detectedAt: new Date().toISOString()
  })
  return true
}

// ─── Sync functions ───────────────────────────────────────────────────────────

async function syncCategories(conflicts: SyncConflict[]): Promise<{ count: number }> {
  const { data, error } = await supabase
    .from('Category')
    .select('id, publicId, name, createdAt, updatedAt, deletedAt')

  if (error) throw new Error(`[sync:categories] ${error.message}`)

  const db = getLocalDb()
  const upsert = db.prepare(`
    INSERT INTO "Category" (id, "publicId", name, "createdAt", "updatedAt", "deletedAt")
    VALUES (@id, @publicId, @name, @createdAt, @updatedAt, @deletedAt)
    ON CONFLICT("publicId") DO UPDATE SET
      name        = excluded.name,
      "updatedAt" = excluded."updatedAt",
      "deletedAt" = excluded."deletedAt"
  `)

  const rows = data ?? []
  const toUpsert = rows.filter((row) => {
    const publicId = row.publicId ?? ''
    const remoteUpdatedAt = row.updatedAt ?? row.createdAt
    return !detectConflict(db, 'Category', publicId, remoteUpdatedAt, conflicts)
  })

  db.transaction((items: CategoryRemote[]) => {
    for (const row of items) {
      upsert.run({
        id: row.id,
        publicId: row.publicId ?? crypto.randomUUID(),
        name: row.name,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt ?? row.createdAt,
        deletedAt: row.deletedAt ?? null
      })
    }
  })(toUpsert)

  return { count: rows.length }
}

async function syncProducts(conflicts: SyncConflict[]): Promise<{ count: number }> {
  const { data, error } = await supabase.from('Product').select(`
    id, publicId, sku, barcode, name, price, cost, profitPctBp, stock,
    stockMin, stockMax, imagePath, taxRateBp, active, categoryId,
    createdAt, updatedAt, deletedAt
  `)

  if (error) throw new Error(`[sync:products] ${error.message}`)

  const db = getLocalDb()
  const upsert = db.prepare(`
    INSERT INTO "Product" (
      id, "publicId", sku, barcode, name, price, cost, "profitPctBp", stock,
      "stockMin", "stockMax", "imagePath", "taxRateBp", active,
      "categoryId", "createdAt", "updatedAt", "deletedAt"
    ) VALUES (
      @id, @publicId, @sku, @barcode, @name, @price, @cost, @profitPctBp, @stock,
      @stockMin, @stockMax, @imagePath, @taxRateBp, @active,
      @categoryId, @createdAt, @updatedAt, @deletedAt
    )
    ON CONFLICT("publicId") DO UPDATE SET
      sku           = excluded.sku,
      barcode       = excluded.barcode,
      name          = excluded.name,
      price         = excluded.price,
      cost          = excluded.cost,
      "profitPctBp" = excluded."profitPctBp",
      stock         = excluded.stock,
      "stockMin"    = excluded."stockMin",
      "stockMax"    = excluded."stockMax",
      "imagePath"   = excluded."imagePath",
      "taxRateBp"   = excluded."taxRateBp",
      active        = excluded.active,
      "categoryId"  = excluded."categoryId",
      "updatedAt"   = excluded."updatedAt",
      "deletedAt"   = excluded."deletedAt"
  `)

  const rows = data ?? []
  const toUpsert = rows.filter((product) => {
    const publicId = product.publicId ?? ''
    const remoteUpdatedAt = product.updatedAt ?? product.createdAt
    return !detectConflict(db, 'Product', publicId, remoteUpdatedAt, conflicts)
  })

  db.transaction((products: ProductRemote[]) => {
    for (const product of products) {
      upsert.run({
        ...product,
        publicId: product.publicId ?? crypto.randomUUID(),
        active: product.active ? 1 : 0,
        updatedAt: product.updatedAt ?? product.createdAt,
        deletedAt: product.deletedAt ?? null
      })
    }
  })(toUpsert)

  return { count: rows.length }
}

async function syncServices(conflicts: SyncConflict[]): Promise<{ count: number }> {
  const { data, error } = await supabase.from('Service').select('*')

  if (error) throw new Error(`[sync:services] ${error.message}`)

  const db = getLocalDb()
  const upsert = db.prepare(`
    INSERT INTO "Service" (
      id, "publicId", code, name, "durationMin", cost, price,
      "profitPctBp", active, "createdAt", "updatedAt", "deletedAt"
    ) VALUES (
      @id, @publicId, @code, @name, @durationMin, @cost, @price,
      @profitPctBp, @active, @createdAt, @updatedAt, @deletedAt
    )
    ON CONFLICT(code) DO UPDATE SET
      name          = excluded.name,
      "durationMin" = excluded."durationMin",
      cost          = excluded.cost,
      price         = excluded.price,
      "profitPctBp" = excluded."profitPctBp",
      active        = excluded.active,
      "updatedAt"   = excluded."updatedAt",
      "deletedAt"   = excluded."deletedAt"
  `)

  const now = new Date().toISOString()
  const rows = data ?? []
  const toUpsert = rows.filter((row) => {
    const publicId = row.publicId ?? ''
    const remoteUpdatedAt = row.updatedAt ?? row.createdAt ?? now
    return !detectConflict(db, 'Service', publicId, remoteUpdatedAt, conflicts)
  })

  db.transaction((items: ServiceRemote[]) => {
    for (const row of items) {
      upsert.run({
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
  })(toUpsert)

  return { count: rows.length }
}

async function syncServiceSupplies(): Promise<{ count: number }> {
  const { data, error } = await supabase.from('ServiceSupply').select('*')

  if (error) throw new Error(`[sync:serviceSupplies] ${error.message}`)

  const db = getLocalDb()

  const tx = db.transaction((rows: ServiceSupplyRemote[]) => {
    // Rebuild all supplies from scratch to avoid stale data
    db.prepare('DELETE FROM "ServiceSupply"').run()

    const insert = db.prepare(`
      INSERT OR IGNORE INTO "ServiceSupply" ("serviceId", "productId", qty)
      VALUES (@serviceId, @productId, @qty)
    `)

    for (const row of rows) {
      const serviceId = row.serviceId ?? row.service_id
      const productId = row.productId ?? row.product_id
      if (serviceId == null || productId == null) continue
      insert.run({ serviceId, productId, qty: row.qty })
    }
  })

  tx(data ?? [])
  return { count: data?.length ?? 0 }
}

// ─── IPC registration ─────────────────────────────────────────────────────────

export function registerSyncIpc(): void {
  ipcMain.handle('sync:pullProducts', async () => {
    const { count } = await syncProducts([])
    return { ok: true, count }
  })

  ipcMain.handle('sync:pushPending', async () => {
    const { pushed, failed } = await pushPending()
    return { ok: true, pushed, failed }
  })

  ipcMain.handle('sync:conflicts', () => lastConflicts)

  ipcMain.handle('sync:pullAll', async () => {
    const push = await pushPending()

    lastConflicts = []
    const conflicts = lastConflicts

    const [categories, products, services, serviceSupplies] = await Promise.all([
      syncCategories(conflicts),
      syncProducts(conflicts),
      syncServices(conflicts),
      syncServiceSupplies()
    ])

    return {
      ok: true,
      syncedAt: new Date().toISOString(),
      push,
      conflictCount: conflicts.length,
      counts: {
        categories: categories.count,
        products: products.count,
        services: services.count,
        serviceSupplies: serviceSupplies.count
      }
    }
  })
}
