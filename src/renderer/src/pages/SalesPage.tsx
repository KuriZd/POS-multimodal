import { type ReactElement } from 'react'
import ModulePlaceholderPage from '../components/common/ModulePlaceholderPage'

export default function SalesPage(): ReactElement {
    return (
        <ModulePlaceholderPage
            title="Módulo de ventas"
            description="Aquí irá el flujo principal del POS: escaneo de productos, carrito, cobro, pagos, tickets e historial de ventas."
            items={[
                'Carrito de compra',
                'Escaneo de productos',
                'Cobro y métodos de pago',
                'Generación de ticket',
                'Consulta de ventas recientes'
            ]}
        />
    )
}