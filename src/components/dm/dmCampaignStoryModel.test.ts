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
  removeStoryGraphLink,
  resolveStoryBranch,
  startCampaignSession,
  storyEventAvailability,
  storyEventSourceCitations,
  synchronizeStoryBranchEventStatuses,
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
  it('把剧情节点的时间线与场景证据合并为去重的原文书签', () => {
    const evidence = {
      id: 'evidence-chapel',
      documentId: 'document-module',
      documentName: '白鹿小教堂.pdf',
      page: 12,
      chunkId: 'chunk-12',
      quote: '艾莉诺拉在书柜夹层中发现了伪信。',
      normalizedQuoteSha256: 'quote-hash',
      verification: 'exact' as const,
    }
    const withEvidence: PdfCampaignAnalysisV2 = {
      ...analysis,
      evidence: [evidence],
      timelineEvents: [{ ...analysis.timelineEvents![0]!, evidenceIds: [evidence.id], citations: [] }],
      scenes: [{
        ...analysis.scenes[0]!,
        evidenceIds: [evidence.id],
        citations: [{
          documentId: evidence.documentId,
          documentName: evidence.documentName,
          page: evidence.page,
          evidenceId: evidence.id,
          quote: evidence.quote,
          verification: evidence.verification,
        }],
      }],
    }
    const event = canonicalStoryEvents(withEvidence)[0]!

    expect(storyEventSourceCitations(event, withEvidence)).toEqual([expect.objectContaining({
      evidenceId: evidence.id,
      documentName: evidence.documentName,
      page: 12,
      quote: evidence.quote,
    })])
  })

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
    expect(events[0]?.summary).toBe('艾莉诺拉协助调查伪信。')
    expect(events[0]?.details).toContain('艾莉诺拉协助调查伪信。')
    expect(events[0]?.details).not.toContain('检查书柜中的伪信。')
    expect(events[0]?.details).toContain('地点：白鹿小教堂')
    expect(events[0]?.details).toContain('涉及人物：艾莉诺拉')
  })

  it('按 SOL 全书顺序排列事件而不是依赖分段或保存顺序', () => {
    const events = canonicalStoryEvents({
      ...analysis,
      scenes: [],
      timelineEvents: [
        { ...analysis.timelineEvents![0]!, id: 'late', name: '后发生', timelineOrder: 20 },
        { ...analysis.timelineEvents![0]!, id: 'early', name: '先发生', timelineOrder: 10 },
      ],
    })

    expect(events.map((event) => event.title)).toEqual(['先发生', '后发生'])
    expect(events.map((event) => event.timelineOrder)).toEqual([10, 20])
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

  it('刷新 AI 事件正文但只保留明确由 DM 编辑的字段、状态和位置', () => {
    const workspace = createStoryWorkspace(analysis)
    workspace.events[0] = {
      ...workspace.events[0]!,
      summary: 'DM 改写摘要',
      details: '旧版 AI 详情',
      status: 'active',
      graphPosition: { x: 120, y: 340 },
      dmEditedFields: ['summary'],
    }
    const refreshed = synchronizeStoryWorkspace(workspace, {
      ...analysis,
      timelineEvents: [{
        ...analysis.timelineEvents![0]!,
        description: 'SOL 新摘要。',
      }],
    })

    expect(refreshed.events[0]).toMatchObject({
      summary: 'DM 改写摘要',
      status: 'active',
      graphPosition: { x: 120, y: 340 },
      dmEditedFields: ['summary'],
    })
    expect(refreshed.events[0]?.details).toContain('SOL 新摘要。')
    expect(refreshed.events[0]?.details).not.toContain('旧版 AI 详情')
    expect(refreshed.events[0]?.details).not.toContain('检查书柜中的伪信。')
  })

  it('旧工作区的空图会接入 SOL 因果关系，DM 明确清空后则保持为空', () => {
    const causalAnalysis: PdfCampaignAnalysisV2 = {
      ...analysis,
      scenes: [],
      timelineEvents: [
        { ...analysis.timelineEvents![0]!, id: 'event-start', name: '收到委托', causedBy: [] },
        { ...analysis.timelineEvents![0]!, id: 'event-investigate', name: '展开调查', causedBy: ['收到委托'], causalExplanation: '委托开启调查。' },
      ],
    }
    const legacyEmpty = createStoryWorkspace(causalAnalysis)
    legacyEmpty.graphLinks = []
    legacyEmpty.graphLayoutVersion = 4
    legacyEmpty.events[0] = { ...legacyEmpty.events[0]!, graphPosition: { x: 180, y: 260 } }
    delete legacyEmpty.graphEditedByDm
    const adopted = synchronizeStoryWorkspace(legacyEmpty, causalAnalysis)
    expect(adopted.graphLinks).toEqual([
      expect.objectContaining({ label: '委托开启调查。' }),
    ])
    expect(adopted.graphEditedByDm).toBe(false)
    expect(adopted.graphLayoutVersion).toBe(4)
    expect(adopted.events[0]?.graphPosition).toEqual({ x: 180, y: 260 })

    const ambiguousLegacyEmpty = synchronizeStoryWorkspace({
      ...legacyEmpty,
      graphLinks: [],
      graphEditedByDm: true,
    }, causalAnalysis)
    expect(ambiguousLegacyEmpty.graphLinks).toHaveLength(1)
    expect(ambiguousLegacyEmpty.graphEditedByDm).toBe(false)

    const intentionallyEmpty = synchronizeStoryWorkspace({
      ...legacyEmpty,
      graphLinks: [],
      graphEditedByDm: true,
      graphLinksClearedByDm: true,
    }, causalAnalysis)
    expect(intentionallyEmpty.graphLinks).toEqual([])
    expect(intentionallyEmpty.graphEditedByDm).toBe(true)
    expect(intentionallyEmpty.graphLinksClearedByDm).toBe(true)
  })

  it('重新分析后 DM 旧箭头全部失效时自动恢复 SOL 因果图', () => {
    const causalAnalysis: PdfCampaignAnalysisV2 = {
      ...analysis,
      scenes: [],
      timelineEvents: [
        { ...analysis.timelineEvents![0]!, id: 'event-start', name: '收到委托', causedBy: [] },
        { ...analysis.timelineEvents![0]!, id: 'event-investigate', name: '展开调查', causedBy: ['收到委托'], causalExplanation: '委托开启调查。' },
      ],
    }
    const stale = createStoryWorkspace(causalAnalysis)
    stale.graphEditedByDm = true
    stale.graphLinks = [{
      id: 'stale-link',
      fromEventId: 'removed-event-a',
      toEventId: 'removed-event-b',
      label: '旧箭头',
      condition: { kind: 'always' },
    }]

    const recovered = synchronizeStoryWorkspace(stale, causalAnalysis)

    expect(recovered.graphLinks).toEqual([
      expect.objectContaining({ label: '委托开启调查。' }),
    ])
    expect(recovered.graphEditedByDm).toBe(false)
  })

  it('载入时自动把已移除的单线投影迁回 SOL 原始分支', () => {
    const causalAnalysis: PdfCampaignAnalysisV2 = {
      ...analysis,
      scenes: [],
      timelineEvents: [
        { ...analysis.timelineEvents![0]!, id: 'event-choice', name: '决定是否同行', causedBy: [] },
        { ...analysis.timelineEvents![0]!, id: 'event-go', name: '同行护送', causedBy: ['决定是否同行'], causalExplanation: '玩家选择同行。' },
        { ...analysis.timelineEvents![0]!, id: 'event-stay', name: '留在驿馆', causedBy: ['决定是否同行'], causalExplanation: '玩家选择留守。' },
      ],
    }
    const original = createStoryWorkspace(causalAnalysis)
    const byTitle = new Map(original.events.map((event) => [event.title, event.id]))
    const dmEvent = { ...createDmStoryEventForTest(), id: 'dm-follow-up', title: 'DM 后续事件' }
    const migrated = synchronizeStoryWorkspace({
      ...original,
      events: [...original.events, dmEvent],
      graphLinks: [
        { id: 'story-link-m123abc-0', fromEventId: byTitle.get('决定是否同行')!, toEventId: byTitle.get('同行护送')!, label: '', condition: { kind: 'always' as const } },
        { id: 'story-link-m123abc-1', fromEventId: byTitle.get('同行护送')!, toEventId: byTitle.get('留在驿馆')!, label: '', condition: { kind: 'always' as const } },
        { id: 'story-link-m123abc-2', fromEventId: byTitle.get('留在驿馆')!, toEventId: dmEvent.id, label: '', condition: { kind: 'always' as const } },
      ],
      graphEditedByDm: true,
      graphLayoutVersion: 4,
    }, causalAnalysis)
    const titleById = new Map(migrated.events.map((event) => [event.id, event.title]))

    expect(migrated.graphLinks?.map((link) => [titleById.get(link.fromEventId), titleById.get(link.toEventId), link.label])).toEqual([
      ['决定是否同行', '同行护送', '玩家选择同行。'],
      ['决定是否同行', '留在驿馆', '玩家选择留守。'],
    ])
    expect(migrated.events.some((event) => event.id === dmEvent.id)).toBe(true)
    expect(migrated.graphEditedByDm).toBe(false)
    expect(migrated.graphLayoutVersion).toBe(2)
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

  it('旧人物条件只保留说明文字，分支改由 DM 三态决定', () => {
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
    expect(evaluateStoryLinkCondition(workspace.graphLinks[0]!, workspace)).toBe('manual')
    expect(evaluateStoryLinkCondition(workspace.graphLinks[1]!, workspace)).toBe('manual')
    expect(storyEventAvailability(workspace, 'dead-route')).toBe('waiting')
    expect(storyEventAvailability(workspace, 'alive-route')).toBe('waiting')

    const ruled = {
      ...workspace,
      graphLinks: workspace.graphLinks.map((link) => ({
        ...link,
        resolution: link.id === 'dead-link' ? 'triggered' as const : 'not-triggered' as const,
      })),
    }
    expect(storyEventAvailability(ruled, 'dead-route')).toBe('available')
    expect(storyEventAvailability(ruled, 'alive-route')).toBe('blocked')
  })

  it('旧事件条件不再自动裁定，仍可由 DM 三态覆盖', () => {
    const gate = { ...createDmStoryEventForTest(), id: 'gate', status: 'completed' as const }
    const alarm = { ...createDmStoryEventForTest(), id: 'alarm', title: '警报被触发', status: 'completed' as const }
    const alarmRoute = { ...createDmStoryEventForTest(), id: 'alarm-route' }
    const quietRoute = { ...createDmStoryEventForTest(), id: 'quiet-route' }
    const workspace = {
      schemaVersion: 1 as const,
      mode: 'running' as const,
      events: [gate, alarm, alarmRoute, quietRoute],
      graphLinks: [
        { id: 'alarm-link', fromEventId: 'gate', toEventId: 'alarm-route', label: '', condition: { kind: 'event-status' as const, eventId: 'alarm', status: 'completed' as const } },
        { id: 'quiet-link', fromEventId: 'gate', toEventId: 'quiet-route', label: '', condition: { kind: 'event-status' as const, eventId: 'alarm', status: 'skipped' as const } },
      ],
      graphInitialized: true,
      personStates: [],
      clueStates: [],
      recaps: [],
    }

    expect(evaluateStoryLinkCondition(workspace.graphLinks[0]!, workspace)).toBe('manual')
    expect(evaluateStoryLinkCondition(workspace.graphLinks[1]!, workspace)).toBe('manual')

    const ruled = {
      ...workspace,
      graphLinks: workspace.graphLinks.map((link) => ({
        ...link,
        resolution: link.id === 'alarm-link' ? 'triggered' as const : 'not-triggered' as const,
      })),
    }
    expect(evaluateStoryLinkCondition(ruled.graphLinks[0]!, ruled)).toBe('matched')
    expect(evaluateStoryLinkCondition(ruled.graphLinks[1]!, ruled)).toBe('blocked')
  })

  it('让 DM 的分支裁定覆盖条件，并把未触发支线的全部后继标记为不可达', () => {
    const choice = { ...createDmStoryEventForTest(), id: 'choice', nodeKind: 'decision' as const, status: 'completed' as const }
    const chosen = { ...createDmStoryEventForTest(), id: 'chosen' }
    const abandoned = { ...createDmStoryEventForTest(), id: 'abandoned' }
    const abandonedEnding = { ...createDmStoryEventForTest(), id: 'abandoned-ending' }
    const workspace = {
      schemaVersion: 1 as const,
      mode: 'running' as const,
      events: [choice, chosen, abandoned, abandonedEnding],
      graphLinks: [
        { id: 'chosen-link', fromEventId: 'choice', toEventId: 'chosen', label: '同行', condition: { kind: 'manual' as const, expression: '玩家决定同行' }, resolution: 'triggered' as const },
        { id: 'abandoned-link', fromEventId: 'choice', toEventId: 'abandoned', label: '留守', condition: { kind: 'manual' as const, expression: '玩家决定留守' }, resolution: 'not-triggered' as const },
        { id: 'abandoned-ending-link', fromEventId: 'abandoned', toEventId: 'abandoned-ending', label: '', condition: { kind: 'always' as const } },
      ],
      graphInitialized: true,
      personStates: [],
      clueStates: [],
      recaps: [],
    }

    expect(evaluateStoryLinkCondition(workspace.graphLinks[0]!, workspace)).toBe('matched')
    expect(evaluateStoryLinkCondition(workspace.graphLinks[1]!, workspace)).toBe('blocked')
    expect(storyEventAvailability(workspace, 'chosen')).toBe('available')
    expect(storyEventAvailability(workspace, 'abandoned')).toBe('blocked')
    expect(storyEventAvailability(workspace, 'abandoned-ending')).toBe('blocked')

    const synchronized = synchronizeStoryBranchEventStatuses(workspace)
    expect(synchronized.events.find((event) => event.id === 'chosen')?.status).toBe('planned')
    expect(synchronized.events.find((event) => event.id === 'abandoned')).toMatchObject({ status: 'not-triggered', statusAutomation: 'branch' })
    expect(synchronized.events.find((event) => event.id === 'abandoned-ending')).toMatchObject({ status: 'not-triggered', statusAutomation: 'branch' })

    const reset = resolveStoryBranch(synchronized, 'chosen-link', 'pending')
    expect(reset.events.find((event) => event.id === 'choice')?.status).toBe('planned')
    expect(reset.events.find((event) => event.id === 'abandoned')?.status).toBe('planned')
    expect(reset.events.find((event) => event.id === 'abandoned-ending')?.status).toBe('planned')
    expect(reset.graphLinks?.map((link) => link.resolution)).toEqual(['pending', 'pending', undefined])
    const switched = resolveStoryBranch(reset, 'abandoned-link', 'triggered')
    expect(switched.events.find((event) => event.id === 'choice')?.status).toBe('completed')
    expect(switched.graphLinks?.map((link) => link.resolution)).toEqual(['not-triggered', 'triggered', undefined])
    expect(storyEventAvailability(switched, 'chosen')).toBe('blocked')
    expect(storyEventAvailability(switched, 'abandoned')).toBe('available')

    const removed = removeStoryGraphLink(switched, 'abandoned-link')
    expect(removed.events.map((event) => event.id)).toEqual(['choice', 'chosen', 'abandoned', 'abandoned-ending'])
    expect(removed.graphLinks?.map((link) => link.id)).toEqual(['chosen-link', 'abandoned-ending-link'])
    expect(removed.events.find((event) => event.id === 'choice')?.status).toBe('planned')
    expect(removed.graphLinks?.find((link) => link.id === 'chosen-link')?.resolution).toBe('pending')
  })

  it('只在所有入边条件都未触发时自动设为未触发，待决定或任一触发会恢复', () => {
    const left = { ...createDmStoryEventForTest(), id: 'left', status: 'completed' as const }
    const right = { ...createDmStoryEventForTest(), id: 'right', status: 'completed' as const }
    const target = { ...createDmStoryEventForTest(), id: 'target' }
    const workspace = {
      schemaVersion: 1 as const,
      mode: 'running' as const,
      events: [left, right, target],
      graphLinks: [
        { id: 'left-target', fromEventId: 'left', toEventId: 'target', label: '左路', condition: { kind: 'manual' as const, expression: '左路成功' }, resolution: 'not-triggered' as const },
        { id: 'right-target', fromEventId: 'right', toEventId: 'target', label: '右路', condition: { kind: 'manual' as const, expression: '右路成功' }, resolution: 'not-triggered' as const },
      ],
      personStates: [],
      clueStates: [],
      activeSession: { id: 'session', title: '测试', startedAt: 1, baselineJournalEntryIds: [], journalEntryIds: [] },
      recaps: [],
    }

    const blocked = synchronizeStoryBranchEventStatuses(workspace)
    expect(blocked.events.find((event) => event.id === 'target')).toMatchObject({ status: 'not-triggered', statusAutomation: 'branch' })

    const waiting = synchronizeStoryBranchEventStatuses({
      ...blocked,
      graphLinks: blocked.graphLinks?.map((link) => link.id === 'right-target' ? { ...link, resolution: 'pending' as const } : link),
    })
    expect(storyEventAvailability(waiting, 'target')).toBe('waiting')
    expect(waiting.events.find((event) => event.id === 'target')?.status).toBe('planned')
    expect(waiting.events.find((event) => event.id === 'target')?.statusAutomation).toBeUndefined()

    const triggered = synchronizeStoryBranchEventStatuses({
      ...blocked,
      graphLinks: blocked.graphLinks?.map((link) => link.id === 'right-target' ? { ...link, resolution: 'triggered' as const } : link),
    })
    expect(storyEventAvailability(triggered, 'target')).toBe('available')
    expect(triggered.events.find((event) => event.id === 'target')?.status).toBe('planned')
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

  it('为同一目标的多个前因保留各自独立的条件和箭头标签', () => {
    const branchAnalysis: PdfCampaignAnalysisV2 = {
      ...analysis,
      scenes: [],
      timelineEvents: [
        { ...analysis.timelineEvents![0]!, id: 'escort', name: '同行护送', causedBy: [], causalBranches: [] },
        { ...analysis.timelineEvents![0]!, id: 'investigate', name: '留守调查', causedBy: [], causalBranches: [] },
        {
          ...analysis.timelineEvents![0]!,
          id: 'city',
          name: '进入翠羽城',
          causedBy: ['同行护送', '留守调查'],
          causalBranches: [
            { sourceEvent: '同行护送', label: '护送成功', condition: '瑟维迪尔得到保护', explanation: '使节亲自作证。', branchPerson: '', branchPersonState: 'unspecified' },
            { sourceEvent: '留守调查', label: '取得证据', condition: '玩家找到伪信证据', explanation: '证据允许玩家通过盘问。', branchPerson: '', branchPersonState: 'unspecified' },
          ],
          causalExplanation: '', branchCondition: '', branchPerson: '', branchPersonState: 'unspecified',
        },
      ],
    }
    const workspace = createStoryWorkspace(branchAnalysis)
    expect(workspace.graphLinks).toHaveLength(2)
    expect(workspace.graphLinks).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: '护送成功', condition: { kind: 'manual', expression: '瑟维迪尔得到保护' } }),
      expect.objectContaining({ label: '取得证据', condition: { kind: 'manual', expression: '玩家找到伪信证据' } }),
    ]))
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
