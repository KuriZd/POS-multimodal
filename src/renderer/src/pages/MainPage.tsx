import { useMemo, useState, type ReactElement } from 'react'
import { useBarcodeScanner } from '../hooks/useBarcodeScanner'
import styles from './MainPage.module.css'

type ProductLookup = Awaited<ReturnType<typeof window.pos.products.findByCode>>

type MainPageProps = {
    user: AuthUser
    onLogout: () => void
}

type MenuItem = {
    key: string
    label: string
    description: string
}

export default function MainPage({ user, onLogout }: MainPageProps): ReactElement {
    /*
      Estado visual general de la pantalla principal.
      message: feedback rápido para el usuario
      lastCode: último código leído por el lector
      product: último producto encontrado por el lector
      syncing: estado de sincronización de catálogo
    */
    const [message, setMessage] = useState(`Bienvenido ${user.name}`)
    const [lastCode, setLastCode] = useState('')
    const [product, setProduct] = useState<ProductLookup>(null)
    const [syncing, setSyncing] = useState(false)
    const [activeSection, setActiveSection] = useState('dashboard')

    /*
      Menú lateral según el rol.
      Esto sirve para ocultar módulos que aún no tocan a ciertos perfiles.
    */
    const menuItems = useMemo<MenuItem[]>(() => {
        const common: MenuItem[] = [
            {
                key: 'dashboard',
                label: 'Inicio',
                description: 'Resumen general del sistema'
            },
            {
                key: 'sales',
                label: 'Ventas',
                description: 'Cobro y registro de ventas'
            }
        ]

        const supervisor: MenuItem[] = [
            {
                key: 'inventory',
                label: 'Inventario',
                description: 'Movimientos y existencias'
            },
            {
                key: 'cash',
                label: 'Caja',
                description: 'Apertura, cierre y movimientos'
            }
        ]

        const admin: MenuItem[] = [
            {
                key: 'catalog',
                label: 'Catálogo',
                description: 'Productos, categorías y servicios'
            },
            {
                key: 'reports',
                label: 'Reportes',
                description: 'Indicadores y consultas'
            },
            {
                key: 'users',
                label: 'Usuarios',
                description: 'Gestión de accesos y roles'
            },
            {
                key: 'settings',
                label: 'Configuración',
                description: 'Parámetros generales del sistema'
            }
        ]

        if (user.role === 'ADMIN') {
            return [...common, ...supervisor, ...admin]
        }

        if (user.role === 'SUPERVISOR') {
            return [...common, ...supervisor, { key: 'reports', label: 'Reportes', description: 'Indicadores y consultas' }]
        }

        return common
    }, [user.role])

    /*
      Captura automática del lector de códigos.
      Si encuentra un producto, actualiza el panel derecho.
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
      Sincroniza productos desde Supabase a la base local.
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

    /*
      Cierra la sesión actual.
    */
    const handleLogout = async (): Promise<void> => {
        try {
            await window.pos.auth.logout()
            onLogout()
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'No fue posible cerrar sesión'
            setMessage(msg)
        }
    }

    return (
        <div className={styles.layout}>
            {/* Sidebar principal */}
            <aside className={styles.sidebar}>
                <div className={styles.brand}>
                    <div className={styles.brandLogo}>DP</div>
                    <div>
                        <h1 className={styles.brandTitle}>Damian’s</h1>
                        <p className={styles.brandSubtitle}>POS Papelería</p>
                    </div>
                </div>

                <nav className={styles.menu}>
                    {menuItems.map((item) => (
                        <button
                            key={item.key}
                            type="button"
                            className={`${styles.menuItem} ${activeSection === item.key ? styles.menuItemActive : ''}`}
                            onClick={() => setActiveSection(item.key)}
                        >
                            <span className={styles.menuLabel}>{item.label}</span>
                            <span className={styles.menuDescription}>{item.description}</span>
                        </button>
                    ))}
                </nav>

                <div className={styles.sidebarFooter}>
                    <p className={styles.roleLabel}>Rol actual</p>
                    <p className={styles.roleValue}>{user.role}</p>
                </div>
            </aside>

            {/* Contenido principal */}
            <div className={styles.main}>
                {/* Barra superior */}
                <header className={styles.topbar}>
                    <div>
                        <h2 className={styles.pageTitle}>Panel principal</h2>
                        <p className={styles.pageSubtitle}>Operación general del sistema</p>
                    </div>

                    <div className={styles.topbarActions}>
                        <button
                            type="button"
                            className={styles.secondaryButton}
                            onClick={() => void handleSyncProducts()}
                            disabled={syncing}
                        >
                            {syncing ? 'Sincronizando...' : 'Sincronizar productos'}
                        </button>

                        <button type="button" className={styles.primaryButton} onClick={() => void handleLogout()}>
                            Cerrar sesión
                        </button>
                    </div>
                </header>

                {/* Grid principal */}
                <section className={styles.contentGrid}>
                    {/* Columna izquierda */}
                    <div className={styles.leftColumn}>
                        <article className={styles.card}>
                            <div className={styles.cardHeader}>
                                <div>
                                    <h3 className={styles.cardTitle}>Sesión activa</h3>
                                    <p className={styles.cardSubtitle}>Información del usuario autenticado</p>
                                </div>
                            </div>

                            <div className={styles.userInfoGrid}>
                                <div className={styles.infoBox}>
                                    <span className={styles.infoLabel}>Nombre</span>
                                    <span className={styles.infoValue}>{user.name}</span>
                                </div>

                                <div className={styles.infoBox}>
                                    <span className={styles.infoLabel}>Usuario</span>
                                    <span className={styles.infoValue}>{user.username}</span>
                                </div>

                                <div className={styles.infoBox}>
                                    <span className={styles.infoLabel}>Rol</span>
                                    <span className={styles.infoValue}>{user.role}</span>
                                </div>

                                <div className={styles.infoBox}>
                                    <span className={styles.infoLabel}>Origen</span>
                                    <span className={styles.infoValue}>{user.source}</span>
                                </div>
                            </div>
                        </article>

                        <article className={styles.card}>
                            <div className={styles.cardHeader}>
                                <div>
                                    <h3 className={styles.cardTitle}>Acciones rápidas</h3>
                                    <p className={styles.cardSubtitle}>Base visual para los módulos del sistema</p>
                                </div>
                            </div>

                            <div className={styles.quickActions}>
                                <button type="button" className={styles.quickAction}>
                                    <span className={styles.quickActionTitle}>Nueva venta</span>
                                    <span className={styles.quickActionText}>Abrir flujo de cobro</span>
                                </button>

                                <button type="button" className={styles.quickAction}>
                                    <span className={styles.quickActionTitle}>Buscar producto</span>
                                    <span className={styles.quickActionText}>Consulta por SKU o código</span>
                                </button>

                                <button type="button" className={styles.quickAction}>
                                    <span className={styles.quickActionTitle}>Movimientos</span>
                                    <span className={styles.quickActionText}>Caja e inventario</span>
                                </button>

                                <button type="button" className={styles.quickAction}>
                                    <span className={styles.quickActionTitle}>Reportes</span>
                                    <span className={styles.quickActionText}>Resumen operativo</span>
                                </button>
                            </div>
                        </article>

                        <article className={styles.card}>
                            <div className={styles.cardHeader}>
                                <div>
                                    <h3 className={styles.cardTitle}>Estado del sistema</h3>
                                    <p className={styles.cardSubtitle}>Mensajes operativos del POS</p>
                                </div>
                            </div>

                            <div className={styles.statusBox}>
                                <p className={styles.statusMessage}>{message}</p>
                                <p className={styles.statusMeta}>Sección activa: {activeSection}</p>
                            </div>
                        </article>
                    </div>

                    {/* Columna derecha */}
                    <div className={styles.rightColumn}>
                        <article className={styles.card}>
                            <div className={styles.cardHeader}>
                                <div>
                                    <h3 className={styles.cardTitle}>Escáner de productos</h3>
                                    <p className={styles.cardSubtitle}>Lectura automática por código de barras</p>
                                </div>
                            </div>

                            <div className={styles.scanPanel}>
                                <div className={styles.scanBox}>
                                    <span className={styles.infoLabel}>Último código leído</span>
                                    <span className={styles.scanValue}>{lastCode || 'Esperando escaneo...'}</span>
                                </div>
                            </div>
                        </article>

                        <article className={styles.card}>
                            <div className={styles.cardHeader}>
                                <div>
                                    <h3 className={styles.cardTitle}>Producto detectado</h3>
                                    <p className={styles.cardSubtitle}>Información rápida del artículo escaneado</p>
                                </div>
                            </div>

                            {product ? (
                                <div className={styles.productDetails}>
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
                    </div>
                </section>
            </div>
        </div>
    )
}