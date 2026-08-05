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

const ILIFA_COMMANDER_PHANTOM = `伊利法统领虚体
中型类人生物（红龙裔），守序中立
AC：14（法师护甲）
HP：35（5d8+10）
速度：30尺
力量18（+4），敏捷12（+1），体质14
（+2），智力16（+3），感知10（+1），魅力19（+4）
技能：说服+6，察觉+2，洞悉+2，隐匿+3，运动+6
豁免：体质+4，魅力+6
伤害抗性：火焰
感官：被动察觉12
语言：通用语，龙语
挑战等级：3
吐息武器：他可以使用动作呼出破坏性的能
量。使用吐息时，他15尺锥状内的每个生物都必须进行一次敏捷豁免（dc14），豁免失
败者将受到2d6点伤害。豁免成功则伤害减 半。
不退斗志：当他的血量低于 10的时候，进入最后血拼高昂的状态，此时他造成的所有伤害获得额外1d6的加值
施法：作为一个 2级施法者，其施法主属性为魅力（豁免dc14，法术加值+6）
戏法：火焰箭，冰冻射线，光亮术，鸣雷破
一环（3法术位，目前只剩2）：命令术，法师护甲，混乱箭
动作
法杖敲击：近战武器攻击，单一目标，命中
+6，伤害：8（1d6+4）钝击伤害
呼唤伊利法军（充能6）
其可以使用一个动作来进行直到下一回合开始的祈唤（期间视为专注），在下一个其回合开始时，1d3个伊利法军兵就会出现在战场上。`

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

  it('normalizes the pasted Ilifa Chinese stat block with safe defaults and stable combat fields', () => {
    const result = parseDnd5ePastedMonster(ILIFA_COMMANDER_PHANTOM)
    expect(result.draft).toMatchObject({
      name: '伊利法统领虚体',
      size: '中型',
      creatureType: '类人生物（红龙裔）',
      alignment: '守序中立',
      armorClass: 14,
      armorClassNote: '法师护甲',
      hitPointsAverage: 35,
      hitPointsDice: '5d8+10',
      walk: 30,
      abilities: { str: 18, dex: 12, con: 14, int: 16, wis: 10, cha: 19 },
      savingThrows: { con: 4, cha: 6 },
      passivePerception: 12,
      languages: '通用语，龙语',
      challengeRating: '3',
      xp: 700,
      damageResistances: ['fire'],
      spellcastingEnabled: true,
      spellcastingCasterLevel: 2,
      spellcastingAbility: 'cha',
      spellcastingSaveDc: 14,
      spellcastingAttackBonus: 6,
      spellSlots: { '1': 3 },
      spellcastingAutomation: 'dm-adjudication',
    })
    expect(result.draft.skills).toEqual([
      expect.objectContaining({ key: 'persuasion', name: '说服', bonus: 6 }),
      expect.objectContaining({ key: 'perception', name: '察觉', bonus: 2 }),
      expect.objectContaining({ key: 'insight', name: '洞悉', bonus: 2 }),
      expect.objectContaining({ key: 'stealth', name: '隐匿', bonus: 3 }),
      expect.objectContaining({ key: 'athletics', name: '运动', bonus: 6 }),
    ])
    expect(result.draft.spells).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'fire-bolt', level: 0 }),
      expect.objectContaining({ id: 'ray-of-frost', level: 0 }),
      expect.objectContaining({ id: 'light', level: 0 }),
      expect.objectContaining({ id: 'command', level: 1 }),
      expect.objectContaining({ id: 'mage-armor', level: 1 }),
    ]))
    expect(result.draft.traits).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: '吐息武器',
        description: expect.stringContaining('呼出破坏性的能量。使用吐息时'),
      }),
    ]))
    expect(result.draft.traits.map((trait) => trait.name)).not.toContain('量')
    expect(result.draft.traits.some((trait) => trait.name.startsWith('败者将受到'))).toBe(false)
    expect(result.draft.traits.map((trait) => trait.name)).not.toEqual(expect.arrayContaining([
      '施法', '戏法', '一环（3法术位，目前只剩2）',
    ]))
    expect(result.draft.spells).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: expect.stringMatching(/^custom-spell-/), name: '鸣雷破', level: 0 }),
      expect.objectContaining({ id: expect.stringMatching(/^custom-spell-/), name: '混乱箭', level: 1 }),
    ]))
    expect(result.warnings.join('\n')).toContain('鸣雷破')
    expect(result.warnings.join('\n')).toContain('混乱箭')
    expect(result.draft.headlessMechanics).toEqual([
      expect.objectContaining({
        name: '不退斗志',
        trigger: 'after-dealt-damage',
        hpBelow: 10,
        automation: 'full',
      }),
    ])
    expect(result.draft.actions).toEqual([
      expect.objectContaining({
        name: '法杖敲击',
        kind: 'weapon-attack',
        automation: 'headless',
        toHit: 6,
        damageDice: '1d6+4',
        damageType: 'bludgeoning',
      }),
      expect.objectContaining({
        name: '呼唤伊利法军',
        kind: 'other',
        automation: 'dm-adjudication',
        usageKind: 'recharge',
        rechargeMinimum: 6,
      }),
    ])
    expect(() => buildDnd5eCustomMonster(result.draft)).not.toThrow()
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
