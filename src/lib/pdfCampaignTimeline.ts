import type { PdfSceneRecordV1, PdfTimelineKindV1 } from './pdfCampaignAnalysis'

const TIMELINE_KIND_ORDER: Record<PdfTimelineKindV1, number> = {
  history: 0,
  current: 1,
  deadline: 2,
  conditional: 3,
}

export const PDF_TIMELINE_KIND_LABELS: Record<PdfTimelineKindV1, string> = {
  history: '背景历史',
  current: '当前流程',
  deadline: '期限',
  conditional: '条件分支',
}

function pageOf(scene: PdfSceneRecordV1): number {
  return scene.citations[0]?.page ?? Number.MAX_SAFE_INTEGER
}

function hasReliableGlobalOrder(scenes: readonly PdfSceneRecordV1[]): boolean {
  if (scenes.length === 0 || scenes.some((scene) => !Number.isSafeInteger(scene.timelineOrder))) return false
  return new Set(scenes.map((scene) => scene.timelineOrder)).size === scenes.length
}

/** Uses synthesis order only when it is complete and unique; chunk-local order is never mistaken for global chronology. */
export function sortPdfCampaignTimeline(scenes: readonly PdfSceneRecordV1[]): PdfSceneRecordV1[] {
  const reliableOrder = hasReliableGlobalOrder(scenes)
  return [...scenes].sort((left, right) => {
    if (reliableOrder) {
      const orderDifference = (left.timelineOrder ?? 0) - (right.timelineOrder ?? 0)
      if (orderDifference !== 0) return orderDifference
    }
    const kindDifference = TIMELINE_KIND_ORDER[left.timelineKind ?? 'current'] - TIMELINE_KIND_ORDER[right.timelineKind ?? 'current']
    if (kindDifference !== 0) return kindDifference
    return pageOf(left) - pageOf(right) || left.name.localeCompare(right.name, 'zh-CN')
  })
}

export function pdfTimelineTimeLabel(scene: PdfSceneRecordV1): string {
  return scene.time?.trim() || '时间未注明'
}

export interface PdfCampaignTimelineSchedule {
  scheduled: PdfSceneRecordV1[]
  unscheduled: PdfSceneRecordV1[]
  /** Insertion index for the room clock marker in the scheduled list. */
  currentMarkerIndex: number
}

function hasGameTime(scene: PdfSceneRecordV1): scene is PdfSceneRecordV1 & { gameTimeWorldMinute: number } {
  return Number.isSafeInteger(scene.gameTimeWorldMinute) && Number(scene.gameTimeWorldMinute) >= 0
}

/**
 * Separates DM-scheduled events from narrative-only events. Narrative phrases such as
 * "several years ago" remain visible but are never guessed onto the authoritative room clock.
 */
export function schedulePdfCampaignTimeline(
  scenes: readonly PdfSceneRecordV1[],
  currentWorldMinute: number,
): PdfCampaignTimelineSchedule {
  const scheduled = scenes.filter(hasGameTime).sort((left, right) => (
    left.gameTimeWorldMinute - right.gameTimeWorldMinute ||
    (left.timelineOrder ?? Number.MAX_SAFE_INTEGER) - (right.timelineOrder ?? Number.MAX_SAFE_INTEGER) ||
    left.name.localeCompare(right.name, 'zh-CN')
  ))
  const unscheduled = sortPdfCampaignTimeline(scenes.filter((scene) => !hasGameTime(scene)))
  const safeCurrentWorldMinute = Math.max(0, Math.floor(currentWorldMinute))
  const nextIndex = scheduled.findIndex((scene) => scene.gameTimeWorldMinute > safeCurrentWorldMinute)
  return {
    scheduled,
    unscheduled,
    currentMarkerIndex: nextIndex < 0 ? scheduled.length : nextIndex,
  }
}
