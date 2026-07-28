import { describe, expect, it } from 'vitest'
import { buildDnd5eCustomMonster, createDnd5eCustomMonsterDraft } from './customMonsterWorkshop'
import { parseDnd5ePastedMonster } from './monsterStatBlockPaste'

const GOBLIN = `Goblin
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
Scimitar. Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) slashing damage.
Shortbow. Ranged Weapon Attack: +4 to hit, range 80/320 ft., one target. Hit: 5 (1d6 + 2) piercing damage.`

describe('D&D 5e pasted monster stat block parser', () => {
  it('fills a common English SRD-style stat block into the shared workshop draft', () => {
    const result = parseDnd5ePastedMonster(GOBLIN)
    expect(result.sourceFormat).toBe('stat-block-text')
    expect(result.draft).toMatchObject({
      name: 'Goblin',
      englishName: 'Goblin',
      size: '小型',
      armorClass: 15,
      armorClassNote: 'leather armor, shield',
      hitPointsAverage: 7,
      hitPointsDice: '2d6',
      walk: 30,
      abilities: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
      passivePerception: 9,
      challengeRating: '1/4',
      xp: 50,
    })
    expect(result.draft.skills).toEqual([
      expect.objectContaining({ name: '隐匿', bonus: 6 }),
    ])
    expect(result.draft.traits).toEqual([
      expect.objectContaining({ name: 'Nimble Escape', ruleKind: 'nimble-escape', automation: 'headless' }),
    ])
    expect(result.draft.actions).toEqual([
      expect.objectContaining({ name: 'Scimitar', mode: 'melee', toHit: 4, damageDice: '1d6+2', damageType: 'slashing' }),
      expect.objectContaining({ name: 'Shortbow', mode: 'ranged', rangeNormal: 80, rangeLong: 320, damageType: 'piercing' }),
    ])
    expect(() => buildDnd5eCustomMonster(result.draft)).not.toThrow()
  })

  it('recognizes common Chinese labels and an on-hit saving throw', () => {
    const result = parseDnd5ePastedMonster(`岩地猎手
中型怪兽，中立
护甲等级 13（天然护甲）
生命值 22（4d8+4）
速度 30尺，攀爬20尺
力量 16 敏捷 12 体质 13 智力 4 感知 12 魅力 6
技能 察觉 +3，隐匿 +3
感官 黑暗视觉60尺，被动察觉13
语言 —
挑战等级 1（200 XP）
敏锐嗅觉。猎手进行依赖嗅觉的感知检定时具有优势。
动作
撞击。近战武器攻击：命中 +5，触及5尺，单一目标。命中：7（1d8+3）点钝击伤害，目标必须通过 DC 13 力量豁免，否则倒地。`)
    expect(result.draft).toMatchObject({
      name: '岩地猎手',
      size: '中型',
      armorClass: 13,
      hitPointsAverage: 22,
      hitPointsDice: '4d8+4',
      walk: 30,
      climb: 20,
      passivePerception: 13,
      challengeRating: '1',
      xp: 200,
    })
    expect(result.draft.actions[0]).toMatchObject({
      name: '撞击',
      toHit: 5,
      damageDice: '1d8+3',
      damageType: 'bludgeoning',
      onHitSaveEnabled: true,
      onHitSaveAbility: 'str',
      onHitSaveDc: 13,
      onHitCondition: 'prone',
      automation: 'headless',
    })
  })

  it('accepts a complete monsterSchema JSON export without lossy text parsing', () => {
    const monster = buildDnd5eCustomMonster(createDnd5eCustomMonsterDraft())
    const result = parseDnd5ePastedMonster(JSON.stringify(monster))
    expect(result.sourceFormat).toBe('monster-json')
    expect(result.warnings).toEqual([])
    expect(buildDnd5eCustomMonster(result.draft)).toMatchObject({
      id: monster.id,
      slug: monster.slug,
      actions: monster.actions,
    })
  })

  it('rejects empty input and warns instead of inventing missing combat fields', () => {
    expect(() => parseDnd5ePastedMonster('   ')).toThrow('请先粘贴怪物属性块')
    const result = parseDnd5ePastedMonster('Unknown Thing\nA mysterious creature')
    expect(result.warnings.join('；')).toContain('关键字段未识别')
    expect(result.warnings.join('；')).toContain('未识别动作段落')
  })
})
