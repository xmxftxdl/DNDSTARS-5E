import { describe, expect, it } from 'vitest'
import { mergePdfEncounterRecords, mergePdfSceneRecords, normalizePdfEventIdentityName } from './pdfCampaignEventDeduplication'

describe('PDF 战役场景与遭遇去重', () => {
  it('忽略标点、连接词和明确的类型后缀，但保留剧情语义', () => {
    expect(normalizePdfEventIdentityName('黑桦弯的伏击（场景）')).toBe('黑桦弯伏击')
    expect(normalizePdfEventIdentityName('黑桦弯伏击战')).toBe('黑桦弯伏击')
    expect(normalizePdfEventIdentityName('信件鉴定仪式')).not.toBe(normalizePdfEventIdentityName('信件伪造'))
  })

  it('合并重复场景的详情、人物、怪物与证据', () => {
    const result = mergePdfSceneRecords([{
      name: '黑桦弯伏击', description: '玩家遭到伏击。', location: '黑桦弯', npcs: ['瑟维迪尔'], monsters: [],
      citations: [{ documentName: '模组.pdf', page: 17 }],
    }, {
      name: '黑桦弯伏击战', description: '伏击者从两侧树林包围玩家。', location: '黑桦弯', npcs: [], monsters: ['伏击者'],
      citations: [{ documentName: '模组.pdf', page: 18 }],
    }])

    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('黑桦弯伏击')
    expect(result[0].description).toContain('两侧树林')
    expect(result[0].npcs).toEqual(['瑟维迪尔'])
    expect(result[0].monsters).toEqual(['伏击者'])
    expect(result[0].citations).toHaveLength(2)
  })

  it('合并重复遭遇并保留全部参战生物', () => {
    const result = mergePdfEncounterRecords([{
      name: '教堂遭遇', description: '守卫出现。', creatures: ['守卫'], notes: '', citations: [],
    }, {
      name: '教堂遭遇战', description: '守卫阻止玩家调查。', creatures: ['祭司'], notes: '可交涉。', citations: [],
    }])
    expect(result).toHaveLength(1)
    expect(result[0].creatures).toEqual(['守卫', '祭司'])
    expect(result[0].notes).toBe('可交涉。')
  })

  it('只在共享证据页时合并包含关系的名称，避免跨章节误合并', () => {
    const sharedPage = mergePdfSceneRecords([{
      name: '信件鉴定', description: '检查信件。', location: '', npcs: [], monsters: [], citations: [{ documentName: '模组.pdf', page: 8 }],
    }, {
      name: '信件鉴定仪式', description: '执行完整鉴定。', location: '', npcs: [], monsters: [], citations: [{ documentName: '模组.pdf', page: 8 }],
    }])
    const differentPages = mergePdfSceneRecords([{
      name: '教堂调查', description: '第一次调查。', location: '', npcs: [], monsters: [], citations: [{ documentName: '模组.pdf', page: 8 }],
    }, {
      name: '教堂调查后续', description: '数日后的第二次调查。', location: '', npcs: [], monsters: [], citations: [{ documentName: '模组.pdf', page: 20 }],
    }])

    expect(sharedPage).toHaveLength(1)
    expect(differentPages).toHaveLength(2)
  })
})
