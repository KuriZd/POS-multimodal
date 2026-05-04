import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: unknown
    pos: {
      config: {
        getPublic: () => {
          supabaseUrl: string
          supabaseAnonKey: string
          source: string
        }
      }
    }
  }
}
