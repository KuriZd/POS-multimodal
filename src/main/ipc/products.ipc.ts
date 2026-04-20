import { ipcMain } from 'electron'
import { getLocalDb } from '../db/local-db'

type ProductRow = {
  id: number
  publicId: string
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
  active: number
}

type CreateProductPayload = {
  sku: string
  name: string
  price: number
  cost: number
  profitPctBp: number
  stock: number
  stockMin: number
  stockMax: number
  imageDataUrl: string | null
}

const SELECT_COLUMNS = `
  id, "publicId", sku, barcode, name, price, cost,
  "profitPctBp" as profitPctBp, stock,
  "stockMin" as stockMin, "stockMax" as stockMax,
  "imagePath" as imagePath, "taxRateBp" as taxRateBp, active
`

function mapRow(row: ProductRow) {
  return { ...row, active: Boolean(row.active) }
}

export function registerProductsIpc(): void {
  ipcMain.handle('products:findByCode', (_event, code: string) => {
    const db = getLocalDb()
    const row = db.prepare(`
      SELECT "publicId" as publicId, sku, barcode, name, price, stock, active
      FROM "Product"
      WHERE active = 1 AND "deletedAt" IS NULL AND (sku = ? OR barcode = ?)
      LIMIT 1
    `).get(code, code) as ProductRow | undefined
    return row ?? null
  })

  ipcMain.handle('products:get', (_event, id: number) => {
    const db = getLocalDb()
    const row = db.prepare(`
      SELECT ${SELECT_COLUMNS} FROM "Product"
      WHERE id = ? AND "deletedAt" IS NULL LIMIT 1
    `).get(id) as ProductRow | undefined
    return row ? mapRow(row) : null
  })

  ipcMain.handle('products:getBySku', (_event, sku: string) => {
    const db = getLocalDb()
    const row = db.prepare(`
      SELECT ${SELECT_COLUMNS} FROM "Product"
      WHERE sku = ? AND "deletedAt" IS NULL LIMIT 1
    `).get(sku) as ProductRow | undefined
    return row ? mapRow(row) : null
  })

  ipcMain.handle('products:list', (_event, args: { page: number; pageSize: number; search?: string; active?: boolean }) => {
    const db = getLocalDb()
    const page = Math.max(1, args.page ?? 1)
    const pageSize = Math.max(1, args.pageSize ?? 20)
    const offset = (page - 1) * pageSize

    const conditions: string[] = ['"deletedAt" IS NULL']
    const params: Record<string, unknown> = { pageSize, offset }

    if (args.search?.trim()) {
      conditions.push(
        `(name LIKE '%' || @search || '%' OR sku LIKE '%' || @search || '%' OR barcode LIKE '%' || @search || '%')`
      )
      params.search = args.search.trim()
    }
    if (args.active !== undefined) {
      conditions.push('active = @active')
      params.active = args.active ? 1 : 0
    }

    const where = conditions.join(' AND ')

    const { count } = db.prepare(
      `SELECT COUNT(*) as count FROM "Product" WHERE ${where}`
    ).get(params) as { count: number }

    const items = db.prepare(`
      SELECT ${SELECT_COLUMNS} FROM "Product"
      WHERE ${where} ORDER BY id DESC LIMIT @pageSize OFFSET @offset
    `).all(params) as ProductRow[]

    return { items: items.map(mapRow), total: count, page, pageSize }
  })

  ipcMain.handle('products:create', (_event, payload: CreateProductPayload) => {
    const db = getLocalDb()
    const now = new Date().toISOString()
    const publicId = crypto.randomUUID()

    const result = db.prepare(`
      INSERT INTO "Product" (
        "publicId", sku, name, price, cost, "profitPctBp",
        stock, "stockMin", "stockMax", "imagePath", active, "createdAt", "updatedAt"
      ) VALUES (
        @publicId, @sku, @name, @price, @cost, @profitPctBp,
        @stock, @stockMin, @stockMax, @imagePath, 1, @now, @now
      )
    `).run({
      publicId,
      sku: payload.sku,
      name: payload.name,
      price: payload.price,
      cost: payload.cost,
      profitPctBp: payload.profitPctBp,
      stock: payload.stock,
      stockMin: payload.stockMin,
      stockMax: payload.stockMax,
      imagePath: payload.imageDataUrl ?? null,
      now
    })

    return { id: Number(result.lastInsertRowid) }
  })

  ipcMain.handle('products:update', (_event, id: number, payload: Partial<CreateProductPayload>) => {
    const db = getLocalDb()
    const now = new Date().toISOString()
    const sets: string[] = ['"updatedAt" = @now']
    const params: Record<string, unknown> = { id, now }

    if (payload.sku !== undefined)        { sets.push('sku = @sku');                      params.sku = payload.sku }
    if (payload.name !== undefined)       { sets.push('name = @name');                    params.name = payload.name }
    if (payload.price !== undefined)      { sets.push('price = @price');                  params.price = payload.price }
    if (payload.cost !== undefined)       { sets.push('cost = @cost');                    params.cost = payload.cost }
    if (payload.profitPctBp !== undefined){ sets.push('"profitPctBp" = @profitPctBp');   params.profitPctBp = payload.profitPctBp }
    if (payload.stock !== undefined)      { sets.push('stock = @stock');                  params.stock = payload.stock }
    if (payload.stockMin !== undefined)   { sets.push('"stockMin" = @stockMin');          params.stockMin = payload.stockMin }
    if (payload.stockMax !== undefined)   { sets.push('"stockMax" = @stockMax');          params.stockMax = payload.stockMax }
    if (payload.imageDataUrl !== undefined){ sets.push('"imagePath" = @imagePath');       params.imagePath = payload.imageDataUrl }

    db.prepare(`UPDATE "Product" SET ${sets.join(', ')} WHERE id = @id AND "deletedAt" IS NULL`).run(params)
    return { id }
  })

  ipcMain.handle('products:remove', (_event, id: number) => {
    const db = getLocalDb()
    const now = new Date().toISOString()
    db.prepare(`
      UPDATE "Product" SET "deletedAt" = ?, "updatedAt" = ?, active = 0
      WHERE id = ? AND "deletedAt" IS NULL
    `).run(now, now, id)
    return { ok: true as const }
  })
}
