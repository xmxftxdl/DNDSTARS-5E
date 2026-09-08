import { describe, expect, it } from 'vitest'
import type { PdfPersonRecordV1, PdfRelationshipRecordV1 } from './pdfCampaignAnalysis'
import { canonicalizePdfPersonRelationships, mergePdfPersonRecords } from './pdfPersonDeduplication'

function person(name: string, overrides: Partial<PdfPersonRecordV1> = {}): PdfPersonRecordV1 {
  return {
    name,
    aliases: [],
    description: '',
    role: '',
    appearance: '',
    personality: '',
    motivation: '',
    secret: '',
    voice: '',
    citations: [],
    ...overrides,
  }
}

describe('PDF 人物实体消歧', () => {
  it('把唯一简称合并到完整姓名，并保留别名和互补资料', () => {
    const result = mergePdfPersonRecords([
      person('费兰迪尔', { role: '银翼家族成员', citations: [{ documentName: '模组.pdf', page: 3 }] }),
      person('费兰迪尔·银翼', { description: '森都四大家族内阁文书官。', motivation: '维护文书程序。', citations: [{ documentName: '模组.pdf', page: 12 }] }),
    ])

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      name: '费兰迪尔·银翼',
      aliases: ['费兰迪尔'],
      role: '银翼家族成员',
      description: '森都四大家族内阁文书官。',
      motivation: '维护文书程序。',
    })
    expect(result[0].citations).toHaveLength(2)
  })

  it('同一简称对应多个完整姓名时不猜测合并', () => {
    const result = mergePdfPersonRecords([
      person('艾琳'),
      person('艾琳·银翼'),
      person('艾琳·灰羽'),
    ])

    expect(result).toHaveLength(3)
  })

  it('通过显式别名合并，并把关系端点改为规范全名', () => {
    const people = mergePdfPersonRecords([
      person('马伦·潮印', { aliases: ['马伦'] }),
      person('马伦', { description: '白鹿小教堂的常客。' }),
    ])
    const relationships: PdfRelationshipRecordV1[] = [{
      from: '马伦',
      to: '白鹿小教堂',
      type: '常客',
      description: '',
      citations: [],
    }]

    expect(people).toHaveLength(1)
    expect(canonicalizePdfPersonRelationships(relationships, people)[0].from).toBe('马伦·潮印')
  })
})
