/**
 * 手工构造一个最小的 PDF 字节流（不依赖任何第三方生成库）。
 *
 * 来源：PDF 1.4 spec 的最小 hello world 形式。结构：
 *   - header: %PDF-1.4
 *   - catalog → pages → page → contents(Hello) → font
 *   - xref + trailer
 *
 * 这个 PDF 用 pdf-parse 可以正常解析出 "Hello PDF" 一行。
 */

const HEADER = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'

function buildObject(id: number, body: string): string {
  return `${id} 0 obj\n${body}\nendobj\n`
}

export function makeMinimalPdf(text: string = 'Hello PDF'): Uint8Array {
  const objects: string[] = []

  // 1: Catalog
  objects.push(buildObject(1, '<< /Type /Catalog /Pages 2 0 R >>'))

  // 2: Pages
  objects.push(buildObject(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>'))

  // 3: Page
  objects.push(buildObject(3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] '
    + '/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>'))

  // 4: Content stream
  const stream = `BT /F1 24 Tf 72 720 Td (${text}) Tj ET`
  objects.push(buildObject(4, `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`))

  // 5: Font
  objects.push(buildObject(5, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'))

  // xref
  const offsets: number[] = []
  let cursor = HEADER.length
  const pieces: string[] = [HEADER]
  for (const o of objects) {
    offsets.push(cursor)
    pieces.push(o)
    cursor += o.length
  }
  const xrefStart = cursor
  let xref = `xref\n0 ${objects.length + 1}\n`
  xref += '0000000000 65535 f \n'
  for (const off of offsets) {
    xref += `${String(off).padStart(10, '0')} 00000 n \n`
  }

  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`

  const full = pieces.join('') + xref + trailer
  return new Uint8Array(Buffer.from(full, 'binary'))
}