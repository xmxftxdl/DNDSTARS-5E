import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { AccountCampaignStoryWorkspaceV1, AccountStoryEventV1 } from '../../lib/accountApi'
import type { PdfCampaignAnalysisV2 } from '../../lib/pdfCampaignAnalysisV2'
import DmStoryFlowGraph, {
  storyGraphAnchoredScroll,
  storyGraphCenteredScroll,
  storyGraphFitZoom,
} from './DmStoryFlowGraph'
import {
  layoutStoryGraphEdgeLabels,
  layoutStoryGraphEvents,
  prioritizeSelectedStoryEntries,
  STORY_GRAPH_NODE_GAP_Y,
  STORY_GRAPH_NODE_HEIGHT,
} from './dmStoryGraphLayout'

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

  it('显示可持久化的时间横线和一键插入当前时间入口', () => {
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
    expect(html).toContain('添加时间点')
    expect(html).toContain('插入当前时间')
    expect(html).toContain('适应屏幕')
    expect(html).toContain('居中')
    expect(html).toContain('100%')
    expect(html).toContain('先选择一个事件')
    expect(html).not.toContain('单击画布空白处添加时间横线')
    expect(html).toContain('data-story-event-selected="false"')
    expect(html).toContain('分支状态（不是事件分类）：')
    expect(html).toContain('无条件推进')
    expect(html).toContain('等待 DM 裁定')
    expect(html).toContain('拖动彩色分支框可改位置')
    expect(html).toContain('data-testid="dm-story-timeline-marker"')
    expect(html).toContain('aria-label="移动时间横线')
    expect(html).toContain('第 2 日 14:30')
  })

  it('把分支说明渲染为可选择和拖动的独立控件', () => {
    const workspace: AccountCampaignStoryWorkspaceV1 = {
      schemaVersion: 1,
      mode: 'prep',
      events: [
        { ...storyEvent('root'), graphPosition: { x: 488, y: 64 } },
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
  })
})
