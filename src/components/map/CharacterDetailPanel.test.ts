import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { Token } from '../../store/maps'
import type { Character } from '../../types/character'
import CharacterDetailPanel from './CharacterDetailPanel'
import {
  closeCharacterDetailOnPrimaryPointerDown,
  shouldCloseCharacterDetailForKey,
} from './characterDetailClose'
import { parseLiveHitPointDraft, resolveHitPointDisplay } from './characterHitPoints'
import { createDnd5eMechanicalEffect } from '../../rulesets/dnd5e'

const token: Token = {
  id: 'hero-token',
  label: '新冒险者',
  x: 0,
  y: 0,
  color: '#34d399',
  emoji: '🧝',
  size: 1,
  type: 'player',
  characterId: 'hero',
}

const character = {
  id: 'hero',
  name: '新冒险者',
  player: '玩家一',
  avatar: '🧝',
  accent: 'from-emerald-500 to-teal-700',
  tokenPortrait: 'data:image/png;base64,character-token',
  race: '人类',
  charClass: '吟游诗人',
  level: 13,
  maxHp: 94,
  currentHp: 79,
  tempHp: 0,
  abilities: { str: 10, dex: 14, con: 14, int: 12, wis: 10, cha: 18 },
  conditions: [],
  speed: 30,
} as unknown as Character

describe('CharacterDetailPanel', () => {
  it('生命值输入与权威确认之间始终使用同一份乐观快照绘制血条', () => {
    expect(resolveHitPointDisplay({
      currentHp: 40,
      maxHp: 80,
      currentHpDraft: '80',
      maxHpDraft: '80',
      editingCurrentHp: true,
      editingMaxHp: false,
    })).toEqual({
      currentHp: 80,
      maxHp: 80,
      percentage: 100,
    })

    expect(resolveHitPointDisplay({
      currentHp: 40,
      maxHp: 80,
      currentHpDraft: '80',
      maxHpDraft: '80',
      editingCurrentHp: false,
      editingMaxHp: false,
      pending: { currentHp: 80, maxHp: 80 },
    })).toEqual({
      currentHp: 80,
      maxHp: 80,
      percentage: 100,
    })
  })

  it('生命值输入时立即解析有效数值，并允许暂时清空输入框', () => {
    expect(parseLiveHitPointDraft('79', 94)).toBe(79)
    expect(parseLiveHitPointDraft('120', 94)).toBe(94)
    expect(parseLiveHitPointDraft('-3', 94)).toBe(0)
    expect(parseLiveHitPointDraft('', 94)).toBeUndefined()
    expect(parseLiveHitPointDraft('invalid', 94)).toBeUndefined()
  })

  it('使用与地图一致的人物 Token，而不是旧 emoji', () => {
    const markup = renderToStaticMarkup(createElement(CharacterDetailPanel, {
      token,
      character,
      onSetHitPoints: () => undefined,
      onClose: () => undefined,
      isDM: true,
    }))

    expect(markup).toContain('data:image/png;base64,character-token')
    expect(markup).toContain('新冒险者的地图 Token')
    expect(markup).not.toContain('>🧝<')
  })

  it('renders the player-only truesight explanation for projected truths', () => {
    const markup = renderToStaticMarkup(createElement(CharacterDetailPanel, {
      token: {
        ...token,
        dnd5eTruesightPerception: {
          ethereal: true, originalForm: true, visualIllusion: true,
        },
      },
      character,
      onSetHitPoints: () => undefined,
      onClose: () => undefined,
      isDM: false,
    }))

    expect(markup).toContain('data-testid="truesight-perception"')
    expect(markup).toContain('真视察觉：以太位面 · 原本形态 · 视觉幻象')
  })

  it('初始生命值输入显示权威角色数值', () => {
    const markup = renderToStaticMarkup(createElement(CharacterDetailPanel, {
      token,
      character,
      onSetHitPoints: () => undefined,
      onClose: () => undefined,
      isDM: true,
    }))

    expect(markup).toContain('value="79"')
    expect(markup).toContain('value="94"')
  })

  it('拟像锁定最大生命、禁用普通恢复并提供炼金实验室修复入口', () => {
    const simulacrumToken: Token = {
      ...token,
      id: 'simulacrum-token',
      label: '新冒险者·拟像',
      hp: 70,
      maxHp: 81,
      dnd5eSimulacrum: {
        schemaVersion: 1,
        sourceTokenId: token.id,
        subjectTokenId: token.id,
        sourceCharacterId: character.id,
        sourceActivityId: 'simulacrum',
        createdRound: 1,
        level: character.level,
        proficiencyBonus: 5,
        abilities: { ...character.abilities },
        armorClass: 15,
        maximumHitPoints: 81,
        speed: 30,
        sizeRank: 2,
        creatureType: 'humanoid',
        classResources: {},
        cannotIncreaseLevel: true,
        cannotRegainSpellSlots: true,
        cannotRegainHitPoints: true,
      },
    }
    const markup = renderToStaticMarkup(createElement(CharacterDetailPanel, {
      token: simulacrumToken,
      character: { ...character, name: simulacrumToken.label, currentHp: 70, maxHp: 81 },
      onSetHitPoints: () => undefined,
      onRepairSimulacrum: () => undefined,
      onClose: () => undefined,
      isDM: true,
    }))

    expect(markup).toContain('data-testid="simulacrum-locked-maximum-hit-points"')
    expect(markup).toContain('data-testid="simulacrum-alchemical-repair"')
    expect(markup).toContain('data-testid="repair-simulacrum"')
    expect(markup).toContain('不能通过治疗或休息恢复生命值')
    expect(markup).toContain('每恢复 1 HP 消耗价值 100 gp')
    expect(markup).not.toContain('aria-label="最大生命值"')
    expect(markup).not.toContain('data-testid="dnd5e-body-integrity"')
  })

  it('把 DM 伤害、治疗和临时生命控制放在角色生命值旁边', () => {
    const markup = renderToStaticMarkup(createElement(CharacterDetailPanel, {
      token,
      character: { ...character, tempHp: 5 },
      onSetHitPoints: () => undefined,
      onAdjustHitPoints: () => undefined,
      onClose: () => undefined,
      isDM: true,
    }))

    expect(markup).toContain('data-testid="dm-hit-point-adjustment-controls"')
    expect(markup).toContain('data-testid="dm-apply-damage"')
    expect(markup).toContain('data-testid="dm-apply-healing"')
    expect(markup).toContain('data-testid="dm-temp-hp-decrease"')
    expect(markup).toContain('data-testid="dm-temp-hp-increase"')
    expect(markup).toContain('结算伤害')
    expect(markup).toContain('结算治疗')
    expect(markup).toContain('临时 5')
  })

  it('显示扩展角色详情并兼容缺少技能熟练字段的旧角色', () => {
    const markup = renderToStaticMarkup(createElement(CharacterDetailPanel, {
      token,
      character: {
        ...character,
        passivePerception: 14,
        saveDC: 16,
        classResources: {
          'dnd5e-spell-slot-1': { current: 2, max: 4 },
        },
      },
      onSetHitPoints: () => undefined,
      onClose: () => undefined,
    }))

    expect(markup).toContain('data-testid="character-detail-combat-summary"')
    expect(markup).toContain('data-testid="character-detail-abilities"')
    expect(markup).toContain('data-testid="character-detail-skills"')
    expect(markup).toContain('data-testid="character-detail-resources"')
    expect(markup).toContain('data-testid="character-detail-equipment"')
  })

  it('20 级德鲁伊的无限荒野形态不会泄漏内部数值哨兵', () => {
    const markup = renderToStaticMarkup(createElement(CharacterDetailPanel, {
      token,
      character: {
        ...character,
        level: 20,
        classResources: {
          'dnd5e-wild-shape': {
            current: String(Number.MAX_SAFE_INTEGER) as unknown as number,
            max: String(Number.MAX_SAFE_INTEGER) as unknown as number,
          },
        },
      },
      onSetHitPoints: () => undefined,
      onClose: () => undefined,
    }))

    expect(markup).toContain('荒野形态')
    expect(markup).toContain('不限次数')
    expect(markup).not.toContain(String(Number.MAX_SAFE_INTEGER))
  })

  it('DM 角色详情在变形术期间显示形态权威属性并隐藏本体装备资源', () => {
    const markup = renderToStaticMarkup(createElement(CharacterDetailPanel, {
      token: { ...token, hp: 136, maxHp: 136 },
      character: {
        ...character,
        currentHp: 203, maxHp: 203, passivePerception: 10, saveDC: 19,
        classResources: { 'dnd5e-spell-slot-4': { current: 1, max: 3 } },
        dnd5eCombatState: {
          wildShapeFormId: 'srd-5.1:tyrannosaurus-rex', wildShapeMode: 'polymorph',
          wildShapeCurrentHp: 136, wildShapeOriginalCurrentHp: 203,
        },
      },
      onSetHitPoints: () => undefined, onClose: () => undefined, isDM: true,
    }))
    expect(markup).toContain('当前形态：霸王龙（变形术）')
    expect(markup).toContain('>136 / 136<')
    expect(markup).toContain('本体 203/203')
    expect(markup).toContain('属性 25')
    expect(markup).toContain('>50 尺<')
    expect(markup).toContain('不可施法')
    expect(markup).toContain('装备已融入形态')
    expect(markup).toContain('当前法术形态无法使用本体法术位或职业资源')
    expect(markup).not.toContain('value="203"')
  })

  it('DM 角色详情正确投影形体变化保留项，并区分融入装备和可用职业资源', () => {
    const markup = renderToStaticMarkup(createElement(CharacterDetailPanel, {
      token: { ...token, hp: 195, maxHp: 195 },
      character: {
        ...character,
        level: 20,
        currentHp: 162,
        maxHp: 162,
        abilities: { str: 8, dex: 16, con: 18, int: 20, wis: 13, cha: 11 },
        savingThrows: ['int', 'wis'],
        skills: ['arcana', 'insight', 'investigation', 'religion'],
        passivePerception: 11,
        saveDC: 19,
        classResources: { 'dnd5e-spell-slot-9': { current: 0, max: 1 } },
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
        },
      },
      onSetHitPoints: () => undefined,
      onClose: () => undefined,
      isDM: true,
    }))
    expect(markup).toContain('当前形态：成年黑龙（形体变化）')
    expect(markup).toContain('属性 20')
    expect(markup).toContain('豁免 +11 · 熟练')
    expect(markup).toContain('>19<')
    expect(markup).toContain('9环法术位')
    expect(markup).toContain('装备已融入形态')
    expect(markup).not.toContain('当前法术形态无法使用本体法术位或职业资源')
  })

  it('DM 角色详情把完全变形术物体形态呈现为物体而非角色', () => {
    const objectEffect = createDnd5eMechanicalEffect({
      definitionId: 'true-polymorph-creature-object-srd-5.1:true-polymorph-object:stone-statue',
      label: '完全变形术·石制雕像', targetId: character.id,
      tags: [
        'transformation', 'object-form', 'equipment-merged',
        'true-polymorph-object-form:srd-5.1:true-polymorph-object:stone-statue',
      ],
      source: { kind: 'spell', actorId: 'wizard', rulesId: 'true-polymorph', spellLevel: 9 },
      duration: { type: 'rounds', remainingRounds: 600, tickOn: 'target-turn-end' },
    })
    const markup = renderToStaticMarkup(createElement(CharacterDetailPanel, {
      token: { ...token, hp: 18, maxHp: 18 },
      character: {
        ...character,
        dnd5eCombatState: {
          wildShapeFormId: 'srd-5.1:true-polymorph-object:stone-statue',
          wildShapeMode: 'true-polymorph', wildShapeCurrentHp: 18,
          wildShapeOriginalCurrentHp: character.currentHp, activeEffects: [objectEffect],
        },
      },
      onSetHitPoints: () => undefined, onClose: () => undefined, isDM: true,
    }))
    expect(markup).toContain('当前形态：石制雕像（完全变形术）')
    expect(markup).toContain('>18 / 18<')
    expect(markup).toContain('>17<')
    expect(markup).toContain('>0 尺<')
    expect(markup).toContain('物体没有生物属性或豁免')
    expect(markup).toContain('物体不能进行生物技能检定')
    expect(markup).toContain('当前物体形态无法使用本体法术位或职业资源')
    expect(markup).toContain('装备与携带物已融入物体形态')
    expect(markup).not.toContain('属性 10')
  })

  it('显示地图 Token 的权威高度', () => {
    const markup = renderToStaticMarkup(createElement(CharacterDetailPanel, {
      token: { ...token, elevationFeet: 20 },
      character,
      onSetHitPoints: () => undefined,
      onClose: () => undefined,
    }))

    expect(markup).toContain('data-testid="character-detail-elevation"')
    expect(markup).toContain('>20 尺<')
  })

  it('只向 DM 提供移除地图标记入口，并明确保留人物卡数据', () => {
    const dmMarkup = renderToStaticMarkup(createElement(CharacterDetailPanel, {
      token,
      character,
      onSetHitPoints: () => undefined,
      onRemoveFromMap: () => undefined,
      onClose: () => undefined,
      isDM: true,
    }))
    const playerMarkup = renderToStaticMarkup(createElement(CharacterDetailPanel, {
      token,
      character,
      onSetHitPoints: () => undefined,
      onRemoveFromMap: () => undefined,
      onClose: () => undefined,
      isDM: false,
    }))

    expect(dmMarkup).toContain('data-testid="remove-character-token"')
    expect(dmMarkup).toContain('不会删除人物卡、装备或战役记录')
    expect(playerMarkup).not.toContain('data-testid="remove-character-token"')
  })

  it('角色降至 0 HP 后仍保留独立的可访问关闭入口', () => {
    const defeatedCharacter = {
      ...character,
      currentHp: 0,
    } as Character
    const markup = renderToStaticMarkup(createElement(CharacterDetailPanel, {
      token: { ...token, hp: 0, maxHp: character.maxHp },
      character: defeatedCharacter,
      onSetHitPoints: () => undefined,
      onClose: () => undefined,
      isDM: true,
    }))

    expect(markup).toContain('data-defeated="true"')
    expect(markup).toContain('z-[120]')
    expect(markup).toContain('data-testid="close-character-detail"')
    expect(markup).toContain('aria-label="关闭角色详情"')
  })

  it('只在 DM 的死亡角色详情中显示尸体与复活账本', () => {
    const deadCharacter = {
      ...character,
      currentHp: 0,
      deathSaveFailures: 3,
      dnd5eCombatState: {
        schemaVersion: 2,
        deathRound: -143_999,
        deathCause: 'other',
        soulReturnStatus: 'free-willing',
        bodyPresent: true,
        missingBodyParts: ['左臂'],
        vitalBodyPartsMissing: true,
      },
    } as Character
    const dmMarkup = renderToStaticMarkup(createElement(CharacterDetailPanel, {
      token: { ...token, hp: 0 }, character: deadCharacter, currentRound: 1,
      onSetHitPoints: () => undefined, onCorpseStateChange: () => undefined,
      onClose: () => undefined, isDM: true,
    }))
    const playerMarkup = renderToStaticMarkup(createElement(CharacterDetailPanel, {
      token: { ...token, hp: 0 }, character: deadCharacter, currentRound: 1,
      onSetHitPoints: () => undefined, onCorpseStateChange: () => undefined,
      onClose: () => undefined, isDM: false,
    }))
    expect(dmMarkup).toContain('data-testid="dnd5e-corpse-state-editor"')
    expect(dmMarkup).toContain('aria-label="死亡时间（天）"')
    expect(dmMarkup).toContain('aria-label="死亡原因"')
    expect(dmMarkup).toContain('并非寿终正寝')
    expect(dmMarkup).toContain('aria-label="灵魂状态"')
    expect(dmMarkup).toContain('自由且愿意返回')
    expect(dmMarkup).toContain('value="10"')
    expect(dmMarkup).toContain('缺失关键器官或部位')
    expect(playerMarkup).not.toContain('data-testid="dnd5e-corpse-state-editor"')
  })

  it('在角色详情中显示可长休恢复的复活虚弱', () => {
    const markup = renderToStaticMarkup(createElement(CharacterDetailPanel, {
      token,
      character: {
        ...character,
        dnd5eCombatState: {
          schemaVersion: 2,
          resurrectionPenalty: { value: -4, recoveryPerLongRest: 1 },
        },
      },
      onSetHitPoints: () => undefined,
      onClose: () => undefined,
      isDM: true,
    }))
    expect(markup).toContain('data-testid="dnd5e-resurrection-penalty"')
    expect(markup).toContain('复活虚弱 -4')
  })

  it('在 DM 角色详情中持续显示活体身体完整性，供断肢再生结算核验', () => {
    const missingMarkup = renderToStaticMarkup(createElement(CharacterDetailPanel, {
      token,
      character: {
        ...character,
        rulesetId: 'dnd5e-2014-srd-5.1',
        dnd5eCombatState: { schemaVersion: 2, bodyPresent: true, missingBodyParts: ['左臂'] },
      },
      onSetHitPoints: () => undefined,
      onClose: () => undefined,
      isDM: true,
    }))
    const restoredMarkup = renderToStaticMarkup(createElement(CharacterDetailPanel, {
      token,
      character: {
        ...character,
        rulesetId: 'dnd5e-2014-srd-5.1',
        dnd5eCombatState: { schemaVersion: 2, bodyPresent: true },
      },
      onSetHitPoints: () => undefined,
      onClose: () => undefined,
      isDM: true,
    }))
    expect(missingMarkup).toContain('data-testid="dnd5e-body-integrity"')
    expect(missingMarkup).toContain('缺失部位：左臂')
    expect(restoredMarkup).toContain('身体完整；无缺失部位')
  })

  it('在主指针按下时先阻止地图事件，再立即关闭死亡角色详情', () => {
    const calls: string[] = []
    const handled = closeCharacterDetailOnPrimaryPointerDown({
      isPrimary: true,
      button: 0,
      preventDefault: () => calls.push('prevent-default'),
      stopPropagation: () => calls.push('stop-propagation'),
    }, () => calls.push('close'))

    expect(handled).toBe(true)
    expect(calls).toEqual(['prevent-default', 'stop-propagation', 'close'])
  })

  it('忽略副指针并保留 Escape 键盘关闭路径', () => {
    let closed = false
    const handled = closeCharacterDetailOnPrimaryPointerDown({
      isPrimary: false,
      button: 0,
      preventDefault: () => undefined,
      stopPropagation: () => undefined,
    }, () => { closed = true })

    expect(handled).toBe(false)
    expect(closed).toBe(false)
    expect(shouldCloseCharacterDetailForKey('Escape')).toBe(true)
    expect(shouldCloseCharacterDetailForKey('Enter')).toBe(false)
  })
})
