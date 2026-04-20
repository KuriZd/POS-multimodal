export const localSchema = `
CREATE TABLE IF NOT EXISTS "User" (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  "passwordHashLocal" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastRemoteLoginAt" TEXT,
  "deletedAt" TEXT
);

CREATE INDEX IF NOT EXISTS idx_user_username
  ON "User"(username);

CREATE TABLE IF NOT EXISTS "Product" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  "publicId" TEXT NOT NULL UNIQUE,
  sku TEXT NOT NULL UNIQUE,
  barcode TEXT UNIQUE,
  name TEXT NOT NULL,
  price INTEGER NOT NULL,
  cost INTEGER NOT NULL DEFAULT 0,
  "profitPctBp" INTEGER NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  "stockMin" INTEGER NOT NULL DEFAULT 0,
  "stockMax" INTEGER NOT NULL DEFAULT 0,
  "imagePath" TEXT,
  "taxRateBp" INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  "categoryId" INTEGER,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL,
  "deletedAt" TEXT
);

CREATE TABLE IF NOT EXISTS "Category" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  "publicId" TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL,
  "deletedAt" TEXT
);

CREATE TABLE IF NOT EXISTS "Sale" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  "publicId" TEXT NOT NULL UNIQUE,
  folio TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  subtotal INTEGER NOT NULL,
  tax INTEGER NOT NULL,
  total INTEGER NOT NULL,
  "cashierId" INTEGER NOT NULL,
  "originDeviceId" TEXT,
  "syncedAt" TEXT,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "SaleItem" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  "publicId" TEXT NOT NULL UNIQUE,
  "salePublicId" TEXT NOT NULL,
  "itemType" TEXT NOT NULL,
  "productPublicId" TEXT,
  "servicePublicId" TEXT,
  qty INTEGER NOT NULL,
  price INTEGER NOT NULL,
  discount INTEGER NOT NULL DEFAULT 0,
  "lineTotal" INTEGER NOT NULL,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "Payment" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  "publicId" TEXT NOT NULL UNIQUE,
  "salePublicId" TEXT NOT NULL,
  method TEXT NOT NULL,
  amount INTEGER NOT NULL,
  reference TEXT,
  "originDeviceId" TEXT,
  "syncedAt" TEXT,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "Service" (
  id INTEGER PRIMARY KEY,
  "publicId" TEXT UNIQUE,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  "durationMin" INTEGER NOT NULL DEFAULT 0,
  cost INTEGER NOT NULL DEFAULT 0,
  price INTEGER NOT NULL DEFAULT 0,
  "profitPctBp" INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  "createdAt" TEXT,
  "updatedAt" TEXT,
  "deletedAt" TEXT
);

CREATE INDEX IF NOT EXISTS idx_service_code ON "Service"(code);

CREATE TABLE IF NOT EXISTS "ServiceSupply" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  "serviceId" INTEGER NOT NULL,
  "productId" INTEGER NOT NULL,
  qty INTEGER NOT NULL DEFAULT 1,
  UNIQUE("serviceId", "productId"),
  FOREIGN KEY("serviceId") REFERENCES "Service"(id) ON DELETE CASCADE,
  FOREIGN KEY("productId") REFERENCES "Product"(id)
);

CREATE TABLE IF NOT EXISTS sync_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_name TEXT NOT NULL,
  entity_public_id TEXT NOT NULL,
  action TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  retries INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS device_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL UNIQUE,
  device_name TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_product_code ON "Product"(sku, barcode);
CREATE INDEX IF NOT EXISTS idx_product_active ON "Product"(active, "deletedAt");
CREATE INDEX IF NOT EXISTS idx_sale_cashier ON "Sale"("cashierId");
CREATE INDEX IF NOT EXISTS idx_sale_item_sale ON "SaleItem"("salePublicId");
CREATE INDEX IF NOT EXISTS idx_payment_sale ON "Payment"("salePublicId");
CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
CREATE INDEX IF NOT EXISTS idx_sync_queue_entity ON sync_queue(entity_name, status);
`
