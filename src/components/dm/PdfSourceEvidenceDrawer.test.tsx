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

  it('V2 引用提供精确页定位与原文书签工作区入口', () => {
    const html = renderToStaticMarkup(<PdfSourceEvidenceDrawer citation={{
      documentId: 'pdf_1234567890abcdef12345678',
      documentName: '模组原文.pdf',
      page: 12,
      evidenceId: 'ev_1234567890abcdef12345678',
      quote: '瑟维迪尔在鹿灯驿馆交付秘密来信。',
      verification: 'exact',
      pageRegion: [0.1, 0.2, 0.8, 0.32],
    }} onClose={() => undefined} onOpenWorkspace={() => undefined} />)
    expect(html).toContain('原始 PDF · 引用定位')
    expect(html).toContain('第 12 页')
    expect(html).toContain('在原文与书签中打开')
  })
})
