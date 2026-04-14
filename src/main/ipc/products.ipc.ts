// ipc/products.ipc.ts
import { ipcMain } from 'electron';
import { getLocalDb } from '../db/local-db';

type ProductRow = {
  publicId: string;
  sku: string;
  barcode: string | null;
  name: string;
  price: number;
  stock: number;
  active: number;
};

export function registerProductsIpc(): void {
  ipcMain.handle('products:findByCode', async (_event, code: string) => {
    const db = getLocalDb();

    const row = db
      .prepare(
        `
        SELECT
          "publicId" as publicId,
          sku,
          barcode,
          name,
          price,
          stock,
          active
        FROM "Product"
        WHERE active = 1
          AND "deletedAt" IS NULL
          AND (sku = ? OR barcode = ?)
        LIMIT 1
        `
      )
      .get(code, code) as ProductRow | undefined;

    return row ?? null;
  });
}