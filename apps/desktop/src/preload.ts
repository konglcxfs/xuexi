/**
 * preload.ts —— Electron 上下文桥。
 *
 * 关键约束：
 *   - contextIsolation: true  → preload 在独立世界运行
 *   - 渲染进程只能通过 window.desktop 拿到下列 API，不能直接 require('electron')
 *   - 所有 IPC handler 都是 explicit handle；预编译错误会被主进程 throw
 */

import { contextBridge, ipcRenderer } from 'electron'

const api = {
  // ---- safeStorage ----
  safeStorage: {
    available: () => ipcRenderer.invoke('safeStorage:available') as Promise<boolean>,
    encrypt: (plaintext: string) =>
      ipcRenderer.invoke('safeStorage:encrypt', plaintext) as Promise<string>,
    decrypt: (b64: string) =>
      ipcRenderer.invoke('safeStorage:decrypt', b64) as Promise<string>,
  },

  // ---- desktop integration ----
  desktop: {
    userDataPath: () => ipcRenderer.invoke('desktop:userDataPath') as Promise<string>,
    apiBaseUrl: () => ipcRenderer.invoke('desktop:apiBaseUrl') as Promise<string | null>,
    collectDir: (dir: string) =>
      ipcRenderer.invoke('desktop:collect-dir', dir) as Promise<{
        ok: boolean
        message?: string
        fileCount?: number
        knowledgePoints?: number
        materials?: number
        preview?: Array<{ path: string; size: number; mtime: string }>
      }>,
    startWatch: (dir: string, subjectId: string) =>
      ipcRenderer.invoke('desktop:start-watch', dir, subjectId) as Promise<{ ok: boolean }>,
    stopWatch: (dir: string, subjectId: string) =>
      ipcRenderer.invoke('desktop:stop-watch', dir, subjectId) as Promise<{ ok: boolean }>,
    listAdapters: () =>
      ipcRenderer.invoke('desktop:list-adapters') as Promise<Array<{ id: string; displayName: string; kind: string }>>,
    onWatchIngested: (cb: (entry: unknown) => void) => {
      ipcRenderer.on('desktop:watch-ingested', (_e, entry) => cb(entry))
    },
  },

  // ---- updater ----
  updater: {
    check: () => ipcRenderer.invoke('app:checkForUpdates') as Promise<{ ok: boolean; version?: string; error?: string }>,
    onAvailable: (cb: (info: unknown) => void) => {
      ipcRenderer.on('update:available', (_e, info) => cb(info))
    },
    onDownloaded: (cb: (info: unknown) => void) => {
      ipcRenderer.on('update:downloaded', (_e, info) => cb(info))
    },
  },

  // ---- meta ----
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    node: process.versions.node,
    chrome: process.versions.chrome,
  },
}

contextBridge.exposeInMainWorld('desktop', api)

export type DesktopBridge = typeof api