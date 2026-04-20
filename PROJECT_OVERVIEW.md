# POS Multimodal — Project Overview

Documento de referencia para desarrollo de la app móvil companion.  
App de escritorio (Electron + React) con sincronización a Supabase (PostgreSQL remoto) y SQLite local.

---

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Desktop framework | Electron 39.2.6 |
| UI | React 19.2.1 + TypeScript 5.9.3 |
| Build | Vite 7.2.6 + electron-vite |
| DB local | SQLite 3 (better-sqlite3 12.9.0) |
| DB remota / sync | Supabase (PostgreSQL) |
| Auth | bcryptjs 3.0.3 (hashing local) + Supabase RPC |
| Estilos | CSS Modules |
| Utilidades | qrcode.react, react-icons, dotenv |
| Empaquetado | electron-builder 26.0.12 |

---

## Estructura de Carpetas

```
src/
├── main/                          # Proceso principal de Electron
│   ├── index.ts                   # Entrada, creación de ventana, registro de IPC
│   ├── db/
│   │   ├── local-db.ts            # Inicialización SQLite (WAL, FK habilitados)
│   │   └── local-schema.ts        # Esquema SQL completo
│   ├── ipc/
│   │   ├── auth.ipc.ts            # IPC: login, me, logout
│   │   ├── products.ipc.ts        # IPC: findByCode (búsqueda por barcode/SKU)
│   │   └── sync.ipc.ts            # IPC: pullProducts, pullAll (Supabase → SQLite)
│   └── supabase/
│       └── client.ts              # Cliente Supabase (solo RPC, sin sesión de usuario)
├── preload/
│   ├── index.ts                   # Context bridge → window.pos
│   └── index.d.ts                 # Tipos del API de Electron expuesto al renderer
└── renderer/src/
    ├── App.tsx                    # Raíz: chequeo de auth → LoginPage | AppLayout
    ├── env.d.ts                   # Tipos globales (AuthUser, AppRole, Window.pos)
    ├── pages/
    │   ├── LoginPage.tsx          # Formulario usuario/contraseña
    │   ├── DashboardPage.tsx      # Bienvenida, scanner barcode, sync manual
    │   ├── ProductsPage.tsx       # CRUD productos y servicios con paginación
    │   ├── SalesPage.tsx          # Interfaz POS: catálogo, carrito, cobro
    │   └── InventoryPage.tsx      # Placeholder — gestión de stock (pendiente)
    ├── components/
    │   ├── layout/
    │   │   ├── AppLayout.tsx      # Layout principal: Sidebar + TopNav + contenido
    │   │   ├── Sidebar.tsx        # Menú lateral (colapso, roles)
    │   │   ├── TopNav.tsx         # Cabecera: sync status, info de usuario
    │   │   └── layout.types.ts    # Tipos: AppSection, SidebarMenuItem
    │   ├── services/
    │   │   ├── AddProductModal.tsx     # Modal crear/editar producto + QR
    │   │   └── AddServicesModal.tsx    # Modal crear/editar servicio + insumos
    │   └── FiltersDropdown/       # Dropdown reutilizable de filtros/orden
    ├── hooks/
    │   ├── useBarcodeScanner.ts   # Buffer de teclado para lectores de barcode (100ms)
    │   └── useSync.ts             # Auto-sync cada 6 horas, rastrea en localStorage
    ├── repositories/
    │   ├── productRepository.ts   # CRUD productos: local primero, fallback remoto
    │   └── serviceRepository.ts   # CRUD servicios: local primero, fallback remoto
    ├── lib/
    │   └── supabaseClient.ts      # Cliente Supabase (proceso renderer)
    └── types/
        └── pos.d.ts               # Tipos compartidos (payloads, respuestas API)
```

---

## Esquema de Base de Datos (SQLite local, espejado en Supabase)

### User
```sql
id, username (unique), name,
role TEXT CHECK(role IN ('ADMIN','CASHIER','SUPERVISOR')),
active, passwordHashLocal, createdAt, updatedAt,
lastRemoteLoginAt, deletedAt
```

### Product
```sql
id, publicId (UUID), sku (unique), barcode, name,
price INT,        -- centavos (2500 = $25.00 MXN)
cost INT,
profitPctBp INT,  -- basis points (1000 = 10%)
stock INT, stockMin INT, stockMax INT,
imagePath TEXT, taxRateBp INT, active,
categoryId → Category.id,
createdAt, updatedAt, syncedAt, deletedAt
-- Index: (sku, barcode) para búsqueda rápida
```

### Category
```sql
id, publicId, name (unique), createdAt, updatedAt, syncedAt, deletedAt
```

### Sale
```sql
id, publicId (unique), folio (unique),
status TEXT CHECK(status IN ('open','paid','cancelled','refunded')),
subtotal INT, tax INT, total INT,
cashierId → User.id,
originDeviceId, syncedAt, createdAt, updatedAt
```

### SaleItem
```sql
id, publicId (unique), salePublicId → Sale.publicId,
itemType TEXT CHECK(itemType IN ('product','service')),
productPublicId, servicePublicId,
qty INT, price INT, discount INT, lineTotal INT,
createdAt, updatedAt
```

### Payment
```sql
id, publicId (unique), salePublicId → Sale.publicId,
method TEXT CHECK(method IN ('efectivo','tarjeta','transferencia','mixto')),
amount INT, reference TEXT,
originDeviceId, syncedAt, createdAt, updatedAt
```

### sync_queue
```sql
id, entity_name, entity_public_id,
action TEXT CHECK(action IN ('INSERT','UPDATE','DELETE')),
payload_json TEXT,
status TEXT DEFAULT 'PENDING',
retries INT DEFAULT 0, last_error TEXT,
created_at, updated_at
-- Index: (status)
```

### device_config
```sql
id, device_id (unique), device_name, created_at
```

**Nota de precios:** Todos los montos se almacenan en **centavos enteros** (ej: `2500` = $25.00 MXN).

---

## Flujo de Autenticación

```
LoginPage → window.pos.auth.login(username, password)
     ↓
[Main Process] Busca User en SQLite
     ├─ passwordHashLocal existe → bcrypt.verify()
     │      ✓ → devuelve AuthUser { id, name, role }
     │      ✗ → fallback remoto ↓
     └─ Sin hash local → supabase.rpc('pos_login', { p_username, p_password })
               ✓ → UPSERT en SQLite + hashea contraseña localmente
               ✗ → null (credenciales inválidas)

Sesión: objeto currentUser en memoria del proceso main
App.tsx llama window.pos.auth.me() al montar para restaurar sesión
Logout: limpia currentUser → regresa a LoginPage
```

**Roles y acceso:**

| Rol | Secciones disponibles |
|-----|-----------------------|
| ADMIN | dashboard, products, inventory, sales |
| SUPERVISOR | dashboard, products, inventory, sales |
| CASHIER | sales (solo POS) |

---

## IPC Channels (Main ↔ Renderer)

El API expuesto en `window.pos`:

```typescript
window.pos.auth.login(username, password)    // → AuthUser | null
window.pos.auth.me()                         // → AuthUser | null
window.pos.auth.logout()                     // → { ok: true }

window.pos.products.findByCode(code)         // → ProductLookup | null
window.pos.products.list(filters?)           // → Product[]
window.pos.products.create(payload)          // → Product
window.pos.products.update(id, payload)      // → Product
window.pos.products.get(id)                  // → Product | null
window.pos.products.remove(id)               // → { ok: true }

window.pos.services.list/create/update/get/remove  // mismo patrón

window.pos.sync.pullProducts()               // → { ok, count }
window.pos.sync.pullAll()                    // → { ok, syncedAt, products }
```

---

## Estrategia de Sincronización

- **Local-first:** SQLite es la fuente principal de verdad en el desktop.
- **Pull desde Supabase:** `sync:pullAll` hace UPSERT masivo por `publicId`.
- **Auto-sync:** cada 6 horas si la app está corriendo (hook `useSync`, rastrea timestamp en `localStorage` bajo clave `pos:lastSyncAt`).
- **sync_queue:** tabla para operaciones pendientes de subir (INSERT/UPDATE/DELETE) — actualmente el push no está implementado en el frontend.
- **Conflictos:** resolución por `publicId` con SQLite `INSERT OR REPLACE`.

---

## Funcionalidades por Sección

### Dashboard
- Bienvenida personalizada con nombre del usuario
- Scanner de barcode (lee input de teclado, buffer 100ms)
- Vista rápida del producto escaneado (nombre, SKU, precio, stock)
- Botón de sincronización manual

### Productos
- Tabs: **Productos** / **Servicios**
- Lista paginada (10/20/50/100 por página)
- Búsqueda por nombre, SKU, barcode, código
- Orden: Alfabético, Recientes, Stock
- Indicador de fuente de datos (Local / Supabase)
- Modal crear/editar:
  - Producto: Código, Nombre, Precio compra, Precio venta, Stock, Min/Max, % Ganancia, QR, imagen
  - Servicio: Código, Nombre, Duración (min), Costo, Precio, % Ganancia, Insumos (productos con cantidades)
- Eliminación lógica (`active = false`)

### Ventas (POS)
- Panel izquierdo — Catálogo:
  - Cards de producto con nombre, precio, stock
  - Alerta visual de stock bajo (≤ 5) y agotado
  - Filtros: Todos, Recientes, A–Z, Solo Productos, Solo Servicios
- Panel derecho — Detalle de venta:
  - Carrito con controles de cantidad (+/−) y eliminación
  - Notas colapsables
  - Resumen: Subtotal, IVA (16%), Descuento, Total
- Sección de cobro:
  - Tabs: Efectivo, Tarjeta, Transferencia, Mixto
  - Efectivo: monto recibido → calcula cambio automáticamente
  - Mixto: divide entre efectivo + tarjeta

### Inventario
- Placeholder. Planificado: consultas de stock, entradas/salidas, ajustes manuales, historial, alertas de stock bajo.

---

## Variables de Entorno

```env
# Proceso main (Electron)
SUPABASE_URL=https://qkgntycnhdalelpydbpq.supabase.co
SUPABASE_ANON_KEY=...

# Proceso renderer (Vite, prefijo VITE_)
VITE_SUPABASE_URL=https://qkgntycnhdalelpydbpq.supabase.co
VITE_SUPABASE_ANON_KEY=...
```

---

## Puntos de Integración para la App Móvil

La app móvil puede conectarse **directamente al mismo proyecto Supabase**:

1. **Auth:** Usar el mismo RPC `pos_login(p_username, p_password)` o implementar Supabase Auth nativo.
2. **Productos/Servicios/Categorías:** Leer directamente de las tablas de Supabase.
3. **Ventas:** Insertar `Sale`, `SaleItem`, `Payment` con un `originDeviceId` único del dispositivo móvil.
4. **Offline:** Implementar SQLite local en móvil con la misma estrategia de `sync_queue`.
5. **Barcode:** La cámara del móvil reemplaza al lector de teclado — misma lógica de búsqueda por `sku` o `barcode`.
6. **Roles:** Respetar la misma lógica de acceso por rol (CASHIER solo ventas, ADMIN todo).

### Tablas Supabase relevantes para móvil
- `Product` — catálogo completo
- `Category` — categorías de productos
- `Service` + `ServiceSupply` — servicios y sus insumos
- `Sale` + `SaleItem` + `Payment` — transacciones
- `User` — autenticación vía RPC

---

## Configuración de Build

- **AppID:** `com.electron.app`
- **Nombre:** `pos-damian`
- **Windows:** Instalador NSIS con acceso directo en escritorio
- **macOS:** Permisos: cámara, micrófono, Documents, Downloads
- **Linux:** AppImage, snap, deb
- **DB local path:** `app.getPath('userData')/data/pos-local.db`
- **Módulos nativos sin sandbox:** `node_modules/better-sqlite3/**/*.node`

---

## Seguridad Electron

| Config | Valor |
|--------|-------|
| contextIsolation | `true` |
| nodeIntegration | `false` |
| sandbox | `false` (requerido por better-sqlite3) |
| Preload | Carga el context bridge antes del renderer |
| CSP | Permite WebSocket de Supabase + URLs blob para imágenes |
