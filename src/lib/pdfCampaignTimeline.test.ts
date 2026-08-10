import { describe, expect, it } from 'vitest'
import type { PdfSceneRecordV1 } from './pdfCampaignAnalysis'
import { pdfTimelineTimeLabel, schedulePdfCampaignTimeline, sortPdfCampaignTimeline } from './pdfCampaignTimeline'

function scene(name: string, overrides: Partial<PdfSceneRecordV1> = {}): PdfSceneRecordV1 {
  return { name, description: '', location: '', npcs: [], monsters: [], citations: [], ...overrides }
}

describe('PDF 战役时间线', () => {
  it('优先使用全书综合生成的唯一顺序', () => {
    const result = sortPdfCampaignTimeline([
      scene('进入翠羽城', { timelineKind: 'current', timelineOrder: 30 }),
      scene('海都密信求助', { timelineKind: 'history', timelineOrder: 20 }),
      scene('白鹿案', { timelineKind: 'history', timelineOrder: 10 }),
    ])
    expect(result.map((entry) => entry.name)).toEqual(['白鹿案', '海都密信求助', '进入翠羽城'])
  })

  it('分段顺序重复时不冒充全局时间，改按类型和证据页排序', () => {
    const result = sortPdfCampaignTimeline([
      scene('条件伏击', { timelineKind: 'conditional', timelineOrder: 10, citations: [{ documentName: 'a.pdf', page: 3 }] }),
      scene('旧案', { timelineKind: 'history', timelineOrder: 10, citations: [{ documentName: 'a.pdf', page: 8 }] }),
      scene('当日调查', { timelineKind: 'current', timelineOrder: 20, citations: [{ documentName: 'a.pdf', page: 2 }] }),
    ])
    expect(result.map((entry) => entry.name)).toEqual(['旧案', '当日调查', '条件伏击'])
    expect(pdfTimelineTimeLabel(result[0])).toBe('时间未注明')
  })

  it('按 DM 绑定的游戏时间排序，并计算当前时间红线插入位置', () => {
    const result = schedulePdfCampaignTimeline([
      scene('晚间伏击', { gameTimeWorldMinute: 20 * 60 }),
      scene('古代传说', { time: '数年前', timelineKind: 'history' }),
      scene('中午会面', { gameTimeWorldMinute: 12 * 60 }),
    ], 15 * 60)
    expect(result.scheduled.map((entry) => entry.name)).toEqual(['中午会面', '晚间伏击'])
    expect(result.unscheduled.map((entry) => entry.name)).toEqual(['古代传说'])
    expect(result.currentMarkerIndex).toBe(1)
  })
})
