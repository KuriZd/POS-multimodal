export type AppSection = 'dashboard' | 'products' | 'inventory' | 'sales'

export type SidebarMenuItem = {
  key: AppSection
  label: string
}