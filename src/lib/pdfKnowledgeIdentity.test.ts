import { describe, expect, it } from 'vitest'
import type { PdfNamedRecordV2, PdfRelationshipRecordV2, PdfSourceEvidenceV2 } from './pdfCampaignAnalysisV2'
import {
  createStablePdfEntityId,
  createStablePdfRelationshipId,
  disambiguatePdfEntityIds,
  disambiguatePdfRelationshipIds,
  resolvePdfRelationshipEndpoints,
} from './pdfKnowledgeIdentity'

const evidence: PdfSourceEvidenceV2 = {
  id: 'ev_123', documentId: 'pdf_123', documentName: '模组.pdf', page: 2, chunkId: 'chunk-1',
  quote: '艾琳在暮钟旅馆收集情报。', normalizedQuoteSha256: 'a'.repeat(64), verification: 'exact',
}

function entity(id: string, name: string, aliases: string[] = []): PdfNamedRecordV2 {
  return {
    id, name, aliases, description: '', citations: [], evidenceIds: [], confidence: 1, reviewStatus: 'auto-verified',
  }
}

function relationship(from: string, to: string): PdfRelationshipRecordV2 {
  const value: PdfRelationshipRecordV2 = {
    id: '', from, to, type: '合作', description: '', citations: [], evidenceIds: [evidence.id],
    confidence: 0.9, reviewStatus: 'auto-verified',
  }
  return { ...value, id: createStablePdfRelationshipId(value) }
}

describe('PDF V2 稳定身份', () => {
  it('实体 ID 不依赖数组顺序、时间或随机数，并区分实体类型', () => {
    const first = createStablePdfEntityId({ kind: 'person', name: ' 艾琳 ', firstEvidence: evidence })
    const same = createStablePdfEntityId({ kind: 'person', name: '艾琳', firstEvidence: evidence })
    const location = createStablePdfEntityId({ kind: 'location', name: '艾琳', firstEvidence: evidence })
    expect(same).toBe(first)
    expect(location).not.toBe(first)
  })

  it('同名实体的第一条证据不同会得到不同 ID', () => {
    const otherEvidence = { ...evidence, id: 'ev_456', page: 3 }
    const first = createStablePdfEntityId({ kind: 'person', name: '约翰', firstEvidence: evidence })
    const second = createStablePdfEntityId({ kind: 'person', name: '约翰', firstEvidence: otherEvidence })
    expect(second).not.toBe(first)
  })

  it('唯一主名称绑定 ID，唯一别名需复核，歧义名称不猜测', () => {
    const result = resolvePdfRelationshipEndpoints({
      people: [entity('p1', '艾琳', ['灰羽女士']), entity('p2', '约翰'), entity('p3', '约翰')],
      locations: [entity('l1', '暮钟旅馆')],
      factions: [],
      relationships: [relationship('艾琳', '暮钟旅馆'), relationship('灰羽女士', '暮钟旅馆'), relationship('约翰', '暮钟旅馆')],
    })
    expect(result[0]).toMatchObject({ fromEntityId: 'p1', toEntityId: 'l1', reviewStatus: 'auto-verified' })
    expect(result[1]).toMatchObject({ fromEntityId: 'p1', toEntityId: 'l1', reviewStatus: 'needs-review' })
    expect(result[2].fromEntityId).toBeUndefined()
    expect(result[2].from).toBe('约翰')
  })

  it('对实体与关系 ID 碰撞做确定性消歧', () => {
    const first = entity('ent_collision', '甲')
    const second = { ...entity('ent_collision', '乙'), description: '不同记录' }
    const entityIds = disambiguatePdfEntityIds([second, first]).map((entry) => entry.id)
    expect(new Set(entityIds).size).toBe(2)
    expect(disambiguatePdfEntityIds([first, second]).map((entry) => entry.id).sort()).toEqual([...entityIds].sort())

    const firstRelation = { ...relationship('甲', '乙'), id: 'rel_collision' }
    const secondRelation = { ...relationship('甲', '丙'), id: 'rel_collision' }
    const relationshipIds = disambiguatePdfRelationshipIds([secondRelation, firstRelation]).map((entry) => entry.id)
    expect(new Set(relationshipIds).size).toBe(2)
    expect(disambiguatePdfRelationshipIds([firstRelation, secondRelation]).map((entry) => entry.id).sort()).toEqual([...relationshipIds].sort())
  })
})
