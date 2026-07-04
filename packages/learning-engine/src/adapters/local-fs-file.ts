/**
 * LocalFsFileAdapter —— 桌面端"用户拖讲义" 的 SourceAdapter 实现。
 *
 * 支持四种 locator 形态：
 *   1) file:// 或 绝对路径 指向 .json ：用约定的 KP / Exercise JSON schema 直接加载
 *   2) file:// 或 绝对路径 指向 .md   ：按一级 / 二级标题切章节，每节生成一个 KP
 *   3) file:// 或 绝对路径 指向 .pdf  ：用 pdf-parse 提取文本，再走和 md 一样的章节切分
 *   4) 绝对路径指向目录                 ：递归扫描 .json / .md / .pdf，逐个调用上面 1/2/3
 *
 * 引擎层只产出 KnowledgePoint / Material，Exercise 仅在源 JSON 里带 exercises 字段时透出。
 *
 * 安全：
 *   - 只在 Electron 主进程调用，因为可以直接读 fs；
 *   - 引擎层只负责构造解析逻辑，fs.readFile 与 pdf 解析都由调用方注入，避免破坏平台无关性。
 */

import type {
  SourceAdapter,
  SourceFetchResult,
  KnowledgePoint,
  LearningMaterial,
} from '@xuexi/shared'

/** 一个 PDF 解析结果的纯结构 —— 引擎层与 pdf-parse 解耦 */
export interface ParsedPdf {
  text: string
  total: number
  info?: Record<string, unknown>
}

export interface LocalFsDeps {
  readJson(path: string): Promise<unknown>
  readText(path: string): Promise<string>
  /** 可选：PDF 解析。返回 null 表示"未启用 PDF 解析能力"，引擎会退化到 stub */
  readPdf?(path: string): Promise<ParsedPdf>
  listDir(path: string, exts: string[]): Promise<string[]>
  resolvePath(input: string): string    // 让调用方处理 file:// 前缀
}

export class LocalFsFileAdapter implements SourceAdapter {
  readonly id = 'local-fs-file'
  readonly displayName = '本地文件系统'
  readonly kind = 'material' as const
  readonly produces: ('KnowledgePoint' | 'Material')[] = ['KnowledgePoint', 'Material']
  readonly requiresAuth = false
  readonly network = false

  constructor(private deps: LocalFsDeps) {}

  async fetch(args: { locator: string; params?: { subjectId?: string; role?: 'primary_school' | 'ruankao'; graph?: string } }): Promise<SourceFetchResult> {
    const path = this.deps.resolvePath(args.locator)
    const subjectId = args.params?.subjectId ?? 'local'
    const role = args.params?.role ?? 'primary_school'
    const graph = args.params?.graph ?? 'local'

    if (path.endsWith('.json')) {
      return this.handleJson(path, subjectId, role, graph)
    }
    if (path.endsWith('.md') || path.endsWith('.markdown')) {
      return this.handleMarkdown(path, subjectId, role, graph)
    }
    if (path.endsWith('.pdf')) {
      return this.handlePdf(path, subjectId, role, graph)
    }
    return this.handleDir(path, subjectId, role, graph)
  }

  // ---------- handlers ----------

  private async handleJson(path: string, subjectId: string, role: 'primary_school' | 'ruankao', graph: string): Promise<SourceFetchResult> {
    const data = (await this.deps.readJson(path)) as {
      knowledgePoints?: KnowledgePoint[]
      materials?: LearningMaterial[]
    }
    const kps = (data.knowledgePoints ?? []).map(kp => ({
      ...kp,
      role: kp.role ?? role,
      graph: kp.graph ?? graph,
      id: kp.id || `${subjectId}:local:${this.hash(path + kp.title)}`,
      mastery: kp.mastery ?? { explain: 0, apply: 0, extend: 0 },
    }))
    return { knowledgePoints: kps, materials: data.materials }
  }

  private async handleMarkdown(path: string, subjectId: string, role: 'primary_school' | 'ruankao', graph: string): Promise<SourceFetchResult> {
    const text = await this.deps.readText(path)
    const sections = splitMarkdownByHeadings(text)
    const baseTitle = path.split('/').pop()?.replace(/\.(md|markdown)$/, '') ?? 'untitled'
    const kps: KnowledgePoint[] = sections.map((s, i) => ({
      id: `${subjectId}:local:${this.hash(path + s.heading)}`,
      role,
      graph,
      code: `local-${i.toString().padStart(3, '0')}`,
      title: s.heading ? `${baseTitle} · ${s.heading}` : `${baseTitle} · 第 ${i + 1} 节`,
      description: s.content.slice(0, 240),
      prerequisites: [],
      difficulty: estimateDifficulty(s.content),
      tags: ['local-file', 'markdown'],
      mastery: { explain: 0, apply: 0, extend: 0 },
    }))
    const materials: LearningMaterial[] = [{
      id: `${subjectId}:local:${this.hash(path)}.material`,
      subjectId,
      knowledgePointIds: kps.map(k => k.id),
      kind: 'article',
      title: baseTitle,
      content: text,
      difficulty: 0.5,
      estimatedMinutes: Math.max(5, Math.round(text.length / 400)),
      sourceTag: 'local-md',
    }]
    return { knowledgePoints: kps, materials }
  }

  private async handlePdf(path: string, subjectId: string, role: 'primary_school' | 'ruankao', graph: string): Promise<SourceFetchResult> {
    if (!this.deps.readPdf) {
      // PDF 解析能力未注入 —— 退化到 stub，跟 v0 行为一致
      const baseTitle = path.split('/').pop() ?? 'untitled.pdf'
      return {
        materials: [{
          id: `${subjectId}:local:${this.hash(path)}.material`,
          subjectId,
          knowledgePointIds: [],
          kind: 'article',
          title: baseTitle,
          content: '(PDF 解析未启用——主进程未注入 readPdf)',
          difficulty: 0.5,
          estimatedMinutes: 0,
          sourceTag: 'local-pdf-pending',
        }],
      }
    }

    const baseTitle = path.split('/').pop()?.replace(/\.pdf$/i, '') ?? 'untitled'
    let parsed: ParsedPdf
    try {
      parsed = await this.deps.readPdf(path)
    } catch (err) {
      const msg = (err as Error).message ?? 'PDF 解析失败'
      return {
        materials: [{
          id: `${subjectId}:local:${this.hash(path)}.material`,
          subjectId,
          knowledgePointIds: [],
          kind: 'article',
          title: baseTitle,
          content: `[PDF 解析失败] ${msg}`,
          difficulty: 0.5,
          estimatedMinutes: 0,
          sourceTag: 'local-pdf-error',
        }],
      }
    }

    const text = (parsed.text ?? '').trim()
    if (!text) {
      return {
        materials: [{
          id: `${subjectId}:local:${this.hash(path)}.material`,
          subjectId,
          knowledgePointIds: [],
          kind: 'article',
          title: baseTitle,
          content: '(PDF 无可提取文本，可能为扫描件)',
          difficulty: 0.5,
          estimatedMinutes: 0,
          sourceTag: 'local-pdf-empty',
        }],
      }
    }

    // 复用 markdown 章节切分（PDF 通常没真标题，按字符长度做虚拟切分）
    const sections = splitTextIntoSections(text)
    const kps: KnowledgePoint[] = sections.map((s, i) => ({
      id: `${subjectId}:local:${this.hash(path + s.heading)}`,
      role,
      graph,
      code: `pdf-${i.toString().padStart(3, '0')}`,
      title: s.heading || `${baseTitle} · 第 ${i + 1} 段`,
      description: s.content.slice(0, 240),
      prerequisites: [],
      difficulty: estimateDifficulty(s.content),
      tags: ['local-file', 'pdf'],
      mastery: { explain: 0, apply: 0, extend: 0 },
    }))
    const materials: LearningMaterial[] = [{
      id: `${subjectId}:local:${this.hash(path)}.material`,
      subjectId,
      knowledgePointIds: kps.map(k => k.id),
      kind: 'article',
      title: baseTitle,
      content: text,
      difficulty: 0.5,
      estimatedMinutes: Math.max(5, Math.round(text.length / 400)),
      sourceTag: `local-pdf(${parsed.total ?? '?'}p)`,
    }]
    return { knowledgePoints: kps, materials }
  }

  private async handleDir(path: string, subjectId: string, role: 'primary_school' | 'ruankao', graph: string): Promise<SourceFetchResult> {
    const files = await this.deps.listDir(path, ['.json', '.md', '.markdown', '.pdf'])
    const kps: KnowledgePoint[] = []
    const materials: LearningMaterial[] = []
    for (const f of files) {
      const inner = await this.fetch({ locator: f, params: { subjectId, role, graph } })
      kps.push(...(inner.knowledgePoints ?? []))
      materials.push(...(inner.materials ?? []))
    }
    return { knowledgePoints: kps, materials }
  }

  // ---------- util ----------

  private hash(s: string): string {
    // FNV-1a 32 bit
    let h = 2166136261
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i)
      h = Math.imul(h, 16777619)
    }
    return (h >>> 0).toString(36)
  }
}

// ---------- 纯函数（适配器也可用，但容易单测） ----------

interface Section {
  heading: string
  content: string
}

/** 按一级 / 二级标题切 markdown 章节。空 heading 也保留为"前言"。 */
export function splitMarkdownByHeadings(md: string): Section[] {
  const lines = md.split(/\r?\n/)
  const sections: Section[] = []
  let cur: Section = { heading: '', content: '' }
  for (const line of lines) {
    const m = line.match(/^(#{1,2})\s+(.+)$/)
    if (m && m[1] && m[2]) {
      if (cur.heading || cur.content.trim()) sections.push(cur)
      cur = { heading: m[2].trim(), content: '' }
    } else {
      cur.content += line + '\n'
    }
  }
  if (cur.heading || cur.content.trim()) sections.push(cur)
  return sections
}

/** 基于字符 / 行数估计 markdown 章节难度（0-1）。 */
export function estimateDifficulty(s: string): number {
  const len = s.length
  const codeLines = (s.match(/`/g) ?? []).length / 2
  if (len < 200) return 0.2
  if (len < 800) return 0.4
  if (len < 2000) return 0.6
  if (codeLines > 5) return 0.85
  return 0.7
}

/**
 * 把一段无标题的纯文本切成若干"段"。PDF 抽出来的文本通常没 markdown 标题，
 * 这里按"连续空行"分段，每段长度限制在 200~1200 字符之间（自适应窗口）。
 */
export function splitTextIntoSections(text: string, opts?: { maxSectionChars?: number; minSectionChars?: number }): Section[] {
  const max = opts?.maxSectionChars ?? 1200
  const min = opts?.minSectionChars ?? 200
  const out: Section[] = []

  // 先按段落（双换行）切
  const paras = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)

  let cur: Section = { heading: '', content: '' }
  for (const p of paras) {
    if (cur.content.length >= max) {
      out.push(cur)
      cur = { heading: '', content: p }
    } else {
      cur.content = cur.content ? cur.content + '\n\n' + p : p
    }
    // 如果当前段落单独超过 max，硬切
    while (cur.content.length > max * 1.5) {
      const head = cur.content.slice(0, max)
      cur.content = cur.content.slice(max)
      out.push({ heading: '', content: head })
    }
  }
  if (cur.content.trim()) out.push(cur)

  // 把过短的相邻段合并
  const merged: Section[] = []
  for (const s of out) {
    if (merged.length === 0) {
      merged.push({ ...s })
    } else {
      const last = merged[merged.length - 1]!
      if (last.content.length < min && s.content.length < min) {
        last.content = last.content + '\n\n' + s.content
      } else {
        merged.push({ ...s })
      }
    }
  }

  // 给段落一个简单的序号标题
  return merged.map((s, i) => ({
    heading: `第 ${i + 1} 段`,
    content: s.content,
  }))
}