import { type ReactElement } from 'react'
import ModulePlaceholderPage from '../components/common/ModulePlaceholderPage'

export default function InventoryPage(): ReactElement {
    return (
        <ModulePlaceholderPage
            title="Módulo de inventario"
            description="Aquí se concentrará el control de existencias, movimientos, ajustes y seguimiento del stock disponible en la papelería."
            items={[
                'Consulta de stock actual',
                'Entradas y salidas de inventario',
                'Ajustes manuales',
                'Historial de movimientos',
                'Alertas de stock mínimo'
            ]}
        />
    )
}