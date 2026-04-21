import { ipcMain } from 'electron'
import { getLocalDb } from '../db/local-db'

type SaleItemInput = {
  itemType: 'product' | 'service' | 'PRODUCT' | 'SERVICE'
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
  payment: { method: string; amount: number }
}

type ProductSnap = {
  id: number; sku: string; barcode: string | null; name: string
  cost: number; taxRateBp: number; profitPctBp: number; categoryName: string | null
}
type ServiceSnap = {
  id: number; code: string; name: string
  cost: number; taxRateBp: number; profitPctBp: number
}

function generateFolio(db: ReturnType<typeof getLocalDb>): string {
  const { count } = db.prepare(`SELECT COUNT(*) as count FROM "Sale"`).get() as { count: number }
  return `VTA-${String(count + 1).padStart(5, '0')}`
}

export function registerSalesIpc(): void {
  ipcMain.handle('sales:create', (_event, payload: CreateSalePayload) => {
    const db = getLocalDb()
    const now = new Date().toISOString()
    const salePublicId = crypto.randomUUID()
    const folio = generateFolio(db)

    const productSnaps = new Map<string, ProductSnap>()
    const serviceSnaps = new Map<string, ServiceSnap>()

    for (const item of payload.items) {
      const type = item.itemType.toUpperCase()
      if (type === 'PRODUCT' && item.productPublicId && !productSnaps.has(item.productPublicId)) {
        const row = db.prepare(`
          SELECT p.id, p.sku, p.barcode, p.name, p.cost, p."taxRateBp", p."profitPctBp",
                 c.name AS categoryName
          FROM "Product" p
          LEFT JOIN "Category" c ON c.id = p."categoryId"
          WHERE p."publicId" = ? LIMIT 1
        `).get(item.productPublicId) as ProductSnap | undefined
        if (row) productSnaps.set(item.productPublicId, row)
      }
      if (type === 'SERVICE' && item.servicePublicId && !serviceSnaps.has(item.servicePublicId)) {
        const row = db.prepare(`
          SELECT id, code, name, cost, "taxRateBp", "profitPctBp"
          FROM "Service" WHERE "publicId" = ? LIMIT 1
        `).get(item.servicePublicId) as ServiceSnap | undefined
        if (row) serviceSnaps.set(item.servicePublicId, row)
      }
    }

    db.transaction(() => {
      db.prepare(`
        INSERT INTO "Sale" ("publicId", folio, status, subtotal, tax, total,
          "cashierId", "createdAt", "updatedAt")
        VALUES (?, ?, 'COMPLETED', ?, ?, ?, ?, ?, ?)
      `).run(salePublicId, folio, payload.subtotal, payload.tax, payload.total,
             payload.cashierId, now, now)

      const { id: saleId } = db.prepare(
        `SELECT id FROM "Sale" WHERE "publicId" = ?`
      ).get(salePublicId) as { id: number }

      const insertItem = db.prepare(`
        INSERT INTO "SaleItem" (
          "publicId","salePublicId","itemType",
          "productPublicId","servicePublicId","originalProductId","originalServiceId",
          qty,"unitPrice",discount,"lineTotal",
          "lineSubtotal","lineTax","lineCostTotal","lineProfit",
          "itemCodeSnapshot","itemNameSnapshot","itemCategorySnapshot",
          "itemSkuSnapshot","itemBarcodeSnapshot",
          "unitCostSnapshot","unitTaxRateBpSnapshot","unitProfitPctBpSnapshot",
          "inventoryTracked","createdAt","updatedAt"
        ) VALUES (?,?,?, ?,?,?,?, ?,?,?,?, ?,?,?,?, ?,?,?, ?,?, ?,?,?, ?,?,?)
      `)

      const insertMove = db.prepare(`
        INSERT INTO "InventoryMovement" (
          "productId","originalProductId","sourceType",qty,
          "stockBefore","stockAfter","userId","saleId","saleItemId",
          "productPublicIdSnapshot","productCodeSnapshot","productNameSnapshot",
          "unitCostSnapshot","createdAt"
        ) VALUES (?,?,'SALE',?, ?,?,?,?,?, ?,?,?, ?,?)
      `)

      const updateStock = db.prepare(
        `UPDATE "Product" SET stock = MAX(0, stock - ?), "updatedAt" = ? WHERE id = ?`
      )

      for (const item of payload.items) {
        const itemUid      = crypto.randomUUID()
        const type         = item.itemType.toUpperCase() as 'PRODUCT' | 'SERVICE'
        const lineSubtotal = item.lineTotal - (item.discount ?? 0)

        if (type === 'PRODUCT' && item.productPublicId) {
          const snap          = productSnaps.get(item.productPublicId)
          const lineCostTotal = (snap?.cost ?? 0) * item.qty
          const lineProfit    = item.lineTotal - lineCostTotal

          const { lastInsertRowid: saleItemId } = insertItem.run(
            itemUid, salePublicId, 'PRODUCT',
            item.productPublicId, null, snap?.id ?? null, null,
            item.qty, item.price, item.discount, item.lineTotal,
            lineSubtotal, 0, lineCostTotal, lineProfit,
            snap?.sku ?? null, snap?.name ?? null, snap?.categoryName ?? null,
            snap?.sku ?? null, snap?.barcode ?? null,
            snap?.cost ?? null, snap?.taxRateBp ?? null, snap?.profitPctBp ?? null,
            snap ? 1 : 0, now, now
          )

          if (snap) {
            const { stock: before } = db.prepare(
              `SELECT stock FROM "Product" WHERE id = ?`
            ).get(snap.id) as { stock: number }

            updateStock.run(item.qty, now, snap.id)

            const { stock: after } = db.prepare(
              `SELECT stock FROM "Product" WHERE id = ?`
            ).get(snap.id) as { stock: number }

            insertMove.run(
              snap.id, snap.id, item.qty,
              before, after, payload.cashierId, saleId, saleItemId,
              item.productPublicId, snap.sku, snap.name,
              snap.cost, now
            )
          }
        } else {
          const snap          = item.servicePublicId ? serviceSnaps.get(item.servicePublicId) : undefined
          const lineCostTotal = (snap?.cost ?? 0) * item.qty
          const lineProfit    = item.lineTotal - lineCostTotal

          insertItem.run(
            itemUid, salePublicId, 'SERVICE',
            null, item.servicePublicId, null, snap?.id ?? null,
            item.qty, item.price, item.discount, item.lineTotal,
            lineSubtotal, 0, lineCostTotal, lineProfit,
            snap?.code ?? null, snap?.name ?? null, null,
            null, null,
            snap?.cost ?? null, snap?.taxRateBp ?? null, snap?.profitPctBp ?? null,
            0, now, now
          )
        }
      }

      db.prepare(`
        INSERT INTO "Payment" ("publicId","salePublicId",method,amount,"createdAt","updatedAt")
        VALUES (?,?,?,?,?,?)
      `).run(crypto.randomUUID(), salePublicId,
             payload.payment.method, payload.payment.amount, now, now)
    })()

    return { ok: true as const, folio, salePublicId }
  })

  ipcMain.handle('sales:recent', (_event, limit = 30) => {
    const db = getLocalDb()
    type Row = {
      id: number; folio: string; createdAt: string
      total: number; subtotal: number; tax: number; status: string
      cashierName: string | null; itemCount: number; paymentMethod: string | null
    }
    const rows = db.prepare(`
      SELECT
        s.id, s.folio, s."createdAt" AS createdAt,
        s.total, s.subtotal, s.tax, s.status,
        u.name          AS cashierName,
        COUNT(si.id)    AS itemCount,
        p.method        AS paymentMethod
      FROM "Sale" s
      LEFT JOIN "User"     u  ON u.id  = s."cashierId"
      LEFT JOIN "SaleItem" si ON si."salePublicId" = s."publicId"
      LEFT JOIN "Payment"  p  ON p."salePublicId"  = s."publicId"
      GROUP BY s.id
      ORDER BY s."createdAt" DESC
      LIMIT ?
    `).all(limit) as Row[]

    return rows.map(r => ({
      id:            r.id,
      folio:         r.folio,
      createdAt:     r.createdAt,
      total:         r.total,
      subtotal:      r.subtotal,
      tax:           r.tax,
      status:        r.status,
      cashierName:   r.cashierName ?? '—',
      itemCount:     r.itemCount,
      paymentMethod: r.paymentMethod ?? '—',
    }))
  })
}
