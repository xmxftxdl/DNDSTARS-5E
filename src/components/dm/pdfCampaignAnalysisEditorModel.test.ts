import { describe, expect, it } from 'vitest'
import type { PdfCampaignAnalysisV1 } from '../../lib/pdfCampaignAnalysis'
import {
  commaSeparatedValues,
  removePdfAnalysisEntry,
  renamePdfAnalysisEntity,
} from './pdfCampaignAnalysisEditorModel'

function analysis(): PdfCampaignAnalysisV1 {
  return {
    schemaVersion: 1,
    overview: '测试战役',
    documents: [{ name: 'module.pdf', pageCount: 20, extractedCharacters: 1000, scannedPages: [] }],
    analyzedChunks: 2,
    people: [{ name: '艾莉', description: '', role: '法师', appearance: '', personality: '', motivation: '', secret: '', voice: '', citations: [] }],
    relationships: [{ from: '艾莉', to: '鹿灯驿馆', type: '居住', description: '', citations: [] }],
    locations: [{ name: '鹿灯驿馆', description: '', citations: [] }],
    factions: [],
    clues: [],
    scenes: [{ name: '会面', description: '', location: '鹿灯驿馆', npcs: ['艾莉'], monsters: [], citations: [] }],
    encounters: [],
    importCandidates: [],
    prepTips: [],
    warnings: [],
  }
}

describe('pdfCampaignAnalysisEditorModel', () => {
  it('重命名人物时同步关系端点和场景人物引用', () => {
    const next = renamePdfAnalysisEntity(analysis(), 'people', 0, '艾莉诺拉')

    expect(next.people[0].name).toBe('艾莉诺拉')
    expect(next.relationships[0].from).toBe('艾莉诺拉')
    expect(next.scenes[0].npcs).toEqual(['艾莉诺拉'])
  })

  it('重命名地点时同步关系端点和场景地点', () => {
    const next = renamePdfAnalysisEntity(analysis(), 'locations', 0, '鹿灯驿站')

    expect(next.relationships[0].to).toBe('鹿灯驿站')
    expect(next.scenes[0].location).toBe('鹿灯驿站')
  })

  it('可以删除误识别项并解析中英文分隔列表', () => {
    const next = removePdfAnalysisEntry(analysis(), 'people', 0)

    expect(next.people).toEqual([])
    expect(commaSeparatedValues('艾莉，布洛姆, 卡洛斯\n玛芮')).toEqual(['艾莉', '布洛姆', '卡洛斯', '玛芮'])
  })
})
