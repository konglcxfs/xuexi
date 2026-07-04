/**
 * Electron 主进程入口 —— 让统一学习引擎装进桌面壳。
 *
 * 职责：
 *   1. 单例锁（避免双开）
 *   2. 启动内嵌 Fastify（apps/api，dev 用 tsx 子进程，prod 用编译产物）
 *   3. 生成对称加密密钥（AES-256），写入 process.env.XUEXI_DECRYPT_SECRET
 *      → 解密工作交给前端通过 IPC 调度主进程 safeStorage
 *   4. 创建 BrowserWindow，指向内嵌后端 URL
 *   5. 注册 IPC：加密/解密、采集源管理、自动更新检查
 *   6. 集成 electron-updater
 *
 * 安全模型（Electron 头号风险）：
 *   - nodeIntegration: false
 *   - contextIsolation: true
 *   - 渲染进程只能通过 contextBridge 暴露的 API（preload.ts）访问主进程能力
 */

import { shell, app, BrowserWindow, ipcMain, safeStorage, session } from 'electron'
import { fork, type ChildProcess } from 'node:child_process'
import crypto from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import { autoUpdater } from 'electron-updater'
import { registerLocalFsAdapter, listCollectableFiles, watchCollectDir } from './local-source'
import { defaultSourceRegistry } from '@xuexi/learning-engine'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const isDev = !app.isPackaged

let mainWindow: BrowserWindow | null = null
let apiProcess: ChildProcess | null = null
let apiBaseUrl: string | null = null
const watchHandles = new Map<string, () => void>()

/** 用户专属数据目录（mac: ~/Library/Application Support/xuexi, win: %APPDATA%/xuexi, linux: ~/.config/xuexi） */
function userDataDir() { return app.getPath('userData') }

/** Electron 内置 safeStorage 是否可用（Linux 需明确启用） */
function ensureSafeStorage(): boolean {
  if (process.platform === 'linux') {
    // electron-safeStorage 在某些 Linux 上需明确设置 keytar
    try { return safeStorage.isEncryptionAvailable() } catch { return false }
  }
  return safeStorage.isEncryptionAvailable()
}

/**
 * 启动内嵌 Fastify API（apps/api）：
 *   - dev：用 tsx 直跑 .ts
 *   - prod：用编译产物
 */
async function startEmbeddedApi(): Promise<string> {
  const apiRoot = path.resolve(__dirname, '..', '..', 'api')
  const apiEntryProd = path.join(apiRoot, 'dist', 'index.esm.js')
  const apiEntryDev = path.join(apiRoot, 'src', 'index.ts')
  const useProd = existsSync(apiEntryProd)

  // 注入对称加密密钥（AES-256 base64）
  const aesKey = crypto.randomBytes(32).toString('base64')
  process.env.XUEXI_DECRYPT_SECRET = aesKey

  // 强制 API 监听 127.0.0.1 + 端口 0（系统分配）
  process.env.XUEXI_API_HOST = '127.0.0.1'
  process.env.XUEXI_API_PORT = process.env.XUEXI_API_PORT ?? '0'

  // DB 文件放到 userData 下，桌面应用不污染仓库
  const dbDir = path.join(userDataDir(), 'data')
  process.env.XUEXI_DB_FILE = path.join(dbDir, 'xuexi.sqlite')

  return new Promise<string>((resolve, reject) => {
    let settled = false

    if (useProd) {
      apiProcess = fork(apiEntryProd, [], {
        env: process.env,
        cwd: apiRoot,
        silent: false,
      })
    } else {
      // dev 模式：通过 tsx 启动 .ts
      const tsxBin = path.resolve(__dirname, '..', '..', '..', 'node_modules', '.bin', 'tsx')
      apiProcess = fork(apiEntryDev, [], {
        env: {
          ...process.env,
          TSX_TSCONFIG_PATH: path.join(apiRoot, 'tsconfig.json'),
        },
        cwd: apiRoot,
        silent: false,
        execPath: tsxBin,
      })
    }

    apiProcess.stdout?.on('data', (chunk: Buffer) => {
      const s = chunk.toString()
      process.stdout.write(`[api] ${s}`)
      // 寻找 "xuexi api listening on http://localhost:<port>"
      const m = s.match(/listening on (https?:\/\/[^\s]+)/)
      if (m && !settled && m[1]) {
        settled = true
        apiBaseUrl = m[1].replace('localhost', '127.0.0.1')
        resolve(apiBaseUrl)
      }
    })
    apiProcess.stderr?.on('data', (chunk: Buffer) => {
      process.stderr.write(`[api:err] ${chunk.toString()}`)
    })
    apiProcess.on('exit', (code) => {
      console.info(`API process exited with code ${code}`)
    })
    apiProcess.on('error', (err) => {
      if (!settled) {
        settled = true
        reject(err)
      }
    })

    // 兜底超时（30s）
    setTimeout(() => {
      if (!settled) {
        settled = true
        reject(new Error('embedded API failed to start within 30s'))
      }
    }, 30_000)
  })
}

async function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    title: 'xuexi',
    backgroundColor: '#f6f7fb',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,           // sandbox + preload 限制 fs，安全模型由 contextBridge 把关
      webSecurity: true,
    },
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())

  // 外链交给系统浏览器
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (apiBaseUrl) {
    // 内嵌后端 → 渲染进程加载 Vite SPA
    await mainWindow.loadURL(apiBaseUrl)
  } else {
    // 极端情况：API 没起来，让用户看到错误
    await mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(
      '<h1>xuexi 启动失败</h1><p>内嵌 API 未就绪。请重启应用并查看日志。</p>'
    ))
  }
}

/**
 * IPC 注册 —— 主进程能力通过 preload bridge 暴露给渲染进程。
 */
function registerIpc() {
  // --- safeStorage 加密/解密 ---
  // 注意：safeStorage 在 Linux 上可能不可用。API 必须返回可用性，调用方降级处理。
  ipcMain.handle('safeStorage:available', () => ensureSafeStorage())
  ipcMain.handle('safeStorage:encrypt', (_e, plaintext: string) => {
    if (!ensureSafeStorage()) throw new Error('safeStorage not available on this platform')
    return safeStorage.encryptString(plaintext).toString('base64')
  })
  ipcMain.handle('safeStorage:decrypt', (_e, b64: string) => {
    if (!ensureSafeStorage()) throw new Error('safeStorage not available on this platform')
    return safeStorage.decryptString(Buffer.from(b64, 'base64'))
  })

  // --- 本地采集源 ---
  ipcMain.handle('desktop:collect-dir', async (_e, dir: string) => {
    if (!existsSync(dir)) {
      return { ok: false, message: `目录不存在：${dir}` }
    }
    try {
      const adapter = registerLocalFsAdapter()
      const files = await listCollectableFiles(dir)
      const result = await adapter.fetch({
        locator: dir,
        params: { subjectId: 'desktop' },
      })
      return {
        ok: true,
        fileCount: files.length,
        knowledgePoints: result.knowledgePoints?.length ?? 0,
        materials: result.materials?.length ?? 0,
        preview: files.slice(0, 20),
      }
    } catch (err) {
      return { ok: false, message: (err as Error).message }
    }
  })

  ipcMain.handle('desktop:start-watch', async (_e, dir: string, subjectId: string) => {
    const stop = watchCollectDir({
      dir,
      subjectId,
      onIngest: (e) => {
        mainWindow?.webContents.send('desktop:watch-ingested', e)
      },
    })
    watchHandles.set(`${dir}::${subjectId}`, stop)
    return { ok: true }
  })

  ipcMain.handle('desktop:stop-watch', async (_e, dir: string, subjectId: string) => {
    const stop = watchHandles.get(`${dir}::${subjectId}`)
    if (stop) {
      stop()
      watchHandles.delete(`${dir}::${subjectId}`)
    }
    return { ok: true }
  })

  ipcMain.handle('desktop:list-adapters', () => {
    return defaultSourceRegistry.list().map((a: { id: string; displayName: string; kind: string }) => ({
      id: a.id, displayName: a.displayName, kind: a.kind,
    }))
  })

  // --- 用户数据目录 ---
  ipcMain.handle('desktop:userDataPath', () => userDataDir())

  // --- 启动 ---
  ipcMain.handle('desktop:apiBaseUrl', () => apiBaseUrl)

  // --- 更新器 ---
  ipcMain.handle('app:checkForUpdates', async () => {
    try {
      const result = await autoUpdater.checkForUpdates()
      return { ok: true, version: result?.updateInfo?.version }
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
  })
}

/**
 * 单例锁：避免双开。
 */
function acquireSingleInstance() {
  const gotLock = app.requestSingleInstanceLock()
  if (!gotLock) {
    app.quit()
    return false
  }
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
  return true
}

/**
 * 自动更新启动。
 */
function initAutoUpdater() {
  autoUpdater.logger = {
    info: (...args: unknown[]) => console.info('[updater]', ...args),
    warn: (...args: unknown[]) => console.warn('[updater]', ...args),
    error: (...args: unknown[]) => console.error('[updater]', ...args),
    debug: () => undefined,
  } as any
  autoUpdater.autoDownload = false        // 用户手动触发
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.on('update-available', (info) => {
    console.info('update available', info.version)
    mainWindow?.webContents.send('update:available', info)
  })
  autoUpdater.on('update-downloaded', (info) => {
    mainWindow?.webContents.send('update:downloaded', info)
  })
  autoUpdater.on('error', (err) => {
    console.error('updater error', err)
  })
  if (!isDev) void autoUpdater.checkForUpdates()
}

// CSP：阻止混合内容 + 限制外联
function setupCsp() {
  session.defaultSession.webRequest.onHeadersReceived((details, cb) => {
    cb({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' 'unsafe-inline' data: blob: http://127.0.0.1:* http://localhost:* ws://127.0.0.1:*",
        ],
      },
    })
  })
}

/**
 * 主流程
 */
async function bootstrap() {
  if (!acquireSingleInstance()) return

  await app.whenReady()
  setupCsp()

  try {
    apiBaseUrl = await startEmbeddedApi()
    console.info(`embedded API at ${apiBaseUrl}`)
  } catch (err) {
    console.error('failed to start embedded API', err)
    // UI 仍要起来，否则用户什么都看不到
    apiBaseUrl = null
  }

  registerIpc()
  await createMainWindow()
  initAutoUpdater()

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) await createMainWindow()
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  if (apiProcess && !apiProcess.killed) {
    apiProcess.kill('SIGTERM')
  }
})

bootstrap().catch((err) => {
  console.error('bootstrap failed', err)
  // eslint-disable-next-line no-console
  console.error(err)
  app.quit()
})