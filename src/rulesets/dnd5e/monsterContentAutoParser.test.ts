import { describe, expect, it } from 'vitest'
import {
  parseDnd5eFeatureMechanicText,
  parseDnd5eSpellcastingText,
  parseDnd5eSpellListText,
} from './monsterContentAutoParser'

describe('怪物特性与法术自动解析', () => {
  it('把固定生命阈值和通用额外伤害转换为可执行机制', () => {
    const result = parseDnd5eFeatureMechanicText(
      '不退斗志：当他的血量低于 10 时，他造成的所有伤害获得额外 1d6 的加值。',
    )
    expect(result.warnings).toEqual([])
    expect(result.mechanic).toMatchObject({
      name: '不退斗志',
      trigger: 'after-dealt-damage',
      triggerSubject: 'self',
      hpBelow: 10,
      hpPercentageAtOrBelow: undefined,
      effectKind: 'damage',
      effectTarget: 'trigger-target',
      healingDice: '1d6',
      damageType: 'inherit-trigger',
      automation: 'full',
    })
  })

  it('区分严格小于和小于等于', () => {
    const below = parseDnd5eFeatureMechanicText('背水一战：生命值小于 10 时，造成伤害后额外造成 1d4 同种伤害。')
    const atOrBelow = parseDnd5eFeatureMechanicText('背水一战：生命值不高于 10 时，造成伤害后额外造成 1d4 同种伤害。')
    expect(below.mechanic?.hpBelow).toBe(10)
    expect(below.mechanic?.hpAtOrBelow).toBeUndefined()
    expect(atOrBelow.mechanic?.hpAtOrBelow).toBe(10)
    expect(atOrBelow.mechanic?.hpBelow).toBeUndefined()
  })

  it('从中文、英文和属性块法术行识别 SRD 法术', () => {
    expect(parseDnd5eSpellListText('火球术、Shield、fire-bolt').spells.map((spell) => spell.id))
      .toEqual(['fireball', 'shield', 'fire-bolt'])
    const block = parseDnd5eSpellcastingText(`Cantrips (at will): fire bolt, mage hand
1st level (4 slots): shield, magic missile`)
    expect(block.slots).toEqual({ '1': 4 })
    expect(block.spells).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'fire-bolt', level: 0, usageKind: 'at-will' }),
      expect.objectContaining({ id: 'shield', level: 1, usageKind: 'slots' }),
    ]))
  })

  it('不猜测无法识别的特性', () => {
    const result = parseDnd5eFeatureMechanicText('神秘灵光：附近生物感到不安。')
    expect(result.mechanic).toBeUndefined()
    expect(result.warnings.length).toBeGreaterThan(0)
  })
})
