import { describe, expect, it } from 'vitest'
import { buildPdfRelationshipForceLayout, buildPdfRelationshipGraphModel } from './pdfRelationshipGraphModel'

const citation = [{ documentName: '迷雾镇.pdf', page: 12 }]

describe('PDF 人物关系图', () => {
  it('把人物、势力和地点注册为不同节点，并把关系端点解析到对应实体', () => {
    const model = buildPdfRelationshipGraphModel({
      people: [{
        name: '艾琳',
        description: '负责调查失踪案。',
        role: '调查员',
        appearance: '银色短发，穿深蓝色旅行斗篷。',
        personality: '谨慎',
        motivation: '找到失踪者',
        secret: '',
        voice: '语速缓慢',
        citations: citation,
      }],
      factions: [{ name: '断牙帮', description: '当地帮派。', citations: citation }],
      locations: [{ name: '旧钟楼', description: '废弃钟楼。', citations: citation }],
      relationships: [
        { from: '艾琳', to: '断牙帮', type: '调查', description: '追查帮派活动。', citations: citation },
        { from: '断牙帮', to: '旧钟楼', type: '占据', description: '把这里当作据点。', citations: citation },
      ],
    })

    expect(model.nodes.map((node) => [node.name, node.kind])).toEqual([
      ['艾琳', 'person'],
      ['断牙帮', 'faction'],
      ['旧钟楼', 'location'],
    ])
    expect(model.edges).toHaveLength(2)
    expect(model.edges[0]).toMatchObject({ sourceId: 'person:艾琳', targetId: 'faction:断牙帮', inferred: false, origin: 'explicit' })
    expect(model.nodes[0].appearance).toContain('银色短发')
  })

  it('把只有关系证据、尚未归类的名称标记为待确认节点', () => {
    const model = buildPdfRelationshipGraphModel({
      people: [],
      factions: [],
      locations: [],
      relationships: [{ from: '神秘访客', to: '艾琳', type: '监视', description: '', citations: citation }],
    })

    expect(model.nodes).toHaveLength(2)
    expect(model.nodes.every((node) => node.kind === 'unknown')).toBe(true)
    expect(model.nodes[0].description).toContain('DM 确认')
  })

  it('在关系图层把被模型误放入人物列表的派系纠正为势力节点', () => {
    const model = buildPdfRelationshipGraphModel({
      people: [{
        name: '卫月派',
        description: '反派势力，试图控制森林。',
        role: '敌对派系',
        personality: '',
        motivation: '',
        secret: '',
        voice: '',
        citations: citation,
      }],
      factions: [],
      locations: [],
      relationships: [],
    })

    expect(model.nodes).toEqual([expect.objectContaining({ name: '卫月派', kind: 'faction' })])
  })

  it('从场景中的人物共现和发生地点补充候选关系，并明确标记为系统推导', () => {
    const model = buildPdfRelationshipGraphModel({
      people: [
        { name: '艾琳', description: '', role: '', appearance: '', personality: '', motivation: '', secret: '', voice: '', citations: citation },
        { name: '卡洛斯', description: '', role: '', appearance: '', personality: '', motivation: '', secret: '', voice: '', citations: citation },
      ],
      factions: [],
      locations: [],
      relationships: [],
      scenes: [{
        name: '钟楼会面',
        description: '两人在钟楼交换情报。',
        location: '旧钟楼',
        npcs: ['艾琳', '卡洛斯'],
        monsters: [],
        citations: citation,
      }],
    })

    expect(model.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: '旧钟楼', kind: 'location' }),
    ]))
    expect(model.edges).toHaveLength(3)
    expect(model.edges.every((edge) => edge.inferred)).toBe(true)
    expect(model.edges.map((edge) => edge.relationship.type).sort()).toEqual(['出现在', '出现在', '同场'])
  })

  it('力导向布局稳定、保持在画布内，并为所有节点生成不同位置', () => {
    const model = buildPdfRelationshipGraphModel({
      people: [
        { name: '艾琳', description: '', role: '', appearance: '', personality: '', motivation: '', secret: '', voice: '', citations: citation },
        { name: '卡洛斯', description: '', role: '', appearance: '', personality: '', motivation: '', secret: '', voice: '', citations: citation },
        { name: '米拉', description: '', role: '', appearance: '', personality: '', motivation: '', secret: '', voice: '', citations: citation },
      ],
      factions: [],
      locations: [],
      relationships: [
        { from: '艾琳', to: '卡洛斯', type: '合作', description: '', citations: citation },
        { from: '艾琳', to: '米拉', type: '调查', description: '', citations: citation },
      ],
    })
    const first = buildPdfRelationshipForceLayout(model.nodes, model.edges, 900, 600)
    const second = buildPdfRelationshipForceLayout(model.nodes, model.edges, 900, 600)

    expect([...first.entries()]).toEqual([...second.entries()])
    expect(first.size).toBe(3)
    expect(new Set([...first.values()].map((point) => `${point.x.toFixed(2)}:${point.y.toFixed(2)}`)).size).toBe(3)
    expect([...first.values()].every((point) => point.x >= 0 && point.x <= 900 && point.y >= 0 && point.y <= 600)).toBe(true)
  })
})
