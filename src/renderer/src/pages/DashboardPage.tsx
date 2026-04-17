import { useState, type ReactElement } from 'react'
import { useBarcodeScanner } from '../hooks/useBarcodeScanner'
import styles from './DashboardPage.module.css'

type ProductLookup = Awaited<ReturnType<typeof window.pos.products.findByCode>>

type DashboardPageProps = {
    user: AuthUser
}

export default function DashboardPage({ user }: DashboardPageProps): ReactElement {
    /*
      Estado principal del dashboard.
      Mantiene el mensaje del sistema, el último código leído
      y el producto encontrado por el lector.
    */
    const [message, setMessage] = useState(`Bienvenido ${user.name}`)
    const [lastCode, setLastCode] = useState('')
    const [product, setProduct] = useState<ProductLookup>(null)
    const [syncing, setSyncing] = useState(false)

    /*
      Hook de captura para el lector de códigos de barras.
      Si encuentra un producto en la base local, actualiza el panel derecho.
    */
    useBarcodeScanner(async (code) => {
        setLastCode(code)

        try {
            const found = await window.pos.products.findByCode(code)
            setProduct(found)

            if (found) {
                setMessage(`Producto encontrado: ${found.name}`)
                return
            }

            setMessage('No se encontró el producto')
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'No fue posible buscar el producto'
            setMessage(msg)
        }
    })

    /*
      Sincronización manual del catálogo local.
      Más adelante esto puede moverse a un servicio automático en segundo plano.
    */
    const handleSyncProducts = async (): Promise<void> => {
        try {
            setSyncing(true)
            const result = await window.pos.sync.pullProducts()
            setMessage(`Productos sincronizados: ${result.count}`)
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'No fue posible sincronizar productos'
            setMessage(msg)
        } finally {
            setSyncing(false)
        }
    }

    return (
        <section className={styles.dashboard}>
            <div className={styles.grid}>
                <article className={styles.card}>
                    <div className={styles.cardHeader}>
                        <div>
                            <h2 className={styles.cardTitle}>Estado del sistema</h2>
                            <p className={styles.cardSubtitle}>Mensaje operativo actual del POS</p>
                        </div>

                        <button
                            type="button"
                            className={styles.syncButton}
                            onClick={() => void handleSyncProducts()}
                            disabled={syncing}
                        >
                            {syncing ? 'Sincronizando...' : 'Sincronizar'}
                        </button>
                    </div>

                    <div className={styles.messageBox}>
                        <p className={styles.messageText}>{message}</p>
                    </div>
                </article>

                <article className={styles.card}>
                    <div className={styles.cardHeader}>
                        <div>
                            <h2 className={styles.cardTitle}>Escáner</h2>
                            <p className={styles.cardSubtitle}>Último código recibido por el lector</p>
                        </div>
                    </div>

                    <div className={styles.codeBox}>
                        <span className={styles.codeValue}>{lastCode || 'Esperando escaneo...'}</span>
                    </div>
                </article>

                <article className={styles.card}>
                    <div className={styles.cardHeader}>
                        <div>
                            <h2 className={styles.cardTitle}>Producto detectado</h2>
                            <p className={styles.cardSubtitle}>Consulta rápida del producto escaneado</p>
                        </div>
                    </div>

                    {product ? (
                        <div className={styles.productGrid}>
                            <div className={styles.infoBox}>
                                <span className={styles.infoLabel}>Nombre</span>
                                <span className={styles.infoValue}>{product.name}</span>
                            </div>

                            <div className={styles.infoBox}>
                                <span className={styles.infoLabel}>SKU</span>
                                <span className={styles.infoValue}>{product.sku}</span>
                            </div>

                            <div className={styles.infoBox}>
                                <span className={styles.infoLabel}>Código</span>
                                <span className={styles.infoValue}>{product.barcode ?? '-'}</span>
                            </div>

                            <div className={styles.infoBox}>
                                <span className={styles.infoLabel}>Precio</span>
                                <span className={styles.infoValue}>${(product.price / 100).toFixed(2)}</span>
                            </div>

                            <div className={styles.infoBox}>
                                <span className={styles.infoLabel}>Stock</span>
                                <span className={styles.infoValue}>{product.stock}</span>
                            </div>
                        </div>
                    ) : (
                        <div className={styles.emptyState}>
                            <p className={styles.emptyTitle}>Sin producto seleccionado</p>
                            <p className={styles.emptyText}>
                                Escanea un artículo con el lector para mostrar su información aquí.
                            </p>
                        </div>
                    )}
                </article>

                <article className={styles.card}>
                    <div className={styles.cardHeader}>
                        <div>
                            <h2 className={styles.cardTitle}>Acciones rápidas</h2>
                            <p className={styles.cardSubtitle}>Base visual para módulos futuros</p>
                        </div>
                    </div>

                    <div className={styles.quickActions}>
                        <button type="button" className={styles.quickAction}>
                            Nueva venta
                        </button>

                        <button type="button" className={styles.quickAction}>
                            Buscar producto
                        </button>

                        <button type="button" className={styles.quickAction}>
                            Ver inventario
                        </button>

                        <button type="button" className={styles.quickAction}>
                            Historial de ventas
                        </button>
                    </div>
                </article>
            </div>
        </section>
    )
}