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

  it('把 NPC 待导入草稿渲染为可打开详情的按钮，并提示战斗单位可能误分类', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <PdfCampaignKnowledgeBase
          analysis={{
            ...analysis,
            importCandidates: [{
              name: '伊利法军兵',
              description: '守序邪恶，作为召唤单位参与战斗。',
              kind: 'npc',
              automation: 'full',
              citations: [{ documentName: '模组.pdf', page: 10 }],
            }],
          }}
          mapHref="/campaign/test/maps"
          initialTab="imports"
          onEdit={vi.fn()}
          onPortraitChange={vi.fn()}
        />
      </MemoryRouter>,
    )

    expect(html).toContain('查看详情')
    expect(html).toContain('可能应归类为怪物')
    expect(html).toContain('<button')
  })
})
