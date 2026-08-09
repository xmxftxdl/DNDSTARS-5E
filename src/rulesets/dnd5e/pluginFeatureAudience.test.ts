import { describe, expect, it } from 'vitest'
import { classifyDnd5ePluginFeatureAudience } from './pluginFeatureAudience'

const monsters = [{
  id: 'room-monster:ilifa-ruler-ghostform',
  slug: 'ilifa-ruler-ghostform',
  name: '伊利法统领虚体',
  ownerPluginId: 'local-rules',
  traits: [{ name: '不退斗志', description: '生命值低于 10 时，造成伤害额外增加 1d6。' }],
  actions: [
    { name: '法杖敲击 Staff Strike', description: '近战武器攻击，命中造成 1d6+4 钝击伤害。' },
    { name: '呼唤伊利法军', description: '召唤伊利法军。' },
    { name: '吐息武器', description: '锥形吐息武器。' },
  ],
  bonusActions: [{ name: '幽影步', description: '传送至多 30 尺。' }],
  reactions: [],
  legendaryActions: [],
  lairActions: [],
  spellcasting: { spells: [] },
}]

describe('classifyDnd5ePluginFeatureAudience', () => {
  it('把怪物属性块中的被动特性归入怪物特性', () => {
    expect(classifyDnd5ePluginFeatureAudience({
      name: '不退斗志',
      ownerPluginId: 'local-rules',
      description: '生命值低于 10 时，造成伤害额外增加 1d6。',
    }, monsters)).toEqual({
      audience: 'monster-trait',
      monsterNames: ['伊利法统领虚体'],
    })
  })

  it('把普通、附赠、反应、传奇和巢穴动作归入怪物动作', () => {
    expect(classifyDnd5ePluginFeatureAudience({
      name: '法杖敲击',
      ownerPluginId: 'local-rules',
      description: '近战武器攻击，命中造成 1d6+4 钝击伤害。',
    }, monsters)).toEqual({
      audience: 'monster-action',
      monsterNames: ['伊利法统领虚体'],
    })
    expect(classifyDnd5ePluginFeatureAudience({
      name: '幽影步',
      ownerPluginId: 'local-rules',
      description: '传送至多 30 尺。',
    }, monsters).audience).toBe('monster-action')
  })

  it('不会把另一插件的同名角色特性误归入怪物', () => {
    expect(classifyDnd5ePluginFeatureAudience({
      name: '不退斗志',
      ownerPluginId: 'character-options',
    }, monsters)).toEqual({ audience: 'character', monsterNames: [] })
  })

  it('支持没有插件所有权的房间自定义怪物反查', () => {
    expect(classifyDnd5ePluginFeatureAudience({
      name: '法杖敲击',
      ownerPluginId: 'legacy-ai-import',
      description: '近战武器攻击，命中造成 1d6+4 钝击伤害。',
    }, [{ ...monsters[0], ownerPluginId: undefined }]).audience).toBe('monster-action')
  })

  it('不会因为房间怪物恰好同名而覆盖明确的职业来源', () => {
    expect(classifyDnd5ePluginFeatureAudience({
      name: '不退斗志',
      ownerPluginId: 'character-options',
      description: '生命值低于 10 时，造成伤害额外增加 1d6。',
      sourceClassId: 'fighter',
    }, [{ ...monsters[0], ownerPluginId: undefined }]).audience).toBe('character')
  })

  it('识别正文被运行时投影移除的旧房间怪物动作', () => {
    expect(classifyDnd5ePluginFeatureAudience({
      id: 'local.room.paste-03816d7f1a693523:ilifa-staff-strike',
      name: '法杖敲击',
      ownerPluginId: 'local.room.paste-03816d7f1a693523',
      summary: '房间临时机械数据；原始规则正文未传输。',
      description: '房间临时机械数据；原始规则正文未传输。',
    }, [{ ...monsters[0], ownerPluginId: undefined }])).toEqual({
      audience: 'monster-action',
      monsterNames: ['伊利法统领虚体'],
    })
  })

  it('通过稳定 ID 前缀把旧房间施法占位项归入怪物规则', () => {
    expect(classifyDnd5ePluginFeatureAudience({
      id: 'local.room.paste-03816d7f1a693523:ilifa-spellcasting',
      name: '施法',
      ownerPluginId: 'local.room.paste-03816d7f1a693523',
      summary: '房间临时机械数据；原始规则正文未传输。',
      description: '房间临时机械数据；原始规则正文未传输。',
    }, [{ ...monsters[0], ownerPluginId: undefined }])).toEqual({
      audience: 'monster-trait',
      monsterNames: ['伊利法统领虚体'],
    })
  })

  it('把截图中的整组旧伊利法占位能力全部移出角色规则', () => {
    const placeholder = '房间临时机械数据；原始规则正文未传输。'
    const legacyFeatures = [
      ['ilifa-unyielding-spirit', '不退斗志'],
      ['ilifa-staff-strike', '法杖敲击'],
      ['ilifa-call-army', '呼唤伊利法军'],
      ['ilifa-breath-weapon', '吐息武器'],
      ['ilifa-spellcasting', '施法'],
    ] as const
    const audiences = legacyFeatures.map(([id, name]) =>
      classifyDnd5ePluginFeatureAudience({
        id: `local.room.paste-03816d7f1a693523:${id}`,
        name,
        ownerPluginId: 'local.room.paste-03816d7f1a693523',
        summary: placeholder,
        description: placeholder,
      }, [{ ...monsters[0], ownerPluginId: undefined }]).audience)

    expect(audiences).toEqual([
      'monster-trait',
      'monster-action',
      'monster-action',
      'monster-action',
      'monster-trait',
    ])
  })
})
