import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import PdfSourceEvidenceDrawer from './PdfSourceEvidenceDrawer'
import { splitPdfSourceHighlight } from './pdfSourceEvidenceViewModel'

describe('PdfSourceEvidenceDrawer', () => {
  it('安全切分 exact 与 normalized 高亮，不使用 HTML 注入', () => {
    expect(splitPdfSourceHighlight('艾琳在暮钟旅馆\n收集情报。', '艾琳在暮钟旅馆 收集情报。')).toEqual({
      before: '', match: '艾琳在暮钟旅馆\n收集情报。', after: '',
    })
    expect(splitPdfSourceHighlight('原文并不相同', '语义相近但不是原文')).toBeNull()
  })

  it('V1 引用显示历史结果提示', () => {
    const html = renderToStaticMarkup(<PdfSourceEvidenceDrawer citation={{ documentName: '旧模组.pdf', page: 3 }} onClose={() => undefined} />)
    expect(html).toContain('V1 历史引用')
    expect(html).toContain('原文仅保存在此设备')
  })

  it('迁移后的 legacy citation 仍显示历史结果提示', () => {
    const html = renderToStaticMarkup(<PdfSourceEvidenceDrawer citation={{
      documentId: 'pdf_legacy_1234567890abcdef12345678',
      documentName: '旧模组.pdf',
      page: 3,
      evidenceId: 'ev_legacy_1234567890abcdef12345678',
      quote: '',
      verification: 'legacy',
    }} onClose={() => undefined} />)
    expect(html).toContain('V1 历史引用')
    expect(html).not.toContain('此设备没有对应原文页缓存')
  })
})
