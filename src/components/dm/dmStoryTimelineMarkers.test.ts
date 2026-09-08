import { describe, expect, it, vi } from 'vitest'
import {
  createStoryTimelineMarker,
  currentStoryTimelineY,
  moveStoryTimelineMarkerY,
  storyCanvasGestureIsClick,
  storyEventIsBeforeTimeline,
  storyTimeClueForEvent,
  storyTimelineYBelowEvent,
  storyTimelineMarkerIsReached,
  synchronizeAnalysisStoryTimelineMarkers,
} from './dmStoryTimelineMarkers'
import type { AccountStoryEventV1 } from '../../lib/accountApi'

describe('剧情图时间标线', () => {
  it('区分空白单击与拖动画布，拖动不会误建时间线', () => {
    expect(storyCanvasGestureIsClick(2, 2)).toBe(true)
    expect(storyCanvasGestureIsClick(5, 0)).toBe(false)
    expect(storyCanvasGestureIsClick(18, 24)).toBe(false)
  })

  it('创建可持久化的横线并可绑定当前战役时间', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000)
    vi.spyOn(Math, 'random').mockReturnValue(0.25)
    expect(createStoryTimelineMarker(182.4, { label: '第 2 日 14:30', gameTimeWorldMinute: 2_310 })).toMatchObject({
      y: 182,
      label: '第 2 日 14:30',
      gameTimeWorldMinute: 2_310,
    })
    vi.restoreAllMocks()
  })

  it('把事件时间线放在该事件与下一层之间的中央', () => {
    expect(storyTimelineYBelowEvent(64, 210, [64, 450, 450], 176)).toBe(362)
    expect(storyTimelineYBelowEvent(450, 210, [64, 450], 176)).toBe(748)
  })

  it('按当前缩放比例移动横线，并限制在画布安全范围内', () => {
    expect(moveStoryTimelineMarkerY(180, 40, 0.8)).toBe(230)
    expect(moveStoryTimelineMarkerY(20, -100, 1)).toBe(16)
    expect(moveStoryTimelineMarkerY(49_990, 100, 1)).toBe(50_000)
  })

  it('以最近到达的战役时间横线作为剧情完成边界', () => {
    const markers = [
      { id: 'morning', y: 180, label: '08:00', gameTimeWorldMinute: 480 },
      { id: 'evening', y: 620, label: '20:00', gameTimeWorldMinute: 1_200 },
      { id: 'future', y: 900, label: '22:00', gameTimeWorldMinute: 1_320 },
    ]
    expect(storyTimelineMarkerIsReached(markers[1]!, 1_200)).toBe(true)
    expect(storyTimelineMarkerIsReached(markers[2]!, 1_200)).toBe(false)
    expect(currentStoryTimelineY(markers, 1_200)).toBe(620)
    expect(storyEventIsBeforeTimeline(400, 166, 620)).toBe(true)
    expect(storyEventIsBeforeTimeline(500, 166, 620)).toBe(false)
  })

  it('将故事开始前与第几小时规范为稳定的相对时间锚点', () => {
    expect(storyTimeClueForEvent(analysisEvent('history', '故事开始之前', 64, 'history'))).toMatchObject({
      key: 'before-start',
      label: '故事开始前',
      timelineKind: 'history',
    })
    expect(storyTimeClueForEvent(analysisEvent('hour-1', '第一小时', 330))).toMatchObject({
      key: 'offset:60',
      label: '第 1 小时',
      relativeOffsetMinutes: 60,
    })
    expect(storyTimeClueForEvent(analysisEvent('hour-2', '第 2 小时', 596))).toMatchObject({
      key: 'offset:120',
      relativeOffsetMinutes: 120,
    })
    expect(storyTimeClueForEvent(analysisEvent('after-start', '故事开始后 3 小时', 862))).toMatchObject({
      key: 'offset:180',
      label: '3 小时后',
      relativeOffsetMinutes: 180,
    })
  })

  it('合并相同时间线索，把横线放在该组卡片下方并绑定故事起点', () => {
    const events = [
      analysisEvent('first-a', '第一小时', 64),
      analysisEvent('first-b', '第 1 小时', 64),
      analysisEvent('second', '第二小时', 330),
    ]
    const markers = synchronizeAnalysisStoryTimelineMarkers(events, [], {
      storyStartWorldMinute: 1_000,
      eventHeight: 154,
      fallbackGap: 112,
    })

    expect(markers).toHaveLength(2)
    expect(markers[0]).toMatchObject({
      y: 274,
      source: 'analysis',
      sourceKey: 'offset:60',
      sourceEventIds: ['first-a', 'first-b'],
      gameTimeWorldMinute: 1_060,
    })
    expect(markers[1]).toMatchObject({ y: 540, sourceKey: 'offset:120', gameTimeWorldMinute: 1_120 })
  })

  it('重新同步只更新分析横线，保留手工横线和 DM 编辑过的位置', () => {
    const event = analysisEvent('first', '第一小时', 330)
    const existing = [
      { id: 'manual', y: 100, label: '手工时间', source: 'manual' as const },
      {
        id: 'analysis-existing',
        y: 777,
        label: '第 1 小时',
        source: 'analysis' as const,
        sourceKey: 'offset:60',
        sourceEventIds: ['first'],
        dmEditedFields: ['y' as const],
      },
    ]
    const markers = synchronizeAnalysisStoryTimelineMarkers([event], existing, { storyStartWorldMinute: 2_000 })
    expect(markers.find((marker) => marker.id === 'manual')).toMatchObject({ y: 100, label: '手工时间' })
    expect(markers.find((marker) => marker.id === 'analysis-existing')).toMatchObject({
      y: 777,
      gameTimeWorldMinute: 2_060,
      dmEditedFields: ['y'],
    })
    const dismissed = synchronizeAnalysisStoryTimelineMarkers([event], markers, { dismissedSourceKeys: ['offset:60'] })
    expect(dismissed.map((marker) => marker.id)).toEqual(['manual'])
  })

  it('移除旧流程遗留的重复无来源时间横线，但保留新版手动时间点', () => {
    const markers = synchronizeAnalysisStoryTimelineMarkers([], [
      { id: 'legacy-a', y: 108, label: '第 2 日 13:00', gameTimeWorldMinute: 7_980 },
      { id: 'legacy-b', y: 289, label: '第 2 日 13:00', gameTimeWorldMinute: 7_980 },
      { id: 'manual-current', y: 420, label: 'DM 手动节点', source: 'manual' },
    ])

    expect(markers).toEqual([
      { id: 'manual-current', y: 420, label: 'DM 手动节点', source: 'manual' },
    ])
  })

  it('按稳定 ID 升级被旧服务端剥离来源的分析横线，不重复生成', () => {
    const event = analysisEvent('before', '故事开始前', 100, 'history')
    const [generated] = synchronizeAnalysisStoryTimelineMarkers([event])
    const legacyPersisted = {
      id: generated!.id,
      y: 777,
      label: generated!.label,
    }

    const markers = synchronizeAnalysisStoryTimelineMarkers([event], [legacyPersisted])

    expect(markers).toHaveLength(1)
    expect(markers[0]).toMatchObject({
      id: generated!.id,
      y: 777,
      label: '故事开始前',
      source: 'analysis',
      sourceKey: 'before-start',
      dmEditedFields: ['y'],
    })
  })

  it('清理旧版未完成的空时间横线，保留新版手动时间点', () => {
    const markers = synchronizeAnalysisStoryTimelineMarkers([], [
      { id: 'legacy-empty', y: 120, label: '时间待设置' },
      { id: 'manual-empty', y: 240, label: '时间待设置', source: 'manual' },
    ])

    expect(markers).toEqual([
      { id: 'manual-empty', y: 240, label: '时间待设置', source: 'manual' },
    ])
  })
})

function analysisEvent(
  id: string,
  timeLabel: string,
  y: number,
  timelineKind: AccountStoryEventV1['timelineKind'] = 'current',
): AccountStoryEventV1 {
  return {
    id,
    title: id,
    summary: '',
    details: '',
    timeLabel,
    status: 'planned',
    source: 'analysis-timeline',
    sourceEventIds: [id],
    sceneIds: [],
    personIds: [],
    clueIds: [],
    tags: [],
    timelineKind,
    graphPosition: { x: 100, y },
  }
}
