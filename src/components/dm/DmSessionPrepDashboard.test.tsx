import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { PdfCampaignAnalysisV2 } from '../../lib/pdfCampaignAnalysisV2'
import DmSessionPrepDashboard from './DmSessionPrepDashboard'
import { calculateDmPrepReadiness } from './dmSessionPrepDashboardModel'
import { createDefaultCampaignPrepPlan } from './dmSessionPrepPlanModel'

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
        <DmSessionPrepDashboard
          analysis={analysis}
          campaignBasePath="/campaign/test"
          plan={createDefaultCampaignPrepPlan(analysis)}
          onPlanChange={vi.fn()}
          onSave={vi.fn()}
          onOpenReview={vi.fn()}
          onOpenStory={vi.fn()}
        />
      </MemoryRouter>,
    )

    expect(html).toContain('本次备团')
    expect(html).toContain('data-session-prep-contrast-surface="true"')
    expect(html).toContain('白鹿小教堂')
    expect(html).toContain('选择本场剧情节点')
    expect(html).toContain('抵达教堂')
    expect(html).toContain('自动带入本场素材')
    expect(html).toContain('建议选择 1–3 个')
    expect(html).toContain('可运行场景')
    expect(html).toContain('登场人物')
    expect(html).toContain('关键线索')
    expect(html).toContain('查看剧情流程图与原文书签')
    expect(html).not.toContain('<h3 class="text-sm font-semibold text-slate-100">关键人物</h3>')
    expect(html).not.toContain('<h3 class="text-sm font-semibold text-slate-100">关键线索</h3>')
    expect(html).toContain('内容工坊')
    expect(html).toContain('保存本次备团')
    expect(html).toContain('开团前检查')
  })

  it('根据结构化资料计算备团就绪度', () => {
    expect(calculateDmPrepReadiness(null)).toBe(10)
    expect(calculateDmPrepReadiness(analysis)).toBeGreaterThan(50)
  })
})
