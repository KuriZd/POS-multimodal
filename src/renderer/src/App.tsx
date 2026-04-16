import { useEffect, useState, type ReactElement } from 'react'
import LoginPage from './pages/LoginPage'
import { useBarcodeScanner } from './hooks/useBarcodeScanner'

type ProductLookup = Awaited<ReturnType<typeof window.pos.products.findByCode>>

type PosHomeProps = {
  user: AuthUser
  onLogout: () => void
}

function PosHome({ user, onLogout }: PosHomeProps): ReactElement {
  const [lastCode, setLastCode] = useState('')
  const [product, setProduct] = useState<ProductLookup>(null)
  const [message, setMessage] = useState(`Bienvenido ${user.name} (${user.role})`)

  useBarcodeScanner(async (code) => {
    setLastCode(code)

    const found = await window.pos.products.findByCode(code)
    setProduct(found)

    if (found) {
      setMessage(`Producto encontrado: ${found.name}`)
      return
    }

    setMessage('No se encontró el producto')
  })

  const syncProducts = async (): Promise<void> => {
    try {
      const result = await window.pos.sync.pullProducts()
      setMessage(`Productos sincronizados: ${result.count}`)
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'No fue posible sincronizar productos'
      setMessage(msg)
    }
  }

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
    <main style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>POS Papelería</h1>
      <p>Usuario: {user.name}</p>
      <p>Rol: {user.role}</p>
      <p>Origen del login: {user.source}</p>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <button onClick={() => void syncProducts()}>Sincronizar productos</button>
        <button onClick={() => void handleLogout()}>Cerrar sesión</button>
      </div>

      <p>{message}</p>
      <p>Último código: {lastCode || '-'}</p>

      {product && (
        <section>
          <h2>{product.name}</h2>
          <p>SKU: {product.sku}</p>
          <p>Código: {product.barcode ?? '-'}</p>
          <p>Precio: ${product.price / 100}</p>
          <p>Stock: {product.stock}</p>
        </section>
      )}
    </main>
  )
}

export default function App(): ReactElement {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    void (async () => {
      try {
        if (!window.pos?.auth) {
          setCheckingSession(false)
          return
        }

        const me = await window.pos.auth.me()
        setUser(me)
      } catch {
        setUser(null)
      } finally {
        setCheckingSession(false)
      }
    })()
  }, [])

  if (checkingSession) {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
          background: '#e6e6e6'
        }}
      >
        Cargando...
      </main>
    )
  }

  if (!user) {
    return <LoginPage onLoginSuccess={(loggedUser) => setUser(loggedUser)} />
  }

  return <PosHome user={user} onLogout={() => setUser(null)} />
}