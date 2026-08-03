import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { PdfCampaignAnalysisV1 } from '../../lib/pdfCampaignAnalysis'
import PdfCampaignKnowledgeBase from './PdfCampaignKnowledgeBase'

const analysis: PdfCampaignAnalysisV1 = {
  schemaVersion: 1,
  overview: '测试战役',
  people: [], relationships: [], locations: [], factions: [], clues: [], scenes: [], encounters: [], prepTips: [], warnings: [],
  importCandidates: [],
  documents: [],
  analyzedChunks: 0,
}

describe('PdfCampaignKnowledgeBase', () => {
  it('把分析结果组织为独立页签、搜索模式、地图、怪物图鉴和关系图入口', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <PdfCampaignKnowledgeBase
          analysis={analysis}
          mapHref="/campaign/test/maps"
          onEdit={vi.fn()}
          onPortraitChange={vi.fn()}
        />
      </MemoryRouter>,
    )

    expect(html).toContain('战役知识库')
    expect(html).toContain('全库搜索模式')
    expect(html).toContain('怪物图鉴')
    expect(html).toContain('人物关系图')
    expect(html).toContain('地图')
    expect(html).toContain('编辑知识库')
  })
})
