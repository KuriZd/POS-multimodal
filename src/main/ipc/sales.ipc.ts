import { ipcMain } from 'electron'
import { getLocalDb } from '../db/local-db'

type SaleItemInput = {
  itemType: 'product' | 'service'
  productPublicId: string | null
  servicePublicId: string | null
  qty: number
  price: number
  discount: number
  lineTotal: number
}

type CreateSalePayload = {
  cashierId: number
  items: SaleItemInput[]
  subtotal: number
  tax: number
  total: number
  payment: {
    method: string
    amount: number
  }
}

function generateFolio(db: ReturnType<typeof getLocalDb>): string {
  const { count } = db.prepare(
    `SELECT COUNT(*) as count FROM "Sale"`
  ).get() as { count: number }
  return `VTA-${String(count + 1).padStart(5, '0')}`
}

export function registerSalesIpc(): void {
  ipcMain.handle('sales:create', (_event, payload: CreateSalePayload) => {
    const db = getLocalDb()
    const now = new Date().toISOString()
    const salePublicId = crypto.randomUUID()
    const folio = generateFolio(db)

    db.transaction(() => {
      db.prepare(`
        INSERT INTO "Sale" (
          "publicId", folio, status, subtotal, tax, total,
          "cashierId", "createdAt", "updatedAt"
        ) VALUES (?, ?, 'COMPLETED', ?, ?, ?, ?, ?, ?)
      `).run(salePublicId, folio, payload.subtotal, payload.tax, payload.total,
             payload.cashierId, now, now)

      const insertItem = db.prepare(`
        INSERT INTO "SaleItem" (
          "publicId", "salePublicId", "itemType",
          "productPublicId", "servicePublicId",
          qty, price, discount, "lineTotal", "createdAt", "updatedAt"
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      for (const item of payload.items) {
        insertItem.run(
          crypto.randomUUID(), salePublicId, item.itemType,
          item.productPublicId, item.servicePublicId,
          item.qty, item.price, item.discount, item.lineTotal,
          now, now
        )
      }

      db.prepare(`
        INSERT INTO "Payment" (
          "publicId", "salePublicId", method, amount, "createdAt", "updatedAt"
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).run(crypto.randomUUID(), salePublicId,
             payload.payment.method, payload.payment.amount, now, now)
    })()

    return { ok: true as const, folio, salePublicId }
  })
}
