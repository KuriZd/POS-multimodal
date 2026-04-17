// src/renderer/src/components/layout/AppLayout.tsx
import { useCallback, useMemo, useState, type ReactElement } from 'react'
import Sidebar from './Sidebar'
import TopNav from './TopNav'
import DashboardPage from '../../pages/DashboardPage'
import ProductsPage from '../../pages/ProductsPage'
import InventoryPage from '../../pages/InventoryPage'
import SalesPage from '../../pages/SalesPage'
import styles from './AppLayout.module.css'
import type { AppSection, SidebarMenuItem } from './layout.types' // ✅ AuthUser importado

type AppLayoutProps = {
    user: AuthUser
    onLogout: () => void
}

export default function AppLayout({ user, onLogout }: AppLayoutProps): ReactElement {
    const [activeSection, setActiveSection] = useState<AppSection>('dashboard')
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

    const menuItems = useMemo<SidebarMenuItem[]>(() => [
        { key: 'dashboard', label: 'Inicio' },
        { key: 'products', label: 'Productos' },
        { key: 'inventory', label: 'Inventario' },
        { key: 'sales', label: 'Ventas' },
    ], [])

    const sectionTitleMap = useMemo<Record<AppSection, string>>(() => ({
        dashboard: 'Panel principal',
        products: 'Productos',
        inventory: 'Inventario',
        sales: 'Ventas',
    }), [])

    const handleToggleCollapse = useCallback(() => {
        setIsSidebarCollapsed((prev) => !prev)
    }, [])

    const renderSectionContent = (): ReactElement => {
        switch (activeSection) {
            case 'products': return <ProductsPage />
            case 'inventory': return <InventoryPage />
            case 'sales': return <SalesPage />
            default: return <DashboardPage user={user} />
        }
    }

    return (
        <div className={styles.layout}>
            <Sidebar
                user={user}
                menuItems={menuItems}
                activeSection={activeSection}
                isCollapsed={isSidebarCollapsed}
                onToggleCollapse={handleToggleCollapse}
                onSelectSection={setActiveSection}
                onLogout={onLogout}
            />

            <div className={styles.mainArea}>
                <TopNav
                    user={user}
                    title={sectionTitleMap[activeSection]}
                    showUserSummary={!isSidebarCollapsed}
                />

                <main className={styles.content}>
                    {renderSectionContent()}
                </main>
            </div>
        </div>
    )
}