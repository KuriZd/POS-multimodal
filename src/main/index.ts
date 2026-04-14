// src/main/index.ts
import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { getLocalDb } from './db/local-db';
import { registerProductsIpc } from './ipc/products.ipc';
import { registerSyncIpc } from './ipc/sync.ipc';

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.mjs')
    }
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
    return;
  }

  void mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
}

app.whenReady().then(() => {
  getLocalDb();
  registerProductsIpc();
  registerSyncIpc();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});