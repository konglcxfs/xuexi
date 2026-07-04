/**
 * 端到端 PDF 测试：用真实 pdf-parse 解析一个手工构造的最小 PDF 文件。
 *
 * 验证引擎的 handlePdf 流程：读 buffer → PDFParse.getText → 切段落 → 出 KP。
 */

import { describe, expect, it } from 'vitest'
import { PDFParse } from 'pdf-parse'
import { LocalFsFileAdapter, type LocalFsDeps } from '../src/adapters/local-fs-file'
import { makeMinimalPdf } from './_fixtures/make-minimal-pdf'

describe('handlePdf end-to-end (real pdf-parse)', () => {
  it('解析真实 PDF buffer 出文本', async () => {
    const buf = makeMinimalPdf('Hello PDF World')
    const parser = new PDFParse({ data: Buffer.from(buf) })
    try {
      const result = await parser.getText()
      expect(result.text).toContain('Hello PDF')
    } finally {
      await parser.destroy().catch(() => undefined)
    }
  })

  it('LocalFsFileAdapter 走 readPdf 真实解析', async () => {
    const buf = makeMinimalPdf('Adapter Integration Test')

    const deps: LocalFsDeps = {
      readJson: async () => ({}),
      readText: async () => '',
      readPdf: async () => {
        const parser = new PDFParse({ data: Buffer.from(buf) })
        try {
          const r = await parser.getText()
          return { text: r.text ?? '', total: 1 }
        } finally {
          await parser.destroy().catch(() => undefined)
        }
      },
      listDir: async () => [],
      resolvePath: (s) => s,
    }

    const a = new LocalFsFileAdapter(deps)
    const result = await a.fetch({
      locator: '/tmp/test.pdf',
      params: { subjectId: 'realpdf', role: 'primary_school', graph: 'g' },
    })

    expect(result.materials).toBeDefined()
    expect(result.materials!.length).toBe(1)
    expect(result.materials![0]!.content).toContain('Adapter Integration Test')
    expect(result.materials![0]!.sourceTag).toMatch(/^local-pdf\(/)
  })

  it('加密 / 损坏 PDF 抛出被 catch 到 material', async () => {
    const garbage = Buffer.from('this is not a pdf at all')

    const deps: LocalFsDeps = {
      readJson: async () => ({}),
      readText: async () => '',
      readPdf: async () => {
        const parser = new PDFParse({ data: garbage })
        try {
          const r = await parser.getText()
          return { text: r.text ?? '', total: 0 }
        } finally {
          await parser.destroy().catch(() => undefined)
        }
      },
      listDir: async () => [],
      resolvePath: (s) => s,
    }

    const a = new LocalFsFileAdapter(deps)
    const result = await a.fetch({
      locator: '/tmp/garbage.pdf',
    })
    // 不管 pdf-parse 是返回空字符串还是抛错，material.sourceTag 至少是 local-pdf-*
    expect(result.materials).toBeDefined()
    expect(result.materials!.length).toBe(1)
  })
})