export type AppSection = 'dashboard' | 'products' | 'inventory' | 'sales' | 'users'

export type SidebarMenuItem = {
  key: AppSection
  label: string
}
