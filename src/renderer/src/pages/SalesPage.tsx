import {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
  type ReactElement,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react'
import styles from './SalesPage.module.css'
import {
  FiSearch,
  FiFileText,
  FiClock,
  FiTrash2,
  FiPlus,
  FiMinus,
  FiShoppingBag,
  FiAlignLeft,
  FiChevronDown,
  FiChevronUp,
  FiRefreshCw,
} from 'react-icons/fi'
import {
  MdOutlineContentCopy,
  MdOutlinePrint,
  MdOutlineBookmarkBorder,
} from 'react-icons/md'
import { AiOutlineProduct } from 'react-icons/ai'
import { FaHandshake } from 'react-icons/fa'

// ─── Types ──────────────────────────────────────────────────────────────────

type ItemType = 'product' | 'service'
type FilterKey = 'none' | 'age' | 'alpha' | 'products' | 'services'
type PaymentMethod = 'efectivo' | 'tarjeta' | 'transferencia' | 'mixto'
type ServiceSize = 'carta' | 'oficio'

type CatalogItem = {
  id: number
  name: string
  price: number // pesos
  type: ItemType
  stock?: number
  sku?: string
  code?: string
  hasSize?: boolean // copia/impresión con opción de tamaño
}

type CartEntry = {
  uid: string
  itemId: number
  name: string
  price: number
  qty: number
  type: ItemType
  size?: ServiceSize
  expanded?: boolean
}

// ─── Mock Catalog ────────────────────────────────────────────────────────────

const CATALOG: CatalogItem[] = [
  { id: 1,   name: 'Cuaderno profesional',    price: 25,   type: 'product',  stock: 45,  sku: 'CUAD-001' },
  { id: 2,   name: 'Resma hojas blancas 500', price: 85,   type: 'product',  stock: 12,  sku: 'HOJA-500' },
  { id: 3,   name: 'Lápiz #2 Mirado',         price: 4,    type: 'product',  stock: 200, sku: 'LAP-002'  },
  { id: 4,   name: 'Pluma azul BIC',           price: 5,    type: 'product',  stock: 180, sku: 'PLU-001'  },
  { id: 5,   name: 'Colores Faber 12 pzas',   price: 45,   type: 'product',  stock: 30,  sku: 'COL-012'  },
  { id: 6,   name: 'Carpeta argollas',         price: 35,   type: 'product',  stock: 25,  sku: 'CARP-001' },
  { id: 7,   name: 'Tijeras escolares',        price: 18,   type: 'product',  stock: 3,   sku: 'TIJ-001'  },
  { id: 8,   name: 'Marcador permanente',      price: 12,   type: 'product',  stock: 75,  sku: 'MARC-001' },
  { id: 9,   name: 'Cartulina blanca',         price: 8,    type: 'product',  stock: 100, sku: 'CART-001' },
  { id: 10,  name: 'Folder Manila c/10',       price: 20,   type: 'product',  stock: 40,  sku: 'FOLD-010' },
  { id: 11,  name: 'Regla 30 cm',              price: 10,   type: 'product',  stock: 80,  sku: 'REGL-030' },
  { id: 12,  name: 'Calculadora básica',       price: 120,  type: 'product',  stock: 15,  sku: 'CALC-001' },
  { id: 13,  name: 'Pegamento UHU 21g',        price: 15,   type: 'product',  stock: 55,  sku: 'PEG-021'  },
  { id: 14,  name: 'Post-it 3×3 100 hojas',   price: 28,   type: 'product',  stock: 35,  sku: 'POST-001' },
  { id: 15,  name: 'Borrador blanco',          price: 3,    type: 'product',  stock: 2,   sku: 'BOR-001'  },
  { id: 16,  name: 'Cinta adhesiva',           price: 9,    type: 'product',  stock: 60,  sku: 'CINT-001' },
  { id: 17,  name: 'Corrector líquido',        price: 14,   type: 'product',  stock: 45,  sku: 'CORR-001' },
  { id: 18,  name: 'Engrapadora chica',        price: 55,   type: 'product',  stock: 20,  sku: 'ENGR-001' },
  { id: 101, name: 'Copia B/N',               price: 1.50, type: 'service',  code: 'SVC-COPY-BN',  hasSize: true },
  { id: 102, name: 'Copia color',             price: 5,    type: 'service',  code: 'SVC-COPY-COL', hasSize: true },
  { id: 103, name: 'Impresión B/N',           price: 3,    type: 'service',  code: 'SVC-IMP-BN',   hasSize: true },
  { id: 104, name: 'Impresión color',         price: 8,    type: 'service',  code: 'SVC-IMP-COL',  hasSize: true },
  { id: 105, name: 'Engargolado',             price: 25,   type: 'service',  code: 'SVC-EGAR'  },
  { id: 106, name: 'Enmicado carta',          price: 15,   type: 'service',  code: 'SVC-ENMIC' },
  { id: 107, name: 'Escaneo',                 price: 5,    type: 'service',  code: 'SVC-SCAN',    hasSize: true },
  { id: 108, name: 'Plastificado',            price: 20,   type: 'service',  code: 'SVC-PLAST' },
  { id: 109, name: 'Recarga tóner',           price: 80,   type: 'service',  code: 'SVC-RECAR' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number): string =>
  n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })

const uid = (): string => Math.random().toString(36).slice(2)

function nowStr(): { date: string; time: string } {
  const d = new Date()
  const date = d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  const time = d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  return { date, time }
}

// ─── Sub-components ──────────────────────────────────────────────────────────

type SalesHeaderProps = {
  search: string
  onSearch: (v: string) => void
  onSearchKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void
  searchRef: React.RefObject<HTMLInputElement | null>
  cashierName: string
}

function SalesHeader({ search, onSearch, onSearchKeyDown, searchRef, cashierName }: SalesHeaderProps): ReactElement {
  const [clock, setClock] = useState(nowStr())

  useEffect(() => {
    const id = setInterval(() => setClock(nowStr()), 30_000)
    return () => clearInterval(id)
  }, [])

  return (
    <header className={styles.header}>
      <div className={styles.searchWrap}>
        <FiSearch size={18} className={styles.searchIcon} />
        <input
          ref={searchRef}
          type="text"
          className={styles.searchInput}
          placeholder="Buscar producto, servicio, SKU o escanear código…"
          value={search}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onSearch(e.target.value)}
          onKeyDown={onSearchKeyDown}
          autoFocus
        />
        {search && (
          <button className={styles.searchClear} onClick={() => onSearch('')} aria-label="Limpiar">
            ×
          </button>
        )}
      </div>

      <div className={styles.headerRight}>
        <button className={styles.headerBtn}>
          <MdOutlineBookmarkBorder size={16} />
          Cotización
        </button>
        <button className={styles.headerBtn}>
          <FiClock size={16} />
          Historial
        </button>
        <div className={styles.headerMeta}>
          <span className={styles.cashierName}>{cashierName}</span>
          <span className={styles.metaSep}>·</span>
          <span className={styles.metaDate}>{clock.date}</span>
          <span className={styles.metaSep}>·</span>
          <span className={styles.metaTime}>{clock.time}</span>
        </div>
      </div>
    </header>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

type SalesFiltersProps = {
  active: FilterKey
  onChange: (k: FilterKey) => void
  total: number
  filtered: number
}

const FILTERS: { key: FilterKey; label: string; icon: ReactElement }[] = [
  { key: 'none',     label: 'Todos',          icon: <FiAlignLeft size={13} /> },
  { key: 'age',      label: 'Recientes',       icon: <FiClock size={13} /> },
  { key: 'alpha',    label: 'A–Z',             icon: <span style={{ fontSize: 11, fontWeight: 700 }}>Az</span> },
  { key: 'products', label: 'Solo productos',  icon: <AiOutlineProduct size={13} /> },
  { key: 'services', label: 'Solo servicios',  icon: <FaHandshake size={12} /> },
]

function SalesFilters({ active, onChange, total, filtered }: SalesFiltersProps): ReactElement {
  return (
    <div className={styles.filtersBar}>
      <div className={styles.filterChips}>
        {FILTERS.map(({ key, label, icon }) => (
          <button
            key={key}
            className={`${styles.filterChip} ${active === key ? styles.filterChipActive : ''}`}
            onClick={() => onChange(key)}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>
      <span className={styles.filterCount}>
        {filtered} de {total}
      </span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

type ProductCardProps = {
  item: CatalogItem
  onAdd: (item: CatalogItem) => void
}

function ProductCard({ item, onAdd }: ProductCardProps): ReactElement {
  const lowStock = item.type === 'product' && item.stock !== undefined && item.stock <= 5
  const outStock = item.type === 'product' && item.stock === 0

  return (
    <button
      className={`${styles.card} ${item.type === 'service' ? styles.cardService : ''} ${outStock ? styles.cardOut : ''}`}
      onClick={() => !outStock && onAdd(item)}
      disabled={outStock}
      title={outStock ? 'Sin existencias' : `Agregar ${item.name}`}
    >
      <div className={styles.cardTop}>
        <div className={`${styles.cardBadge} ${item.type === 'service' ? styles.cardBadgeSvc : styles.cardBadgeProd}`}>
          {item.type === 'service'
            ? <><FaHandshake size={10} /> Servicio</>
            : <><AiOutlineProduct size={10} /> Producto</>}
        </div>
        {lowStock && !outStock && (
          <span className={styles.cardLowStock}>Stock bajo</span>
        )}
        {outStock && (
          <span className={styles.cardOutStock}>Sin stock</span>
        )}
      </div>

      <p className={styles.cardName}>{item.name}</p>
      <p className={styles.cardSku}>{item.sku ?? item.code}</p>

      <div className={styles.cardBottom}>
        <span className={styles.cardPrice}>{fmt(item.price)}</span>
        {item.type === 'product' && item.stock !== undefined && (
          <span className={`${styles.cardStock} ${lowStock ? styles.cardStockLow : ''}`}>
            {item.stock} pzas
          </span>
        )}
        {item.type === 'service' && (
          <span className={styles.cardPerUnit}>por hoja</span>
        )}
      </div>

      <div className={styles.cardAddBtn}>
        <FiPlus size={14} />
      </div>
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

type CartRowProps = {
  entry: CartEntry
  onQtyChange: (uid: string, delta: number) => void
  onRemove: (uid: string) => void
  onToggleExpand: (uid: string) => void
  onSizeChange: (uid: string, size: ServiceSize) => void
}

function CartRow({ entry, onQtyChange, onRemove, onToggleExpand, onSizeChange }: CartRowProps): ReactElement {
  const catalogItem = CATALOG.find(c => c.id === entry.itemId)
  const hasSize = catalogItem?.hasSize ?? false

  return (
    <div className={`${styles.cartRow} ${entry.type === 'service' ? styles.cartRowSvc : ''}`}>
      <div className={styles.cartRowMain}>
        <div className={styles.cartRowInfo}>
          <span className={styles.cartRowName}>{entry.name}</span>
          <span className={styles.cartRowUnit}>{fmt(entry.price)} c/u</span>
        </div>

        <div className={styles.cartRowControls}>
          <button className={styles.qtyBtn} onClick={() => onQtyChange(entry.uid, -1)} aria-label="Reducir">
            <FiMinus size={12} />
          </button>
          <span className={styles.qtyValue}>{entry.qty}</span>
          <button className={styles.qtyBtn} onClick={() => onQtyChange(entry.uid, +1)} aria-label="Aumentar">
            <FiPlus size={12} />
          </button>
        </div>

        <div className={styles.cartRowRight}>
          <span className={styles.cartRowSubtotal}>{fmt(entry.price * entry.qty)}</span>
          <div className={styles.cartRowActions}>
            {hasSize && (
              <button
                className={styles.expandBtn}
                onClick={() => onToggleExpand(entry.uid)}
                aria-label="Opciones"
                title="Opciones de servicio"
              >
                {entry.expanded ? <FiChevronUp size={13} /> : <FiChevronDown size={13} />}
              </button>
            )}
            <button className={styles.removeBtn} onClick={() => onRemove(entry.uid)} aria-label="Eliminar">
              <FiTrash2 size={13} />
            </button>
          </div>
        </div>
      </div>

      {entry.expanded && hasSize && (
        <div className={styles.cartRowParams}>
          <span className={styles.paramsLabel}>Tamaño:</span>
          {(['carta', 'oficio'] as ServiceSize[]).map(s => (
            <button
              key={s}
              className={`${styles.paramChip} ${entry.size === s ? styles.paramChipActive : ''}`}
              onClick={() => onSizeChange(entry.uid, s)}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function EmptyCart(): ReactElement {
  return (
    <div className={styles.emptyCart}>
      <div className={styles.emptyCartIcon}>
        <FiShoppingBag size={36} />
      </div>
      <p className={styles.emptyCartTitle}>Sin artículos</p>
      <p className={styles.emptyCartSub}>Busca o selecciona productos y servicios del catálogo para agregarlos a la venta.</p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

type PaymentSectionProps = {
  method: PaymentMethod
  total: number
  cashReceived: string
  onMethodChange: (m: PaymentMethod) => void
  onCashChange: (v: string) => void
  onCharge: () => void
  disabled: boolean
}

const METHODS: { key: PaymentMethod; label: string }[] = [
  { key: 'efectivo',      label: 'Efectivo'      },
  { key: 'tarjeta',       label: 'Tarjeta'       },
  { key: 'transferencia', label: 'Transferencia' },
  { key: 'mixto',         label: 'Mixto'         },
]

function PaymentSection({
  method, total, cashReceived, onMethodChange, onCashChange, onCharge, disabled
}: PaymentSectionProps): ReactElement {
  const received = parseFloat(cashReceived) || 0
  const change = received - total

  return (
    <div className={styles.paySection}>
      <div className={styles.methodTabs}>
        {METHODS.map(m => (
          <button
            key={m.key}
            className={`${styles.methodTab} ${method === m.key ? styles.methodTabActive : ''}`}
            onClick={() => onMethodChange(m.key)}
          >
            {m.label}
          </button>
        ))}
      </div>

      {method === 'efectivo' && (
        <div className={styles.cashFields}>
          <div className={styles.cashField}>
            <label className={styles.cashLabel}>Monto recibido</label>
            <div className={styles.cashInputWrap}>
              <span className={styles.cashPrefix}>$</span>
              <input
                type="number"
                className={styles.cashInput}
                value={cashReceived}
                onChange={(e) => onCashChange(e.target.value)}
                placeholder="0.00"
                min={0}
                step={0.50}
              />
            </div>
          </div>
          {received > 0 && (
            <div className={`${styles.changeRow} ${change < 0 ? styles.changeNeg : styles.changePos}`}>
              <span>{change < 0 ? 'Faltan' : 'Cambio'}</span>
              <span className={styles.changeAmount}>{fmt(Math.abs(change))}</span>
            </div>
          )}
        </div>
      )}

      {method === 'mixto' && (
        <div className={styles.cashFields}>
          <p className={styles.mixtoNote}>Ingresa el monto en efectivo; el resto se cobra a tarjeta.</p>
          <div className={styles.cashField}>
            <label className={styles.cashLabel}>Efectivo</label>
            <div className={styles.cashInputWrap}>
              <span className={styles.cashPrefix}>$</span>
              <input
                type="number"
                className={styles.cashInput}
                value={cashReceived}
                onChange={(e) => onCashChange(e.target.value)}
                placeholder="0.00"
                min={0}
                step={0.50}
              />
            </div>
          </div>
          {received > 0 && (
            <div className={styles.changeRow}>
              <span>Tarjeta</span>
              <span className={styles.changeAmount}>{fmt(Math.max(0, total - received))}</span>
            </div>
          )}
        </div>
      )}

      <button
        className={styles.chargeBtn}
        onClick={onCharge}
        disabled={disabled}
      >
        Cobrar {!disabled && fmt(total)}
      </button>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function SalesPage(): ReactElement {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterKey>('none')
  const [cart, setCart] = useState<CartEntry[]>([])
  const [payMethod, setPayMethod] = useState<PaymentMethod>('efectivo')
  const [cashReceived, setCashReceived] = useState('')
  const [discount, setDiscount] = useState(0)
  const [notes, setNotes] = useState('')
  const [notesOpen, setNotesOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  // ── Catalog filtering ────────────────────────────────────────

  const filtered = useMemo<CatalogItem[]>(() => {
    let items = CATALOG

    const q = search.trim().toLowerCase()
    if (q) {
      items = items.filter(
        i =>
          i.name.toLowerCase().includes(q) ||
          (i.sku?.toLowerCase().includes(q) ?? false) ||
          (i.code?.toLowerCase().includes(q) ?? false)
      )
    }

    if (filter === 'products') items = items.filter(i => i.type === 'product')
    if (filter === 'services') items = items.filter(i => i.type === 'service')

    const copy = [...items]
    if (filter === 'alpha') copy.sort((a, b) => a.name.localeCompare(b.name, 'es'))
    if (filter === 'age') copy.sort((a, b) => b.id - a.id)

    return copy
  }, [search, filter])

  // ── Cart ops ─────────────────────────────────────────────────

  const addToCart = useCallback((item: CatalogItem) => {
    setCart(prev => {
      const existing = prev.find(e => e.itemId === item.id)
      if (existing) {
        return prev.map(e => e.uid === existing.uid ? { ...e, qty: e.qty + 1 } : e)
      }
      return [...prev, {
        uid: uid(),
        itemId: item.id,
        name: item.name,
        price: item.price,
        qty: 1,
        type: item.type,
        size: item.hasSize ? 'carta' : undefined,
        expanded: false,
      }]
    })
  }, [])

  const changeQty = useCallback((entryUid: string, delta: number) => {
    setCart(prev =>
      prev
        .map(e => e.uid === entryUid ? { ...e, qty: e.qty + delta } : e)
        .filter(e => e.qty > 0)
    )
  }, [])

  const removeEntry = useCallback((entryUid: string) => {
    setCart(prev => prev.filter(e => e.uid !== entryUid))
  }, [])

  const toggleExpand = useCallback((entryUid: string) => {
    setCart(prev => prev.map(e => e.uid === entryUid ? { ...e, expanded: !e.expanded } : e))
  }, [])

  const changeSize = useCallback((entryUid: string, size: ServiceSize) => {
    setCart(prev => prev.map(e => e.uid === entryUid ? { ...e, size } : e))
  }, [])

  const clearCart = useCallback(() => {
    setCart([])
    setCashReceived('')
    setDiscount(0)
    setNotes('')
  }, [])

  // ── Totals ───────────────────────────────────────────────────

  const subtotal = useMemo(() => cart.reduce((acc, e) => acc + e.price * e.qty, 0), [cart])
  const tax = useMemo(() => Math.round(subtotal * 0.16 * 100) / 100, [subtotal])
  const total = useMemo(() => subtotal + tax - discount, [subtotal, tax, discount])

  // ── Keyboard shortcut: Escape clears search ──────────────────
  const handleSearchKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') setSearch('')
  }, [])

  const handleCharge = useCallback(() => {
    if (cart.length === 0) return
    alert(`Venta procesada por ${fmt(total)}`)
    clearCart()
  }, [cart, total, clearCart])

  // ── Render ───────────────────────────────────────────────────

  return (
    <div className={styles.page}>
      <SalesHeader
        search={search}
        onSearch={setSearch}
        onSearchKeyDown={handleSearchKeyDown}
        searchRef={searchRef}
        cashierName="Oscar Z."
      />

      <div className={styles.body}>
        {/* ── Left: catalog ──────────────────────────────────── */}
        <section className={styles.catalogPanel}>
          <SalesFilters
            active={filter}
            onChange={setFilter}
            total={CATALOG.length}
            filtered={filtered.length}
          />

          {filtered.length === 0 ? (
            <div className={styles.noResults}>
              <FiSearch size={28} />
              <p>Sin resultados para <strong>"{search}"</strong></p>
              <button className={styles.noResultsReset} onClick={() => { setSearch(''); setFilter('none') }}>
                Limpiar filtros
              </button>
            </div>
          ) : (
            <div className={styles.grid}>
              {filtered.map(item => (
                <ProductCard key={item.id} item={item} onAdd={addToCart} />
              ))}
            </div>
          )}
        </section>

        {/* ── Right: sale detail ─────────────────────────────── */}
        <aside className={styles.salePanel}>
          <div className={styles.salePanelHeader}>
            <span className={styles.salePanelTitle}>Detalle de venta</span>
            {cart.length > 0 && (
              <button className={styles.clearCartBtn} onClick={clearCart} title="Vaciar carrito">
                <FiRefreshCw size={13} />
                Limpiar
              </button>
            )}
          </div>

          {/* Cart list */}
          <div className={styles.cartList}>
            {cart.length === 0
              ? <EmptyCart />
              : cart.map(entry => (
                <CartRow
                  key={entry.uid}
                  entry={entry}
                  onQtyChange={changeQty}
                  onRemove={removeEntry}
                  onToggleExpand={toggleExpand}
                  onSizeChange={changeSize}
                />
              ))
            }
          </div>

          {/* Notes */}
          <div className={styles.notesSection}>
            <button
              className={styles.notesToggle}
              onClick={() => setNotesOpen(o => !o)}
            >
              <FiFileText size={13} />
              {notesOpen ? 'Ocultar notas' : 'Agregar nota'}
              {notesOpen ? <FiChevronUp size={12} /> : <FiChevronDown size={12} />}
            </button>
            {notesOpen && (
              <textarea
                className={styles.notesInput}
                placeholder="Observaciones de la venta, instrucciones especiales…"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
              />
            )}
          </div>

          {/* Summary */}
          <div className={styles.summary}>
            <div className={styles.summaryRow}>
              <span>Subtotal</span>
              <span>{fmt(subtotal)}</span>
            </div>
            <div className={styles.summaryRow}>
              <span>IVA (16%)</span>
              <span>{fmt(tax)}</span>
            </div>
            <div className={styles.summaryRow}>
              <span>
                Descuento
                <button
                  className={styles.discountToggle}
                  onClick={() => {
                    const v = prompt('Descuento en pesos:', String(discount))
                    if (v !== null) setDiscount(Math.max(0, parseFloat(v) || 0))
                  }}
                >
                  Editar
                </button>
              </span>
              <span className={styles.discountVal}>-{fmt(discount)}</span>
            </div>
            <div className={styles.summaryTotal}>
              <span>Total</span>
              <span>{fmt(total)}</span>
            </div>
          </div>

          {/* Payment */}
          <PaymentSection
            method={payMethod}
            total={total}
            cashReceived={cashReceived}
            onMethodChange={setPayMethod}
            onCashChange={setCashReceived}
            onCharge={handleCharge}
            disabled={cart.length === 0}
          />
        </aside>
      </div>
    </div>
  )
}
