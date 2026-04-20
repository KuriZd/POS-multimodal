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
  services: {
    get: (id: number) => ipcRenderer.invoke('services:get', id),
    getByCode: (code: string) => ipcRenderer.invoke('services:getByCode', code),
    list: (args: unknown) => ipcRenderer.invoke('services:list', args),
    create: (payload: unknown) => ipcRenderer.invoke('services:create', payload),
    update: (id: number, payload: unknown) => ipcRenderer.invoke('services:update', id, payload),
    remove: (id: number) => ipcRenderer.invoke('services:remove', id)
  },
  sync: {
    pullProducts: () => ipcRenderer.invoke('sync:pullProducts'),
    pullAll: () => ipcRenderer.invoke('sync:pullAll'),
    pushPending: () => ipcRenderer.invoke('sync:pushPending'),
    conflicts: () => ipcRenderer.invoke('sync:conflicts')
  }
})
