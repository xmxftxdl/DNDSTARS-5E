import { describe, expect, it } from 'vitest'
import type { PdfCampaignAnalysisV1 } from './pdfCampaignAnalysis'
import {
  materializePdfCampaignAnalysis,
  migratePdfCampaignAnalysisV1ToV2,
  normalizeDmEditedPdfCampaignAnalysisV2,
  projectPdfCampaignAnalysisV2ToLegacyView,
} from './pdfCampaignAnalysisMigration'

const legacy: PdfCampaignAnalysisV1 = {
  schemaVersion: 1,
  overview: '旧版分析',
  documents: [{ name: '模组.pdf', pageCount: 3, extractedCharacters: 100, scannedPages: [] }],
  people: [{
    name: '艾琳', description: '调查员', role: '盟友', appearance: '银发', personality: '谨慎', motivation: '查明真相',
    secret: '', voice: '平静', portraitDataUrl: 'data:image/png;base64,AA==', citations: [{ documentName: '模组.pdf', page: 1 }],
  }],
  relationships: [{ from: '艾琳', to: '暮钟旅馆', type: '调查', description: '', citations: [{ documentName: '模组.pdf', page: 2 }] }],
  locations: [{ name: '暮钟旅馆', description: '旧旅馆', citations: [{ documentName: '模组.pdf', page: 2 }] }],
  factions: [], clues: [], timelineEvents: [{
    name: '到达旅馆', description: '', location: '暮钟旅馆', npcs: ['艾琳'], monsters: [],
    gameTimeWorldMinute: 540, citations: [],
  }], scenes: [], encounters: [], importCandidates: [], prepTips: [],
  warnings: ['旧版警告'], analyzedChunks: 2,
}

describe('PDF 分析 V1/V2 迁移', () => {
  it('不重新调用 AI 即可迁移，保留画像、警告和关系', () => {
    const migrated = migratePdfCampaignAnalysisV1ToV2(legacy)
    expect(migrated.schemaVersion).toBe(2)
    expect(migrated.people[0]?.portraitDataUrl).toBe(legacy.people[0]?.portraitDataUrl)
    expect(migrated.warnings).toEqual(['旧版警告'])
    expect(migrated.evidence.every((entry) => entry.verification === 'legacy')).toBe(true)
    expect(migrated.relationships[0]).toMatchObject({ fromEntityId: migrated.people[0]?.id, toEntityId: migrated.locations[0]?.id })
    expect(migrated.timelineEvents?.[0]?.gameTimeWorldMinute).toBe(540)
  })

  it('迁移和物化具有确定性，V2 投影仍供旧 UI 使用', () => {
    const first = materializePdfCampaignAnalysis(legacy)
    const second = materializePdfCampaignAnalysis({ schemaVersion: 1, kind: 'pdf-campaign-analysis', payload: legacy })
    expect(second).toEqual(first)
    expect(materializePdfCampaignAnalysis(first)).toEqual(first)
    expect(projectPdfCampaignAnalysisV2ToLegacyView(first)).toMatchObject({
      schemaVersion: 1,
      people: [{ name: '艾琳', portraitDataUrl: 'data:image/png;base64,AA==' }],
      relationships: [{ from: '艾琳', to: '暮钟旅馆' }],
    })
  })

  it('V2 编辑结果规范化保持幂等', () => {
    const migrated = migratePdfCampaignAnalysisV1ToV2(legacy)
    const first = normalizeDmEditedPdfCampaignAnalysisV2(migrated)
    const second = normalizeDmEditedPdfCampaignAnalysisV2(first)
    expect(second).toEqual(first)
  })

  it('载入旧 V2 战役时自动合并重复场景与遭遇', () => {
    const migrated = migratePdfCampaignAnalysisV1ToV2(legacy)
    const scene = {
      ...migrated.timelineEvents![0]!,
      name: '黑桦弯伏击', location: '黑桦弯', npcs: [], monsters: ['伏击者'],
    }
    const encounter = {
      ...migrated.timelineEvents![0]!,
      name: '黑桦弯伏击战', creatures: ['伏击者'], notes: '从两侧包围玩家。',
    }
    migrated.scenes = [scene, { ...scene, name: '黑桦弯伏击战' }]
    migrated.encounters = [encounter, { ...encounter, name: '黑桦弯伏击' }]

    const restored = materializePdfCampaignAnalysis(migrated)

    expect(restored.scenes).toHaveLength(1)
    expect(restored.encounters).toHaveLength(1)
  })
})
