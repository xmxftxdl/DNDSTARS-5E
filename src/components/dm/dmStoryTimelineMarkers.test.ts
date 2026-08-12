import { describe, expect, it, vi } from 'vitest'
import {
  createStoryTimelineMarker,
  currentStoryTimelineY,
  moveStoryTimelineMarkerY,
  storyCanvasGestureIsClick,
  storyEventIsBeforeTimeline,
  storyTimelineYBelowEvent,
  storyTimelineMarkerIsReached,
} from './dmStoryTimelineMarkers'

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
})
