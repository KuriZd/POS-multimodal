// src/renderer/src/views/services/AddServicesModal.tsx
import { useCallback, useEffect, useMemo, useRef, useState, type JSX, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { FiX, FiSave, FiHelpCircle, FiMinusCircle, FiPlusCircle } from 'react-icons/fi'
import { MdOutlineQrCode2 } from 'react-icons/md'
import { CiBarcode } from 'react-icons/ci'
import { QRCodeSVG } from 'qrcode.react'
import styles from './AddServicesModal.module.css'
import {
  serviceRepository,
  type CreateServicePayload,
  type ServiceSupplyInput,
  type ServiceDetails
} from '../../repositories/serviceRepository'
import { supabase } from '../../lib/supabaseClient'

type Props = {
  open: boolean
  onClose: () => void
  serviceId?: number | null
  serviceID?: number | null
}

type FormState = {
  code: string
  name: string
  durationMin: string
  buyPrice: string
  sellPrice: string
  profitPct: string
}

const initialState: FormState = {
  code: '',
  name: '',
  durationMin: '',
  buyPrice: '',
  sellPrice: '',
  profitPct: ''
}

type PriceEditMode = 'sell' | 'pct' | null
type DataSource = 'local' | 'supabase'

function useEscapeToClose(open: boolean, onClose: () => void): void {
  useEffect(() => {
    if (!open) return

    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])
}

function getCryptoRandomInt(maxExclusive: number): number {
  if (maxExclusive <= 0) return 0

  const hasCrypto = typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function'
  if (!hasCrypto) return Math.floor(Math.random() * maxExclusive)

  const range = 0xffffffff
  const limit = range - (range % maxExclusive)
  const buffer = new Uint32Array(1)

  let x = 0
  do {
    crypto.getRandomValues(buffer)
    x = buffer[0]
  } while (x >= limit)

  return x % maxExclusive
}

function generate8DigitCode(): string {
  const value = getCryptoRandomInt(100_000_000)
  return String(value).padStart(8, '0')
}

function parseDecimal(input: string): number | null {
  const raw = input.trim()
  if (!raw) return null
  const normalized = raw.replace(/\s+/g, '').replace(/,/g, '.')
  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}

function parseInteger(input: string): number | null {
  const raw = input.trim()
  if (!raw) return null
  const n = Number(raw)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

function formatNumber(n: number, decimals = 2): string {
  const fixed = n.toFixed(decimals)
  return fixed.replace(/\.?0+$/g, '')
}

function computeProfitPct(buy: number, sell: number): number | null {
  if (!(buy > 0)) return null
  return ((sell - buy) / buy) * 100
}

function computeSellPrice(buy: number, pct: number): number | null {
  if (!(buy > 0)) return null
  return buy * (1 + pct / 100)
}

function toCents(value: number): number {
  return Math.round(value * 100)
}

function fromCentsToInput(cents: number): string {
  return formatNumber((cents ?? 0) / 100, 2)
}

function pctToBp(pct: number): number {
  return Math.round(pct * 100)
}

function bpToPctInput(bp: number): string {
  return formatNumber((bp ?? 0) / 100, 2)
}

const QR_DOWNLOAD_SIZE = 512

function buildQrPayload(code: string, name: string): string {
  return JSON.stringify({ v: 1, type: 'service', code, name })
}

function sanitizeFilenamePart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 40)
}

function nextAnimationFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}

function getSvgMarkup(svg: SVGElement, size: number): string {
  const clone = svg.cloneNode(true) as SVGElement
  if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', String(size))
  clone.setAttribute('height', String(size))
  return new XMLSerializer().serializeToString(clone)
}

async function downloadQrSvgAsPng(svg: SVGElement, filename: string, size: number): Promise<void> {
  const markup = getSvgMarkup(svg, size)
  const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`

  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('No se pudo preparar el QR para descarga'))
    img.src = svgDataUrl
  })

  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo generar el QR (canvas no disponible)')

  ctx.drawImage(img, 0, 0, size, size)

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('No se pudo generar el PNG'))),
      'image/png'
    )
  })

  const url = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
  } finally {
    URL.revokeObjectURL(url)
  }
}

function suppliesMapToArray(map: Record<number, number>): ServiceSupplyInput[] {
  return Object.entries(map)
    .map(([id, qty]) => ({ productId: Number(id), qty }))
    .filter((x) => Number.isFinite(x.productId) && x.qty > 0)
}

function suppliesArrayToMap(arr: ServiceSupplyInput[] | undefined): Record<number, number> {
  const out: Record<number, number> = {}
  for (const s of arr ?? []) {
    if (!Number.isFinite(s.productId) || s.qty <= 0) continue
    out[s.productId] = s.qty
  }
  return out
}

type ProductPickItem = {
  id: number
  name: string
  stock: number | null
  cost: number
}

type ProductsListResult = {
  items: ProductPickItem[]
  total: number
  page: number
  pageSize: number
}

type ProductsBridge = {
  list?: (args: { search: string; page: number; pageSize: number }) => Promise<ProductsListResult>
}

type ServiceLookup = ServiceDetails & {
  source: DataSource
}

function getProductsBridge(): ProductsBridge | null {
  const w = window as unknown as { pos?: { products?: ProductsBridge } }
  return w.pos?.products ?? null
}

function normalizeProductFromSupabase(row: Record<string, unknown>): ProductPickItem {
  return {
    id: Number(row.id ?? 0),
    name: String(row.name ?? ''),
    stock: row.stock == null ? null : Number(row.stock),
    cost: Number(row.cost ?? row.buy_price ?? row.buyPrice ?? 0)
  }
}

async function fetchProductsFromSupabase(
  search: string,
  page: number,
  pageSize: number
): Promise<ProductsListResult> {
  let query = supabase
    .from('Product')
    .select('*', { count: 'exact' })
    .eq('active', true)
    .order('id', { ascending: true })
    .range((page - 1) * pageSize, page * pageSize - 1)

  const term = search.trim()
  if (term) {
    query = query.or(`name.ilike.%${term}%,sku.ilike.%${term}%,barcode.ilike.%${term}%`)
  }

  const { data, count, error } = await query

  if (error) throw error

  const rows = Array.isArray(data) ? data : []

  return {
    items: rows.map((row) => normalizeProductFromSupabase(row as Record<string, unknown>)),
    total: count ?? rows.length,
    page,
    pageSize
  }
}

function normalizeServiceFromSupabase(
  row: Record<string, unknown>,
  supplies: ServiceSupplyInput[] = []
): ServiceLookup {
  return {
    id: Number(row.id ?? 0),
    code: String(row.code ?? row.sku ?? ''),
    name: String(row.name ?? ''),
    durationMin: Number(row.durationMin ?? row.duration_min ?? 0),
    cost: Number(row.cost ?? row.buy_price ?? row.buyPrice ?? 0),
    price: Number(row.price ?? row.sell_price ?? row.sellPrice ?? 0),
    profitPctBp: Number(row.profitPctBp ?? row.profit_pct_bp ?? 0),
    supplies,
    source: 'supabase'
  }
}

async function fetchSupabaseServiceSupplies(serviceId: number): Promise<ServiceSupplyInput[]> {
  const attempts = [
    { table: 'service_supplies', filterKey: 'service_id', productKey: 'product_id' },
    { table: 'service_supplies', filterKey: 'serviceId', productKey: 'productId' },
    { table: 'serviceSupplies', filterKey: 'service_id', productKey: 'product_id' },
    { table: 'serviceSupplies', filterKey: 'serviceId', productKey: 'productId' }
  ] as const

  for (const attempt of attempts) {
    const { data, error } = await supabase
      .from(attempt.table)
      .select('*')
      .eq(attempt.filterKey, serviceId)

    if (error) continue

    const rows = Array.isArray(data) ? data : []
    return rows
      .map((row) => ({
        productId: Number((row as Record<string, unknown>)[attempt.productKey] ?? 0),
        qty: Number((row as Record<string, unknown>).qty ?? 0)
      }))
      .filter((item) => Number.isFinite(item.productId) && item.qty > 0)
  }

  return []
}

async function fetchServiceFromSupabase(serviceId: number): Promise<ServiceLookup> {
  const { data, error } = await supabase
    .from('Service')
    .select('*')
    .eq('id', serviceId)
    .maybeSingle()

  if (error || !data) {
    throw error ?? new Error('No se encontró el servicio en Supabase')
  }

  const supplies = await fetchSupabaseServiceSupplies(serviceId)
  return normalizeServiceFromSupabase(data as Record<string, unknown>, supplies)
}

async function getServiceByCodeFromSupabase(code: string): Promise<ServiceLookup | null> {
  const normalized = code.trim()
  if (!normalized) return null

  const { data, error } = await supabase
    .from('Service')
    .select('*')
    .eq('code', normalized)
    .maybeSingle()

  if (error || !data) return null

  return normalizeServiceFromSupabase(data as Record<string, unknown>)
}

type ModalShellProps = {
  onClose: () => void
  children: JSX.Element
}

function ModalShell({ onClose, children }: ModalShellProps): JSX.Element {
  function handleBackdropMouseDown(e: MouseEvent<HTMLDivElement>): void {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div
      className={styles.backdrop}
      onMouseDown={handleBackdropMouseDown}
      role="dialog"
      aria-modal="true"
    >
      {children}
    </div>
  )
}

type ModalHeaderProps = {
  title: string
  onClose: () => void
}

function ModalHeader({ title, onClose }: ModalHeaderProps): JSX.Element {
  return (
    <div className={styles.header}>
      <h3 className={styles.title}>{title}</h3>

      <button className={styles.closeBtn} type="button" onClick={onClose} aria-label="Cerrar">
        <FiX />
      </button>
    </div>
  )
}

type SaveFooterProps = {
  onSave: () => void | Promise<void>
  disabled?: boolean
}

function SaveFooter({ onSave, disabled }: SaveFooterProps): JSX.Element {
  return (
    <div className={styles.footer}>
      <button className={styles.saveBtn} type="button" onClick={onSave} disabled={disabled}>
        <span>{disabled ? 'Guardando...' : 'Guardar'}</span>
        <FiSave />
      </button>
    </div>
  )
}

type AlertKind = 'error' | 'warning'
type AlertMessage = { kind: AlertKind; text: string; key: string }

function AlertsBottom({ alerts }: { alerts: AlertMessage[] }): JSX.Element | null {
  if (!alerts.length) return null

  return (
    <div
      style={{ padding: '0 16px', marginTop: 12, display: 'grid', gap: 6 }}
      role="status"
      aria-live="polite"
    >
      {alerts.map((a) => (
        <div
          key={a.key}
          style={{
            fontSize: 12,
            color: a.kind === 'error' ? 'crimson' : '#b45309'
          }}
        >
          {a.text}
        </div>
      ))}
    </div>
  )
}

type InsumosModalProps = {
  open: boolean
  initialSelected: Record<number, number>
  onClose: () => void
  onApply: (nextSelected: Record<number, number>, computedCostCents: number) => void
}

function InsumosModal({
  open,
  initialSelected,
  onClose,
  onApply
}: InsumosModalProps): JSX.Element | null {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize] = useState(6)

  const [items, setItems] = useState<ProductPickItem[]>([])
  const [total, setTotal] = useState(0)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [selected, setSelected] = useState<Record<number, number>>({})
  const [cacheById, setCacheById] = useState<Record<number, ProductPickItem>>({})

  useEffect(() => {
    if (!open) return
    setSelected(initialSelected)
    setSearch('')
    setPage(1)
    setError(null)
  }, [open, initialSelected])

  useEffect(() => {
    if (!open) return

    const productsApi = getProductsBridge()
    const list = productsApi?.list

    let cancelled = false
    setLoading(true)
    setError(null)

    void (async () => {
      try {
        let result: ProductsListResult | null = null

        if (typeof list === 'function') {
          try {
            const localResult = await list({ search: search.trim(), page, pageSize })
            result = localResult

            if (localResult.total === 0 && localResult.items.length === 0) {
              result = await fetchProductsFromSupabase(search, page, pageSize)
            }
          } catch {
            result = await fetchProductsFromSupabase(search, page, pageSize)
          }
        } else {
          result = await fetchProductsFromSupabase(search, page, pageSize)
        }

        if (cancelled || !result) return

        setItems(result.items)
        setTotal(result.total)

        setCacheById((prev) => {
          const next = { ...prev }
          for (const p of result.items) next[p.id] = p
          return next
        })
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'No se pudieron cargar los insumos'
        setError(msg)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, search, page, pageSize])

  const pages = Math.max(1, Math.ceil(total / pageSize))

  const computedCostCents = useMemo(() => {
    let sum = 0
    for (const [idStr, qty] of Object.entries(selected)) {
      const id = Number(idStr)
      if (!Number.isFinite(id) || qty <= 0) continue
      const p = cacheById[id]
      if (!p) continue
      sum += p.cost * qty
    }
    return sum
  }, [selected, cacheById])

  function setQty(productId: number, qty: number): void {
    setSelected((prev) => {
      const next = { ...prev }
      if (qty <= 0) {
        delete next[productId]
        return next
      }
      next[productId] = qty
      return next
    })
  }

  function handleApply(): void {
    onApply(selected, computedCostCents)
    onClose()
  }

  function handleBackdropMouseDown(e: MouseEvent<HTMLDivElement>): void {
    if (e.target === e.currentTarget) onClose()
  }

  if (!open) return null

  return createPortal(
    <div
      className={styles.backdrop}
      onMouseDown={handleBackdropMouseDown}
      role="dialog"
      aria-modal="true"
    >
      <div className={styles.modalSmall}>
        <ModalHeader title="Insumos" onClose={onClose} />

        <div className={styles.body}>
          <div
            style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '0 16px' }}
          >
            <input
              className={styles.input}
              style={{ maxWidth: 340 }}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Buscar producto..."
            />

            <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', color: '#111827' }}>
              <span style={{ color: '#6b7280' }}>Coste operativo:</span>
              <strong>${(computedCostCents / 100).toFixed(2)}</strong>
            </div>
          </div>

          {loading ? <div style={{ padding: '10px 16px', opacity: 0.75 }}>Cargando...</div> : null}

          {error ? <div style={{ padding: '10px 16px', color: 'crimson' }}>{error}</div> : null}

          <div style={{ padding: '14px 16px' }}>
            <div
              style={{
                background: '#fff',
                borderRadius: 16,
                overflow: 'hidden',
                boxShadow: '0 10px 20px rgba(0,0,0,.10)'
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 70px 110px',
                  padding: '10px 14px',
                  background: '#dbe9ff',
                  fontWeight: 700,
                  color: '#1e2a45'
                }}
              >
                <div>Nombre</div>
                <div style={{ textAlign: 'center' }}>Stock</div>
                <div style={{ textAlign: 'center' }}>Cantidad</div>
              </div>

              <div style={{ display: 'grid' }}>
                {items.map((p) => {
                  const qty = selected[p.id] ?? 0
                  const stockText = p.stock === null ? 'N/A' : String(p.stock)

                  return (
                    <div
                      key={p.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 70px 110px',
                        padding: '10px 14px',
                        borderTop: '1px solid #e5e7eb',
                        alignItems: 'center',
                        color: '#111827'
                      }}
                    >
                      <div style={{ fontSize: 18 }}>{p.name}</div>
                      <div style={{ textAlign: 'center' }}>{stockText}</div>

                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'center',
                          gap: 12,
                          alignItems: 'center'
                        }}
                      >
                        <button
                          type="button"
                          className={styles.iconBtn}
                          onClick={() => setQty(p.id, qty - 1)}
                          disabled={qty <= 0}
                          aria-label="Disminuir"
                          title="Disminuir"
                        >
                          <FiMinusCircle />
                        </button>

                        <span style={{ minWidth: 18, textAlign: 'center' }}>{qty}</span>

                        <button
                          type="button"
                          className={styles.iconBtn}
                          onClick={() => setQty(p.id, qty + 1)}
                          aria-label="Aumentar"
                          title="Aumentar"
                        >
                          <FiPlusCircle />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 12 }}>
              <button
                className={styles.iconBtn}
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                aria-label="Anterior"
                title="Anterior"
              >
                {'<'}
              </button>

              <span style={{ color: '#6b7280' }}>
                {page} / {pages}
              </span>

              <button
                className={styles.iconBtn}
                type="button"
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                disabled={page >= pages}
                aria-label="Siguiente"
                title="Siguiente"
              >
                {'>'}
              </button>
            </div>
          </div>

          <SaveFooter onSave={handleApply} disabled={loading} />
        </div>
      </div>
    </div>,
    document.body
  )
}

type ServiceFormProps = {
  form: FormState
  setField: <K extends keyof FormState>(key: K, value: FormState[K]) => void
  onGenerateCode: () => void
  onDownloadQr: () => void
  onCodeBlur: () => void
  onBuyPriceChange: (value: string) => void
  onSellPriceChange: (value: string) => void
  onProfitPctChange: (value: string) => void
  onOpenInsumos: () => void
  suppliesCount: number
}

function ServiceForm({
  form,
  setField,
  onGenerateCode,
  onDownloadQr,
  onCodeBlur,
  onBuyPriceChange,
  onSellPriceChange,
  onProfitPctChange,
  onOpenInsumos,
  suppliesCount
}: ServiceFormProps): JSX.Element {
  return (
    <div className={styles.form}>
      <div className={styles.row2}>
        <div className={styles.field}>
          <label className={styles.label}>Código de Producto</label>

          <div className={styles.codeWrap}>
            <input
              className={styles.input}
              value={form.code}
              onChange={(e) => setField('code', e.target.value)}
              onBlur={onCodeBlur}
              placeholder=""
            />

            <div className={styles.codeActions}>
              <button
                className={styles.iconBtn}
                type="button"
                aria-label="Generar código"
                data-tooltip="Generar código"
                title="Generar código"
                onClick={onGenerateCode}
              >
                <CiBarcode />
              </button>

              <button
                className={styles.iconBtn}
                type="button"
                aria-label="Generar QR"
                data-tooltip="Generar QR"
                title="Generar QR"
                onClick={onDownloadQr}
              >
                <MdOutlineQrCode2 />
              </button>

              <button
                className={styles.iconBtn}
                type="button"
                aria-label="Ayuda"
                data-tooltip="Ayuda"
                title="Ayuda"
              >
                <FiHelpCircle />
              </button>
            </div>
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Nombre del Servicio</label>
          <input
            className={styles.input}
            value={form.name}
            onChange={(e) => setField('name', e.target.value)}
            placeholder=""
          />
        </div>
      </div>

      <div className={styles.row4}>
        <div className={styles.stackCol}>
          <div className={styles.field}>
            <label className={styles.label}>Coste Operativo</label>
            <input
              className={styles.input}
              value={form.buyPrice}
              onChange={(e) => onBuyPriceChange(e.target.value)}
              inputMode="decimal"
            />
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Precio venta</label>
          <input
            className={styles.input}
            value={form.sellPrice}
            onChange={(e) => onSellPriceChange(e.target.value)}
            inputMode="decimal"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Porcentaje de ganancia</label>
          <input
            className={styles.input}
            value={form.profitPct}
            onChange={(e) => onProfitPctChange(e.target.value)}
            inputMode="decimal"
          />
        </div>

        <div className={styles.insumosWrap}>
          <button
            className={styles.insumosBtn}
            type="button"
            onClick={onOpenInsumos}
            aria-label="Insumos"
            title="Insumos"
          >
            Insumos{suppliesCount > 0 ? ` (${suppliesCount})` : ''} <FiPlusCircle />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AddServiceModal({
  open,
  onClose,
  serviceId,
  serviceID
}: Props): JSX.Element | null {
  const effectiveServiceId = serviceId ?? serviceID ?? null
  const isEditMode = Boolean(effectiveServiceId)

  const [form, setForm] = useState<FormState>(initialState)
  const [priceEditMode, setPriceEditMode] = useState<PriceEditMode>(null)

  const [isSaving, setIsSaving] = useState(false)
  const [isLoadingService, setIsLoadingService] = useState(false)

  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveInfo, setSaveInfo] = useState<string | null>(null)
  const [skuError, setSkuError] = useState<string | null>(null)
  const [sellPriceError, setSellPriceError] = useState<string | null>(null)

  const [insumosOpen, setInsumosOpen] = useState(false)
  const [suppliesMap, setSuppliesMap] = useState<Record<number, number>>({})
  const [serviceSource, setServiceSource] = useState<DataSource | null>(null)

  const [qrDownloadValue, setQrDownloadValue] = useState('')
  const qrRenderRef = useRef<HTMLDivElement | null>(null)

  const closeAll = useCallback(() => {
    setSaveError(null)
    setSaveInfo(null)
    setSkuError(null)
    setSellPriceError(null)
    setIsSaving(false)
    setIsLoadingService(false)
    setInsumosOpen(false)
    setServiceSource(null)
    onClose()
  }, [onClose])

  const handleEscape = useCallback(() => {
    if (insumosOpen) {
      setInsumosOpen(false)
      return
    }
    closeAll()
  }, [insumosOpen, closeAll])

  useEscapeToClose(open, handleEscape)

  useEffect(() => {
    if (!open) return

    setSaveError(null)
    setSaveInfo(null)
    setSkuError(null)
    setSellPriceError(null)
    setQrDownloadValue('')
    setPriceEditMode(null)
    setSuppliesMap({})
    setServiceSource(null)

    if (!effectiveServiceId) {
      setForm(initialState)
      return
    }

    let cancelled = false
    setIsLoadingService(true)

    void (async () => {
      try {
        let service: ServiceLookup | null = null

        try {
          const localService = await serviceRepository.get(effectiveServiceId)
          service = { ...localService, source: 'local' }
        } catch {
          service = await fetchServiceFromSupabase(effectiveServiceId)
        }

        if (cancelled || !service) return

        setForm({
          code: service.code ?? '',
          name: service.name ?? '',
          durationMin: String(service.durationMin ?? 0),
          buyPrice: fromCentsToInput(service.cost ?? 0),
          sellPrice: fromCentsToInput(service.price ?? 0),
          profitPct: bpToPctInput(service.profitPctBp ?? 0)
        })

        setSuppliesMap(suppliesArrayToMap(service.supplies))
        setServiceSource(service.source)
        setPriceEditMode('sell')
      } catch (err) {
        const message = err instanceof Error ? err.message : 'No se pudo cargar el servicio'
        setSaveError(message)
      } finally {
        if (!cancelled) setIsLoadingService(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, effectiveServiceId])

  if (!open) return null

  function setField<K extends keyof FormState>(key: K, value: FormState[K]): void {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (key === 'code') setSkuError(null)
  }

  function ensureServiceCode(): string {
    const current = form.code.trim()
    if (current) return current

    const next = generate8DigitCode()
    setField('code', next)
    return next
  }

  async function validateCodeUniqueness(code: string): Promise<boolean> {
    const normalized = code.trim()
    if (!normalized) {
      setSkuError(null)
      return true
    }

    try {
      const localExisting = await serviceRepository.getByCode(normalized).catch(() => null)
      const supabaseExisting = await getServiceByCodeFromSupabase(normalized).catch(() => null)

      if (
        localExisting &&
        !(
          effectiveServiceId &&
          serviceSource === 'local' &&
          localExisting.id === effectiveServiceId
        )
      ) {
        setSkuError(`El código "${normalized}" ya está registrado en otro servicio.`)
        return false
      }

      if (
        supabaseExisting &&
        !(
          effectiveServiceId &&
          serviceSource === 'supabase' &&
          supabaseExisting.id === effectiveServiceId
        )
      ) {
        setSkuError(`El código "${normalized}" ya está registrado en otro servicio.`)
        return false
      }

      setSkuError(null)
      return true
    } catch {
      setSkuError(null)
      return true
    }
  }

  function handleGenerateCode(): void {
    const next = generate8DigitCode()
    setField('code', next)
    void validateCodeUniqueness(next)
  }

  async function handleDownloadQr(): Promise<void> {
    try {
      setSaveError(null)

      const code = ensureServiceCode()
      const name = form.name.trim()

      if (!name) throw new Error('Para generar el QR, primero ingresa el nombre del servicio.')

      const isUnique = await validateCodeUniqueness(code)
      if (!isUnique) throw new Error('El código ya existe. Cambia el código para generar el QR.')

      const payload = buildQrPayload(code, name)
      setQrDownloadValue(payload)

      await nextAnimationFrame()

      const svg = qrRenderRef.current?.querySelector('svg')
      if (!svg) throw new Error('No se pudo generar el QR para descarga.')

      const safeName = sanitizeFilenamePart(name)
      const filename = `qr_service_${code}_${safeName || 'servicio'}.png`

      await downloadQrSvgAsPng(svg, filename, QR_DOWNLOAD_SIZE)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo descargar el QR'
      setSaveError(message)
    }
  }

  const suppliesCount = Object.keys(suppliesMap).length

  function handleApplySupplies(next: Record<number, number>, computedCostCents: number): void {
    setSuppliesMap(next)
    const costText = (computedCostCents / 100).toFixed(2)
    handleBuyPriceChange(costText)
  }

  function handleSellPriceChange(value: string): void {
    if (!value.trim()) {
      setSellPriceError(null)
      setPriceEditMode('sell')
      setField('sellPrice', value)
      setField('profitPct', '')
      return
    }

    if (value.includes('-')) {
      setSellPriceError('El precio no puede ser negativo.')
      return
    }

    const sell = parseDecimal(value)
    if (sell !== null && sell < 0) {
      setSellPriceError('El precio no puede ser negativo.')
      return
    }

    setSellPriceError(null)
    setPriceEditMode('sell')
    setField('sellPrice', value)

    const buy = parseDecimal(form.buyPrice)
    if (buy === null || sell === null) return

    const pct = computeProfitPct(buy, sell)
    if (pct === null) return

    setField('profitPct', formatNumber(pct, 2))
  }

  function handleProfitPctChange(value: string): void {
    setPriceEditMode('pct')
    setField('profitPct', value)

    const pct = parseDecimal(value)
    if (pct === null) return

    const buy = parseDecimal(form.buyPrice)
    if (buy === null) return

    const sell = computeSellPrice(buy, pct)
    if (sell === null) return

    setField('sellPrice', formatNumber(sell, 2))
  }

  function handleBuyPriceChange(value: string): void {
    setField('buyPrice', value)

    const buy = parseDecimal(value)
    if (buy === null) return

    if (priceEditMode === 'pct') {
      const pct = parseDecimal(form.profitPct)
      if (pct === null) return

      const sell = computeSellPrice(buy, pct)
      if (sell === null) return

      setField('sellPrice', formatNumber(sell, 2))
      return
    }

    if (priceEditMode === 'sell') {
      const sell = parseDecimal(form.sellPrice)
      if (sell === null) return

      const pct = computeProfitPct(buy, sell)
      if (pct === null) return

      setField('profitPct', formatNumber(pct, 2))
    }
  }

  const profitPctNumber = parseDecimal(form.profitPct)
  const profitPctAlert =
    profitPctNumber !== null && profitPctNumber < 0
      ? 'El porcentaje de ganancia es negativo.'
      : null

  const alerts: AlertMessage[] = [
    skuError ? { key: 'code', kind: 'error', text: skuError } : null,
    sellPriceError ? { key: 'sell', kind: 'error', text: sellPriceError } : null,
    saveError ? { key: 'save', kind: 'error', text: saveError } : null,
    saveInfo ? { key: 'info', kind: 'warning', text: saveInfo } : null,
    profitPctAlert ? { key: 'pct', kind: 'warning', text: profitPctAlert } : null
  ].filter((x): x is AlertMessage => x !== null)

  async function handleSave(): Promise<void> {
    if (isSaving || isLoadingService) return

    setIsSaving(true)
    setSaveError(null)
    setSaveInfo(null)

    try {
      const code = form.code.trim()
      const name = form.name.trim()
      if (!code) throw new Error('Falta el código del servicio')
      if (!name) throw new Error('Falta el nombre del servicio')

      const sell = parseDecimal(form.sellPrice)
      if (sell !== null && sell < 0) throw new Error('El precio no puede ser negativo')

      const okCode = await validateCodeUniqueness(code)
      if (!okCode) throw new Error('El código del servicio ya existe. Usa otro código.')

      const supplies = suppliesMapToArray(suppliesMap)

      const basePayload: CreateServicePayload = {
        code,
        name,
        durationMin: parseInteger(form.durationMin) ?? 0,
        cost: toCents(parseDecimal(form.buyPrice) ?? 0),
        price: toCents(parseDecimal(form.sellPrice) ?? 0),
        profitPctBp: pctToBp(parseDecimal(form.profitPct) ?? 0),
        supplies
      }

      if (!effectiveServiceId) {
        await serviceRepository.create(basePayload)
      } else {
        await serviceRepository.update(effectiveServiceId, basePayload)
      }

      closeAll()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al guardar el servicio'
      setSaveError(message)
    } finally {
      setIsSaving(false)
    }
  }

  const modalTitle = isEditMode ? 'Editar Servicio' : 'Agregar Servicio'

  return createPortal(
    <>
      <ModalShell onClose={closeAll}>
        <div className={styles.modal}>
          <ModalHeader title={modalTitle} onClose={closeAll} />

          <div className={styles.body}>
            <div className={styles.contentGrid}>
              <ServiceForm
                form={form}
                setField={setField}
                onGenerateCode={handleGenerateCode}
                onDownloadQr={handleDownloadQr}
                onCodeBlur={() => void validateCodeUniqueness(form.code)}
                onBuyPriceChange={handleBuyPriceChange}
                onSellPriceChange={handleSellPriceChange}
                onProfitPctChange={handleProfitPctChange}
                onOpenInsumos={() => setInsumosOpen(true)}
                suppliesCount={suppliesCount}
              />
            </div>

            <div
              ref={qrRenderRef}
              style={{
                position: 'absolute',
                left: -99999,
                top: -99999,
                width: 1,
                height: 1,
                overflow: 'hidden'
              }}
              aria-hidden="true"
            >
              <QRCodeSVG value={qrDownloadValue || ' '} size={QR_DOWNLOAD_SIZE} includeMargin />
            </div>

            {isLoadingService ? (
              <div style={{ padding: '0 16px', marginTop: 10, opacity: 0.75 }}>
                Cargando servicio...
              </div>
            ) : null}

            <AlertsBottom alerts={alerts} />

            <SaveFooter onSave={handleSave} disabled={isSaving || isLoadingService} />
          </div>
        </div>
      </ModalShell>

      <InsumosModal
        open={insumosOpen}
        initialSelected={suppliesMap}
        onClose={() => setInsumosOpen(false)}
        onApply={handleApplySupplies}
      />
    </>,
    document.body
  )
}
