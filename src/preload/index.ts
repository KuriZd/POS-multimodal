// src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron';

const api = {
  products: {
    findByCode: (code: string) => ipcRenderer.invoke('products:findByCode', code)
  },
  sync: {
    pullProducts: () => ipcRenderer.invoke('sync:pullProducts')
  }
};

contextBridge.exposeInMainWorld('pos', api);