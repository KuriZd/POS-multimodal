import { ipcMain } from 'electron'
import { getLocalDb } from '../db/local-db'

type ServiceRow = {
  id: number
  code: string
  name: string
  durationMin: number
  cost: number
  price: number
  profitPctBp: number
  active: number
  createdAt: string | null
}

type SupplyRow = {
  productId: number
  qty: number
}

type ServiceSupplyInput = {
  productId: number
  qty: number
}

type CreateServicePayload = {
  code: string
  name: string
  durationMin: number
  cost: number
  price: number
  profitPctBp: number
  supplies: ServiceSupplyInput[]
}

function mapService(row: ServiceRow, supplies: SupplyRow[]) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    durationMin: row.durationMin,
    cost: row.cost,
    price: row.price,
    profitPctBp: row.profitPctBp,
    active: Boolean(row.active),
    createdAt: row.createdAt,
    supplies
  }
}

function getSupplies(db: ReturnType<typeof getLocalDb>, serviceId: number): SupplyRow[] {
  return db.prepare(
    `SELECT "productId", qty FROM "ServiceSupply" WHERE "serviceId" = ?`
  ).all(serviceId) as SupplyRow[]
}

export function registerServicesIpc(): void {
  ipcMain.handle('services:get', (_event, id: number) => {
    const db = getLocalDb()
    const row = db.prepare(
      `SELECT id, code, name, "durationMin" as durationMin, cost, price,
              "profitPctBp" as profitPctBp, active, "createdAt" as createdAt
       FROM "Service" WHERE id = ? AND "deletedAt" IS NULL LIMIT 1`
    ).get(id) as ServiceRow | undefined

    if (!row) return null
    return mapService(row, getSupplies(db, row.id))
  })

  ipcMain.handle('services:getByCode', (_event, code: string) => {
    const db = getLocalDb()
    const row = db.prepare(
      `SELECT id, code, name, "durationMin" as durationMin, cost, price,
              "profitPctBp" as profitPctBp, active, "createdAt" as createdAt
       FROM "Service" WHERE code = ? AND "deletedAt" IS NULL LIMIT 1`
    ).get(code) as ServiceRow | undefined

    if (!row) return null
    return mapService(row, getSupplies(db, row.id))
  })

  ipcMain.handle('services:list', (_event, args: { page: number; pageSize: number; search?: string; active?: boolean }) => {
    const db = getLocalDb()
    const page = Math.max(1, args.page ?? 1)
    const pageSize = Math.max(1, args.pageSize ?? 20)
    const offset = (page - 1) * pageSize

    const conditions: string[] = ['"deletedAt" IS NULL']
    const params: Record<string, unknown> = { pageSize, offset }

    if (args.search?.trim()) {
      conditions.push(`(name LIKE '%' || @search || '%' OR code LIKE '%' || @search || '%')`)
      params.search = args.search.trim()
    }
    if (args.active !== undefined) {
      conditions.push('active = @active')
      params.active = args.active ? 1 : 0
    }

    const where = conditions.join(' AND ')
    const { count } = db.prepare(
      `SELECT COUNT(*) as count FROM "Service" WHERE ${where}`
    ).get(params) as { count: number }

    const items = db.prepare(
      `SELECT id, "publicId", code, name, "durationMin" as durationMin, cost, price,
              "profitPctBp" as profitPctBp, active, "createdAt" as createdAt
       FROM "Service" WHERE ${where} ORDER BY id DESC LIMIT @pageSize OFFSET @offset`
    ).all(params) as ServiceRow[]

    return {
      items: items.map((s) => ({ ...s, active: Boolean(s.active) })),
      total: count,
      page,
      pageSize
    }
  })

  ipcMain.handle('services:create', (_event, payload: CreateServicePayload) => {
    const db = getLocalDb()
    const now = new Date().toISOString()

    const result = db.prepare(
      `INSERT INTO "Service" (code, name, "durationMin", cost, price, "profitPctBp", active, "createdAt", "updatedAt")
       VALUES (@code, @name, @durationMin, @cost, @price, @profitPctBp, 1, @now, @now)`
    ).run({
      code: payload.code,
      name: payload.name,
      durationMin: payload.durationMin,
      cost: payload.cost,
      price: payload.price,
      profitPctBp: payload.profitPctBp,
      now
    })

    const serviceId = Number(result.lastInsertRowid)

    if (payload.supplies.length > 0) {
      const insertSupply = db.prepare(
        `INSERT OR REPLACE INTO "ServiceSupply" ("serviceId", "productId", qty) VALUES (?, ?, ?)`
      )
      db.transaction(() => {
        for (const s of payload.supplies) {
          insertSupply.run(serviceId, s.productId, s.qty)
        }
      })()
    }

    return { id: serviceId }
  })

  ipcMain.handle('services:update', (_event, id: number, payload: Partial<CreateServicePayload>) => {
    const db = getLocalDb()
    const now = new Date().toISOString()

    const sets: string[] = ['"updatedAt" = @now']
    const params: Record<string, unknown> = { id, now }

    if (payload.name !== undefined) { sets.push('name = @name'); params.name = payload.name }
    if (payload.code !== undefined) { sets.push('code = @code'); params.code = payload.code }
    if (payload.durationMin !== undefined) { sets.push('"durationMin" = @durationMin'); params.durationMin = payload.durationMin }
    if (payload.cost !== undefined) { sets.push('cost = @cost'); params.cost = payload.cost }
    if (payload.price !== undefined) { sets.push('price = @price'); params.price = payload.price }
    if (payload.profitPctBp !== undefined) { sets.push('"profitPctBp" = @profitPctBp'); params.profitPctBp = payload.profitPctBp }

    db.prepare(`UPDATE "Service" SET ${sets.join(', ')} WHERE id = @id`).run(params)

    if (payload.supplies !== undefined) {
      const supplies = payload.supplies
      db.transaction(() => {
        db.prepare(`DELETE FROM "ServiceSupply" WHERE "serviceId" = ?`).run(id)
        const insert = db.prepare(
          `INSERT INTO "ServiceSupply" ("serviceId", "productId", qty) VALUES (?, ?, ?)`
        )
        for (const s of supplies) {
          insert.run(id, s.productId, s.qty)
        }
      })()
    }

    return { id }
  })

  ipcMain.handle('services:remove', (_event, id: number) => {
    const db = getLocalDb()
    const now = new Date().toISOString()
    db.prepare(`UPDATE "Service" SET "deletedAt" = ?, "updatedAt" = ? WHERE id = ?`).run(now, now, id)
    return { ok: true }
  })
}
