/**
 * desktop bridge —— 与 apps/desktop/src/preload.ts 对齐的类型 + helper。
 * 在浏览器模式下 `window.desktop` 为 undefined，相关函数降级或抛错。
 */

import type { AIVendor } from '@xuexi/shared'

export interface DesktopBridge {
  safeStorage: {
    available: () => Promise<boolean>
    encrypt: (plaintext: string) => Promise<string>
    decrypt: (b64: string) => Promise<string>
  }
  desktop: {
    userDataPath: () => Promise<string>
    apiBaseUrl: () => Promise<string | null>
    collectDir: (dir: string) => Promise<{
      ok: boolean
      message?: string
      fileCount?: number
      knowledgePoints?: number
      materials?: number
      preview?: Array<{ path: string; size: number; mtime: string }>
    }>
    startWatch: (dir: string, subjectId: string) => Promise<{ ok: boolean }>
    stopWatch: (dir: string, subjectId: string) => Promise<{ ok: boolean }>
    listAdapters: () => Promise<Array<{ id: string; displayName: string; kind: string }>>
    onWatchIngested: (cb: (entry: unknown) => void) => void
  }
  updater: {
    check: () => Promise<{ ok: boolean; version?: string; error?: string }>
    onAvailable: (cb: (info: unknown) => void) => void
    onDownloaded: (cb: (info: unknown) => void) => void
  }
  platform: NodeJS.Platform
  versions: { electron: string; node: string; chrome: string }
}

declare global {
  interface Window {
    desktop?: DesktopBridge
  }
}

/** 探测是否在 Electron 桌面壳内。 */
export function isDesktop(): boolean {
  return typeof window !== 'undefined' && typeof window.desktop !== 'undefined'
}

/** 默认 endpoint（开发期 vite proxy）。Electron 时由 IPC 拿内嵌 URL。 */
export async function resolveApiBaseUrl(): Promise<string> {
  if (isDesktop()) {
    const url = await window.desktop!.desktop.apiBaseUrl()
    return url ?? ''
  }
  return ''
}

/**
 * apiKey 加密：
 *  - Electron：主进程 safeStorage（基于 OS Keychain / DPAPI / libsecret）
 *  - 浏览器（开发期）：Web Crypto AES-GCM，key 存放 sessionStorage 仅供调试
 *
 * 浏览器方案只是为了在桌面应用未启动时的开发模式能用，不构成任何安全保证。
 */
export async function encryptApiKey(plaintext: string): Promise<string> {
  if (isDesktop() && (await window.desktop!.safeStorage.available())) {
    return window.desktop!.safeStorage.encrypt(plaintext)
  }
  return browserFallbackEncrypt(plaintext)
}

export async function decryptApiKey(payload: string): Promise<string> {
  if (isDesktop() && (await window.desktop!.safeStorage.available())) {
    try { return await window.desktop!.safeStorage.decrypt(payload) } catch { return '' }
  }
  return browserFallbackDecrypt(payload)
}

// -------- browser fallback (Web Crypto, dev only) --------
const BROWSER_KEY = 'xuexi-browser-key'

async function getOrCreateKey(): Promise<CryptoKey> {
  const raw = sessionStorage.getItem(BROWSER_KEY)
  if (raw) {
    const buf = Uint8Array.from(JSON.parse(raw) as number[])
    return crypto.subtle.importKey('raw', buf, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
  }
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
  const exported = new Uint8Array(await crypto.subtle.exportKey('raw', key))
  sessionStorage.setItem(BROWSER_KEY, JSON.stringify(Array.from(exported)))
  return key
}

async function browserFallbackEncrypt(plaintext: string): Promise<string> {
  const key = await getOrCreateKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext)
  ))
  return 'b:' + btoa(String.fromCharCode(...iv, ...ct))
}

async function browserFallbackDecrypt(payload: string): Promise<string> {
  if (!payload.startsWith('b:')) return ''
  try {
    const bytes = Uint8Array.from(atob(payload.slice(2)), c => c.charCodeAt(0))
    const iv = bytes.slice(0, 12)
    const ct = bytes.slice(12)
    const key = await getOrCreateKey()
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct)
    return new TextDecoder().decode(pt)
  } catch {
    return ''
  }
}

// -------- vendor 工厂：每个 vendor 的 baseUrl/model 默认值 --------
export interface VendorPreset {
  baseUrl: string
  model: string
}

export const VENDOR_PRESETS: Record<AIVendor, VendorPreset> = {
  openai:    { baseUrl: 'https://api.openai.com/v1',          model: 'gpt-4o-mini' },
  deepseek:  { baseUrl: 'https://api.deepseek.com/v1',        model: 'deepseek-chat' },
  anthropic: { baseUrl: 'https://api.anthropic.com/v1',       model: 'claude-3-5-sonnet-latest' },
  ollama:    { baseUrl: 'http://localhost:11434/v1',          model: 'llama3.1' },
  custom:    { baseUrl: '',                                    model: '' },
}

export const VENDOR_NAMES: Record<AIVendor, string> = {
  openai: 'OpenAI',
  deepseek: 'DeepSeek',
  anthropic: 'Anthropic (Claude)',
  ollama: 'Ollama (本地)',
  custom: '自定义（OpenAI 兼容）',
}