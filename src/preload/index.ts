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
    findByCode: (code: string) => ipcRenderer.invoke('products:findByCode', code),
    get: (id: number) => ipcRenderer.invoke('products:get', id),
    getBySku: (sku: string) => ipcRenderer.invoke('products:getBySku', sku),
    list: (args: unknown) => ipcRenderer.invoke('products:list', args)
  },
  services: {
    get: (id: number) => ipcRenderer.invoke('services:get', id),
    getByCode: (code: string) => ipcRenderer.invoke('services:getByCode', code),
    list: (args: unknown) => ipcRenderer.invoke('services:list', args)
  },
  users: {
    list: () => ipcRenderer.invoke('users:list'),
    create: (payload: unknown) => ipcRenderer.invoke('users:create', payload),
    update: (id: number, payload: unknown) => ipcRenderer.invoke('users:update', id, payload)
  },
  sales: {
    create: (payload: unknown) => ipcRenderer.invoke('sales:create', payload)
  },
  sync: {
    pullProducts: () => ipcRenderer.invoke('sync:pullProducts'),
    pullAll: () => ipcRenderer.invoke('sync:pullAll'),
    pushPending: () => ipcRenderer.invoke('sync:pushPending'),
    conflicts: () => ipcRenderer.invoke('sync:conflicts')
  }
})
