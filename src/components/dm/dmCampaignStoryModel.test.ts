import { describe, expect, it } from 'vitest'
import type { AccountCampaignPrepPlanDraftV1 } from '../../lib/accountApi'
import type { PdfCampaignAnalysisV2 } from '../../lib/pdfCampaignAnalysisV2'
import type { CampaignJournalEntry } from '../../lib/roomCommunications'
import {
  applySessionReview,
  buildSessionReview,
  canonicalStoryEvents,
  createStoryWorkspace,
  evaluateStoryLinkCondition,
  orderedStoryEvents,
  startCampaignSession,
  storyEventAvailability,
  synchronizeStoryWorkspace,
} from './dmCampaignStoryModel'

const namedBase = { aliases: [], evidenceIds: ['e1'], confidence: 1, reviewStatus: 'approved' as const, description: '', citations: [] }
const analysis: PdfCampaignAnalysisV2 = {
  schemaVersion: 2,
  documents: [], evidence: [], overview: '', analyzedChunks: 1,
  people: [{ ...namedBase, id: 'person-elinora', name: '艾莉诺拉', role: '调查者', personality: '', motivation: '', secret: '', voice: '' }],
  relationships: [], locations: [], factions: [],
  clues: [{ ...namedBase, id: 'clue-letter', name: '伪信', source: '书柜', discovery: '调查', failForward: '' }],
  timelineEvents: [{ ...namedBase, id: 'timeline-chapel', name: '调查白鹿小教堂', description: '艾莉诺拉协助调查伪信。', location: '白鹿小教堂', npcs: ['艾莉诺拉'], monsters: [], time: '当日黄昏' }],
  scenes: [{ ...namedBase, id: 'scene-chapel', name: '调查白鹿小教堂', description: '检查书柜中的伪信。', location: '白鹿小教堂', npcs: ['艾莉诺拉'], monsters: [] }],
  encounters: [], importCandidates: [], prepTips: [], warnings: [],
}

function journal(id: string, title: string, body: string, createdAt: number): CampaignJournalEntry {
  return { id, title, body, source: 'dm', authorMemberId: 'dm', authorName: 'DM', createdAt, updatedAt: createdAt }
}

describe('dmCampaignStoryModel', () => {
  it('把同一时间线节点与可运行场景合并为一个 StoryEvent', () => {
    const events = canonicalStoryEvents(analysis)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      title: '调查白鹿小教堂',
      sourceEventIds: ['timeline-chapel'],
      sceneIds: ['scene-chapel'],
      personIds: ['person-elinora'],
      clueIds: ['clue-letter'],
    })
    expect(events[0]?.details).toContain('艾莉诺拉协助调查伪信。')
    expect(events[0]?.details).toContain('检查书柜中的伪信。')
    expect(events[0]?.details).toContain('地点：白鹿小教堂')
    expect(events[0]?.details).toContain('涉及人物：艾莉诺拉')
  })

  it('不会把未关联的可运行场景逐条复制为统一事件', () => {
    const events = canonicalStoryEvents({
      ...analysis,
      scenes: [
        ...analysis.scenes,
        { ...namedBase, id: 'scene-inn', name: '酒馆闲谈', description: '供 DM 运行的可选场景。', location: '鹿灯驿馆', npcs: [], monsters: [] },
      ],
    })
    expect(events).toHaveLength(1)
    expect(events[0]?.sceneIds).toEqual(['scene-chapel'])
  })

  it('不会因为两个事件引用同一段证据就把它们错误合并', () => {
    const events = canonicalStoryEvents({
      ...analysis,
      scenes: [],
      timelineEvents: [
        { ...analysis.timelineEvents![0]!, id: 'event-search', name: '搜查书柜', description: '玩家发现夹层。', evidenceIds: ['same-page'] },
        { ...analysis.timelineEvents![0]!, id: 'event-ambush', name: '伏击者现身', description: '机关触发后伏击者破窗而入。', evidenceIds: ['same-page'] },
      ],
    })

    expect(events.map((event) => event.title)).toEqual(['搜查书柜', '伏击者现身'])
    expect(events[0]?.details).toContain('玩家发现夹层。')
    expect(events[1]?.details).toContain('机关触发后伏击者破窗而入。')
  })

  it('同步时清除旧版场景投影且重复同步不会再次膨胀', () => {
    const legacyWorkspace = createStoryWorkspace(analysis)
    legacyWorkspace.events.push({
      ...legacyWorkspace.events[0]!,
      id: 'legacy-scene-only',
      title: '酒馆闲谈',
      source: 'analysis-scene',
      sourceEventIds: [],
      sceneIds: ['scene-inn'],
    })
    legacyWorkspace.events.push({ ...createDmStoryEventForTest(), id: 'dm-event' })

    const first = synchronizeStoryWorkspace(legacyWorkspace, analysis)
    const second = synchronizeStoryWorkspace(first, analysis)
    expect(first.events.map((event) => event.id)).toEqual([legacyWorkspace.events[0]!.id, 'dm-event'])
    expect(second.events).toEqual(first.events)
  })

  it('同步旧版过度合并节点时拆分事件且不会产生重复 ID', () => {
    const splitAnalysis: PdfCampaignAnalysisV2 = {
      ...analysis,
      scenes: [],
      timelineEvents: [
        { ...analysis.timelineEvents![0]!, id: 'event-search', name: '搜查书柜', description: '玩家发现夹层。', evidenceIds: ['same-page'] },
        { ...analysis.timelineEvents![0]!, id: 'event-ambush', name: '伏击者现身', description: '伏击者破窗而入。', evidenceIds: ['same-page'] },
      ],
    }
    const legacy = createStoryWorkspace(splitAnalysis)
    legacy.events = [{
      ...legacy.events[0]!,
      id: 'legacy-merged-event',
      title: '搜查书柜 / 伏击者现身',
      summary: '玩家发现夹层。\n\n伏击者破窗而入。',
      details: '旧版混合详情',
      sourceEventIds: ['event-search', 'event-ambush'],
    }]
    legacy.graphLinks = []

    const synchronized = synchronizeStoryWorkspace(legacy, splitAnalysis)
    expect(synchronized.events).toHaveLength(2)
    expect(new Set(synchronized.events.map((event) => event.id)).size).toBe(2)
    expect(synchronized.events.map((event) => event.summary)).toEqual(['玩家发现夹层。', '伏击者破窗而入。'])
    expect(synchronized.events[0]?.details).not.toContain('旧版混合详情')
  })

  it('使用 DM 剧情连线决定团务事件顺序，而不是沿用 AI 数组顺序', () => {
    const first = { ...createDmStoryEventForTest(), id: 'first', title: '开场', graphPosition: { x: 20, y: 120 } }
    const yes = { ...createDmStoryEventForTest(), id: 'yes', title: '接受委托', graphPosition: { x: 320, y: 40 } }
    const no = { ...createDmStoryEventForTest(), id: 'no', title: '拒绝委托', graphPosition: { x: 320, y: 260 } }
    const workspace = {
      schemaVersion: 1 as const,
      mode: 'prep' as const,
      events: [no, yes, first],
      graphLinks: [
        { id: 'link-yes', fromEventId: 'first', toEventId: 'yes', label: '是' },
        { id: 'link-no', fromEventId: 'first', toEventId: 'no', label: '否' },
      ],
      graphInitialized: true,
      personStates: [],
      clueStates: [],
      recaps: [],
    }
    expect(orderedStoryEvents(workspace).map((event) => event.id)).toEqual(['first', 'yes', 'no'])
  })

  it('根据人物生死状态判断互斥分支，并在前置事件完成后开放正确节点', () => {
    const first = { ...createDmStoryEventForTest(), id: 'first', status: 'completed' as const }
    const dead = { ...createDmStoryEventForTest(), id: 'dead-route' }
    const alive = { ...createDmStoryEventForTest(), id: 'alive-route' }
    const workspace = {
      schemaVersion: 1 as const,
      mode: 'running' as const,
      events: [first, dead, alive],
      graphLinks: [
        { id: 'dead-link', fromEventId: 'first', toEventId: 'dead-route', label: '', condition: { kind: 'person-state' as const, personId: 'person-elinora', state: 'dead' as const } },
        { id: 'alive-link', fromEventId: 'first', toEventId: 'alive-route', label: '', condition: { kind: 'person-state' as const, personId: 'person-elinora', state: 'alive' as const } },
      ],
      graphInitialized: true,
      graphLayoutVersion: 2 as const,
      personStates: [{ personId: 'person-elinora', status: 'dead' as const, note: '', updatedBySessionId: 'session' }],
      clueStates: [],
      activeSession: { id: 'session', title: '测试团务', startedAt: 1, baselineJournalEntryIds: [], journalEntryIds: [] },
      recaps: [],
    }
    expect(evaluateStoryLinkCondition(workspace.graphLinks[0]!, workspace)).toBe('matched')
    expect(evaluateStoryLinkCondition(workspace.graphLinks[1]!, workspace)).toBe('blocked')
    expect(storyEventAvailability(workspace, 'dead-route')).toBe('available')
    expect(storyEventAvailability(workspace, 'alive-route')).toBe('blocked')
  })

  it('把 AI 直接推理的因果前提与人物生死分支转换为剧情图，而不是按数组顺序串联', () => {
    const causalAnalysis: PdfCampaignAnalysisV2 = {
      ...analysis,
      scenes: [],
      timelineEvents: [
        { ...analysis.timelineEvents![0]!, id: 'event-choice', evidenceIds: ['e-choice'], name: '审判嫌疑人', location: '审判厅', causedBy: [], causalExplanation: '', branchCondition: '', branchPerson: '', branchPersonState: 'unspecified' },
        { ...analysis.timelineEvents![0]!, id: 'event-dead', evidenceIds: ['e-dead'], name: '继承人复仇', location: '城门', causedBy: ['审判嫌疑人'], causalExplanation: '处决引发继承人的复仇。', branchCondition: '艾莉诺拉被处决', branchPerson: '艾莉诺拉', branchPersonState: 'dead' },
        { ...analysis.timelineEvents![0]!, id: 'event-alive', evidenceIds: ['e-alive'], name: '嫌疑人作证', location: '议事厅', causedBy: ['审判嫌疑人'], causalExplanation: '幸存者提供关键证词。', branchCondition: '艾莉诺拉仍然存活', branchPerson: '艾莉诺拉', branchPersonState: 'alive' },
      ],
    }
    const workspace = createStoryWorkspace(causalAnalysis)
    expect(workspace.graphLinks).toHaveLength(2)
    expect(workspace.graphLinks).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: '处决引发继承人的复仇。', condition: { kind: 'person-state', personId: 'person-elinora', state: 'dead' } }),
      expect.objectContaining({ label: '幸存者提供关键证词。', condition: { kind: 'person-state', personId: 'person-elinora', state: 'alive' } }),
    ]))
    expect(workspace.events.find((event) => event.title === '继承人复仇')?.details).toContain('直接前因：审判嫌疑人')
    expect(workspace.events.find((event) => event.title === '继承人复仇')?.details).toContain('分支条件：艾莉诺拉被处决')
    expect(workspace.graphLinks?.every((link) => workspace.events.find((event) => event.id === link.fromEventId)?.title === '审判嫌疑人')).toBe(true)
  })

  it('只使用本场新增日志生成复盘，并在 DM 确认后更新人物、线索和下一场清单', () => {
    const before = journal('before', '旧日志', '旧记录提及伪信。', 900)
    const workspace = startCampaignSession(createStoryWorkspace(analysis), '调查伪信', [before], 1_000)
    const active = { ...workspace, events: workspace.events.map((event) => ({ ...event, status: 'active' as const })) }
    const current = journal('current', '教堂调查', '艾莉诺拉协助玩家发现伪信，并破解了伪造方式。', 1_100)
    const reviewed = buildSessionReview(analysis, active, [before, current], 1_200)
    expect(reviewed.mode).toBe('review')
    expect(reviewed.activeSession?.journalEntryIds).toEqual(['current'])
    expect(reviewed.activeSession?.review?.personUpdates).toEqual(expect.arrayContaining([
      expect.objectContaining({ personId: 'person-elinora', accepted: true }),
    ]))
    expect(reviewed.activeSession?.review?.clueUpdates).toEqual(expect.arrayContaining([
      expect.objectContaining({ clueId: 'clue-letter', status: 'resolved', accepted: true }),
    ]))

    const plan: AccountCampaignPrepPlanDraftV1 = {
      schemaVersion: 1,
      sessionTitle: '调查伪信',
      objective: '',
      selectedStoryEventIds: [], selectedSceneIds: [], selectedPersonIds: [], selectedClueIds: [],
      checklist: [], privateNotes: '', storyWorkspace: reviewed,
    }
    const applied = applySessionReview(plan)
    expect(applied.storyWorkspace?.mode).toBe('prep')
    expect(applied.storyWorkspace?.activeSession).toBeUndefined()
    expect(applied.storyWorkspace?.recaps).toHaveLength(1)
    expect(applied.storyWorkspace?.personStates[0]?.personId).toBe('person-elinora')
    expect(applied.storyWorkspace?.clueStates[0]).toMatchObject({ clueId: 'clue-letter', status: 'resolved' })
    expect(applied.checklist.length).toBeGreaterThan(0)
  })
})

function createDmStoryEventForTest() {
  return {
    id: 'dm-event',
    title: 'DM 新增事件',
    summary: '',
    details: '',
    timeLabel: '',
    status: 'planned' as const,
    source: 'dm' as const,
    sourceEventIds: [],
    sceneIds: [],
    personIds: [],
    clueIds: [],
    tags: [],
  }
}
