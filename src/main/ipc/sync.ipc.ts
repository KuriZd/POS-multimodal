// ipc/sync.ip.ts
import { ipcMain } from 'electron';
import { getLocalDb } from '../db/local-db';
import { supabase } from '../supabase/client';

type ProductRemote = {
  id: number;
  publicId?: string;
  sku: string;
  barcode: string | null;
  name: string;
  price: number;
  cost: number;
  profitPctBp: number;
  stock: number;
  stockMin: number;
  stockMax: number;
  imagePath: string | null;
  taxRateBp: number;
  active: boolean;
  categoryId: number | null;
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string | null;
};

export function registerSyncIpc(): void {
  ipcMain.handle('sync:pullProducts', async () => {
    const { data, error } = await supabase
      .from('Product')
      .select(`
        id,
        publicId,
        sku,
        barcode,
        name,
        price,
        cost,
        profitPctBp,
        stock,
        stockMin,
        stockMax,
        imagePath,
        taxRateBp,
        active,
        categoryId,
        createdAt,
        updatedAt,
        deletedAt
      `);

    if (error) {
      throw new Error(error.message);
    }

    const db = getLocalDb();

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
        sku = excluded.sku,
        barcode = excluded.barcode,
        name = excluded.name,
        price = excluded.price,
        cost = excluded.cost,
        "profitPctBp" = excluded."profitPctBp",
        stock = excluded.stock,
        "stockMin" = excluded."stockMin",
        "stockMax" = excluded."stockMax",
        "imagePath" = excluded."imagePath",
        "taxRateBp" = excluded."taxRateBp",
        active = excluded.active,
        "categoryId" = excluded."categoryId",
        "updatedAt" = excluded."updatedAt",
        "deletedAt" = excluded."deletedAt"
    `);

    const tx = db.transaction((products: ProductRemote[]) => {
      for (const product of products) {
        upsert.run({
          ...product,
          publicId: product.publicId ?? crypto.randomUUID(),
          active: product.active ? 1 : 0,
          updatedAt: product.updatedAt ?? product.createdAt,
          deletedAt: product.deletedAt ?? null
        });
      }
    });

    tx(data ?? []);

    return {
      ok: true,
      count: data?.length ?? 0
    };
  });
}