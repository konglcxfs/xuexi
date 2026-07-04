import { describe, expect, it } from 'vitest'
import {
  LocalFsFileAdapter,
  splitMarkdownByHeadings,
  splitTextIntoSections,
  estimateDifficulty,
  type LocalFsDeps,
} from '../src/adapters/local-fs-file'

// ----- 内存版 deps，方便测试 -----
function makeDeps(overrides?: Partial<LocalFsDeps>): LocalFsDeps {
  return {
    readJson: async () => ({}),
    readText: async () => '',
    readPdf: async () => ({ text: '', total: 0 }),
    listDir: async () => [],
    resolvePath: (s) => s,
    ...overrides,
  }
}

describe('splitMarkdownByHeadings', () => {
  it('按一级 / 二级标题切章节', () => {
    const md = `# 第一章

paragraph 1

## 1.1 小节

paragraph 2

# 第二章

paragraph 3`
    const sections = splitMarkdownByHeadings(md)
    expect(sections).toHaveLength(3)
    expect(sections[0]?.heading).toBe('第一章')
    expect(sections[1]?.heading).toBe('1.1 小节')
    expect(sections[2]?.heading).toBe('第二章')
  })

  it('没有任何标题时把整段作为前言', () => {
    const sections = splitMarkdownByHeadings('hello world\n\nmore text')
    expect(sections).toHaveLength(1)
    expect(sections[0]?.heading).toBe('')
    expect(sections[0]?.content).toContain('hello world')
  })
})

describe('splitTextIntoSections', () => {
  it('无标题文本按段落切，再合并短段', () => {
    const longPara = 'A'.repeat(500)
    const text = [longPara, longPara, longPara, longPara, longPara].join('\n\n')
    const sections = splitTextIntoSections(text, { maxSectionChars: 1200, minSectionChars: 200 })
    expect(sections.length).toBeGreaterThan(1)
    sections.forEach((s, i) => {
      expect(s.heading).toBe(`第 ${i + 1} 段`)
    })
  })

  it('超长段硬切到 maxSectionChars', () => {
    const huge = 'B'.repeat(5000)
    const sections = splitTextIntoSections(huge, { maxSectionChars: 1200, minSectionChars: 200 })
    const totalChars = sections.reduce((sum, s) => sum + s.content.length, 0)
    expect(totalChars).toBeGreaterThanOrEqual(5000)
  })
})

describe('estimateDifficulty', () => {
  it('短文本为 0.2', () => {
    expect(estimateDifficulty('x'.repeat(100))).toBe(0.2)
  })
  it('中等长度 0.4', () => {
    expect(estimateDifficulty('x'.repeat(500))).toBe(0.4)
  })
  it('含多代码块 0.85', () => {
    const code = '`'.repeat(20) + 'x'.repeat(3000)
    expect(estimateDifficulty(code)).toBe(0.85)
  })
})

describe('LocalFsFileAdapter.fetch', () => {
  it('json 文件读出 KP', async () => {
    const kp = {
      id: '',  // 让 adapter 补
      code: 'C1',
      title: '测试',
      description: 'd',
      prerequisites: [],
      difficulty: 0.3,
      tags: [],
      mastery: { explain: 0, apply: 0, extend: 0 },
    }
    const deps = makeDeps({
      readJson: async () => ({ knowledgePoints: [kp] }),
    })
    const a = new LocalFsFileAdapter(deps)
    const r = await a.fetch({
      locator: '/tmp/x.json',
      params: { subjectId: 'subj', role: 'primary_school', graph: 'g' },
    })
    expect(r.knowledgePoints).toHaveLength(1)
    expect(r.knowledgePoints![0]!.role).toBe('primary_school')
    expect(r.knowledgePoints![0]!.graph).toBe('g')
    expect(r.knowledgePoints![0]!.id).toMatch(/^subj:local:/)
  })

  it('md 文件按章节切 KP', async () => {
    const md = `# 标题1

text1

# 标题2

text2`
    const deps = makeDeps({ readText: async () => md })
    const a = new LocalFsFileAdapter(deps)
    const r = await a.fetch({ locator: '/tmp/x.md' })
    expect(r.knowledgePoints).toHaveLength(2)
    expect(r.materials).toHaveLength(1)
    expect(r.materials![0]!.content).toBe(md)
  })

  it('pdf 文件调用 readPdf 拿文本，再切 KP', async () => {
    const pdfText = ['第一段。'.repeat(50), '第二段。'.repeat(50), '第三段。'.repeat(50)].join('\n\n')
    const deps = makeDeps({
      readPdf: async () => ({ text: pdfText, total: 3 }),
    })
    const a = new LocalFsFileAdapter(deps)
    const r = await a.fetch({
      locator: '/tmp/x.pdf',
      params: { subjectId: 's', role: 'ruankao', graph: 'g' },
    })
    expect(r.knowledgePoints!.length).toBeGreaterThan(0)
    expect(r.materials![0]!.sourceTag).toMatch(/^local-pdf\(/)
    expect(r.materials![0]!.content.length).toBeGreaterThan(0)
  })

  it('pdf 解析抛错时不崩溃，返回错误 material', async () => {
    const deps = makeDeps({
      readPdf: async () => { throw new Error('encrypted') },
    })
    const a = new LocalFsFileAdapter(deps)
    const r = await a.fetch({ locator: '/tmp/x.pdf' })
    expect(r.materials).toHaveLength(1)
    expect(r.materials![0]!.content).toContain('PDF 解析失败')
  })

  it('pdf 解析能力未注入时退化到 stub', async () => {
    const deps = makeDeps()  // 没 readPdf
    delete (deps as { readPdf?: unknown }).readPdf
    const a = new LocalFsFileAdapter(deps)
    const r = await a.fetch({ locator: '/tmp/x.pdf' })
    expect(r.materials![0]!.content).toContain('PDF 解析未启用')
  })

  it('目录递归扫描 json / md / pdf', async () => {
    const deps = makeDeps({
      listDir: async () => ['/d/a.md', '/d/b.json', '/d/c.pdf'],
      readText: async () => '# 标题\n\ntext',
      readJson: async () => ({ knowledgePoints: [{
        id: '', code: 'c', title: 't', description: 'd',
        prerequisites: [], difficulty: 0.3, tags: [],
        mastery: { explain: 0, apply: 0, extend: 0 },
      }] }),
      readPdf: async () => ({ text: 'long text '.repeat(200), total: 1 }),
    })
    const a = new LocalFsFileAdapter(deps)
    const r = await a.fetch({ locator: '/d', params: { subjectId: 's' } })
    expect(r.knowledgePoints!.length).toBeGreaterThan(2)  // md + json 至少 1, pdf 至少 1
    expect(r.materials!.length).toBeGreaterThanOrEqual(2)
  })
})