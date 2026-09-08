import { describe, expect, it } from 'vitest'
import { parseDnd5eMonsterStatBlock } from '../rulesets/dnd5e/monsterSchema'
import {
  consumeDmWorkshopMonsterHandoff,
  stageDmWorkshopMonsterHandoff,
} from './dmWorkshopMonsterHandoff'

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) },
  }
}

describe('dmWorkshopMonsterHandoff', () => {
  it('把战役怪物资源一次性交接给怪物工坊，并保留来源与复核警告', () => {
    const storage = memoryStorage()
    expect(stageDmWorkshopMonsterHandoff('campaign-1', {
      name: '潮汐祭司',
      description: '在灯塔决战中使用潮汐魔法。',
      monsterStatBlockText: '',
      automation: 'partial',
      sourceLabels: ['灯塔决战', '模组.pdf · 第 12 页'],
    }, storage, 10_000)).toBe(true)

    const request = consumeDmWorkshopMonsterHandoff('campaign-1', storage, 10_001)
    expect(request?.monster.name).toBe('潮汐祭司')
    expect(request?.monster.description).toContain('潮汐魔法')
    expect(request?.monster.actions).toEqual([])
    expect(request?.review.sourceText).toContain('第 12 页')
    expect(request?.review.unsupported?.join('')).toContain('partial')
    expect(parseDnd5eMonsterStatBlock(request?.monster)).toMatchObject({ ok: true })
    expect(consumeDmWorkshopMonsterHandoff('campaign-1', storage, 10_002)).toBeNull()
  })

  it('拒绝跨战役或过期的怪物交接数据', () => {
    const storage = memoryStorage()
    stageDmWorkshopMonsterHandoff('campaign-1', {
      name: '旧怪物', description: '', automation: 'unreviewed', sourceLabels: [],
      monsterStatBlockText: '',
    }, storage, 1_000)
    expect(consumeDmWorkshopMonsterHandoff('campaign-2', storage, 1_001)).toBeNull()
    expect(consumeDmWorkshopMonsterHandoff('campaign-1', storage, 30_000_000)).toBeNull()
  })

  it('把 PDF 中的完整属性块转换为工坊的特质、动作和战斗数值', () => {
    const storage = memoryStorage()
    const monsterStatBlockText = `Goblin
Small humanoid (goblinoid), neutral evil
Armor Class 15 (leather armor, shield)
Hit Points 7 (2d6)
Speed 30 ft.
STR DEX CON INT WIS CHA
8 (-1) 14 (+2) 10 (+0) 10 (+0) 8 (-1) 8 (-1)
Skills Stealth +6
Senses darkvision 60 ft., passive Perception 9
Languages Common, Goblin
Challenge 1/4 (50 XP)
Nimble Escape. The goblin can take the Disengage or Hide action as a bonus action on each of its turns.
Actions
Scimitar. Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) slashing damage.`
    expect(stageDmWorkshopMonsterHandoff('campaign-1', {
      name: 'Goblin',
      description: 'PDF 怪物属性块。',
      monsterStatBlockText,
      automation: 'partial',
      sourceLabels: ['模组.pdf · 第 7 页'],
    }, storage, 20_000)).toBe(true)

    const request = consumeDmWorkshopMonsterHandoff('campaign-1', storage, 20_001)
    expect(request?.monster).toMatchObject({
      name: 'Goblin',
      armorClass: { value: 15 },
      hitPoints: { average: 7, dice: '2d6' },
    })
    expect(request?.monster.traits).toEqual([
      expect.objectContaining({ name: 'Nimble Escape' }),
    ])
    expect(request?.monster.actions).toEqual([
      expect.objectContaining({
        name: 'Scimitar',
        attack: expect.objectContaining({
          toHit: 4,
          damage: [expect.objectContaining({ count: 1, sides: 6, bonus: 2, type: 'slashing' })],
        }),
      }),
    ])
    expect(request?.review.assumptions?.join('')).toContain('特性')
    expect(request?.review.sourceText).toContain('Nimble Escape')
  })
})
