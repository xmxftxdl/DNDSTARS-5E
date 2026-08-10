import type {
  PdfEncounterRecordV1,
  PdfImportCandidateV1,
  PdfNamedRecordV1,
  PdfPersonRecordV1,
  PdfPrepTipV1,
  PdfRelationshipRecordV1,
  PdfSceneRecordV1,
  PdfClueRecordV1,
} from '../../lib/pdfCampaignAnalysis'
import type { PdfCampaignAnalysisView } from '../../lib/pdfCampaignAnalysisV2'

export type PdfAnalysisEntityCollection = 'people' | 'factions' | 'locations'

export function emptyPdfPerson(): PdfPersonRecordV1 {
  return {
    name: '新人物',
    aliases: [],
    description: '',
    role: '',
    appearance: '',
    personality: '',
    motivation: '',
    secret: '',
    voice: '',
    citations: [],
  }
}

export function emptyPdfNamedRecord(name = '新条目'): PdfNamedRecordV1 {
  return { name, description: '', citations: [] }
}

export function emptyPdfRelationship(): PdfRelationshipRecordV1 {
  return { from: '', to: '', type: '', description: '', citations: [] }
}

export function emptyPdfClue(): PdfClueRecordV1 {
  return { name: '新线索', description: '', source: '', discovery: '', failForward: '', citations: [] }
}

export function emptyPdfScene(): PdfSceneRecordV1 {
  return {
    name: '新场景',
    description: '',
    location: '',
    npcs: [],
    monsters: [],
    time: '时间未注明',
    timelineOrder: 0,
    timelineKind: 'current',
    tags: [],
    citations: [],
  }
}

export function emptyPdfTimelineEvent(worldMinute?: number): PdfSceneRecordV1 {
  return {
    ...emptyPdfScene(),
    name: '新时间节点',
    ...(Number.isSafeInteger(worldMinute) && Number(worldMinute) >= 0
      ? { gameTimeWorldMinute: Math.floor(Number(worldMinute)) }
      : {}),
  }
}

export function emptyPdfEncounter(): PdfEncounterRecordV1 {
  return { name: '新遭遇', description: '', creatures: [], notes: '', citations: [] }
}

export function emptyPdfImportCandidate(): PdfImportCandidateV1 {
  return { name: '新资源', description: '', kind: 'npc', automation: 'manual', citations: [] }
}

export function emptyPdfPrepTip(): PdfPrepTipV1 {
  return { title: '新备团提示', description: '', priority: 'medium', citations: [] }
}

function replaceExact(values: readonly string[], previousName: string, nextName: string): string[] {
  return values.map((value) => value === previousName ? nextName : value)
}

/**
 * 重命名实体时同步关系图和场景引用，避免 DM 修正姓名后生成一个新的“待确认”节点。
 */
export function renamePdfAnalysisEntity(
  analysis: PdfCampaignAnalysisView,
  collection: PdfAnalysisEntityCollection,
  index: number,
  nextName: string,
): PdfCampaignAnalysisView {
  const entries = analysis[collection]
  const current = entries[index]
  if (!current) return analysis
  const previousName = current.name
  const normalizedName = nextName.trim()
  const nextEntries = entries.map((entry, entryIndex) => entryIndex === index
    ? { ...entry, name: normalizedName }
    : entry)
  const next: PdfCampaignAnalysisView = {
    ...analysis,
    [collection]: nextEntries,
    relationships: analysis.relationships.map((relationship) => ({
      ...relationship,
      from: relationship.from === previousName ? normalizedName : relationship.from,
      to: relationship.to === previousName ? normalizedName : relationship.to,
    })),
  }
  if (collection === 'people') {
    next.scenes = analysis.scenes.map((scene) => ({
      ...scene,
      npcs: replaceExact(scene.npcs, previousName, normalizedName),
    }))
    next.timelineEvents = (analysis.timelineEvents ?? []).map((event) => ({
      ...event,
      npcs: replaceExact(event.npcs, previousName, normalizedName),
    }))
  }
  if (collection === 'locations') {
    next.scenes = analysis.scenes.map((scene) => ({
      ...scene,
      location: scene.location === previousName ? normalizedName : scene.location,
    }))
    next.timelineEvents = (analysis.timelineEvents ?? []).map((event) => ({
      ...event,
      location: event.location === previousName ? normalizedName : event.location,
    }))
  }
  return next
}

export function removePdfAnalysisEntry<K extends keyof PdfCampaignAnalysisView>(
  analysis: PdfCampaignAnalysisView,
  collection: K,
  index: number,
): PdfCampaignAnalysisView {
  const entries = analysis[collection]
  if (!Array.isArray(entries)) return analysis
  return { ...analysis, [collection]: entries.filter((_, entryIndex) => entryIndex !== index) }
}

export function commaSeparatedValues(value: string): string[] {
  return value.split(/[，,\n]/u).map((entry) => entry.trim()).filter(Boolean)
}
