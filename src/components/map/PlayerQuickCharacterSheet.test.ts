import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Character } from '../../types/character'
import { createDnd5eMechanicalEffect, DND5E_QUARTERSTAFF } from '../../rulesets/dnd5e'
import PlayerQuickCharacterSheet from './PlayerQuickCharacterSheet'

function character(): Character {
  return {
    id: 'quick-hero', name: '伊芙琳', player: '玩家一', avatar: '🧙', accent: 'from-violet-600 to-indigo-700',
    race: '高等精灵', charClass: '法师', level: 5, background: '贤者', experience: 6500, reputation: 0,
    abilities: { str: 8, dex: 16, con: 14, int: 18, wis: 12, cha: 10 }, savingThrows: ['int', 'wis'], skills: ['arcana', 'history'],
    maxHp: 32, currentHp: 25, tempHp: 4, hitDice: '5d6', ac: 14, speed: 30, initiativeBonus: 0, saveDC: 15,
    passivePerception: 11, inspiration: 0, conditions: ['blinded'], notes: '', dmNotes: '', visibleToPlayers: true,
    classResources: {
      fighterSecondWind: { current: 1, max: 1 },
      'dnd5e-arcane-recovery': { current: 1, max: 1 },
      'dnd5e-spell-slot-2': { current: 2, max: 3 },
    },
    equipment: { mainWeapon: DND5E_QUARTERSTAFF },
    dnd5eInventory: {
      schemaVersion: 3,
      entries: [{
        instanceId: 'potion-1', templateId: 'healing-potion', quantity: 2, acquiredAt: 2,
        item: {
          id: 'healing-potion', name: '治疗药水', category: 'consumable', icon: 'healing-potion', description: '恢复生命值。', rulesText: '恢复 2d4+2 生命值。', stackable: true,
          source: { book: 'SRD 5.1', license: 'CC BY 4.0' },
        },
      }],
      currency: { cp: 3, sp: 4, ep: 0, gp: 20, pp: 0 },
    },
  }
}

describe('PlayerQuickCharacterSheet', () => {
  it('displays Aid current HP against the effective maximum instead of the base maximum', () => {
    const aid = createDnd5eMechanicalEffect({
      definitionId: 'activity:aid:aid:modifiers:0', label: '援助术', targetId: 'quick-hero',
      source: { kind: 'spell', actorId: 'cleric', rulesId: 'aid', spellLevel: 2 },
      duration: { type: 'rounds', remainingRounds: 4_800, tickOn: 'target-turn-end' },
      modifiers: { hitPointMaximumBonus: 5 },
    })
    const html = renderToStaticMarkup(createElement(PlayerQuickCharacterSheet, {
      character: {
        ...character(), currentHp: 37,
        dnd5eCombatState: { activeEffects: [aid] },
      },
      onClose: () => undefined,
    }))
    expect(html).toContain('>37/37<')
  })

  it('在同一总览中显示属性、状态、资源与装备道具', () => {
    const html = renderToStaticMarkup(createElement(PlayerQuickCharacterSheet, { character: character(), onClose: () => undefined }))
    expect(html).toContain('data-testid="quick-character-sheet"')
    expect(html).toContain('data-testid="quick-character-overview"')
    expect(html).toContain('quick-character-sheet__header')
    expect(html).toContain('quick-character-sheet__ability')
    expect(html).toContain('quick-character-sheet__resource')
    expect(html).toContain('quick-character-sheet__equipment')
    expect(html).not.toContain('quick-character-tab-')
    expect(html).toContain('伊芙琳')
    expect(html).toContain('护甲等级')
    expect(html).toContain('属性与豁免')
    expect(html).toContain('奥秘')
    expect(html).toContain('奥术回想')
    expect(html).toContain('2环法术位')
    expect(html).not.toContain('回气')
    expect(html).not.toContain('fighterSecondWind')
  })

  it('将固定装备槽和背包物品放在同一面板的两个清晰区域', () => {
    const html = renderToStaticMarkup(createElement(PlayerQuickCharacterSheet, { character: character(), onClose: () => undefined }))
    const source = readFileSync(new URL('./PlayerQuickCharacterSheet.tsx', import.meta.url), 'utf8')
    expect(source).toContain("import Dnd5eInventoryTile from '../character/Dnd5eInventoryTile'")
    expect(html).toContain('data-testid="quick-character-equipment-grid"')
    expect(html).toContain('data-testid="quick-character-backpack-grid"')
    expect(html).toContain('主手／法器')
    expect(html).toContain('长棍')
    expect(html).toContain('治疗药水')
    expect(html).toContain('已装备 1/9 · 背包 1 类物品')
  })

  it('显示战斗中的法术派生 AC、正确 DC 与非状态效果', () => {
    const mageArmor = createDnd5eMechanicalEffect({
      definitionId: 'srd-5.1:spell:mage-armor', label: '法师护甲', targetId: 'quick-hero',
      source: { kind: 'spell', actorId: 'quick-hero', rulesId: 'mage-armor', spellLevel: 1 },
      duration: { type: 'rounds', remainingRounds: 4_800, tickOn: 'target-turn-end' },
    })
    const longstrider = createDnd5eMechanicalEffect({
      definitionId: 'srd-5.1:spell:longstrider', label: '大步奔行', targetId: 'quick-hero',
      source: { kind: 'spell', actorId: 'quick-hero', rulesId: 'longstrider', spellLevel: 2 },
      duration: { type: 'rounds', remainingRounds: 600, tickOn: 'target-turn-end' },
      modifiers: { speedBonusFeet: 10 },
    })
    const windWalk = createDnd5eMechanicalEffect({
      definitionId: 'srd-5.1:spell:wind-walk:cloud-form', label: '御风而行·云雾形态', targetId: 'quick-hero',
      source: { kind: 'spell', actorId: 'quick-hero', rulesId: 'wind-walk', spellLevel: 6 },
      duration: { type: 'rounds', remainingRounds: 4_800, tickOn: 'target-turn-end' },
      modifiers: { flySpeedFeet: 300 },
    })
    const html = renderToStaticMarkup(createElement(PlayerQuickCharacterSheet, {
      character: {
        ...character(), level: 20, abilities: { ...character().abilities, int: 20 }, saveDC: 12,
        conditions: [], dnd5eCombatState: { activeEffects: [mageArmor, longstrider, windWalk] },
      },
      onClose: () => undefined,
    }))
    expect(html).toContain('>16<')
    expect(html).toContain('>19<')
    expect(html).toContain('>40 尺<')
    expect(html).toContain('飞行 300 尺')
    expect(html).toContain('法师护甲')
    expect(html).toContain('大步奔行')
    expect(html).toContain('剩余 600 轮')
    expect(html).not.toContain('无状态效果')
  })

  it('权威效果与旧 conditions 投影同名时只显示一次，并显示剩余轮数', () => {
    const disguiseSelf = createDnd5eMechanicalEffect({
      definitionId: 'adjudicated:disguise-self:易容术', label: '易容术', targetId: 'quick-hero',
      legacyCondition: '易容术',
      source: { kind: 'spell', actorId: 'quick-hero', rulesId: 'disguise-self', spellLevel: 1 },
      duration: { type: 'rounds', remainingRounds: 600, tickOn: 'target-turn-end' },
    })
    const html = renderToStaticMarkup(createElement(PlayerQuickCharacterSheet, {
      character: {
        ...character(),
        conditions: ['blinded', '易容术'],
        dnd5eCombatState: { activeEffects: [disguiseSelf] },
      },
      onClose: () => undefined,
    }))
    expect(html.match(/易容术/g)).toHaveLength(1)
    expect(html).toContain('易容术 · 剩余 600 轮')
    expect(html).toContain('目盲')
  })

  it('显示专注法术名称和剩余轮数，避免地图持续区域失去可诊断信息', () => {
    const html = renderToStaticMarkup(createElement(PlayerQuickCharacterSheet, {
      character: {
        ...character(),
        concentrating: true,
        dnd5eCombatState: {
          concentrationSpellId: 'silent-image',
          concentrationRoundsRemaining: 100,
        },
      },
      onClose: () => undefined,
    }))
    expect(html).toContain('专注中：无声幻影 · 剩余 100 轮')
  })

  it('20 级德鲁伊的无限荒野形态不会泄漏内部数值哨兵', () => {
    const maximum = Number.MAX_SAFE_INTEGER
    const html = renderToStaticMarkup(createElement(PlayerQuickCharacterSheet, {
      character: {
        ...character(),
        charClass: '德鲁伊',
        dnd5eClassLevels: { druid: 20 },
        level: 20,
        classResources: {
          'dnd5e-wild-shape': { current: maximum, max: maximum },
          'dnd5e-natural-recovery': { current: 1, max: 1 },
        },
      },
      onClose: () => undefined,
    }))
    expect(html).toContain('荒野形态')
    expect(html).toContain('不限次数')
    expect(html).not.toContain(String(maximum))
  })

  it('变形术期间显示野兽权威属性、形态生命并隐藏已融入的装备资源', () => {
    const html = renderToStaticMarkup(createElement(PlayerQuickCharacterSheet, {
      character: {
        ...character(),
        charClass: '德鲁伊', dnd5eClassLevels: { druid: 20 }, level: 20,
        currentHp: 203, maxHp: 203,
        dnd5eCombatState: {
          wildShapeFormId: 'srd-5.1:tyrannosaurus-rex',
          wildShapeMode: 'polymorph',
          wildShapeCurrentHp: 100,
          wildShapeOriginalCurrentHp: 203,
        },
      },
      onClose: () => undefined,
    }))
    expect(html).toContain('当前形态：霸王龙（变形术）')
    expect(html).toContain('形态生命值')
    expect(html).toContain('>100/136<')
    expect(html).toContain('本体 203/203')
    expect(html).toContain('>25<')
    expect(html).toContain('>50 尺<')
    expect(html).toContain('不可施法')
    expect(html).toContain('装备已融入形态')
    expect(html).toContain('当前法术形态无法使用本体法术位或职业资源')
    expect(html).not.toContain('长棍')
  })

  it('形体变化保留法师心智属性和职业资源，并按融入选择停用装备', () => {
    const base = character()
    const html = renderToStaticMarkup(createElement(PlayerQuickCharacterSheet, {
      character: {
        ...base,
        level: 20,
        currentHp: 162,
        maxHp: 162,
        abilities: { str: 8, dex: 16, con: 18, int: 20, wis: 13, cha: 11 },
        savingThrows: ['int', 'wis'],
        skills: ['arcana', 'insight', 'investigation', 'religion'],
        passivePerception: 11,
        saveDC: 19,
        classResources: { 'dnd5e-spell-slot-9': { current: 0, max: 1 } },
        concentrating: true,
        dnd5eCombatState: {
          wildShapeFormId: 'srd-5.1:adult-black-dragon',
          wildShapeMode: 'shapechange',
          shapechangeEquipmentDisposition: 'merge',
          wildShapeCurrentHp: 195,
          wildShapeOriginalCurrentHp: 162,
          wildShapeOriginalAbilities: { str: 8, dex: 16, con: 18, int: 20, wis: 13, cha: 11 },
          wildShapeOriginalSavingThrowBonuses: { str: -1, dex: 3, con: 4, int: 11, wis: 7, cha: 0 },
          wildShapeOriginalSavingThrowProficiencies: ['int', 'wis'],
          wildShapeOriginalSkillProficiencies: ['arcana', 'insight', 'investigation', 'religion'],
          wildShapeOriginalPassivePerception: 11,
          concentrationSpellId: 'shapechange',
          concentrationRoundsRemaining: 600,
        },
      },
      onClose: () => undefined,
    }))
    expect(html).toContain('当前形态：成年黑龙（形体变化）')
    expect(html).toMatch(/智力<\/div><div[^>]*>20<\/div>/)
    expect(html).toMatch(/魅力<\/div><div[^>]*>11<\/div>/)
    expect(html).toContain('>19<')
    expect(html).toContain('9环法术位')
    expect(html).toContain('装备已融入形态')
    expect(html).not.toContain('当前法术形态无法使用本体法术位或职业资源')
    expect(html).not.toContain('长棍')
  })

  it('完全变形术物体形态显示独立物体生命池并封存生物字段', () => {
    const objectEffect = createDnd5eMechanicalEffect({
      definitionId: 'true-polymorph-creature-object-srd-5.1:true-polymorph-object:stone-statue',
      label: '完全变形术·石制雕像', targetId: 'quick-hero',
      tags: [
        'transformation', 'object-form', 'equipment-merged',
        'true-polymorph-object-form:srd-5.1:true-polymorph-object:stone-statue',
      ],
      source: { kind: 'spell', actorId: 'wizard', rulesId: 'true-polymorph', spellLevel: 9 },
      duration: { type: 'rounds', remainingRounds: 600, tickOn: 'target-turn-end' },
    })
    const html = renderToStaticMarkup(createElement(PlayerQuickCharacterSheet, {
      character: {
        ...character(), currentHp: 25, maxHp: 32,
        dnd5eCombatState: {
          wildShapeFormId: 'srd-5.1:true-polymorph-object:stone-statue',
          wildShapeMode: 'true-polymorph', wildShapeCurrentHp: 18,
          wildShapeOriginalCurrentHp: 25, activeEffects: [objectEffect],
        },
      },
      onClose: () => undefined,
    }))
    expect(html).toContain('当前形态：石制雕像（完全变形术）')
    expect(html).toContain('物体生命值')
    expect(html).toContain('>18/18<')
    expect(html).toContain('>17<')
    expect(html).toContain('>0 尺<')
    expect(html).toContain('物体没有生物属性或豁免')
    expect(html).toContain('物体不能进行生物技能检定')
    expect(html).toContain('当前物体形态无法使用本体法术位或职业资源')
    expect(html).toContain('装备与携带物已融入物体形态')
    expect(html).not.toContain('长棍')
    expect(html).not.toContain('奥秘')
  })
})
