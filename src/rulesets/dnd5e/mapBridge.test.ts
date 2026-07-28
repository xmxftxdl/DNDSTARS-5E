import { afterEach, describe, expect, it } from 'vitest'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { dnd5eCombatantCanSee, dnd5eTargetArmorClassForAttack, resolveDnd5eHeadlessAction } from './headlessCombatEngine'
import { createDnd5eMapCombatSnapshot, planDnd5eMapResultApplication } from './mapBridge'
import { createDnd5eMechanicalEffect, dnd5eConditionsFromActiveEffects } from './activeEffects'
import { migrateLegacyDnd5eConditions } from './legacyActiveEffectMigration'
import { setMapGeometryRuntime, type MapGeometryState } from '../../lib/mapGeometry'
import { buildDnd5eCustomMonster, createDnd5eCustomMonsterDraft } from './customMonsterWorkshop'
import { setDnd5eRoomMonsterCatalog } from './monsters'
import {
  DND5E_LONGSWORD,
  DND5E_OFFHAND_SHORTSWORD,
  DND5E_SHORTSWORD,
} from './equipment'

function character(): Character {
  return { id: 'char', name: 'Hero', player: 'P1', avatar: '', accent: '', race: '', charClass: '', level: 1, background: '', experience: 0, reputation: 0, abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 10, cha: 10 }, savingThrows: [], skills: [], maxHp: 20, currentHp: 20, tempHp: 0, hitDice: '1d10', ac: 16, speed: 30, initiativeBonus: 0, saveDC: 10, passivePerception: 10, inspiration: 0, conditions: [], notes: '', dmNotes: '', visibleToPlayers: true }
}

function token(patch: Partial<Token>): Token {
  return { id: 'token', label: 'Token', x: 0, y: 0, color: '', emoji: '', size: 1, type: 'enemy', hp: 10, maxHp: 10, ...patch }
}

function conditionState(targetId: string, conditions: string[]) {
  const activeEffects = migrateLegacyDnd5eConditions({ targetId, conditions })
  return { schemaVersion: 2 as const, activeEffects, conditions: dnd5eConditionsFromActiveEffects(activeEffects) }
}

function characterWithConditions(base: Character, conditions: string[]): Character {
  const state = conditionState(base.id, conditions)
  return { ...base, conditions: state.conditions, dnd5eCombatState: state }
}

describe('D&D 5e map bridge', () => {
  afterEach(() => {
    setMapGeometryRuntime([])
    setDnd5eRoomMonsterCatalog([])
  })

  it('projects authoritative main-hand and off-hand weapon provenance for players', () => {
    const ordinary = { ...character(), id: 'ordinary', alignment: 'LG', equipment: { mainWeapon: DND5E_LONGSWORD } }
    const silveredMain = structuredClone(DND5E_SHORTSWORD)
    if (silveredMain.dnd5e?.kind !== 'weapon') throw new Error('test weapon missing rules')
    silveredMain.id = 'plugin:silvered-shortsword'
    silveredMain.dnd5e.specialMaterial = 'silvered'
    const magicalOffHand = structuredClone(DND5E_OFFHAND_SHORTSWORD)
    if (magicalOffHand.dnd5e?.kind !== 'weapon') throw new Error('test weapon missing rules')
    magicalOffHand.id = 'plugin:magic-offhand-shortsword'
    magicalOffHand.dnd5e.magical = true
    const dualWielder = {
      ...character(),
      id: 'dual-wielder',
      alignment: '中立邪恶',
      equipment: { mainWeapon: silveredMain, offHand: magicalOffHand },
    }
    const magicalMain = structuredClone(DND5E_LONGSWORD)
    if (magicalMain.dnd5e?.kind !== 'weapon') throw new Error('test weapon missing rules')
    magicalMain.id = 'plugin:magic-longsword'
    magicalMain.dnd5e.magical = true
    const magicUser = {
      ...character(),
      id: 'magic-user',
      alignment: 'unknown homebrew alignment',
      equipment: { mainWeapon: magicalMain },
    }
    const tokens = [ordinary, dualWielder, magicUser].map((entry, index) => token({
      id: `${entry.id}-token`,
      type: 'player',
      characterId: entry.id,
      x: index * 10,
      hp: entry.currentHp,
      maxHp: entry.maxHp,
    }))
    const map: BattleMap = {
      id: 'weapon-provenance',
      name: 'Weapon provenance',
      width: 100,
      height: 100,
      gridSize: 10,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      feetPerCell: 5,
      tokens,
    }
    const snapshot = createDnd5eMapCombatSnapshot({
      combatId: 'weapon-provenance',
      map,
      characters: [ordinary, dualWielder, magicUser],
      initiativeOrder: tokens.map((entry, index) => ({
        tokenId: entry.id,
        label: entry.label,
        emoji: '',
        color: '',
        roll: 20 - index,
      })),
    })

    expect(snapshot.state.combatants['ordinary-token']).toMatchObject({
      mainWeaponId: DND5E_LONGSWORD.id,
      mainWeaponMagical: false,
      moralAlignment: 'good',
      weaponDamageSources: {
        [DND5E_LONGSWORD.id]: { magical: false },
      },
    })
    expect(snapshot.state.combatants['dual-wielder-token']).toMatchObject({
      mainWeaponId: silveredMain.id,
      mainWeaponMagical: false,
      moralAlignment: 'evil',
      weaponDamageSources: {
        [silveredMain.id]: { magical: false, specialMaterial: 'silvered' },
        [magicalOffHand.id]: { magical: true },
      },
    })
    expect(snapshot.state.combatants['magic-user-token']).toMatchObject({
      mainWeaponId: magicalMain.id,
      mainWeaponMagical: true,
      weaponDamageSources: {
        [magicalMain.id]: { magical: true },
      },
    })
    expect(snapshot.state.combatants['magic-user-token'].moralAlignment).toBeUndefined()
  })

  it('projects monster conditional defenses, magic weapons, and moral alignment', () => {
    const base = buildDnd5eCustomMonster(createDnd5eCustomMonsterDraft())
    const monster = {
      ...base,
      id: 'custom:fiendish-guardian',
      alignment: '守序邪恶',
      damageDefenseRules: [{
        outcome: 'immune' as const,
        damageTypes: ['bludgeoning', 'piercing', 'slashing'] as const,
        delivery: 'weapon-attack' as const,
        magical: false,
        weaponMaterialNot: 'silvered' as const,
        reason: 'test:nonsilvered-immunity',
      }],
      traits: [...base.traits, {
        name: 'Magic Weapons',
        description: 'Weapon attacks are magical.',
        automation: 'headless' as const,
        rule: { kind: 'magic-weapons' as const, weaponAttacksMagical: true as const },
      }, {
        name: 'Limited Magic Immunity',
        description: 'Spells of 6th level or lower do not affect this creature unless it wishes.',
        automation: 'headless' as const,
        rule: {
          kind: 'limited-magic-immunity' as const,
          maximumSpellLevel: 6 as const,
          advantageAboveMaximum: true as const,
          allowsWilling: true as const,
        },
      }],
    }
    setDnd5eRoomMonsterCatalog([monster])
    const monsterToken = token({
      id: 'guardian-token',
      poolId: monster.id,
      hp: monster.hitPoints.average,
      maxHp: monster.hitPoints.average,
    })
    const map: BattleMap = {
      id: 'monster-provenance',
      name: 'Monster provenance',
      width: 100,
      height: 100,
      gridSize: 10,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      feetPerCell: 5,
      tokens: [monsterToken],
    }
    const snapshot = createDnd5eMapCombatSnapshot({
      combatId: 'monster-provenance',
      map,
      characters: [],
      initiativeOrder: [{
        tokenId: monsterToken.id,
        label: monsterToken.label,
        emoji: '',
        color: '',
        roll: 10,
      }],
    })
    expect(snapshot.state.combatants[monsterToken.id]).toMatchObject({
      weaponAttacksMagical: true,
      magicResistance: true,
      limitedMagicImmunity: {
        kind: 'limited-magic-immunity',
        maximumSpellLevel: 6,
        advantageAboveMaximum: true,
        allowsWilling: true,
      },
      moralAlignment: 'evil',
      damageDefenseRules: monster.damageDefenseRules,
    })
  })

  it('initializes and persists custom per-day action uses and legendary points', () => {
    const draft = createDnd5eCustomMonsterDraft()
    draft.actions[0].usageKind = 'per-day'
    draft.actions[0].usageMax = 2
    draft.legendaryActionPoints = 5
    draft.actions.push({
      ...createDnd5eCustomMonsterDraft().actions[0],
      id: 'legendary-strike',
      category: 'legendary',
      name: '传奇斩击',
    })
    const monster = buildDnd5eCustomMonster(draft)
    setDnd5eRoomMonsterCatalog([monster])
    const monsterToken = token({ id: 'custom', poolId: monster.id, hp: monster.hitPoints.average, maxHp: monster.hitPoints.average })
    const map: BattleMap = {
      id: 'custom-resources', name: 'Custom resources', width: 100, height: 100,
      gridSize: 10, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [monsterToken],
    }
    const snapshot = createDnd5eMapCombatSnapshot({
      combatId: 'custom-resources',
      map,
      characters: [],
      initiativeOrder: [{ tokenId: monsterToken.id, label: monsterToken.label, emoji: '', color: '', roll: 10 }],
    })
    expect(snapshot.state.combatants[monsterToken.id].classState).toMatchObject({
      monsterLegendaryActionPoints: 5,
      monsterActionUsesByActionId: {
        [draft.actions[0].id]: { current: 2, max: 2 },
      },
    })
    snapshot.state.combatants[monsterToken.id].classState.monsterActionUsesByActionId![draft.actions[0].id].current = 1
    const plan = planDnd5eMapResultApplication({
      state: snapshot.state,
      map,
      characters: [],
      characterIdByCombatantId: snapshot.characterIdByCombatantId,
    })
    expect(plan.map.tokens[0].dnd5eCombatState?.monsterActionUsesByActionId?.[draft.actions[0].id])
      .toEqual({ current: 1, max: 2 })
  })

  it('persists pending monster triggers and one-shot roll modifiers across map snapshots', () => {
    const monsterToken = token({ id: 'custom', poolId: 'srd-5.1:goblin', hp: 7, maxHp: 7 })
    const map: BattleMap = {
      id: 'mechanic-state', name: 'Mechanic state', width: 100, height: 100,
      gridSize: 10, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [monsterToken],
    }
    const initiativeOrder = [{ tokenId: monsterToken.id, label: monsterToken.label, emoji: '', color: '', roll: 10 }]
    const snapshot = createDnd5eMapCombatSnapshot({
      combatId: 'mechanic-state', map, characters: [], initiativeOrder,
    })
    const trigger = {
      id: 'mechanic-state:1:1:custom:test',
      mechanicOwnerId: monsterToken.id,
      mechanicId: 'test',
      event: 'when-hit' as const,
      subjectId: monsterToken.id,
      createdRound: 1,
      chainDepth: 0,
    }
    snapshot.state.combatants[monsterToken.id].classState.pendingMonsterMechanicTriggers = {
      [trigger.id]: trigger,
    }
    snapshot.state.combatants[monsterToken.id].classState.monsterMechanicTriggerSequence = 1
    snapshot.state.combatants[monsterToken.id].classState.monsterMechanicRollModifiers = [{
      id: 'modifier',
      mechanicOwnerId: monsterToken.id,
      mechanicId: 'test',
      roll: 'attack',
      mode: 'bonus',
      bonus: 2,
    }]
    const plan = planDnd5eMapResultApplication({
      state: snapshot.state, map, characters: [],
      characterIdByCombatantId: snapshot.characterIdByCombatantId,
    })
    const reconnected = createDnd5eMapCombatSnapshot({
      combatId: 'mechanic-state', map: plan.map, characters: [], initiativeOrder,
    })
    expect(reconnected.state.combatants[monsterToken.id].classState).toMatchObject({
      pendingMonsterMechanicTriggers: { [trigger.id]: trigger },
      monsterMechanicTriggerSequence: 1,
      monsterMechanicRollModifiers: [{ mechanicId: 'test', roll: 'attack', mode: 'bonus', bonus: 2 }],
    })
  })

  it('projects monster Fey Ancestry as magical Sleep immunity', () => {
    const drow = token({ id: 'drow-token', poolId: 'srd-5.1:drow', hp: 13, maxHp: 13 })
    const map: BattleMap = {
      id: 'fey-ancestry-map', name: 'Fey Ancestry', width: 100, height: 100,
      gridSize: 10, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5, tokens: [drow],
    }
    const snapshot = createDnd5eMapCombatSnapshot({
      combatId: 'fey-ancestry', map, characters: [],
      initiativeOrder: [{ tokenId: drow.id, label: drow.label, emoji: '', color: '', roll: 10 }],
    })
    expect(snapshot.state.combatants[drow.id].conditionImmunities)
      .toEqual(expect.arrayContaining(['magical-sleep', '魔法睡眠']))
  })

  it('projects effective Headless size and elevation back to the map token', () => {
    const ogre = token({
      id: 'ogre', poolId: 'srd-5.1:ogre', creatureSize: '大型',
      size: 2, elevationFeet: 5, hp: 59, maxHp: 59,
    })
    const map: BattleMap = {
      id: 'projection-map', name: 'Projection', width: 100, height: 100,
      gridSize: 10, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [ogre],
    }
    const snapshot = createDnd5eMapCombatSnapshot({
      combatId: 'projection', map, characters: [],
      initiativeOrder: [{ tokenId: ogre.id, label: ogre.label, emoji: '', color: '', roll: 10 }],
    })
    const combatant = snapshot.state.combatants[ogre.id]
    combatant.elevationFeet = 15
    combatant.classState.activeEffects = [createDnd5eMechanicalEffect({
      definitionId: 'test:enlarge',
      label: '变巨',
      targetId: ogre.id,
      source: { kind: 'spell', actorId: ogre.id, rulesId: 'enlarge-reduce' },
      modifiers: { sizeRankDelta: 1 },
    })]
    const plan = planDnd5eMapResultApplication({
      state: snapshot.state,
      map,
      characters: [],
      characterIdByCombatantId: {},
    })
    expect(plan.map.tokens[0]).toMatchObject({ size: 3, elevationFeet: 15 })
    expect(plan.changedTokenIds).toContain(ogre.id)
  })

  it('compiles obstacle cover and blocked effect lines into Headless attack resolution', () => {
    const hero = character()
    const heroToken = token({ id: 'hero-token', type: 'player', characterId: hero.id, x: 10, y: 50, hp: 20, maxHp: 20 })
    const enemy = token({ id: 'enemy-token', x: 90, y: 50, hp: 10, maxHp: 10 })
    const map: BattleMap = {
      id: 'geometry-map', name: 'Geometry', width: 100, height: 100, gridSize: 10,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5, tokens: [heroToken, enemy],
    }
    const initiativeOrder = [heroToken, enemy].map((entry, index) => ({
      tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
    }))
    const baseGeometry: MapGeometryState = {
      mapId: map.id,
      walls: [],
      doors: [],
      obstacles: [{
        id: 'crate', kind: 'obstacle', label: '木箱',
        points: [{ x: 45, y: 40 }, { x: 55, y: 40 }, { x: 55, y: 60 }, { x: 45, y: 60 }],
        cover: 'half', blocksVision: false, blocksMovement: true, blocksLineOfEffect: false,
        baseHeightFeet: 0, heightFeet: 5, createdAt: 1,
      }],
      vision: { enabled: false, defaultRangeFeet: 60, sharePartyVision: true, ambientLight: 'bright' },
      updatedAt: 1,
    }
    setMapGeometryRuntime([baseGeometry])
    const covered = createDnd5eMapCombatSnapshot({ combatId: 'combat', map, characters: [hero], initiativeOrder })
    expect(dnd5eTargetArmorClassForAttack(covered.state, heroToken.id, enemy.id))
      .toBe(covered.state.combatants[enemy.id].armorClass + 2)

    setMapGeometryRuntime([{
      ...baseGeometry,
      obstacles: [],
      walls: [{
        id: 'stone-wall', kind: 'wall', label: '石墙',
        points: [{ x: 50, y: 0 }, { x: 50, y: 100 }],
        blocksVision: true, blocksMovement: true, blocksLineOfEffect: true,
        baseHeightFeet: 0, heightFeet: 10, createdAt: 2,
      }],
    }])
    const blocked = createDnd5eMapCombatSnapshot({ combatId: 'combat', map, characters: [hero], initiativeOrder })
    const naturalTwenty = resolveDnd5eHeadlessAction(blocked.state, {
      type: 'attack', actorId: heroToken.id, targetId: enemy.id,
      attackModifier: 99, d20: 20, damage: { count: 1, sides: 8, bonus: 3, rolls: [8] },
    })
    expect(naturalTwenty).toMatchObject({ ok: true, state: { combatants: { [enemy.id]: { currentHp: 10 } } } })
  })

  it('compiles character Darkvision ActiveEffects into ordinary-darkness visibility', () => {
    const heroToken = token({
      id: 'hero-token',
      type: 'player',
      characterId: 'char',
      x: 10,
      y: 50,
      hp: 20,
      maxHp: 20,
    })
    const enemy = token({ id: 'enemy-token', x: 90, y: 50 })
    const darkvision = createDnd5eMechanicalEffect({
      definitionId: 'srd-5.1:spell:darkvision',
      label: '黑暗视觉',
      targetId: heroToken.id,
      source: { kind: 'spell', actorId: 'caster', rulesId: 'darkvision' },
      duration: { type: 'rounds', remainingRounds: 4_800, tickOn: 'target-turn-end' },
      modifiers: { darkvisionRangeFeet: 60 },
    })
    const hero = {
      ...character(),
      dnd5eCombatState: { schemaVersion: 2 as const, activeEffects: [darkvision] },
    }
    const map: BattleMap = {
      id: 'darkvision-map',
      name: 'Darkvision',
      width: 120,
      height: 100,
      gridSize: 10,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      feetPerCell: 5,
      tokens: [heroToken, enemy],
    }
    setMapGeometryRuntime([{
      mapId: map.id,
      walls: [],
      doors: [],
      obstacles: [],
      vision: {
        enabled: true,
        defaultRangeFeet: 60,
        sharePartyVision: true,
        ambientLight: 'darkness',
      },
      updatedAt: 1,
    }])
    const initiativeOrder = [heroToken, enemy].map((entry, index) => ({
      tokenId: entry.id,
      label: entry.label,
      emoji: '',
      color: '',
      roll: 20 - index,
    }))
    const snapshot = createDnd5eMapCombatSnapshot({
      combatId: 'darkvision-map',
      map,
      characters: [hero],
      initiativeOrder,
    })
    expect(dnd5eCombatantCanSee(snapshot.state, heroToken.id, enemy.id)).toBe(true)
  })

  it('keeps Devil’s Sight identical between map geometry and Headless visibility', () => {
    const hero = {
      ...character(),
      charClass: '契术师',
      dnd5eClassLevels: { warlock: 2 },
      dnd5eClassChoices: {
        classes: {
          warlock: {
            selections: { 'eldritch-invocations': ['devils-sight'] },
          },
        },
      },
    } satisfies Character
    const heroToken = token({
      id: 'hero-token',
      type: 'player',
      characterId: hero.id,
      x: 10,
      y: 50,
      hp: 20,
      maxHp: 20,
    })
    const enemy = token({ id: 'enemy-token', x: 90, y: 50 })
    const map: BattleMap = {
      id: 'devils-sight-map',
      name: 'Devil’s Sight',
      width: 120,
      height: 100,
      gridSize: 10,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      feetPerCell: 5,
      tokens: [heroToken, enemy],
    }
    setMapGeometryRuntime([{
      mapId: map.id,
      walls: [],
      doors: [],
      obstacles: [{
        id: 'darkness',
        kind: 'obstacle',
        label: '黑暗术',
        points: [{ x: 70, y: 30 }, { x: 110, y: 30 }, { x: 110, y: 70 }, { x: 70, y: 70 }],
        blocksVision: false,
        blocksMovement: false,
        blocksLineOfEffect: false,
        cover: 'none',
        baseHeightFeet: 0,
        heightFeet: 20,
        magicalDarkness: true,
        darknessSpellLevel: 2,
        createdAt: 1,
      }],
      vision: {
        enabled: true,
        defaultRangeFeet: 60,
        sharePartyVision: false,
        ambientLight: 'bright',
      },
      updatedAt: 1,
    }])
    const initiativeOrder = [heroToken, enemy].map((entry, index) => ({
      tokenId: entry.id,
      label: entry.label,
      emoji: '',
      color: '',
      roll: 20 - index,
    }))
    const snapshot = createDnd5eMapCombatSnapshot({
      combatId: 'devils-sight-map',
      map,
      characters: [hero],
      initiativeOrder,
    })
    expect(snapshot.state.combatants[heroToken.id]).toMatchObject({
      darknessSightRangeFeet: 120,
      magicalDarknessSightRangeFeet: 120,
    })
    expect(snapshot.state.magicalDarknessByCombatantPair?.[
      `${heroToken.id}\u0000${enemy.id}`
    ]).toBe(true)
    expect(dnd5eCombatantCanSee(snapshot.state, heroToken.id, enemy.id)).toBe(true)
  })

  it('preserves native effect instances across reconnect snapshots', () => {
    const hero = characterWithConditions(character(), ['poisoned'])
    const heroToken = token({ id: 'hero-token', type: 'player', characterId: hero.id, hp: 20, maxHp: 20 })
    const enemy = token({ id: 'enemy-token', dnd5eCombatState: conditionState('enemy-token', ['stunned']) })
    const map: BattleMap = { id: 'map', name: 'Map', width: 100, height: 100, gridSize: 10, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [heroToken, enemy] }
    const initiativeOrder = [
      { tokenId: heroToken.id, label: heroToken.label, emoji: '', color: '', roll: 20 },
      { tokenId: enemy.id, label: enemy.label, emoji: '', color: '', roll: 10 },
    ]
    const first = createDnd5eMapCombatSnapshot({ combatId: 'combat', map, characters: [hero], initiativeOrder })
    const plan = planDnd5eMapResultApplication({ state: first.state, map, characters: [hero], characterIdByCombatantId: first.characterIdByCombatantId })
    const heroEffects = plan.characters[0].dnd5eCombatState?.activeEffects
    const enemyEffects = plan.map.tokens.find((entry) => entry.id === enemy.id)?.dnd5eCombatState?.activeEffects
    expect(heroEffects).toEqual([expect.objectContaining({ standardCondition: 'poisoned', appliedAt: 0 })])
    expect(enemyEffects).toEqual([expect.objectContaining({ standardCondition: 'stunned', appliedAt: 0 })])

    const reconnected = createDnd5eMapCombatSnapshot({
      combatId: 'combat', map: plan.map, characters: plan.characters, initiativeOrder,
    })
    expect(reconnected.state.combatants[heroToken.id].classState.activeEffects).toEqual(heroEffects)
    expect(reconnected.state.combatants[enemy.id].classState.activeEffects).toEqual(enemyEffects)
  })

  it('persists a Help attack marker on an unlinked monster token', () => {
    const helper = token({ id: 'helper-token', type: 'player', x: 0, y: 0 })
    const enemy = token({ id: 'enemy-token', type: 'enemy', x: 10, y: 0 })
    const map: BattleMap = {
      id: 'help-map', name: 'Help', width: 100, height: 100, gridSize: 10,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5, tokens: [helper, enemy],
    }
    const initiativeOrder = [
      { tokenId: helper.id, label: helper.label, emoji: '', color: '', roll: 20 },
      { tokenId: enemy.id, label: enemy.label, emoji: '', color: '', roll: 10 },
    ]
    const snapshot = createDnd5eMapCombatSnapshot({ combatId: 'help', map, characters: [], initiativeOrder })
    const helped = resolveDnd5eHeadlessAction(snapshot.state, {
      type: 'help', actorId: helper.id, targetId: enemy.id, helpKind: 'attack',
    })
    expect(helped.ok).toBe(true)
    if (!helped.ok) return
    const plan = planDnd5eMapResultApplication({
      state: helped.state, map, characters: [], characterIdByCombatantId: {},
    })
    const persistedEnemy = plan.map.tokens.find((entry) => entry.id === enemy.id)
    expect(persistedEnemy?.dnd5eCombatState).toMatchObject({
      helpedAttackSourceId: helper.id,
      helpedAttackSourceTurnKey: 'help:1:helper-token',
    })
    const reconnected = createDnd5eMapCombatSnapshot({
      combatId: 'help', map: plan.map, characters: [], initiativeOrder,
    })
    expect(reconnected.state.combatants[enemy.id].classState.helpedAttackSourceId).toBe(helper.id)
  })

  it('persists pending monster saving-throw transactions across map reconnect snapshots', () => {
    const hero: Character = {
      ...character(),
      dnd5eCombatState: {
        activeEffectDamageSavePendingIds: ['hero-effect'],
        monsterOnHitSavePending: {
          sourceId: 'zombie-token', actionId: 'bite', ability: 'str', dc: 11, condition: 'prone',
        },
      },
    }
    const heroToken = token({ id: 'hero-token', type: 'player', characterId: hero.id, hp: 20, maxHp: 20 })
    const zombie = token({
      id: 'zombie-token', poolId: 'srd-5.1:zombie', hp: 0, maxHp: 22,
      dnd5eCombatState: {
        activeEffectDamageSavePendingIds: ['zombie-effect'],
        undeadFortitudePending: { dc: 12, damage: 7, sourceId: heroToken.id },
      },
    })
    const map: BattleMap = {
      id: 'map', name: 'Map', width: 100, height: 100, gridSize: 10,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [heroToken, zombie],
    }
    const initiativeOrder = [heroToken, zombie].map((entry, index) => ({
      tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
    }))
    const first = createDnd5eMapCombatSnapshot({ combatId: 'combat', map, characters: [hero], initiativeOrder })
    expect(first.state.combatants[zombie.id]).toMatchObject({
      currentHp: 0,
      deathSaves: { dead: false },
      classState: { undeadFortitudePending: { dc: 12, damage: 7, sourceId: heroToken.id } },
    })
    expect(first.state.combatants[heroToken.id].classState.monsterOnHitSavePending).toMatchObject({
      sourceId: zombie.id, actionId: 'bite', ability: 'str', dc: 11, condition: 'prone',
    })
    expect(first.state.combatants[heroToken.id].classState.activeEffectDamageSavePendingIds).toEqual(['hero-effect'])
    const plan = planDnd5eMapResultApplication({
      state: first.state, map, characters: [hero], characterIdByCombatantId: first.characterIdByCombatantId,
    })
    expect(plan.map.tokens.find((entry) => entry.id === zombie.id)?.dnd5eCombatState?.undeadFortitudePending)
      .toEqual({ dc: 12, damage: 7, sourceId: heroToken.id })
    expect(plan.map.tokens.find((entry) => entry.id === zombie.id)?.dnd5eCombatState?.activeEffectDamageSavePendingIds)
      .toEqual(['zombie-effect'])
    expect(plan.characters[0].dnd5eCombatState?.monsterOnHitSavePending).toMatchObject({
      sourceId: zombie.id, actionId: 'bite', ability: 'str', dc: 11, condition: 'prone',
    })

    const reconnected = createDnd5eMapCombatSnapshot({
      combatId: 'combat', map: plan.map, characters: plan.characters, initiativeOrder,
    })
    expect(reconnected.state.combatants[zombie.id].classState.undeadFortitudePending?.dc).toBe(12)
    expect(reconnected.state.combatants[heroToken.id].classState.monsterOnHitSavePending?.dc).toBe(11)
    expect(reconnected.state.combatants[zombie.id].classState.activeEffectDamageSavePendingIds).toEqual(['zombie-effect'])
    expect(reconnected.state.combatants[heroToken.id].classState.activeEffectDamageSavePendingIds).toEqual(['hero-effect'])
  })

  it('creates combatants keyed by token and applies authoritative HP/position only', () => {
    const hero = character()
    const heroToken = token({ id: 'hero-token', type: 'player', characterId: hero.id, label: hero.name, hp: 20, maxHp: 20 })
    const enemy = token({ id: 'enemy-token', label: 'Enemy', x: 30 })
    const map: BattleMap = { id: 'map', name: 'Map', width: 100, height: 100, gridSize: 10, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [heroToken, enemy] }
    const snapshot = createDnd5eMapCombatSnapshot({ combatId: 'combat', map, characters: [hero], initiativeOrder: [{ tokenId: heroToken.id, label: hero.name, emoji: '', color: '', roll: 20 }, { tokenId: enemy.id, label: enemy.label, emoji: '', color: '', roll: 10 }] })
    const attack = resolveDnd5eHeadlessAction(snapshot.state, { type: 'attack', actorId: heroToken.id, targetId: enemy.id, attackModifier: 5, d20: 15, damage: { count: 1, sides: 8, bonus: 3, rolls: [5] } })
    expect(attack.ok).toBe(true)
    if (!attack.ok) return
    const plan = planDnd5eMapResultApplication({ state: attack.state, map, characters: [hero], characterIdByCombatantId: snapshot.characterIdByCombatantId })
    expect(plan.map.tokens.find((item) => item.id === enemy.id)?.hp).toBe(2)
    expect(plan.changedTokenIds).toEqual([enemy.id])
  })

  it('hydrates a namespaced SRD monster with its exact stat block', () => {
    const enemy = token({
      id: 'goblin-token',
      label: '哥布林',
      poolId: 'srd-5.1:goblin',
      hp: 7,
      maxHp: 7,
    })
    const hero = character()
    const heroToken = token({ id: 'hero-token', type: 'player', characterId: hero.id, hp: 20, maxHp: 20 })
    const map: BattleMap = { id: 'map', name: 'Map', width: 100, height: 100, gridSize: 10, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [enemy, heroToken] }
    const snapshot = createDnd5eMapCombatSnapshot({
      combatId: 'combat',
      map,
      characters: [hero],
      initiativeOrder: [
        { tokenId: enemy.id, label: enemy.label, emoji: '', color: '', roll: 20 },
        { tokenId: heroToken.id, label: heroToken.label, emoji: '', color: '', roll: 10 },
      ],
    })
    expect(snapshot.state.combatants[enemy.id]).toMatchObject({
      statBlockId: 'srd-5.1:goblin',
      armorClass: 15,
      currentHp: 7,
      maxHp: 7,
      speed: 30,
      proficiencyBonus: 2,
      abilities: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
    })
  })

  it('hydrates DM-applied player and monster condition labels into Headless mechanics', () => {
    const hero = characterWithConditions(character(), ['poisoned'])
    const heroToken = token({ id: 'hero-token', type: 'player', characterId: hero.id, hp: 20, maxHp: 20 })
    const enemy = token({
      id: 'enemy-token',
      label: 'Enemy',
      dnd5eCombatState: conditionState('enemy-token', ['stunned']),
    })
    const map: BattleMap = {
      id: 'map', name: 'Map', width: 100, height: 100, gridSize: 10,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [enemy, heroToken],
    }
    const snapshot = createDnd5eMapCombatSnapshot({
      combatId: 'combat', map, characters: [hero],
      initiativeOrder: [
        { tokenId: enemy.id, label: enemy.label, emoji: '', color: '', roll: 20 },
        { tokenId: heroToken.id, label: heroToken.label, emoji: '', color: '', roll: 10 },
      ],
    })

    expect(snapshot.state.combatants[heroToken.id].conditions).toContain('poisoned')
    expect(snapshot.state.combatants[enemy.id].conditions).toContain('stunned')
    expect(resolveDnd5eHeadlessAction(snapshot.state, { type: 'dash', actorId: enemy.id }))
      .toMatchObject({ ok: false, reason: 'invalid-actor' })
  })

  it('persists Hurl Through Hell banishment on an unlinked monster token and hydrates it again', () => {
    const hero = { ...character(), rulesetId: 'dnd5e-2014-srd-5.1' as const, charClass: '邪术师', level: 14 }
    const heroToken = token({ id: 'hero-token', type: 'player', characterId: hero.id, hp: 20, maxHp: 20 })
    const enemy = token({ id: 'enemy-token', label: 'Enemy', hp: 100, maxHp: 100 })
    const map: BattleMap = {
      id: 'map', name: 'Map', width: 100, height: 100, gridSize: 10,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [heroToken, enemy],
    }
    const initiativeOrder = [
      { tokenId: heroToken.id, label: heroToken.label, emoji: '', color: '', roll: 20 },
      { tokenId: enemy.id, label: enemy.label, emoji: '', color: '', roll: 10 },
    ]
    const snapshot = createDnd5eMapCombatSnapshot({ combatId: 'combat', map, characters: [hero], initiativeOrder })
    snapshot.state.combatants[enemy.id].classState = {
      hurlThroughHellSourceId: heroToken.id,
      hurlThroughHellDamage: 55,
      hurlThroughHellAppliedTurnKey: 'combat:1:hero-token',
    }
    const banishedEffects = migrateLegacyDnd5eConditions({ targetId: enemy.id, conditions: ['banished'] })
    snapshot.state.combatants[enemy.id].classState.activeEffects = banishedEffects
    snapshot.state.combatants[enemy.id].conditions = dnd5eConditionsFromActiveEffects(banishedEffects)
    const plan = planDnd5eMapResultApplication({
      state: snapshot.state, map, characters: [hero], characterIdByCombatantId: snapshot.characterIdByCombatantId,
    })
    expect(plan.map.tokens.find((entry) => entry.id === enemy.id)?.dnd5eCombatState).toMatchObject({
      hurlThroughHellSourceId: heroToken.id,
      hurlThroughHellDamage: 55,
      hurlThroughHellAppliedTurnKey: 'combat:1:hero-token',
      conditions: ['banished'],
    })
    const hydrated = createDnd5eMapCombatSnapshot({
      combatId: 'combat', map: plan.map, characters: plan.characters, initiativeOrder,
    })
    expect(hydrated.state.combatants[enemy.id]).toMatchObject({
      conditions: ['banished'],
      classState: { hurlThroughHellSourceId: heroToken.id, hurlThroughHellDamage: 55 },
    })
  })

  it('applies the strongest conscious Paladin Aura of Protection to nearby allies but not enemies', () => {
    const paladin: Character = {
      ...character(), id: 'paladin', name: '圣武士', rulesetId: 'dnd5e-2014-srd-5.1', charClass: '圣武士', level: 6,
      abilities: { str: 16, dex: 10, con: 14, int: 8, wis: 12, cha: 18 }, savingThrows: ['wis', 'cha'],
    }
    const ally: Character = { ...character(), id: 'ally', name: '盟友', rulesetId: 'dnd5e-2014-srd-5.1', charClass: '战士' }
    const paladinToken = token({ id: 'paladin-token', type: 'player', characterId: paladin.id, x: 25, y: 25 })
    const allyToken = token({ id: 'ally-token', type: 'player', characterId: ally.id, x: 75, y: 25 })
    const enemy = token({ id: 'enemy-token', poolId: 'srd-5.1:goblin', x: 75, y: 75 })
    const map: BattleMap = { id: 'map', name: 'Map', width: 500, height: 500, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5, tokens: [paladinToken, allyToken, enemy] }
    const initiativeOrder = [paladinToken, allyToken, enemy].map((entry, index) => ({ tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index }))
    const snapshot = createDnd5eMapCombatSnapshot({ combatId: 'combat', map, characters: [paladin, ally], initiativeOrder })

    expect(snapshot.state.combatants[allyToken.id].savingThrowBonuses).toMatchObject({
      str: 7, dex: 6, con: 6, int: 4, wis: 4, cha: 4,
    })
    expect(snapshot.state.combatants[paladinToken.id].savingThrowBonuses.cha).toBe(11)
    expect(snapshot.state.combatants[enemy.id].savingThrowBonuses.dex).toBeUndefined()
  })

  it('derives Holy Nimbus enemy sources from opposition and 30-foot map distance', () => {
    const paladin: Character = {
      ...character(), id: 'paladin', name: '圣武士', rulesetId: 'dnd5e-2014-srd-5.1', charClass: '圣武士', level: 20,
      dnd5eClassChoices: { classes: { paladin: { subclass: 'devotion' } } },
      dnd5eCombatState: { holyNimbusRoundsRemaining: 10 },
    }
    const paladinToken = token({ id: 'paladin-token', type: 'player', characterId: paladin.id, x: 25, y: 25 })
    const nearEnemy = token({ id: 'near-enemy', poolId: 'srd-5.1:goblin', x: 275, y: 25 })
    const farEnemy = token({ id: 'far-enemy', poolId: 'srd-5.1:goblin', x: 425, y: 25 })
    const map: BattleMap = {
      id: 'map', name: 'Map', width: 500, height: 500, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [paladinToken, nearEnemy, farEnemy],
    }
    const initiativeOrder = [paladinToken, nearEnemy, farEnemy].map((entry, index) => ({
      tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
    }))
    const snapshot = createDnd5eMapCombatSnapshot({ combatId: 'combat', map, characters: [paladin], initiativeOrder })
    expect(snapshot.state.combatants[nearEnemy.id].holyNimbusSourceIds).toEqual([paladinToken.id])
    expect(snapshot.state.combatants[farEnemy.id].holyNimbusSourceIds).toBeUndefined()
    expect(snapshot.state.combatants[paladinToken.id].holyNimbusSourceIds).toBeUndefined()
  })

  it('derives Draconic Presence sources and respects successful-save immunity', () => {
    const sorcerer: Character = {
      ...character(), id: 'sorcerer', name: '术士', rulesetId: 'dnd5e-2014-srd-5.1', charClass: '术士', level: 18,
      concentrating: true,
      dnd5eClassChoices: { classes: { sorcerer: { subclass: 'draconic' } } },
      dnd5eCombatState: {
        concentrationSpellId: 'class:draconic-presence:fear',
        concentrationTargetIds: [],
        concentrationRoundsRemaining: 10,
      },
    }
    const sorcererToken = token({ id: 'sorcerer-token', type: 'player', characterId: sorcerer.id, x: 25, y: 25 })
    const enemy = token({ id: 'enemy-token', poolId: 'srd-5.1:goblin', x: 275, y: 25 })
    const map: BattleMap = {
      id: 'map', name: 'Map', width: 700, height: 500, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5, tokens: [sorcererToken, enemy],
    }
    const initiativeOrder = [sorcererToken, enemy].map((entry, index) => ({
      tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
    }))
    const snapshot = createDnd5eMapCombatSnapshot({ combatId: 'combat', map, characters: [sorcerer], initiativeOrder })
    expect(snapshot.state.combatants[enemy.id].draconicPresenceSourceIds).toEqual([sorcererToken.id])

    enemy.dnd5eCombatState = { draconicPresenceImmunityRoundsBySource: { [sorcererToken.id]: 100 } }
    const immuneSnapshot = createDnd5eMapCombatSnapshot({ combatId: 'combat', map, characters: [sorcerer], initiativeOrder })
    expect(immuneSnapshot.state.combatants[enemy.id].draconicPresenceSourceIds).toBeUndefined()
  })

  it('expands Paladin auras at level 18 and applies Courage and Devotion condition immunities', () => {
    const paladin: Character = {
      ...character(), id: 'paladin', name: '圣武士', rulesetId: 'dnd5e-2014-srd-5.1', charClass: '圣武士', level: 18,
      abilities: { ...character().abilities, cha: 16 },
      dnd5eClassChoices: { classes: { paladin: { subclass: 'devotion' } } },
    }
    const ally: Character = { ...character(), id: 'ally', name: '盟友', rulesetId: 'dnd5e-2014-srd-5.1', charClass: '战士' }
    const paladinToken = token({ id: 'paladin-token', type: 'player', characterId: paladin.id, x: 25, y: 25 })
    const allyToken = token({ id: 'ally-token', type: 'player', characterId: ally.id, x: 275, y: 25 })
    const map: BattleMap = { id: 'map', name: 'Map', width: 500, height: 500, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5, tokens: [paladinToken, allyToken] }
    const initiativeOrder = [paladinToken, allyToken].map((entry, index) => ({ tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index }))
    const snapshot = createDnd5eMapCombatSnapshot({ combatId: 'combat', map, characters: [paladin, ally], initiativeOrder })

    expect(snapshot.state.combatants[allyToken.id].savingThrowBonuses.dex).toBe(5)
    expect(snapshot.state.combatants[allyToken.id].conditionImmunities).toEqual(expect.arrayContaining([
      'frightened', '惊惧', '恐慌', 'charmed', '魅惑',
    ]))
  })

  it('does not project Paladin auras while the Paladin is stunned', () => {
    const paladin: Character = {
      ...character(), id: 'paladin', rulesetId: 'dnd5e-2014-srd-5.1', charClass: '圣武士', level: 10,
      abilities: { ...character().abilities, cha: 18 },
      dnd5eCombatState: { stunnedByActorId: 'enemy', stunnedAppliedTurnKey: 'combat:1:enemy' },
    }
    const ally: Character = { ...character(), id: 'ally', rulesetId: 'dnd5e-2014-srd-5.1', charClass: '战士' }
    const paladinToken = token({ id: 'paladin-token', type: 'player', characterId: paladin.id, x: 25, y: 25 })
    const allyToken = token({ id: 'ally-token', type: 'player', characterId: ally.id, x: 75, y: 25 })
    const map: BattleMap = { id: 'map', name: 'Map', width: 500, height: 500, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5, tokens: [paladinToken, allyToken] }
    const initiativeOrder = [paladinToken, allyToken].map((entry, index) => ({ tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index }))
    const snapshot = createDnd5eMapCombatSnapshot({ combatId: 'combat', map, characters: [paladin, ally], initiativeOrder })

    expect(snapshot.state.combatants[allyToken.id].savingThrowBonuses.dex).toBe(2)
    expect(snapshot.state.combatants[allyToken.id].conditionImmunities).not.toContain('frightened')
  })

  it('projects Countercharm to hearing allies within 30 feet but not enemies, distant allies, or deafened allies', () => {
    const bard: Character = {
      ...character(), id: 'bard', rulesetId: 'dnd5e-2014-srd-5.1', charClass: '吟游诗人', level: 6,
      dnd5eCombatState: { countercharmRoundsRemaining: 1 },
    }
    const near: Character = { ...character(), id: 'near', rulesetId: 'dnd5e-2014-srd-5.1', charClass: '战士' }
    const far: Character = { ...character(), id: 'far', rulesetId: 'dnd5e-2014-srd-5.1', charClass: '战士' }
    const deaf = characterWithConditions(
      { ...character(), id: 'deaf', rulesetId: 'dnd5e-2014-srd-5.1', charClass: '战士' },
      ['耳聋'],
    )
    const bardToken = token({ id: 'bard-token', type: 'player', characterId: bard.id, x: 25, y: 25 })
    const nearToken = token({ id: 'near-token', type: 'player', characterId: near.id, x: 275, y: 25 })
    const farToken = token({ id: 'far-token', type: 'player', characterId: far.id, x: 375, y: 25 })
    const deafToken = token({ id: 'deaf-token', type: 'player', characterId: deaf.id, x: 75, y: 25 })
    const enemy = token({ id: 'enemy-token', x: 75, y: 75 })
    const map: BattleMap = {
      id: 'map', name: 'Map', width: 500, height: 500, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [bardToken, nearToken, farToken, deafToken, enemy],
    }
    const initiativeOrder = map.tokens.map((entry, index) => ({
      tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
    }))
    const snapshot = createDnd5eMapCombatSnapshot({ combatId: 'combat', map, characters: [bard, near, far, deaf], initiativeOrder })
    expect(snapshot.state.combatants[bardToken.id].countercharmSourceIds).toEqual([bardToken.id])
    expect(snapshot.state.combatants[nearToken.id].countercharmSourceIds).toEqual([bardToken.id])
    expect(snapshot.state.combatants[farToken.id].countercharmSourceIds).toBeUndefined()
    expect(snapshot.state.combatants[deafToken.id].countercharmSourceIds).toBeUndefined()
    expect(snapshot.state.combatants[enemy.id].countercharmSourceIds).toBeUndefined()
  })

  it('hydrates SRD class poison and disease immunities into the Headless snapshot', () => {
    const paladin: Character = {
      ...character(), id: 'paladin', rulesetId: 'dnd5e-2014-srd-5.1', charClass: '圣武士', level: 3,
    }
    const monk: Character = {
      ...character(), id: 'monk', rulesetId: 'dnd5e-2014-srd-5.1', charClass: '武僧', level: 10,
    }
    const druid: Character = {
      ...character(), id: 'druid', rulesetId: 'dnd5e-2014-srd-5.1', charClass: '德鲁伊', level: 10,
      dnd5eClassChoices: { classes: { druid: { subclass: 'land' } } },
    }
    const paladinToken = token({ id: 'paladin-token', type: 'player', characterId: paladin.id })
    const monkToken = token({ id: 'monk-token', type: 'player', characterId: monk.id, x: 50 })
    const druidToken = token({ id: 'druid-token', type: 'player', characterId: druid.id, x: 75 })
    const map: BattleMap = {
      id: 'map', name: 'Map', width: 100, height: 100, gridSize: 10, gridOffsetX: 0, gridOffsetY: 0,
      showGrid: true, tokens: [paladinToken, monkToken, druidToken],
    }
    const initiativeOrder = [paladinToken, monkToken, druidToken].map((entry, index) => ({
      tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
    }))
    const snapshot = createDnd5eMapCombatSnapshot({ combatId: 'combat', map, characters: [paladin, monk, druid], initiativeOrder })

    expect(snapshot.state.combatants[paladinToken.id].conditionImmunities).toEqual(expect.arrayContaining(['disease', '疾病']))
    expect(snapshot.state.combatants[monkToken.id].damageImmunities).toContain('poison')
    expect(snapshot.state.combatants[monkToken.id].conditionImmunities).toEqual(expect.arrayContaining(['poisoned', '中毒', 'disease', '疾病']))
    expect(snapshot.state.combatants[druidToken.id].damageImmunities).toContain('poison')
    expect(snapshot.state.combatants[druidToken.id].conditionImmunities).toEqual(expect.arrayContaining(['poisoned', '中毒', 'disease', '疾病']))
  })

  it('persists Wild Shape HP on the token without overwriting the character body HP', () => {
    const druid: Character = {
      ...character(),
      rulesetId: 'dnd5e-2014-srd-5.1',
      charClass: '德鲁伊',
      level: 2,
      currentHp: 17,
      maxHp: 20,
      dnd5eClassChoices: { classes: { druid: { selections: { 'wild-shape-known-forms': ['srd-5.1:wolf'] } } } },
      classResources: { 'dnd5e-wild-shape': { current: 2, max: 2 } },
    }
    const druidToken = token({ id: 'druid-token', type: 'player', characterId: druid.id, hp: 17, maxHp: 20 })
    const enemy = token({ id: 'enemy-token', poolId: 'srd-5.1:goblin', x: 50 })
    const map: BattleMap = {
      id: 'map', name: 'Map', width: 100, height: 100, gridSize: 10,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [druidToken, enemy],
    }
    const snapshot = createDnd5eMapCombatSnapshot({
      combatId: 'combat', map, characters: [druid],
      initiativeOrder: [
        { tokenId: druidToken.id, label: druidToken.label, emoji: '', color: '', roll: 20 },
        { tokenId: enemy.id, label: enemy.label, emoji: '', color: '', roll: 10 },
      ],
    })
    const transformed = resolveDnd5eHeadlessAction(snapshot.state, {
      type: 'druid-wild-shape', actorId: druidToken.id, formId: 'srd-5.1:wolf',
    })
    expect(transformed.ok).toBe(true)
    if (!transformed.ok) return
    const plan = planDnd5eMapResultApplication({
      state: transformed.state, map, characters: [druid],
      characterIdByCombatantId: snapshot.characterIdByCombatantId,
    })
    expect(plan.characters[0].currentHp).toBe(17)
    expect(plan.characters[0].dnd5eCombatState).toMatchObject({
      wildShapeFormId: 'srd-5.1:wolf', wildShapeCurrentHp: 11, wildShapeOriginalCurrentHp: 17,
    })
    expect(plan.map.tokens.find((entry) => entry.id === druidToken.id)).toMatchObject({ hp: 11, maxHp: 11 })
  })
})
