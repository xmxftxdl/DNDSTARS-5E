import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import type { AccountCampaignStoryWorkspaceV1, AccountStoryEventV1 } from '../../lib/accountApi'
import type { PdfCampaignAnalysisV2 } from '../../lib/pdfCampaignAnalysisV2'
import DmStoryFlowGraph from './DmStoryFlowGraph'
import {
  storyGraphAnchoredScroll,
  storyGraphCenteredScroll,
  storyGraphFitZoom,
} from './dmStoryGraphViewport'
import {
  layoutStoryGraphEdgeLabels,
  layoutStoryGraphEvents,
  prioritizeSelectedStoryEntries,
  STORY_GRAPH_NODE_GAP_Y,
  STORY_GRAPH_NODE_HEIGHT,
} from './dmStoryGraphLayout'

const storyFlowGraphSource = readFileSync(
  new URL('./DmStoryFlowGraph.tsx', import.meta.url),
  'utf8',
)

function storyEvent(id: string): AccountStoryEventV1 {
  return {
    id,
    title: id,
    summary: '',
    details: '',
    timeLabel: '',
    status: 'planned',
    source: 'dm',
    sourceEventIds: [],
    sceneIds: [],
    personIds: [],
    clueIds: [],
    tags: [],
  }
}

describe('DmStoryFlowGraph layout', () => {
  it('全屏适应会按宽高限制缩放，并把大画布滚动到中央', () => {
    const zoom = storyGraphFitZoom({
      viewportWidth: 1_600,
      viewportHeight: 900,
      canvasWidth: 2_400,
      canvasHeight: 1_200,
      padding: 50,
    })
    expect(zoom).toBe(0.63)
    expect(storyGraphCenteredScroll({
      viewportWidth: 1_600,
      viewportHeight: 900,
      canvasWidth: 2_400,
      canvasHeight: 1_200,
      zoom: 1,
    })).toEqual({ left: 400, top: 150 })
  })

  it('缩放时保持视口中心指向同一个剧情坐标', () => {
    expect(storyGraphAnchoredScroll({
      viewportWidth: 1_000,
      viewportHeight: 700,
      canvasWidth: 2_000,
      canvasHeight: 1_600,
      previousZoom: 1,
      nextZoom: 1.2,
      scrollLeft: 500,
      scrollTop: 450,
      anchorX: 500,
      anchorY: 350,
    })).toEqual({ left: 700, top: 610 })
  })

  it('单列剧情节点在最小画布中央纵向排布，不会迁移到最左边', () => {
    const laidOut = layoutStoryGraphEvents([storyEvent('a'), storyEvent('b')], [{
      id: 'link', fromEventId: 'a', toEventId: 'b', label: '', condition: { kind: 'always' },
    }])
    expect(laidOut.map((event) => event.graphPosition?.x)).toEqual([488, 488])
    expect(laidOut[1]!.graphPosition!.y - laidOut[0]!.graphPosition!.y).toBe(STORY_GRAPH_NODE_HEIGHT + STORY_GRAPH_NODE_GAP_Y)
  })

  it('共同原因的互斥结果在下一层横向展开', () => {
    const laidOut = layoutStoryGraphEvents([storyEvent('root'), storyEvent('dead'), storyEvent('alive')], [
      { id: 'dead-link', fromEventId: 'root', toEventId: 'dead', label: '', condition: { kind: 'always' } },
      { id: 'alive-link', fromEventId: 'root', toEventId: 'alive', label: '', condition: { kind: 'always' } },
    ])
    const root = laidOut.find((event) => event.id === 'root')!
    const dead = laidOut.find((event) => event.id === 'dead')!
    const alive = laidOut.find((event) => event.id === 'alive')!
    expect(root.graphPosition?.x).toBeGreaterThan(dead.graphPosition!.x)
    expect(root.graphPosition?.x).toBeLessThan(alive.graphPosition!.x)
    expect(dead.graphPosition?.y).toBe(alive.graphPosition?.y)
  })

  it('关联选择器把已关联人物、线索和结局稳定置顶', () => {
    const entries = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }]
    expect(prioritizeSelectedStoryEntries(entries, ['c', 'a']).map((entry) => entry.id)).toEqual(['a', 'c', 'b', 'd'])
  })

  it('分支标签自动错开且不会覆盖事件卡片', () => {
    const positions = {
      root: { x: 488, y: 64 },
      left: { x: 274, y: 450 },
      right: { x: 702, y: 450 },
    }
    const links = [
      { id: 'left-link', fromEventId: 'root', toEventId: 'left', label: '角色获救，进入盟友路线', condition: { kind: 'always' as const } },
      { id: 'right-link', fromEventId: 'root', toEventId: 'right', label: '角色死亡，进入调查路线', condition: { kind: 'always' as const } },
    ]
    const labels = layoutStoryGraphEdgeLabels(links, positions, (link) => link.label)
    expect(labels).toHaveLength(2)

    const overlaps = (left: { x: number; y: number; width: number; height: number }, right: { x: number; y: number; width: number; height: number }) => (
      left.x < right.x + right.width
      && left.x + left.width > right.x
      && left.y < right.y + right.height
      && left.y + left.height > right.y
    )
    const nodeRects = Object.values(positions).map((position) => ({ ...position, width: 304, height: STORY_GRAPH_NODE_HEIGHT }))
    expect(overlaps(labels[0]!, labels[1]!)).toBe(false)
    expect(labels.every((label) => nodeRects.every((node) => !overlaps(label, node)))).toBe(true)
  })

  it('默认直接显示完整世界线，编辑工具保持收起', () => {
    const workspace: AccountCampaignStoryWorkspaceV1 = {
      schemaVersion: 1,
      mode: 'prep',
      events: [storyEvent('a')],
      graphLinks: [],
      graphInitialized: true,
      graphLayoutVersion: 4,
      timelineMarkers: [{ id: 'time-1', y: 180, label: '第 2 日 14:30', gameTimeWorldMinute: 2_310 }],
      personStates: [],
      clueStates: [],
      recaps: [],
    }
    const analysis = { people: [], clues: [] } as unknown as PdfCampaignAnalysisV2
    const html = renderToStaticMarkup(createElement(DmStoryFlowGraph, { workspace, analysis, onChange: () => undefined }))
    expect(html).toContain('剧情世界线')
    expect(html).toContain('完整事件、分支条件与时间线')
    expect(html).toContain('适应')
    expect(html).toContain('全屏')
    expect(html).not.toContain('编辑完整世界线')
    expect(html).not.toContain('返回简洁流程')
    expect(html).not.toContain('data-testid="dm-story-edit-tools"')
    expect(html).toContain('data-story-event-selected="false"')
    expect(html).toContain('data-testid="dm-story-timeline-marker"')
    expect(html).toContain('aria-label="移动时间横线')
    expect(html).toContain('第 2 日 14:30')
  })

  it('全屏把编辑器收进覆盖式下拉层，不再挤压思维导图画布', () => {
    expect(storyFlowGraphSource).toContain('aria-label="切换剧情编辑工具"')
    expect(storyFlowGraphSource).toContain('aria-expanded={editToolsOpen}')
    expect(storyFlowGraphSource).toContain('{editToolsOpen &&')
    expect(storyFlowGraphSource).toContain("data-overlay={fullscreen ? 'true' : 'false'}")
    expect(storyFlowGraphSource).toContain("'relative z-40 shrink-0 border-b")
    expect(storyFlowGraphSource).toContain('absolute left-3 right-3 top-full')
    expect(storyFlowGraphSource).toContain('data-testid="dm-story-flow-viewport"')
    expect(storyFlowGraphSource).toContain('max-h-[calc(100vh-6.5rem)]')
  })

  it('分支编辑器提供通用事件条件，不再把所有非人物分支称为 DM 裁定', () => {
    expect(storyFlowGraphSource).toContain('<option value="event-completed">指定事件已发生</option>')
    expect(storyFlowGraphSource).toContain('<option value="event-skipped">指定事件未发生</option>')
    expect(storyFlowGraphSource).toContain('<option value="manual">其他事件或自定义条件</option>')
    expect(storyFlowGraphSource).toContain('aria-label="分支判断事件"')
    expect(storyFlowGraphSource).not.toContain('<option value="manual">DM 手动裁定</option>')
  })

  it('在 AI 剧情节点上显示可点击回查的 PDF 原文书签数量', () => {
    const event = {
      ...storyEvent('ai-event'),
      source: 'analysis-timeline' as const,
      sourceEventIds: ['timeline-event'],
    }
    const workspace: AccountCampaignStoryWorkspaceV1 = {
      schemaVersion: 1,
      mode: 'prep',
      events: [event],
      graphLinks: [],
      graphInitialized: true,
      graphLayoutVersion: 4,
      personStates: [],
      clueStates: [],
      recaps: [],
    }
    const citation = {
      documentId: 'document-module',
      documentName: '冒险模组.pdf',
      page: 7,
      evidenceId: 'evidence-event',
      quote: '钟声响起后，密门从祭坛后方打开。',
      verification: 'exact' as const,
    }
    const analysis = {
      people: [],
      clues: [],
      evidence: [],
      scenes: [],
      timelineEvents: [{ id: 'timeline-event', citations: [citation], evidenceIds: [] }],
    } as unknown as PdfCampaignAnalysisV2

    const html = renderToStaticMarkup(createElement(DmStoryFlowGraph, { workspace, analysis, onChange: () => undefined }))
    expect(html).toContain('冒险模组.pdf · 第 7 页')
    expect(html).toContain('第 7 页')
  })

  it('完整世界线直接显示事件摘要、时间与 DM 调整后的分支位置', () => {
    const workspace: AccountCampaignStoryWorkspaceV1 = {
      schemaVersion: 1,
      mode: 'prep',
      events: [
        { ...storyEvent('root'), summary: '这段完整摘要不应出现在简洁主流程。', timeLabel: '第三日午夜', graphPosition: { x: 488, y: 64 } },
        { ...storyEvent('outcome'), graphPosition: { x: 488, y: 450 } },
      ],
      graphLinks: [{
        id: 'branch-label',
        fromEventId: 'root',
        toEventId: 'outcome',
        label: '交出伪信后获得通行证',
        condition: { kind: 'manual', expression: '玩家选择交出伪信' },
        labelPosition: { x: 720, y: 310 },
      }],
      graphInitialized: true,
      graphLayoutVersion: 4,
      personStates: [],
      clueStates: [],
      recaps: [],
    }
    const analysis = { people: [], clues: [] } as unknown as PdfCampaignAnalysisV2
    const html = renderToStaticMarkup(createElement(DmStoryFlowGraph, { workspace, analysis, onChange: () => undefined }))
    expect(html).toContain('data-story-link-label="true"')
    expect(html).toContain('玩家选择交出伪信')
    expect(html).toContain('left:720px')
    expect(html).toContain('top:310px')
    expect(html).toContain('这段完整摘要不应出现在简洁主流程。')
    expect(html).toContain('第三日午夜')
  })

  it('渲染 DM 创建的选择框，并把未触发分支及后继节点显示为灰色不可达', () => {
    const workspace: AccountCampaignStoryWorkspaceV1 = {
      schemaVersion: 1,
      mode: 'running',
      events: [
        { ...storyEvent('玩家是否同行？'), nodeKind: 'decision', status: 'completed' },
        storyEvent('同行护送'),
        storyEvent('留在驿馆'),
        storyEvent('驿馆后续'),
      ],
      graphLinks: [
        { id: 'go', fromEventId: '玩家是否同行？', toEventId: '同行护送', label: '同行', resolution: 'triggered', condition: { kind: 'manual', expression: '玩家同行' } },
        { id: 'stay', fromEventId: '玩家是否同行？', toEventId: '留在驿馆', label: '留守', resolution: 'not-triggered', condition: { kind: 'manual', expression: '玩家留守' } },
        { id: 'stay-next', fromEventId: '留在驿馆', toEventId: '驿馆后续', label: '', condition: { kind: 'always' } },
      ],
      graphInitialized: true,
      graphLayoutVersion: 4,
      personStates: [], clueStates: [], recaps: [],
    }
    const analysis = { people: [], clues: [] } as unknown as PdfCampaignAnalysisV2
    const html = renderToStaticMarkup(createElement(DmStoryFlowGraph, { workspace, analysis, onChange: () => undefined }))

    expect(html).toContain('data-story-explicit-decision="true"')
    expect(html).toContain('data-story-event-availability="available"')
    expect(html.match(/data-story-event-availability="blocked"/g)).toHaveLength(2)
    expect(html).toContain('grayscale opacity-35')
  })
})
