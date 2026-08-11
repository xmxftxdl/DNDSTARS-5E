import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { PdfCampaignAnalysisV2 } from '../../lib/pdfCampaignAnalysisV2'
import DmSessionPrepDashboard from './DmSessionPrepDashboard'
import { calculateDmPrepReadiness } from './dmSessionPrepDashboardModel'

const analysis = {
  schemaVersion: 2,
  documents: [], evidence: [], analyzedChunks: 1,
  overview: '玩家即将抵达白鹿小教堂并调查伪信。',
  people: [{ id: 'p1', aliases: [], evidenceIds: [], confidence: 1, reviewStatus: 'approved', name: '艾莉诺拉', description: '', citations: [], role: '魔法伤痕调查者', personality: '', motivation: '', secret: '', voice: '' }],
  relationships: [], factions: [], locations: [],
  clues: [{ id: 'c1', aliases: [], evidenceIds: [], confidence: 1, reviewStatus: 'approved', name: '伪信', description: '', citations: [], source: '书柜', discovery: '调查', failForward: '' }],
  timelineEvents: [{ id: 't1', aliases: [], evidenceIds: [], confidence: 1, reviewStatus: 'approved', name: '抵达教堂', description: '', citations: [], location: '白鹿小教堂', npcs: [], monsters: [], gameTimeWorldMinute: 60 }],
  scenes: [{ id: 's1', aliases: [], evidenceIds: [], confidence: 1, reviewStatus: 'approved', name: '教堂调查', description: '', citations: [], location: '白鹿小教堂', npcs: ['艾莉诺拉'], monsters: [] }],
  encounters: [], importCandidates: [], prepTips: [], warnings: [],
} satisfies PdfCampaignAnalysisV2

describe('DmSessionPrepDashboard', () => {
  it('把分析结果变成本次备团摘要和快捷入口', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <DmSessionPrepDashboard analysis={analysis} campaignBasePath="/campaign/test" onOpenReview={vi.fn()} />
      </MemoryRouter>,
    )

    expect(html).toContain('本次备团')
    expect(html).toContain('白鹿小教堂')
    expect(html).toContain('艾莉诺拉')
    expect(html).toContain('伪信')
    expect(html).toContain('内容工坊')
  })

  it('根据结构化资料计算备团就绪度', () => {
    expect(calculateDmPrepReadiness(null)).toBe(10)
    expect(calculateDmPrepReadiness(analysis)).toBeGreaterThan(50)
  })
})
