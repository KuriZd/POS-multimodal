import { contextBridge, ipcRenderer } from 'electron'

console.log('PRELOAD CARGADO')

contextBridge.exposeInMainWorld('pos', {
  auth: {
    login: (username: string, password: string) =>
      ipcRenderer.invoke('auth:login', username, password),
    me: () => ipcRenderer.invoke('auth:me'),
    logout: () => ipcRenderer.invoke('auth:logout')
  },
  products: {
    findByCode: (code: string) => ipcRenderer.invoke('products:findByCode', code)
  },
  sync: {
    pullProducts: () => ipcRenderer.invoke('sync:pullProducts'),
    pullAll: () => ipcRenderer.invoke('sync:pullAll')
  }
})
