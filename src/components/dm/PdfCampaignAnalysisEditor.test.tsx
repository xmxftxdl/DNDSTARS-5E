import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { PdfCampaignAnalysisV1 } from '../../lib/pdfCampaignAnalysis'
import PdfCampaignAnalysisEditor from './PdfCampaignAnalysisEditor'

const analysis: PdfCampaignAnalysisV1 = {
  schemaVersion: 1,
  overview: '帝国伪信引发两派冲突。',
  documents: [{ name: 'module.pdf', pageCount: 20, extractedCharacters: 20_000, scannedPages: [] }],
  analyzedChunks: 4,
  people: [{ name: '艾莉诺拉', description: '调查伪信。', role: '法师', appearance: '银发', personality: '谨慎', motivation: '查明真相', secret: '', voice: '言辞克制', citations: [{ documentName: 'module.pdf', page: 4 }] }],
  relationships: [{ from: '艾莉诺拉', to: '翠羽城', type: '调查', description: '', citations: [{ documentName: 'module.pdf', page: 4 }] }],
  locations: [{ name: '翠羽城', description: '', citations: [] }],
  factions: [],
  clues: [],
  scenes: [],
  encounters: [],
  importCandidates: [],
  prepTips: [],
  warnings: [],
}

describe('PdfCampaignAnalysisEditor', () => {
  it('提供分类审阅、可编辑概览和只读证据说明', () => {
    const html = renderToStaticMarkup(<PdfCampaignAnalysisEditor analysis={analysis} onChange={() => undefined} onClose={() => undefined} />)

    expect(html).toContain('DM 分析结果审阅器')
    expect(html).toContain('总览')
    expect(html).toContain('人物')
    expect(html).toContain('待导入资源')
    expect(html).toContain('复核事项')
    expect(html).toContain('全书概览')
    expect(html).toContain('帝国伪信引发两派冲突。')
    expect(html).toContain('PDF 原文与引用页码保持不变')
  })
})
