/**
 * Electron 主进程的 fs 读写 deps —— 把 LocalFsFileAdapter 接通到真正的 fs。
 *
 * 主进程独有：
 *   - 真实文件系统
 *   - PDF 解析（懒加载 pdf-parse 减少主进程启动时间）
 *   - 设置 chokidar 监听（这里用 node:fs.watch 简化）
 */

import { promises as fsp, existsSync, readdirSync, statSync, watch } from 'node:fs'
import path from 'node:path'
import { LocalFsFileAdapter, type LocalFsDeps, type ParsedPdf } from '@xuexi/learning-engine'
import { defaultSourceRegistry } from '@xuexi/learning-engine'

/** pdf-parse 懒加载：第一次调用时才 require，避免主进程启动慢 */
let pdfParseModule: typeof import('pdf-parse') | null = null
async function loadPdfParse(): Promise<typeof import('pdf-parse')> {
  if (!pdfParseModule) {
    // pdf-parse 是 CJS + ESM 双发布；用动态 import 拿默认导出（class PDFParse）
    const mod = await import('pdf-parse')
    pdfParseModule = mod
  }
  return pdfParseModule
}

async function readPdfWithPdfParse(p: string): Promise<ParsedPdf> {
  const mod = await loadPdfParse()
  const buffer = await fsp.readFile(p)
  // v2 API：new PDFParse({ data: buffer }).getText()
  const parser = new mod.PDFParse({ data: buffer })
  try {
    const result = await parser.getText()
    return {
      text: result.text ?? '',
      total: (result as { total?: number }).total ?? 0,
      info: (result as { info?: Record<string, unknown> }).info,
    }
  } finally {
    await parser.destroy().catch(() => undefined)
  }
}

const adapterDeps: LocalFsDeps = {
  async readJson(p: string) {
    return JSON.parse(await fsp.readFile(p, 'utf8'))
  },
  async readText(p: string) {
    return fsp.readFile(p, 'utf8')
  },
  async readPdf(p: string) {
    return readPdfWithPdfParse(p)
  },
  async listDir(p: string, exts: string[]) {
    if (!existsSync(p)) return []
    const out: string[] = []
    const walk = (dir: string) => {
      const ents = readdirSync(dir, { withFileTypes: true })
      for (const ent of ents) {
        const child = path.join(dir, ent.name)
        if (ent.isDirectory()) walk(child)
        else if (exts.some(e => ent.name.toLowerCase().endsWith(e))) out.push(child)
      }
    }
    walk(p)
    return out
  },
  resolvePath(input: string) {
    if (input.startsWith('file://')) {
      return decodeURIComponent(input.replace(/^file:\/\//, ''))
    }
    return input
  },
}

let localAdapter: LocalFsFileAdapter | null = null

export function registerLocalFsAdapter(): LocalFsFileAdapter {
  if (localAdapter) return localAdapter
  const a = new LocalFsFileAdapter(adapterDeps)
  defaultSourceRegistry.register(a)
  localAdapter = a
  return a
}

/** 列出某目录下所有可被本地采集的文件（用于"提示用户能拖入什么"） */
export async function listCollectableFiles(rootDir: string): Promise<Array<{ path: string; size: number; mtime: string }>> {
  if (!existsSync(rootDir)) return []
  const out: Array<{ path: string; size: number; mtime: string }> = []
  const walk = (dir: string) => {
    const ents = readdirSync(dir, { withFileTypes: true })
    for (const ent of ents) {
      if (ent.name.startsWith('.')) continue
      const child = path.join(dir, ent.name)
      if (ent.isDirectory()) walk(child)
      else if (/\.(json|md|markdown|pdf)$/i.test(ent.name)) {
        const st = statSync(child)
        out.push({ path: child, size: st.size, mtime: st.mtime.toISOString() })
      }
    }
  }
  walk(rootDir)
  return out
}

/**
 * 启动一个 watcher，监听本地采集目录的内容变更，自动入库。
 * 推荐放在 `~/Documents/xuexi/sources/<subjectId>/` 这样的路径下。
 *
 * 这里用 node:fs.watch（更轻量，跨平台）。Linux 上如果文件量大可换成 chokidar。
 */
export function watchCollectDir(opts: {
  dir: string
  subjectId: string
  onIngest: (entry: { displayName: string; files: Array<{ path: string; size: number; mtime: string }>; result: unknown }) => void
}) {
  if (!existsSync(opts.dir)) return () => undefined
  let debounce: NodeJS.Timeout | null = null
  let lastRev = 0

  const trigger = async () => {
    if (debounce) clearTimeout(debounce)
    debounce = setTimeout(async () => {
      const files = await listCollectableFiles(opts.dir)
      const rev = files.reduce((s, f) => s + f.path.length + f.size, 0)
      if (rev === lastRev) return
      lastRev = rev
      const adapter = registerLocalFsAdapter()
      const result = await adapter.fetch({
        locator: opts.dir,
        params: { subjectId: opts.subjectId },
      })
      opts.onIngest({
        displayName: path.basename(opts.dir),
        files,
        result,
      })
    }, 1000)
  }

  const watcher = watch(opts.dir, { recursive: true }, () => trigger())
  // 首次启动立即触发一次
  void trigger()
  return () => watcher.close()
}