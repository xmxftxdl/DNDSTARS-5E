import { describe, expect, it } from 'vitest'
import type { PdfCampaignAnalysisV1 } from '../../lib/pdfCampaignAnalysis'
import {
  buildPdfMapIndex,
  buildPdfMonsterCodex,
  buildPdfPersonPortraitPrompt,
  pdfKnowledgeMatches,
  pdfKnowledgeTabCounts,
} from './pdfCampaignKnowledgeBaseModel'

const citation = { documentName: '测试模组.pdf', page: 7 }

function analysis(): PdfCampaignAnalysisV1 {
  return {
    schemaVersion: 1,
    overview: '一场围绕失落灯塔展开的冒险。',
    people: [{ name: '艾琳', role: '向导', description: '熟悉海岸。', appearance: '银发灰眼', personality: '谨慎', motivation: '保护渔村', secret: '', voice: '', citations: [citation] }],
    relationships: [{ from: '艾琳', to: '潮汐教团', type: '敌对', description: '正在追查教团。', citations: [citation] }],
    locations: [{ name: '失落灯塔', description: '位于礁石尽头。', citations: [citation] }],
    factions: [{ name: '潮汐教团', description: '秘密组织。', citations: [citation] }],
    clues: [{ name: '破损徽记', description: '教团徽记。', source: '书桌', discovery: '调查', failForward: '仍可从港口打听', citations: [citation] }],
    scenes: [{ name: '灯塔决战', description: '阻止仪式。', location: '失落灯塔', npcs: ['艾琳'], monsters: ['潮汐祭司'], citations: [citation] }],
    encounters: [{ name: '灯塔守卫', description: '守卫入口。', creatures: ['潮汐祭司', '巨蟹'], notes: '', citations: [citation] }],
    importCandidates: [
      { name: '潮汐祭司', description: '施法怪物。', kind: 'monster', automation: 'partial', citations: [citation] },
      { name: '失落灯塔', description: '战术地图。', kind: 'map', automation: 'manual', citations: [citation] },
    ],
    prepTips: [],
    warnings: [],
    documents: [{ name: '测试模组.pdf', pageCount: 12, extractedCharacters: 12000, scannedPages: [] }],
    analyzedChunks: 3,
  }
}

describe('PDF 战役知识库模型', () => {
  it('把结构化怪物和遭遇引用合并为图鉴，并保留自动化状态', () => {
    const entries = buildPdfMonsterCodex(analysis())

    expect(entries).toHaveLength(2)
    expect(entries.find((entry) => entry.name === '潮汐祭司')).toMatchObject({
      automation: 'partial',
      encounterNames: ['灯塔守卫'],
    })
    expect(entries.find((entry) => entry.name === '巨蟹')?.automation).toBe('unreviewed')
  })

  it('把地图候选、地点和关联场景合并为地图索引', () => {
    const entries = buildPdfMapIndex(analysis())

    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ name: '失落灯塔', source: 'map-candidate', sceneNames: ['灯塔决战'] })
  })

  it('支持中文全库搜索并为每个页签给出稳定数量', () => {
    const fixture = analysis()

    expect(pdfKnowledgeMatches('银发', fixture.people[0].appearance)).toBe(true)
    expect(pdfKnowledgeMatches('不存在', fixture.people[0].appearance)).toBe(false)
    expect(pdfKnowledgeTabCounts(fixture)).toMatchObject({ people: 1, maps: 1, monsters: 2, relationships: 1 })
  })

  it('用原文外貌、身份和性格生成可编辑立绘提示词', () => {
    const prompt = buildPdfPersonPortraitPrompt(analysis().people[0])

    expect(prompt).toContain('艾琳')
    expect(prompt).toContain('银发灰眼')
    expect(prompt).toContain('无文字，无水印')
  })
})
