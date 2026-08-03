import type {
  PdfCampaignAnalysisV1,
  PdfImportCandidateV1,
  PdfNamedRecordV1,
  PdfSourceCitationV1,
} from '../../lib/pdfCampaignAnalysis'

export type PdfKnowledgeTabV1 =
  | 'overview'
  | 'people'
  | 'factions'
  | 'locations'
  | 'events'
  | 'clues'
  | 'timeline'
  | 'maps'
  | 'monsters'
  | 'relationships'
  | 'imports'

export interface PdfMonsterCodexEntryV1 {
  name: string
  description: string
  source: 'import-candidate' | 'encounter-reference'
  automation: PdfImportCandidateV1['automation'] | 'unreviewed'
  encounterNames: string[]
  citations: PdfSourceCitationV1[]
}

export interface PdfMapIndexEntryV1 {
  name: string
  description: string
  source: 'map-candidate' | 'location'
  sceneNames: string[]
  citations: PdfSourceCitationV1[]
}

function normalized(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLocaleLowerCase('zh-CN') : ''
}

export function pdfKnowledgeMatches(query: string, ...values: unknown[]): boolean {
  const needle = normalized(query)
  if (!needle) return true
  return values.some((value) => {
    if (Array.isArray(value)) return normalized(value.join(' ')).includes(needle)
    return normalized(value).includes(needle)
  })
}

function mergeCitations(...collections: readonly PdfSourceCitationV1[][]): PdfSourceCitationV1[] {
  const seen = new Set<string>()
  return collections.flat().filter((citation) => {
    const key = `${citation.documentName}:${citation.page}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function buildPdfMonsterCodex(analysis: PdfCampaignAnalysisV1): PdfMonsterCodexEntryV1[] {
  const byName = new Map<string, PdfMonsterCodexEntryV1>()
  for (const candidate of analysis.importCandidates.filter((entry) => entry.kind === 'monster')) {
    const key = normalized(candidate.name)
    if (!key) continue
    byName.set(key, {
      name: candidate.name,
      description: candidate.description,
      source: 'import-candidate',
      automation: candidate.automation,
      encounterNames: [],
      citations: [...candidate.citations],
    })
  }
  for (const encounter of analysis.encounters) {
    for (const creature of encounter.creatures) {
      const key = normalized(creature)
      if (!key) continue
      const current = byName.get(key)
      byName.set(key, current ? {
        ...current,
        encounterNames: [...new Set([...current.encounterNames, encounter.name])],
        citations: mergeCitations(current.citations, encounter.citations),
      } : {
        name: creature,
        description: `在“${encounter.name}”中出现，尚未提取为可导入的结构化怪物。`,
        source: 'encounter-reference',
        automation: 'unreviewed',
        encounterNames: [encounter.name],
        citations: [...encounter.citations],
      })
    }
  }
  return [...byName.values()].sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
}

export function buildPdfMapIndex(analysis: PdfCampaignAnalysisV1): PdfMapIndexEntryV1[] {
  const byName = new Map<string, PdfMapIndexEntryV1>()
  for (const candidate of analysis.importCandidates.filter((entry) => entry.kind === 'map')) {
    const key = normalized(candidate.name)
    if (!key) continue
    byName.set(key, {
      name: candidate.name,
      description: candidate.description,
      source: 'map-candidate',
      sceneNames: [],
      citations: [...candidate.citations],
    })
  }
  for (const location of analysis.locations) {
    const key = normalized(location.name)
    if (!key) continue
    const relatedScenes = analysis.scenes
      .filter((scene) => normalized(scene.location) === key || normalized(scene.description).includes(key))
      .map((scene) => scene.name)
    const current = byName.get(key)
    byName.set(key, current ? {
      ...current,
      sceneNames: [...new Set([...current.sceneNames, ...relatedScenes])],
      citations: mergeCitations(current.citations, location.citations),
    } : {
      name: location.name,
      description: location.description,
      source: 'location',
      sceneNames: relatedScenes,
      citations: [...location.citations],
    })
  }
  return [...byName.values()].sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
}

export function buildPdfPersonPortraitPrompt(person: {
  name: string
  role: string
  appearance?: string
  personality: string
  description: string
}): string {
  return [
    'D&D 奇幻人物立绘，竖版 3:4，全身或四分之三身，单人，纯净或轻度环境背景，无文字，无水印。',
    `人物：${person.name}。身份：${person.role || '未确认'}。`,
    person.appearance ? `原文外貌：${person.appearance}。` : '',
    person.personality ? `性格气质：${person.personality}。` : '',
    person.description ? `剧情档案：${person.description}。` : '',
    '保持服装、年龄、族裔和辨识特征与资料一致，不添加资料中不存在的徽记或武器。',
  ].filter(Boolean).join('\n')
}

export function pdfKnowledgeTabCounts(analysis: PdfCampaignAnalysisV1): Record<PdfKnowledgeTabV1, number> {
  return {
    overview: analysis.people.length + analysis.factions.length + analysis.locations.length + analysis.clues.length,
    people: analysis.people.length,
    factions: analysis.factions.length,
    locations: analysis.locations.length,
    events: analysis.scenes.length + analysis.encounters.length,
    clues: analysis.clues.length,
    timeline: analysis.scenes.length,
    maps: buildPdfMapIndex(analysis).length,
    monsters: buildPdfMonsterCodex(analysis).length,
    relationships: analysis.relationships.length,
    imports: analysis.importCandidates.length,
  }
}

export function recordSearchText(record: PdfNamedRecordV1): unknown[] {
  return [record.name, record.description, record.citations.map((citation) => `${citation.documentName} ${citation.page}`)]
}
