import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { PdfCampaignAnalysisV2 } from '../../lib/pdfCampaignAnalysisV2'
import type { CampaignJournalEntry } from '../../lib/roomCommunications'
import { createDefaultCampaignPrepPlan } from './dmSessionPrepPlanModel'
import { buildSessionReview, startCampaignSession } from './dmCampaignStoryModel'
import DmSessionLifecyclePanel from './DmSessionLifecyclePanel'
import DmStoryEventWorkspace from './DmStoryEventWorkspace'

const base = { aliases: [], evidenceIds: ['e1'], confidence: 1, reviewStatus: 'approved' as const, description: '', citations: [] }
const analysis: PdfCampaignAnalysisV2 = {
  schemaVersion: 2, documents: [], evidence: [], overview: '', analyzedChunks: 1,
  people: [{ ...base, id: 'p1', name: '艾莉诺拉', role: '调查者', personality: '', motivation: '', secret: '', voice: '' }],
  relationships: [], locations: [], factions: [],
  clues: [{ ...base, id: 'c1', name: '伪信', source: '', discovery: '', failForward: '' }],
  timelineEvents: [{ ...base, id: 't1', name: '教堂调查', location: '白鹿小教堂', npcs: ['艾莉诺拉'], monsters: [] }],
  scenes: [{ ...base, id: 's1', name: '教堂调查', location: '白鹿小教堂', npcs: ['艾莉诺拉'], monsters: [] }],
  encounters: [], importCandidates: [], prepTips: [], warnings: [],
}

const entry: CampaignJournalEntry = {
  id: 'journal-1', title: '发现伪信', body: '艾莉诺拉帮助玩家发现伪信。', source: 'dm',
  authorMemberId: 'dm', authorName: 'DM', createdAt: 2_000, updatedAt: 2_000,
}

describe('DmSessionLifecyclePanel', () => {
  it('显示备团运行入口和统一事件统计', () => {
    const plan = createDefaultCampaignPrepPlan(analysis)
    const html = renderToStaticMarkup(<MemoryRouter><DmSessionLifecyclePanel view="session" analysis={analysis} plan={plan} journalEntries={[]} journalConnected={false} communicationsHref="/communications" onPlanChange={vi.fn()} /></MemoryRouter>)
    expect(html).toContain('团务模式 · 备团')
    expect(html).toContain('开始本场团务')
    expect(html).toContain('统一剧情事件')
  })

  it('显示由本场日志生成且等待 DM 确认的复盘建议', () => {
    const plan = createDefaultCampaignPrepPlan(analysis)
    const running = startCampaignSession(plan.storyWorkspace!, plan.sessionTitle, [], 1_000)
    const reviewed = buildSessionReview(analysis, running, [entry], 3_000)
    const html = renderToStaticMarkup(<MemoryRouter><DmSessionLifecyclePanel view="review" analysis={analysis} plan={{ ...plan, storyWorkspace: reviewed }} journalEntries={[entry]} journalConnected communicationsHref="/communications" onPlanChange={vi.fn()} /></MemoryRouter>)
    expect(html).toContain('人物状态建议')
    expect(html).toContain('线索状态建议')
    expect(html).toContain('确认复盘并准备下一场')
    expect(html).toContain('艾莉诺拉')
    expect(html).toContain('伪信')
  })
})

describe('DmStoryEventWorkspace', () => {
  it('只显示一个合并后的事件，并保留场景关联', () => {
    const plan = createDefaultCampaignPrepPlan(analysis)
    const html = renderToStaticMarkup(<DmStoryEventWorkspace analysis={analysis} plan={plan} onPlanChange={vi.fn()} />)
    expect(html).toContain('1 个统一事件')
    expect(html).toContain('关联 1 个可运行场景')
    expect(html).toContain('剧情主线')
    expect(html).toContain('剧情世界线')
    expect(html).toContain('编辑剧情图')
    expect(html).toContain('点击节点查看完整内容')
    expect(html).toContain('全屏')
    expect(html).not.toContain('分支判断类型')
    expect(html).not.toContain('事件摘要')
  })
})
