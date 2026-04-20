// src/renderer/src/components/layout/AppLayout.tsx
import { useCallback, useMemo, useState, type ReactElement } from 'react'
import Sidebar from './Sidebar'
import TopNav from './TopNav'
import { useSync } from '../../hooks/useSync'
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

const ROLE_ALLOWED_SECTIONS: Record<AppRole, AppSection[]> = {
    ADMIN: ['dashboard', 'products', 'inventory', 'sales'],
    SUPERVISOR: ['dashboard', 'products', 'inventory', 'sales'],
    CASHIER: ['sales'],
}

const ALL_MENU_ITEMS: SidebarMenuItem[] = [
    { key: 'dashboard', label: 'Inicio' },
    { key: 'products', label: 'Productos' },
    { key: 'inventory', label: 'Inventario' },
    { key: 'sales', label: 'Ventas' },
]

export default function AppLayout({ user, onLogout }: AppLayoutProps): ReactElement {
    const allowedSections = ROLE_ALLOWED_SECTIONS[user.role]
    const defaultSection: AppSection = allowedSections.includes('dashboard') ? 'dashboard' : allowedSections[0]

    const [activeSection, setActiveSection] = useState<AppSection>(defaultSection)
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true)
    const { status: syncStatus, lastSyncAt, conflictCount, sync } = useSync()

    const menuItems = useMemo<SidebarMenuItem[]>(
        () => ALL_MENU_ITEMS.filter((item) => allowedSections.includes(item.key as AppSection)),
        [user.role]
    )

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
        if (!allowedSections.includes(activeSection)) return <SalesPage />
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
                    syncStatus={syncStatus}
                    lastSyncAt={lastSyncAt}
                    conflictCount={conflictCount}
                    onSyncNow={sync}
                />

                <main className={styles.content}>
                    {renderSectionContent()}
                </main>
            </div>
        </div>
    )
}