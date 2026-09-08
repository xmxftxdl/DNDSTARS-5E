import { afterEach, describe, expect, it } from 'vitest'
import type { BattleMap, Token } from '../../store/maps'
import { createEmptyMapGeometry, setMapGeometryRuntime } from '../../lib/mapGeometry'
import type { Character } from '../../types/character'
import { DND5E_SHIELD } from './equipment'
import {
  buildDnd5eCustomMonster,
  createDnd5eCustomMonsterDraft,
  createDnd5eCustomMonsterMechanicDraft,
  createDnd5eCustomMonsterTraitDraft,
} from './customMonsterWorkshop'
import { getDnd5eSrdMonster, setDnd5eRoomMonsterCatalog } from './monsters'
import {
  prepareDnd5eMonsterAfterHitMechanics,
  prepareDnd5eMonsterAttack,
  previewDnd5eMonsterAttack,
  dnd5ePreparedMonsterAttackIsAutomaticCritical,
  dnd5ePreparedMonsterTraitDamageDefinitions,
  resolvePreparedDnd5eMonsterAttack,
} from './monsterAttackAction'
import { resolveDnd5eMonsterMapMove } from './monsterMoveAction'
import { createDnd5eConditionEffect, createDnd5eMechanicalEffect } from './activeEffects'
import { createDnd5eTurnEconomyCounts, spendDnd5eTurnResource } from './turnEconomy'

function character(): Character {
  return { id: 'hero', name: '英雄', player: 'P1', avatar: '', accent: '', race: '', charClass: '', level: 1, background: '', experience: 0, reputation: 0, abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 10, cha: 10 }, savingThrows: [], skills: [], maxHp: 40, currentHp: 40, tempHp: 0, hitDice: '1d10', ac: 16, speed: 30, initiativeBonus: 0, saveDC: 10, passivePerception: 10, inspiration: 0, conditions: [], notes: '', dmNotes: '', visibleToPlayers: true }
}

function token(patch: Partial<Token>): Token {
  return { id: 'token', label: 'Token', x: 0, y: 0, color: '', emoji: '', size: 1, type: 'enemy', hp: 10, maxHp: 10, ...patch }
}

describe('SRD monster map action adapter', () => {
  afterEach(() => {
    setDnd5eRoomMonsterCatalog([])
    setMapGeometryRuntime([])
  })

  it('lets a player-side animated object make its Headless melee attack against an enemy monster', () => {
    const animatedObject = token({
      id: 'animated-object',
      label: '微型活化物件',
      x: 5,
      y: 5,
      poolId: 'srd-5.1:animated-object:tiny:fly-hover:slashing',
      hp: 20,
      maxHp: 20,
      dnd5eSummon: {
        schemaVersion: 1,
        pluginId: 'srd-5.1',
        featureId: 'spell:animate-objects',
        sourceCharacterId: 'wizard',
        sourceTokenId: 'wizard-token',
        concentrationId: 'animate-objects',
        createdRound: 1,
        expiresAfterRound: 11,
        side: 'player',
      },
    })
    const goblin = token({
      id: 'goblin',
      label: '地精',
      x: 15,
      y: 5,
      poolId: 'srd-5.1:goblin',
      hp: 7,
      maxHp: 7,
    })
    const map: BattleMap = {
      id: 'animated-object-attack-map',
      name: 'Animated object attack',
      width: 100,
      height: 100,
      gridSize: 10,
      feetPerCell: 5,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      tokens: [animatedObject, goblin],
    }
    const initiativeOrder = [animatedObject, goblin].map((entry, index) => ({
      tokenId: entry.id,
      label: entry.label,
      emoji: '',
      color: '',
      roll: 20 - index,
    }))

    const prepared = prepareDnd5eMonsterAttack({
      combatId: 'animated-object-attack',
      map,
      characters: [],
      initiativeOrder,
      actorTokenId: animatedObject.id,
      targetTokenId: goblin.id,
      targetTokenIds: [goblin.id],
      actionIndex: 0,
    })

    expect(prepared).toMatchObject({ ok: true })
    if (!prepared.ok) return
    expect(prepared.prepared.attacks[0]?.attack).toMatchObject({
      toHit: 8,
      damage: [{ count: 1, sides: 4, bonus: 4, type: 'slashing' }],
    })
  })

  it('keeps an explicitly selected ape fist single and resolves it as critical damage against an unconscious target within 5 feet', () => {
    const unconscious = createDnd5eConditionEffect({
      condition: 'unconscious',
      targetId: 'hero-token',
      source: { kind: 'dm' },
    })
    const hero: Character = {
      ...character(),
      conditions: ['unconscious'],
      dnd5eCombatState: { activeEffects: [unconscious] },
    }
    const apeMonster = getDnd5eSrdMonster('srd-5.1:ape')!
    const ape = token({
      id: 'ape', label: '猿', x: 0, y: 0, poolId: apeMonster.id,
      hp: apeMonster.hitPoints.average, maxHp: apeMonster.hitPoints.average,
    })
    const heroToken = token({
      id: 'hero-token', label: hero.name, x: 10, y: 0,
      type: 'player', characterId: hero.id,
      hp: hero.currentHp, maxHp: hero.maxHp,
      dnd5eCombatState: { activeEffects: [unconscious] },
    })
    const map: BattleMap = {
      id: 'ape-unconscious-critical', name: 'Ape unconscious critical',
      width: 100, height: 100, gridSize: 10, feetPerCell: 5,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true,
      tokens: [ape, heroToken],
    }
    const prepared = prepareDnd5eMonsterAttack({
      combatId: map.id,
      map,
      characters: [hero],
      initiativeOrder: [ape, heroToken].map((entry, index) => ({
        tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
      })),
      actorTokenId: ape.id,
      targetTokenId: heroToken.id,
      actionIndex: apeMonster.actions.findIndex((action) => action.id === 'fist'),
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return

    expect(prepared.prepared.action.id).toBe('fist')
    expect(prepared.prepared.attacks).toHaveLength(1)
    expect(prepared.prepared.attackModes).toEqual(['advantage'])
    expect(prepared.prepared.attackModeResolutions?.[0]?.advantageReasons)
      .toContain('目标处于昏迷状态')
    expect(prepared.prepared.attacks.every((_, index) =>
      dnd5ePreparedMonsterAttackIsAutomaticCritical(prepared.prepared, index),
    )).toBe(true)
    expect(prepared.prepared.attacks.map((_, index) =>
      previewDnd5eMonsterAttack(prepared.prepared, index, 12, 4).critical,
    )).toEqual([true])

    const resolved = resolvePreparedDnd5eMonsterAttack({
      prepared: prepared.prepared,
      rolls: [{ d20: 12, d20Second: 4, damageRolls: [[1, 2]] }],
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.result.events.filter((event) =>
      event.type === 'attack-resolved' && event.critical)).toHaveLength(1)
    expect(resolved.application?.characters[0].currentHp).toBe(34)
  })

  it('builds a direct weapon sequence from the authoritative occurrence target', () => {
    const animatedObject = token({
      id: 'animated-object', x: 5, y: 5,
      poolId: 'srd-5.1:animated-object:tiny:fly-hover:slashing',
      hp: 20, maxHp: 20,
      dnd5eSummon: {
        schemaVersion: 1, pluginId: 'srd-5.1', featureId: 'spell:animate-objects',
        sourceCharacterId: 'wizard', sourceTokenId: 'wizard-token',
        createdRound: 1, expiresAfterRound: 11, side: 'player',
      },
    })
    const preferred = token({
      id: 'preferred', x: 95, y: 5, poolId: 'srd-5.1:goblin', hp: 7, maxHp: 7,
    })
    const occurrence = token({
      id: 'occurrence', x: 15, y: 5, poolId: 'srd-5.1:goblin', hp: 7, maxHp: 7,
    })
    const map: BattleMap = {
      id: 'authoritative-occurrence-map', name: 'Authoritative occurrence',
      width: 120, height: 100, gridSize: 10, feetPerCell: 5,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true,
      tokens: [animatedObject, preferred, occurrence],
    }
    const initiativeOrder = [animatedObject, preferred, occurrence].map((entry, index) => ({
      tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
    }))

    const prepared = prepareDnd5eMonsterAttack({
      combatId: 'authoritative-occurrence', map, characters: [], initiativeOrder,
      actorTokenId: animatedObject.id,
      targetTokenId: preferred.id,
      targetTokenIds: [occurrence.id],
      actionIndex: 0,
    })

    expect(prepared).toMatchObject({ ok: true })
    if (!prepared.ok) return
    expect(prepared.prepared.attacks).toHaveLength(1)
    expect(prepared.prepared.attacks[0]?.targetToken.id).toBe(occurrence.id)
  })

  it('prepares a generic summoned companion profile as repeated magical attacks with Host bonuses', () => {
    const hero = character()
    const heroToken = token({
      id: 'hero-token', x: 10, type: 'player', characterId: hero.id,
      hp: hero.currentHp, maxHp: hero.maxHp,
    })
    const wolf = token({
      id: 'companion-wolf', x: 0, poolId: 'srd-5.1:wolf', hp: 44, maxHp: 44,
      dnd5eSummon: {
        schemaVersion: 1, pluginId: 'test', featureId: 'test:companion',
        sourceCharacterId: 'ranger', sourceTokenId: 'ranger-token',
        createdRound: 1, expiresAfterRound: 14_400, side: 'enemy', persistent: true,
        weaponAttackBonus: 4, weaponDamageBonus: 4,
        weaponAttacksMagical: true, attacksPerAction: 2,
      },
    })
    const map: BattleMap = {
      id: 'companion-attack-map', name: 'Companion attack', width: 100, height: 100,
      gridSize: 10, feetPerCell: 5, gridOffsetX: 0, gridOffsetY: 0, showGrid: true,
      tokens: [wolf, heroToken],
    }
    const initiativeOrder = [
      { tokenId: wolf.id, label: wolf.label, emoji: '', color: '', roll: 20 },
      { tokenId: heroToken.id, label: heroToken.label, emoji: '', color: '', roll: 10 },
    ]
    const prepared = prepareDnd5eMonsterAttack({
      combatId: 'companion-attack', map, characters: [hero], initiativeOrder,
      actorTokenId: wolf.id, targetTokenId: heroToken.id,
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.attacks).toHaveLength(2)
    expect(prepared.prepared.attacks.map((entry) => entry.attack.toHit)).toEqual([8, 8])
    expect(prepared.prepared.attacks.map((entry) => entry.attack.damage[0]?.bonus)).toEqual([6, 6])
    expect(prepared.prepared.state.combatants[wolf.id]).toMatchObject({
      weaponAttacksMagical: true,
      summonedAttacksPerAction: 2,
    })
  })

  it('applies underwater disadvantage to land monsters and preserves swimming predators', () => {
    const hero = character()
    const heroToken = token({ id: 'hero-token', x: 10, type: 'player', characterId: hero.id })
    const wolf = token({ id: 'wolf', x: 0, poolId: 'srd-5.1:wolf' })
    const shark = token({ id: 'shark', x: 0, poolId: 'srd-5.1:reef-shark' })
    const map: BattleMap = {
      id: 'underwater-map', name: 'Underwater', width: 100, height: 100, gridSize: 10,
      feetPerCell: 5, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [wolf, heroToken],
    }
    setMapGeometryRuntime([{ ...createEmptyMapGeometry(map.id), environment: 'underwater' }])
    const initiativeOrder = [wolf, shark, heroToken].map((entry, index) => ({
      tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
    }))
    const landAttack = prepareDnd5eMonsterAttack({
      combatId: 'combat', map, characters: [hero], initiativeOrder,
      actorTokenId: wolf.id, targetTokenId: heroToken.id,
    })
    expect(landAttack.ok).toBe(true)
    if (!landAttack.ok) return
    expect(landAttack.prepared.attackModes[0]).toBe('disadvantage')

    const swimmingAttack = prepareDnd5eMonsterAttack({
      combatId: 'combat', map: { ...map, tokens: [shark, heroToken] }, characters: [hero],
      initiativeOrder, actorTokenId: shark.id, targetTokenId: heroToken.id,
    })
    expect(swimmingAttack.ok).toBe(true)
    if (!swimmingAttack.ok) return
    expect(swimmingAttack.prepared.attackModes[0]).toBe('normal')
  })

  it('blocks ordinary monster projectiles across Wind Wall but exempts a giant thrown rock', () => {
    const hero = character()
    const heroToken = token({ id: 'hero-token', x: 105, y: 5, type: 'player', characterId: hero.id })
    const windWall = {
      id: 'wind-wall', sourceKind: 'core-spell' as const, coreSpellId: 'wind-wall',
      pluginId: 'srd-5.1', featureId: 'spell:wind-wall', color: '#ffffff',
      label: '风墙术', sourceCharacterId: 'druid', sourceTokenId: 'druid-token',
      slotLevel: 3, sourceSpellSaveDc: 15, createdRound: 1, expiresAfterRound: 11,
      anchorMode: 'fixed' as const, cells: [{ col: 5, row: 0 }],
      vertical: { mode: 'volume' as const, baseElevationFeet: 0, heightFeet: 15 },
      blocking: { movement: true, movementMode: 'boundary' as const },
    }
    const goblinMonster = getDnd5eSrdMonster('srd-5.1:goblin')!
    const goblin = token({ id: 'goblin', x: 5, y: 5, poolId: goblinMonster.id })
    const goblinMap: BattleMap = {
      id: 'wind-wall-monster-map', name: 'Wind Wall', width: 200, height: 100,
      gridSize: 10, feetPerCell: 5, gridOffsetX: 0, gridOffsetY: 0, showGrid: true,
      tokens: [goblin, heroToken], dnd5ePluginAreas: [windWall],
    }
    const goblinRangedIndex = goblinMonster.actions.findIndex((entry) => entry.attack?.mode === 'ranged')
    expect(prepareDnd5eMonsterAttack({
      combatId: 'wind-wall-goblin', map: goblinMap, characters: [hero],
      initiativeOrder: [goblin, heroToken].map((entry, index) => ({
        tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
      })),
      actorTokenId: goblin.id, targetTokenId: heroToken.id, actionIndex: goblinRangedIndex,
    })).toEqual({ ok: false, reason: 'projectile-blocked-by-wind-wall' })

    const giantMonster = getDnd5eSrdMonster('srd-5.1:hill-giant')!
    const giant = token({
      id: 'giant', x: 5, y: 5, size: 3, creatureSize: '大型', poolId: giantMonster.id,
      hp: giantMonster.hitPoints.average, maxHp: giantMonster.hitPoints.average,
    })
    const giantRangedIndex = giantMonster.actions.findIndex((entry) => entry.attack?.mode === 'ranged')
    expect(prepareDnd5eMonsterAttack({
      combatId: 'wind-wall-giant', map: { ...goblinMap, tokens: [giant, heroToken] },
      characters: [hero],
      initiativeOrder: [giant, heroToken].map((entry, index) => ({
        tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
      })),
      actorTokenId: giant.id, targetTokenId: heroToken.id, actionIndex: giantRangedIndex,
    }).ok).toBe(true)
  })

  it('applies defender-linked creature-type disadvantage to prepared and committed monster attacks', () => {
    const protection = createDnd5eMechanicalEffect({
      definitionId: 'activity:protection-from-evil-and-good',
      label: 'Protection from Evil and Good',
      source: { kind: 'spell', actorId: 'hero', rulesId: 'protection-from-evil-and-good' },
      targetId: 'hero-token',
      modifiers: { attacksAgainstTargetDisadvantageCreatureTypes: ['undead'] },
    })
    const hero = {
      ...character(),
      dnd5eCombatState: { activeEffects: [protection] },
    }
    const heroToken = token({
      id: 'hero-token', x: 10, type: 'player', characterId: hero.id,
      hp: hero.currentHp, maxHp: hero.maxHp,
    })
    const zombieMonster = getDnd5eSrdMonster('srd-5.1:zombie')!
    const zombie = token({
      id: 'zombie', label: '僵尸', x: 0, poolId: zombieMonster.id,
      hp: zombieMonster.hitPoints.average, maxHp: zombieMonster.hitPoints.average,
    })
    const map: BattleMap = {
      id: 'typed-protection-map', name: 'Typed protection', width: 100, height: 100,
      gridSize: 10, feetPerCell: 5, gridOffsetX: 0, gridOffsetY: 0, showGrid: true,
      tokens: [zombie, heroToken],
    }
    const prepared = prepareDnd5eMonsterAttack({
      combatId: map.id, map, characters: [hero],
      initiativeOrder: [zombie, heroToken].map((entry, index) => ({
        tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
      })),
      actorTokenId: zombie.id, targetTokenId: heroToken.id,
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.attackModes[0]).toBe('disadvantage')

    const damageRolls = prepared.prepared.attacks[0]!.attack.damage.map((damage) =>
      Array(damage.count).fill(1))
    const resolved = resolvePreparedDnd5eMonsterAttack({
      prepared: prepared.prepared,
      rolls: [{
        targetId: heroToken.id, mode: 'normal', d20: 18, d20Second: 2, damageRolls,
      }],
    })
    expect(resolved.result.ok).toBe(true)
    if (!resolved.result.ok) return
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved', actorId: zombie.id, targetId: heroToken.id, d20: 2,
    }))
  })

  it('applies magic-circle persistent-area creature-type disadvantage to monster attacks', () => {
    const hero = character()
    const heroToken = token({
      id: 'hero-token', x: 10, type: 'player', characterId: hero.id,
      hp: hero.currentHp, maxHp: hero.maxHp,
    })
    const skeletonMonster = getDnd5eSrdMonster('srd-5.1:skeleton')!
    const skeleton = token({
      id: 'skeleton', label: '骷髅', x: 0, poolId: skeletonMonster.id,
      hp: skeletonMonster.hitPoints.average, maxHp: skeletonMonster.hitPoints.average,
    })
    const map: BattleMap = {
      id: 'magic-circle-typed-protection-map', name: 'Magic circle typed protection',
      width: 100, height: 100, gridSize: 10, feetPerCell: 5,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true,
      tokens: [skeleton, heroToken],
      dnd5ePluginAreas: [{
        id: 'magic-circle', pluginId: 'srd-5.1', featureId: 'spell:magic-circle',
        sourceKind: 'core-spell', coreSpellId: 'magic-circle', label: '防护法阵',
        color: '#8b5cf6', sourceCharacterId: hero.id, sourceTokenId: heroToken.id,
        cells: [{ col: 1, row: 0 }], createdRound: 1, expiresAfterRound: 600,
        relation: 'any', includeSelf: true,
        occupantModifiers: {
          attacksAgainstOccupantDisadvantageCreatureTypes: ['undead'],
        },
      }],
    }
    const prepared = prepareDnd5eMonsterAttack({
      combatId: map.id, map, characters: [hero],
      initiativeOrder: [skeleton, heroToken].map((entry, index) => ({
        tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
      })),
      actorTokenId: skeleton.id, targetTokenId: heroToken.id,
      actionIndex: skeletonMonster.actions.findIndex((action) => action.id === 'shortbow'),
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.attackModes[0]).toBe('disadvantage')
    expect(prepared.prepared.attacks[0]?.targetAttackModeResolution?.disadvantageReasons)
      .toContain('防护法阵令该攻击具有劣势')
  })

  it('treats the DM monster roll ruling as the final authoritative attack mode', () => {
    const prone = createDnd5eConditionEffect({
      condition: 'prone',
      source: { kind: 'system', rulesId: 'test:dm-roll-mode-prone' },
      targetId: 'hero-token',
    })
    const hero = {
      ...character(),
      conditions: ['prone' as const],
      dnd5eCombatState: { activeEffects: [prone] },
    }
    const heroToken = token({
      id: 'hero-token', x: 10, type: 'player', characterId: hero.id,
      hp: hero.currentHp, maxHp: hero.maxHp,
    })
    const goblinMonster = getDnd5eSrdMonster('srd-5.1:goblin')!
    const goblin = token({
      id: 'goblin', x: 0, poolId: goblinMonster.id,
      hp: goblinMonster.hitPoints.average, maxHp: goblinMonster.hitPoints.average,
    })
    const map: BattleMap = {
      id: 'dm-final-roll-mode', name: 'DM final roll mode', width: 100, height: 100,
      gridSize: 10, feetPerCell: 5, gridOffsetX: 0, gridOffsetY: 0,
      showGrid: true, tokens: [goblin, heroToken],
    }
    const prepared = prepareDnd5eMonsterAttack({
      combatId: map.id,
      map,
      characters: [hero],
      initiativeOrder: [goblin, heroToken].map((entry, index) => ({
        tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
      })),
      actorTokenId: goblin.id,
      targetTokenId: heroToken.id,
      actionIndex: goblinMonster.actions.findIndex((action) => action.id === 'scimitar'),
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.attackModes[0]).toBe('advantage')

    const damageRolls = prepared.prepared.attacks[0]!.attack.damage.map((damage) =>
      Array(damage.count).fill(1))
    expect(previewDnd5eMonsterAttack(
      prepared.prepared,
      0,
      2,
      18,
      false,
      undefined,
      undefined,
      undefined,
      'disadvantage',
    ).roll.d20).toBe(2)
    const resolved = resolvePreparedDnd5eMonsterAttack({
      prepared: prepared.prepared,
      rolls: [{
        d20: 2,
        d20Second: 18,
        mode: 'advantage',
        dmFinalMode: 'disadvantage',
        damageRolls,
      }],
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    if (!resolved.result.ok) return
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved',
      actorId: goblin.id,
      targetId: heroToken.id,
      d20: 2,
      hit: false,
    }))
  })

  it('prepares Charge dice and its save rider from persisted Host movement evidence', () => {
    const hero = character()
    const monster = getDnd5eSrdMonster('srd-5.1:boar')!
    const boar = token({
      id: 'boar',
      x: 40,
      poolId: monster.id,
      hp: monster.hitPoints.average,
      maxHp: monster.hitPoints.average,
      dnd5eCombatState: {
        monsterMechanicMovementTurnKey: 'charge-map:1:boar',
        monsterMechanicMovementFeet: 20,
        monsterMechanicMovementOrigin: { x: 0, y: 0 },
        monsterMechanicMovementLast: { x: 40, y: 0 },
        monsterMechanicMovementStraight: true,
      },
    })
    const heroToken = token({
      id: 'hero-token',
      x: 50,
      type: 'player',
      characterId: hero.id,
      hp: hero.currentHp,
      maxHp: hero.maxHp,
    })
    const map: BattleMap = {
      id: 'charge-map', name: 'Charge map', width: 100, height: 100,
      gridSize: 10, feetPerCell: 5, gridOffsetX: 0, gridOffsetY: 0,
      showGrid: true, tokens: [boar, heroToken],
    }
    const prepared = prepareDnd5eMonsterAttack({
      combatId: 'charge-map',
      map,
      characters: [hero],
      initiativeOrder: [boar, heroToken].map((entry, index) => ({
        tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
      })),
      actorTokenId: boar.id,
      targetTokenId: heroToken.id,
      actionIndex: monster.actions.findIndex((action) => action.id === 'tusk'),
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.attacks[0]?.attack.onHitRule).toEqual({
      kind: 'saving-throw-condition', ability: 'str', dc: 11, condition: 'prone',
    })
    expect(dnd5ePreparedMonsterTraitDamageDefinitions(
      prepared.prepared,
      0,
      'normal',
    )).toEqual([expect.objectContaining({
      traitId: 'charge-damage',
      damage: expect.objectContaining({ count: 1, sides: 6, type: 'slashing' }),
    })])
  })

  it('prepares and resolves a Host-authorized Pounce follow-up as a bonus action', () => {
    const hero = {
      ...character(),
      conditions: ['prone' as const],
      dnd5eCombatState: {
        activeEffects: [createDnd5eConditionEffect({
          condition: 'prone',
          source: {
            kind: 'monster',
            actorId: 'lion',
            rulesId: 'monster:srd-5.1:lion:pounce',
          },
          targetId: 'hero-token',
        })],
      },
    }
    const lionMonster = getDnd5eSrdMonster('srd-5.1:lion')!
    const lion = token({
      id: 'lion',
      x: 40,
      poolId: lionMonster.id,
      hp: lionMonster.hitPoints.average,
      maxHp: lionMonster.hitPoints.average,
      dnd5eCombatState: {
        monsterTriggeredBonusAction: {
          schemaVersion: 1,
          combatId: 'pounce-map',
          round: 1,
          turnKey: 'pounce-map:1:lion',
          actionId: 'pounce-bite-bonus-action',
          referencedActionId: 'bite',
          targetId: 'hero-token',
          requiredTargetCondition: 'prone',
        },
      },
    })
    const heroToken = token({
      id: 'hero-token', x: 50, type: 'player', characterId: hero.id,
      hp: hero.currentHp, maxHp: hero.maxHp,
    })
    const map: BattleMap = {
      id: 'pounce-map', name: 'Pounce map', width: 100, height: 100,
      gridSize: 10, feetPerCell: 5, gridOffsetX: 0, gridOffsetY: 0,
      showGrid: true, tokens: [lion, heroToken],
    }
    const bonusActionIndex = lionMonster.bonusActions?.findIndex((action) =>
      action.id === 'pounce-bite-bonus-action') ?? -1
    const prepared = prepareDnd5eMonsterAttack({
      combatId: 'pounce-map', round: 1, map, characters: [hero],
      initiativeOrder: [lion, heroToken].map((entry, index) => ({
        tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
      })),
      actorTokenId: lion.id,
      targetTokenId: heroToken.id,
      actionIndex: bonusActionIndex,
      resourceKind: 'bonus-action',
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({
      resourceKind: 'bonus-action',
      resourceAction: { id: 'pounce-bite-bonus-action' },
      action: { id: 'bite' },
    })
    const damageRolls = prepared.prepared.attacks[0]!.attack.damage.map((damage) =>
      Array(damage.count).fill(1))
    const resolved = resolvePreparedDnd5eMonsterAttack({
      prepared: prepared.prepared,
      rolls: [{ d20: 10, damageRolls }],
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    if (!resolved.result.ok) return
    expect(resolved.result.state.combatants[lion.id].turn.bonusActionAvailable).toBe(false)
    expect(resolved.result.state.combatants[lion.id].turn.actionAvailable).toBe(true)
  })

  it('resolves a targeted legendary attack off turn and spends only legendary points', () => {
    const hero = character()
    const monster = getDnd5eSrdMonster('srd-5.1:aboleth')!
    const aboleth = token({
      id: 'aboleth', label: monster.name, poolId: monster.id, x: 0,
      hp: monster.hitPoints.average, maxHp: monster.hitPoints.average,
      dnd5eCombatState: { monsterLegendaryActionPoints: 2 },
    })
    const heroToken = token({
      id: 'hero-token', label: hero.name, type: 'player', characterId: hero.id,
      x: 10, hp: hero.currentHp, maxHp: hero.maxHp,
    })
    const battleMap: BattleMap = {
      id: 'legendary-attack-map', name: 'Legendary attack', width: 100, height: 100,
      gridSize: 10, feetPerCell: 5, gridOffsetX: 0, gridOffsetY: 0,
      showGrid: true, tokens: [aboleth, heroToken],
    }
    const actionIndex = monster.legendaryActions?.findIndex((action) =>
      action.id === 'tail-swipe') ?? -1
    const prepared = prepareDnd5eMonsterAttack({
      combatId: 'legendary-attack', round: 1, map: battleMap, characters: [hero],
      initiativeOrder: [aboleth, heroToken].map((entry, index) => ({
        tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
      })),
      currentInitiativeIndex: 1,
      actorTokenId: aboleth.id,
      targetTokenId: heroToken.id,
      actionIndex,
      resourceKind: 'legendary-action',
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({
      resourceKind: 'legendary-action',
      resourceAction: { id: 'tail-swipe' },
      action: { id: 'tail' },
      state: { initiativeIndex: 1 },
    })
    const damageRolls = prepared.prepared.attacks[0]!.attack.damage.map((damage) =>
      Array(damage.count).fill(1))
    const resolved = resolvePreparedDnd5eMonsterAttack({
      prepared: prepared.prepared,
      rolls: [{ d20: 10, damageRolls }],
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    if (!resolved.result.ok) return
    expect(resolved.result.state.combatants[aboleth.id]).toMatchObject({
      classState: { monsterLegendaryActionPoints: 1 },
      turn: { actionAvailable: true },
    })
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'monster-legendary-action-used',
      actorId: aboleth.id,
      actionId: 'tail-swipe',
      cost: 1,
      remaining: 1,
    }))
  })

  it('keeps the Roper parent Multiattack and explicit Tendril selection distinct', () => {
    const hero = character()
    const monster = getDnd5eSrdMonster('srd-5.1:roper')!
    const roper = token({
      id: 'roper',
      label: monster.name,
      poolId: monster.id,
      hp: monster.hitPoints.average,
      maxHp: monster.hitPoints.average,
    })
    const heroToken = token({
      id: 'hero-token',
      label: hero.name,
      x: 10,
      type: 'player',
      characterId: hero.id,
      hp: hero.currentHp,
      maxHp: hero.maxHp,
    })
    const map: BattleMap = {
      id: 'roper-composite-map',
      name: 'Roper composite',
      width: 200,
      height: 100,
      gridSize: 10,
      feetPerCell: 5,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      tokens: [roper, heroToken],
    }
    const initiativeOrder = [
      { tokenId: roper.id, label: roper.label, emoji: '', color: '', roll: 20 },
      { tokenId: heroToken.id, label: heroToken.label, emoji: '', color: '', roll: 10 },
    ]
    const parentIndex = monster.actions.findIndex((action) => action.id === 'multiattack')
    const childIndex = monster.actions.findIndex((action) => action.id === 'tendril')
    const parent = prepareDnd5eMonsterAttack({
      combatId: `roper-composite-${parentIndex}`,
      map,
      characters: [hero],
      initiativeOrder,
      actorTokenId: roper.id,
      targetTokenId: heroToken.id,
      actionIndex: parentIndex,
    })
    expect(parent.ok).toBe(true)
    if (!parent.ok) return
    expect(parent.prepared.action.id).toBe('multiattack')
    expect(parent.prepared.compositeRuntime?.children.map((child) => child.kind))
      .toEqual(['weapon', 'weapon', 'weapon', 'weapon', 'special', 'weapon'])
    expect(parent.prepared.attacks.map((attack) => attack.sequenceIndex))
      .toEqual([0, 1, 2, 3, 5])

    const child = prepareDnd5eMonsterAttack({
      combatId: `roper-composite-${childIndex}`,
      map,
      characters: [hero],
      initiativeOrder,
      actorTokenId: roper.id,
      targetTokenId: heroToken.id,
      actionIndex: childIndex,
    })
    expect(child.ok).toBe(true)
    if (!child.ok) return
    expect(child.prepared.action.id).toBe('tendril')
    expect(child.prepared.attacks.map((attack) => attack.id)).toEqual(['tendril'])
  })

  it('lets Reel bring the live-map target into range before the Roper Bite', () => {
    const hero = character()
    const monster = getDnd5eSrdMonster('srd-5.1:roper')!
    const roper = token({
      id: 'roper-live',
      label: monster.name,
      x: 900,
      y: 500,
      size: 2,
      poolId: monster.id,
      hp: monster.hitPoints.average,
      maxHp: monster.hitPoints.average,
    })
    const heroToken = token({
      id: 'hero-live',
      label: hero.name,
      x: 862.5,
      y: 562.5,
      type: 'player',
      characterId: hero.id,
      hp: hero.currentHp,
      maxHp: hero.maxHp,
    })
    const map: BattleMap = {
      id: 'roper-live-map',
      name: 'Roper live map',
      width: 1024,
      height: 1024,
      gridSize: 25,
      feetPerCell: 5,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      tokens: [roper, heroToken],
    }
    const initiativeOrder = [
      { tokenId: roper.id, label: roper.label, emoji: '', color: '', roll: 20 },
      { tokenId: heroToken.id, label: heroToken.label, emoji: '', color: '', roll: 10 },
    ]
    const parentIndex = monster.actions.findIndex((action) =>
      action.id === 'multiattack')
    const expectedTargets = Array.from({ length: 6 }, () => heroToken.id)
    const prepared = prepareDnd5eMonsterAttack({
      combatId: `roper-live-${parentIndex}`,
      map,
      characters: [hero],
      initiativeOrder,
      actorTokenId: roper.id,
      targetTokenId: heroToken.id,
      targetTokenIds: expectedTargets,
      actionIndex: parentIndex,
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.action.id).toBe('multiattack')
    expect(prepared.prepared.attacks.find((attack) =>
      attack.id === 'bite')?.distanceFeet).toBeGreaterThan(5)
  })

  it.each([
    {
      monsterId: 'srd-5.1:ogre',
      actionId: 'greatclub',
      actorX: 50,
      targetX: 35,
      expectedDistanceFeet: 5,
    },
    {
      monsterId: 'srd-5.1:elephant',
      actionId: 'gore',
      actorX: 55,
      targetX: 35,
      expectedDistanceFeet: 5,
    },
    {
      monsterId: 'srd-5.1:ancient-red-dragon',
      actionId: 'bite',
      actorX: 60,
      targetX: 15,
      expectedDistanceFeet: 15,
    },
  ])('uses the $monsterId stat-block footprint for melee range', ({
    monsterId,
    actionId,
    actorX,
    targetX,
    expectedDistanceFeet,
  }) => {
    const hero = character()
    const monster = getDnd5eSrdMonster(monsterId)!
    const actor = token({
      id: `actor:${monsterId}`,
      label: monster.name,
      x: actorX,
      y: 50,
      size: 1,
      creatureSize: undefined,
      poolId: monster.id,
      hp: monster.hitPoints.average,
      maxHp: monster.hitPoints.average,
    })
    const heroToken = token({
      id: `target:${monsterId}`,
      label: hero.name,
      x: targetX,
      y: 55,
      type: 'player',
      characterId: hero.id,
      hp: hero.currentHp,
      maxHp: hero.maxHp,
    })
    const sizedMap: BattleMap = {
      id: `size-range:${monsterId}`,
      name: 'Size range',
      width: 200,
      height: 120,
      gridSize: 10,
      feetPerCell: 5,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      tokens: [actor, heroToken],
    }
    const initiativeOrder = [
      { tokenId: actor.id, label: actor.label, emoji: '', color: '', roll: 20 },
      { tokenId: heroToken.id, label: heroToken.label, emoji: '', color: '', roll: 10 },
    ]
    const actionIndex = monster.actions.findIndex((action) => action.id === actionId)
    expect(actionIndex).toBeGreaterThanOrEqual(0)

    const prepared = prepareDnd5eMonsterAttack({
      combatId: `size-range:${monsterId}`,
      map: sizedMap,
      characters: [hero],
      initiativeOrder,
      actorTokenId: actor.id,
      targetTokenId: heroToken.id,
      actionIndex,
    })

    expect(prepared.ok, `${monsterId}:${actionId}`).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.attacks[0]?.distanceFeet).toBe(expectedDistanceFeet)
  })

  it('prepares and submits one stable target per Tyrannosaurus occurrence', () => {
    const heroA = character()
    const heroB = { ...character(), id: 'hero-b', name: '英雄B', ac: 20 }
    const monster = getDnd5eSrdMonster('srd-5.1:tyrannosaurus-rex')!
    const tyrannosaurus = token({
      id: 'tyrannosaurus',
      label: monster.name,
      poolId: monster.id,
      hp: monster.hitPoints.average,
      maxHp: monster.hitPoints.average,
    })
    const targetA = token({
      id: 'hero-a-token',
      label: heroA.name,
      x: 10,
      type: 'player',
      characterId: heroA.id,
      hp: heroA.currentHp,
      maxHp: heroA.maxHp,
    })
    const targetB = token({
      id: 'hero-b-token',
      label: heroB.name,
      y: 10,
      type: 'player',
      characterId: heroB.id,
      hp: heroB.currentHp,
      maxHp: heroB.maxHp,
    })
    const map: BattleMap = {
      id: 'tyrannosaurus-multi-target',
      name: 'Tyrannosaurus multi-target',
      width: 200,
      height: 100,
      gridSize: 10,
      feetPerCell: 5,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      tokens: [tyrannosaurus, targetA, targetB],
    }
    const initiativeOrder = [tyrannosaurus, targetA, targetB].map(
      (entry, index) => ({
        tokenId: entry.id,
        label: entry.label,
        emoji: '',
        color: '',
        roll: 20 - index,
      }),
    )
    const actionIndex = monster.actions.findIndex((action) =>
      action.id === 'multiattack')
    const prepared = prepareDnd5eMonsterAttack({
      combatId: 'tyrannosaurus-multi-target',
      map,
      characters: [heroA, heroB],
      initiativeOrder,
      actorTokenId: tyrannosaurus.id,
      targetTokenId: targetA.id,
      targetTokenIds: [targetA.id, targetB.id],
      actionIndex,
    })

    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.targetOccurrences.map((entry) => entry.targetId))
      .toEqual([targetA.id, targetB.id])
    expect(prepared.prepared.attacks.map((entry) => ({
      targetId: entry.targetToken.id,
      armorClass: entry.targetArmorClass,
    }))).toEqual([
      {
        targetId: targetA.id,
        armorClass:
          prepared.prepared.state.combatants[targetA.id].armorClass,
      },
      {
        targetId: targetB.id,
        armorClass:
          prepared.prepared.state.combatants[targetB.id].armorClass,
      },
    ])
    const resolved = resolvePreparedDnd5eMonsterAttack({
      prepared: prepared.prepared,
      rolls: [
        { d20: 1, damageRolls: [] },
        { d20: 1, damageRolls: [] },
      ],
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.result.events.flatMap((event) =>
      event.type === 'attack-resolved' ? [event.targetId] : [],
    )).toEqual([targetA.id, targetB.id])
  })

  it('trims planner targets to the rolled Violet Fungus repeat count', () => {
    const hero = character()
    const monster = getDnd5eSrdMonster('srd-5.1:violet-fungus')!
    const fungus = token({
      id: 'fungus',
      poolId: monster.id,
      hp: monster.hitPoints.average,
      maxHp: monster.hitPoints.average,
    })
    const target = token({
      id: 'hero-token',
      x: 10,
      type: 'player',
      characterId: hero.id,
      hp: hero.currentHp,
      maxHp: hero.maxHp,
    })
    const map: BattleMap = {
      id: 'violet-fungus-random-repeat',
      name: 'Violet Fungus random repeat',
      width: 100,
      height: 100,
      gridSize: 10,
      feetPerCell: 5,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      tokens: [fungus, target],
    }
    const prepared = prepareDnd5eMonsterAttack({
      combatId: 'violet-fungus-random-repeat',
      map,
      characters: [hero],
      initiativeOrder: [fungus, target].map((entry, index) => ({
        tokenId: entry.id,
        label: entry.label,
        emoji: '',
        color: '',
        roll: 20 - index,
      })),
      actorTokenId: fungus.id,
      targetTokenId: target.id,
      // The planner scores the unresolved 1d4 action at its maximum.
      targetTokenIds: [target.id, target.id, target.id, target.id],
      actionIndex: monster.actions.findIndex((action) =>
        action.id === 'multiattack'),
      randomRepeatRoll: 2,
    })

    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.targetOccurrences).toHaveLength(2)
    expect(prepared.prepared.attacks.map((entry) => entry.targetToken.id))
      .toEqual([target.id, target.id])
  })

  it('retains legacy same-target preparation for Giant Crocodile', () => {
    const hero = character()
    const monster = getDnd5eSrdMonster('srd-5.1:giant-crocodile')!
    const crocodile = token({
      id: 'crocodile',
      poolId: monster.id,
      hp: monster.hitPoints.average,
      maxHp: monster.hitPoints.average,
    })
    const target = token({
      id: 'hero-token',
      x: 10,
      type: 'player',
      characterId: hero.id,
      hp: hero.currentHp,
      maxHp: hero.maxHp,
    })
    const map: BattleMap = {
      id: 'crocodile-legacy-target',
      name: 'Crocodile legacy target',
      width: 100,
      height: 100,
      gridSize: 10,
      feetPerCell: 5,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      tokens: [crocodile, target],
    }
    const prepared = prepareDnd5eMonsterAttack({
      combatId: 'crocodile-legacy-target',
      map,
      characters: [hero],
      initiativeOrder: [crocodile, target].map((entry, index) => ({
        tokenId: entry.id,
        label: entry.label,
        emoji: '',
        color: '',
        roll: 20 - index,
      })),
      actorTokenId: crocodile.id,
      targetTokenId: target.id,
      actionIndex: monster.actions.findIndex((action) =>
        action.id === 'multiattack'),
    })

    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.targetOccurrences.map((entry) => entry.targetId))
      .toEqual([target.id, target.id])
  })

  it('keeps Ankheg Bite locked to its linked target and prepares that attack with advantage', () => {
    const grapple = createDnd5eConditionEffect({
      id: 'relation:grapple:ankheg:bite:linked-hero-token',
      condition: 'grappled',
      source: {
        kind: 'monster',
        actorId: 'ankheg',
        rulesId: 'monster:srd-5.1:ankheg:bite:bite-grapple',
      },
      targetId: 'linked-hero-token',
      duration: { type: 'permanent' },
      escapeCheck: {
        ability: 'str',
        skill: 'athletics',
        alternativeAbility: 'dex',
        alternativeSkill: 'acrobatics',
        dc: 13,
        economy: 'action',
      },
      relation: {
        schemaVersion: 1,
        kind: 'grapple',
        sourceActorId: 'ankheg',
        sourceActionId: 'bite',
        slotGroup: 'bite',
        maxDistanceFeet: 5,
        movement: 'drag-target',
        endsOnSourceIncapacitated: true,
      },
      stackingKey: 'relation:grapple:ankheg:bite:linked-hero-token',
    })
    const linkedHero: Character = {
      ...character(),
      id: 'linked-hero',
      dnd5eCombatState: {
        schemaVersion: 2,
        activeEffects: [grapple],
      },
    }
    const otherHero: Character = {
      ...character(),
      id: 'other-hero',
    }
    const ankheg = token({
      id: 'ankheg',
      label: 'Ankheg',
      x: 0,
      y: 0,
      poolId: 'srd-5.1:ankheg',
      hp: 39,
      maxHp: 39,
    })
    const linkedTarget = token({
      id: 'linked-hero-token',
      label: linkedHero.name,
      x: 10,
      y: 0,
      type: 'player',
      characterId: linkedHero.id,
      hp: linkedHero.currentHp,
      maxHp: linkedHero.maxHp,
    })
    const otherTarget = token({
      id: 'other-hero-token',
      label: otherHero.name,
      x: 0,
      y: 10,
      type: 'player',
      characterId: otherHero.id,
      hp: otherHero.currentHp,
      maxHp: otherHero.maxHp,
    })
    const battleMap: BattleMap = {
      id: 'ankheg-linked-target-map',
      name: 'Ankheg linked target',
      width: 100,
      height: 100,
      gridSize: 10,
      feetPerCell: 5,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      tokens: [ankheg, linkedTarget, otherTarget],
    }
    const initiativeOrder = [ankheg, linkedTarget, otherTarget].map((entry, index) => ({
      tokenId: entry.id,
      label: entry.label,
      emoji: '',
      color: '',
      roll: 20 - index,
    }))

    const linkedAttack = prepareDnd5eMonsterAttack({
      combatId: 'ankheg-linked-target-combat',
      map: battleMap,
      characters: [linkedHero, otherHero],
      initiativeOrder,
      actorTokenId: ankheg.id,
      targetTokenId: linkedTarget.id,
      actionIndex: 0,
    })
    expect(linkedAttack.ok).toBe(true)
    if (!linkedAttack.ok) return
    expect(linkedAttack.prepared.action.id).toBe('bite')
    expect(linkedAttack.prepared.targetAttackMode).toBe('normal')
    expect(linkedAttack.prepared.attackModes).toEqual(['advantage'])
    expect(previewDnd5eMonsterAttack(linkedAttack.prepared, 0, 2, 18).roll.d20).toBe(18)

    expect(prepareDnd5eMonsterAttack({
      combatId: 'ankheg-linked-target-combat',
      map: battleMap,
      characters: [linkedHero, otherHero],
      initiativeOrder,
      actorTokenId: ankheg.id,
      targetTokenId: otherTarget.id,
      actionIndex: 0,
    })).toEqual({ ok: false, reason: 'invalid-target' })
  })

  it('keeps Behir Bite as a single attack at 10 feet when Constrict is out of range', () => {
    const hero = character()
    const behir = token({
      id: 'behir',
      label: 'Behir',
      x: 35,
      y: 35,
      creatureSize: '超大型',
      poolId: 'srd-5.1:behir',
      hp: 168,
      maxHp: 168,
    })
    const heroToken = token({
      id: 'hero-token',
      label: hero.name,
      x: 5,
      y: 35,
      type: 'player',
      characterId: hero.id,
      hp: hero.currentHp,
      maxHp: hero.maxHp,
    })
    const battleMap: BattleMap = {
      id: 'behir-ten-feet',
      name: 'Behir ten feet',
      width: 100,
      height: 100,
      gridSize: 10,
      feetPerCell: 5,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      tokens: [behir, heroToken],
    }
    const monster = getDnd5eSrdMonster('srd-5.1:behir')
    const biteIndex = monster?.actions.findIndex((action) => action.id === 'bite') ?? -1
    expect(biteIndex).toBeGreaterThanOrEqual(0)
    const prepared = prepareDnd5eMonsterAttack({
      combatId: 'behir-ten-feet',
      map: battleMap,
      characters: [hero],
      initiativeOrder: [
        { tokenId: behir.id, label: behir.label, emoji: '', color: '', roll: 20 },
        { tokenId: heroToken.id, label: heroToken.label, emoji: '', color: '', roll: 10 },
      ],
      actorTokenId: behir.id,
      targetTokenId: heroToken.id,
      actionIndex: biteIndex,
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({
      distanceFeet: 10,
      action: { id: 'bite' },
      attacks: [{ id: 'bite' }],
    })
  })

  it('keeps Behir Bite legal but rejects Constrict and its Multiattack against a Huge target', () => {
    const hero = character()
    const behir = token({
      id: 'behir',
      label: 'Behir',
      poolId: 'srd-5.1:behir',
      hp: 168,
      maxHp: 168,
    })
    const hugeTarget = token({
      id: 'huge-target',
      label: hero.name,
      x: 10,
      type: 'player',
      characterId: hero.id,
      creatureSize: '超大型',
      hp: hero.currentHp,
      maxHp: hero.maxHp,
    })
    const battleMap: BattleMap = {
      id: 'behir-huge-target',
      name: 'Behir huge target',
      width: 100,
      height: 100,
      gridSize: 10,
      feetPerCell: 5,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      tokens: [behir, hugeTarget],
    }
    const initiativeOrder = [
      { tokenId: behir.id, label: behir.label, emoji: '', color: '', roll: 20 },
      { tokenId: hugeTarget.id, label: hugeTarget.label, emoji: '', color: '', roll: 10 },
    ]
    const monster = getDnd5eSrdMonster('srd-5.1:behir')!
    const biteIndex = monster.actions.findIndex((action) => action.id === 'bite')
    const constrictIndex = monster.actions.findIndex((action) => action.id === 'constrict')
    const bite = prepareDnd5eMonsterAttack({
      combatId: 'behir-huge-target',
      map: battleMap,
      characters: [hero],
      initiativeOrder,
      actorTokenId: behir.id,
      targetTokenId: hugeTarget.id,
      actionIndex: biteIndex,
    })
    expect(bite.ok).toBe(true)
    if (!bite.ok) return
    expect(bite.prepared.action.id).toBe('bite')
    expect(bite.prepared.attacks.map((entry) => entry.id)).toEqual(['bite'])
    expect(prepareDnd5eMonsterAttack({
      combatId: 'behir-huge-target',
      map: battleMap,
      characters: [hero],
      initiativeOrder,
      actorTokenId: behir.id,
      targetTokenId: hugeTarget.id,
      actionIndex: constrictIndex,
    })).toEqual({ ok: false, reason: 'invalid-target' })
  })

  it('uses Bugbear javelin melee damage at 5 feet and ranged damage at 30 feet', () => {
    const hero = character()
    const bugbear = token({
      id: 'bugbear',
      label: 'Bugbear',
      poolId: 'srd-5.1:bugbear',
      hp: 27,
      maxHp: 27,
    })
    const initiativeOrder = [
      { tokenId: bugbear.id, label: bugbear.label, emoji: '', color: '', roll: 20 },
      { tokenId: 'hero-token', label: hero.name, emoji: '', color: '', roll: 10 },
    ]
    const prepareAt = (x: number) => {
      const heroToken = token({
        id: 'hero-token',
        label: hero.name,
        type: 'player',
        characterId: hero.id,
        hp: hero.currentHp,
        maxHp: hero.maxHp,
        x,
      })
      const battleMap: BattleMap = {
        id: `bugbear-${x}`,
        name: 'Bugbear javelin',
        width: 200,
        height: 100,
        gridSize: 10,
        feetPerCell: 5,
        gridOffsetX: 0,
        gridOffsetY: 0,
        showGrid: true,
        tokens: [bugbear, heroToken],
      }
      return prepareDnd5eMonsterAttack({
        combatId: `combat-${x}`,
        map: battleMap,
        characters: [hero],
        initiativeOrder,
        actorTokenId: bugbear.id,
        targetTokenId: heroToken.id,
        actionIndex: 1,
      })
    }

    const melee = prepareAt(10)
    expect(melee.ok).toBe(true)
    if (!melee.ok) return
    expect(melee.prepared).toMatchObject({
      distanceFeet: 5,
      attackModes: ['normal'],
      attacks: [{
        id: 'javelin',
        attack: {
          mode: 'melee',
          damage: [{ count: 2, sides: 6, bonus: 2 }],
        },
      }],
    })
    const meleeResult = resolvePreparedDnd5eMonsterAttack({
      prepared: melee.prepared,
      rolls: [{ d20: 15, damageRolls: [[3, 4]] }],
    })
    expect(meleeResult.result.ok).toBe(true)
    expect(meleeResult.application?.characters[0].currentHp).toBe(31)

    const ranged = prepareAt(60)
    expect(ranged.ok).toBe(true)
    if (!ranged.ok) return
    expect(ranged.prepared).toMatchObject({
      distanceFeet: 30,
      attacks: [{
        id: 'javelin',
        attack: {
          mode: 'ranged',
          damage: [{ count: 1, sides: 6, bonus: 2 }],
        },
      }],
    })
    expect(resolvePreparedDnd5eMonsterAttack({
      prepared: ranged.prepared,
      rolls: [{ d20: 15, damageRolls: [[3, 4]] }],
    }).result).toMatchObject({ ok: false, reason: 'invalid-dice' })
    const rangedResult = resolvePreparedDnd5eMonsterAttack({
      prepared: ranged.prepared,
      rolls: [{ d20: 15, damageRolls: [[4]] }],
    })
    expect(rangedResult.result.ok).toBe(true)
    expect(rangedResult.application?.characters[0].currentHp).toBe(34)
  })

  it('uses two melee daggers for Cult Fanatic Multiattack but only one dagger at range', () => {
    const hero = character()
    const fanatic = token({
      id: 'cult-fanatic',
      label: 'Cult Fanatic',
      poolId: 'srd-5.1:cult-fanatic',
      hp: 22,
      maxHp: 22,
    })
    const initiativeOrder = [
      { tokenId: fanatic.id, label: fanatic.label, emoji: '', color: '', roll: 20 },
      { tokenId: 'hero-token', label: hero.name, emoji: '', color: '', roll: 10 },
    ]
    const prepareAt = (x: number, actionIndex: number) => {
      const heroToken = token({
        id: 'hero-token',
        label: hero.name,
        type: 'player',
        characterId: hero.id,
        hp: hero.currentHp,
        maxHp: hero.maxHp,
        x,
      })
      const battleMap: BattleMap = {
        id: `cult-fanatic-${x}-${actionIndex}`,
        name: 'Cult Fanatic dagger modes',
        width: 200,
        height: 100,
        gridSize: 10,
        feetPerCell: 5,
        gridOffsetX: 0,
        gridOffsetY: 0,
        showGrid: true,
        tokens: [fanatic, heroToken],
      }
      return prepareDnd5eMonsterAttack({
        combatId: `cult-fanatic-${x}-${actionIndex}`,
        map: battleMap,
        characters: [hero],
        initiativeOrder,
        actorTokenId: fanatic.id,
        targetTokenId: heroToken.id,
        actionIndex,
      })
    }

    const melee = prepareAt(10, 0)
    expect(melee.ok).toBe(true)
    if (!melee.ok) return
    expect(melee.prepared.action).toMatchObject({
      id: 'multiattack',
      sequenceAttackMode: 'melee',
    })
    expect(melee.prepared.attacks).toHaveLength(2)
    expect(melee.prepared.attacks.every(({ attack }) => attack.mode === 'melee')).toBe(true)

    const ranged = prepareAt(40, 1)
    expect(ranged.ok).toBe(true)
    if (!ranged.ok) return
    expect(ranged.prepared.action.id).toBe('dagger')
    expect(ranged.prepared.attacks).toHaveLength(1)
    expect(ranged.prepared.attacks[0]?.attack.mode).toBe('ranged')

    expect(prepareAt(40, 0)).toEqual({
      ok: false,
      reason: 'target-out-of-range',
    })
  })

  it('keeps explicit Barbed Devil attacks distinct from its Multiattack choices', () => {
    const hero = character()
    const monster = getDnd5eSrdMonster('srd-5.1:barbed-devil')!
    const barbedDevil = token({
      id: 'barbed-devil',
      label: monster.name,
      x: 0,
      poolId: monster.id,
      hp: monster.hitPoints.average,
      maxHp: monster.hitPoints.average,
    })
    const initiativeOrder = [
      { tokenId: barbedDevil.id, label: barbedDevil.label, emoji: '', color: '', roll: 20 },
      { tokenId: 'hero-token', label: hero.name, emoji: '', color: '', roll: 10 },
    ]
    const actionIndex = (actionId: string) =>
      monster.actions.findIndex((action) => action.id === actionId)
    const prepareAt = (x: number, actionId: string) => {
      const heroToken = token({
        id: 'hero-token',
        label: hero.name,
        x,
        type: 'player',
        characterId: hero.id,
        hp: hero.currentHp,
        maxHp: hero.maxHp,
      })
      const battleMap: BattleMap = {
        id: `barbed-devil-${actionId}-${x}`,
        name: 'Barbed Devil Multiattack modes',
        width: 400,
        height: 100,
        gridSize: 10,
        feetPerCell: 5,
        gridOffsetX: 0,
        gridOffsetY: 0,
        showGrid: true,
        tokens: [barbedDevil, heroToken],
      }
      return prepareDnd5eMonsterAttack({
        combatId: `barbed-devil-${actionId}-${x}`,
        map: battleMap,
        characters: [hero],
        initiativeOrder,
        actorTokenId: barbedDevil.id,
        targetTokenId: heroToken.id,
        actionIndex: actionIndex(actionId),
      })
    }

    const melee = prepareAt(10, 'multiattack')
    expect(melee.ok).toBe(true)
    if (!melee.ok) return
    expect(melee.prepared.action).toMatchObject({
      id: 'multiattack',
      kind: 'multiattack',
      automation: 'headless',
    })
    expect(melee.prepared.attacks.map((attack) => attack.id))
      .toEqual(['tail', 'claw', 'claw'])
    expect(melee.prepared.attacks.every(({ attack }) => attack.mode === 'melee')).toBe(true)

    for (const actionId of ['tail', 'claw']) {
      const child = prepareAt(10, actionId)
      expect(child.ok, actionId).toBe(true)
      if (!child.ok) continue
      expect(child.prepared.action.id).toBe(actionId)
      expect(child.prepared.attacks.map((attack) => attack.id)).toEqual([actionId])
    }

    const ranged = prepareAt(100, 'multiattack-hurl-flame')
    expect(ranged.ok).toBe(true)
    if (ranged.ok) {
      expect(ranged.prepared.action).toMatchObject({
        id: 'multiattack-hurl-flame',
        kind: 'multiattack',
        automation: 'headless',
      })
      expect(ranged.prepared.attacks.map((attack) => attack.id))
        .toEqual(['hurl-flame', 'hurl-flame'])
      expect(ranged.prepared.attacks.every(({ attack }) => attack.mode === 'ranged')).toBe(true)
    }

    const singleRanged = prepareAt(100, 'hurl-flame')
    expect(singleRanged.ok).toBe(true)
    if (singleRanged.ok) {
      expect(singleRanged.prepared.action.id).toBe('hurl-flame')
      expect(singleRanged.prepared.attacks.map((attack) => attack.id))
        .toEqual(['hurl-flame'])
    }

    expect(prepareAt(320, 'multiattack-hurl-flame')).toEqual({
      ok: false,
      reason: 'target-out-of-range',
    })
  })

  it('aligns the Headless turn to a monster outside the first initiative slot', () => {
    const hero = character()
    const monster = getDnd5eSrdMonster('srd-5.1:barbed-devil')!
    const heroToken = token({
      id: 'hero-token',
      x: 10,
      type: 'player',
      characterId: hero.id,
    })
    const barbedDevil = token({
      id: 'barbed-devil',
      label: '针刺魔',
      x: 0,
      poolId: 'srd-5.1:barbed-devil',
      hp: 110,
      maxHp: 110,
    })
    const battleMap: BattleMap = {
      id: 'later-initiative-map',
      name: 'Later initiative',
      width: 100,
      height: 100,
      gridSize: 10,
      feetPerCell: 5,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      tokens: [heroToken, barbedDevil],
    }
    const prepared = prepareDnd5eMonsterAttack({
      combatId: 'combat',
      map: battleMap,
      characters: [hero],
      initiativeOrder: [
        { tokenId: heroToken.id, label: heroToken.label, emoji: '', color: '', roll: 20 },
        { tokenId: barbedDevil.id, label: barbedDevil.label, emoji: '', color: '', roll: 10 },
      ],
      actorTokenId: barbedDevil.id,
      targetTokenId: heroToken.id,
      actionIndex: monster.actions.findIndex((action) => action.id === 'multiattack'),
    })

    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.state.initiativeIndex).toBe(1)
    expect(prepared.prepared.action.id).toBe('multiattack')
    expect(prepared.prepared.attacks.map((attack) => attack.id))
      .toEqual(['tail', 'claw', 'claw'])

    const resolved = resolvePreparedDnd5eMonsterAttack({
      prepared: prepared.prepared,
      rolls: [
        { d20: 12, damageRolls: [[3, 4]] },
        { d20: 12, damageRolls: [[3]] },
        { d20: 12, damageRolls: [[4]] },
      ],
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.result.events.filter((event) =>
      event.type === 'attack-resolved' &&
      event.actorId === barbedDevil.id &&
      event.targetId === heroToken.id)).toHaveLength(3)
  })

  it('applies Pack Tactics only while a conscious ally is within 5 feet of the target', () => {
    const hero = character()
    const wolf = token({ id: 'wolf', x: 0, poolId: 'srd-5.1:wolf' })
    const ally = token({ id: 'ally', x: 20, poolId: 'srd-5.1:wolf' })
    const heroToken = token({ id: 'hero-token', x: 10, type: 'player', characterId: hero.id })
    const map: BattleMap = {
      id: 'map', name: 'Map', width: 100, height: 100, gridSize: 10, feetPerCell: 5,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [wolf, ally, heroToken],
    }
    const prepared = prepareDnd5eMonsterAttack({
      combatId: 'combat', map, characters: [hero],
      initiativeOrder: [wolf, ally, heroToken].map((entry, index) => ({
        tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
      })),
      actorTokenId: wolf.id, targetTokenId: heroToken.id,
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.packTactics).toBe(true)
    expect(prepared.prepared.targetAttackMode).toBe('advantage')
  })

  it('cancels Pack Tactics when Bestow Curse gives attacks against its source disadvantage', () => {
    const hero = character()
    const heroToken = token({
      id: 'hero-token', x: 10, type: 'player', characterId: hero.id,
      hp: hero.currentHp, maxHp: hero.maxHp,
    })
    const curse = createDnd5eMechanicalEffect({
      definitionId: 'activity:bestow-curse:bestow-curse-attacks-against-source:modifiers:0',
      label: '降咒·攻击施法者劣势',
      tags: ['curse', 'bestow-curse', 'bestow-curse.attacks-against-source'],
      source: { kind: 'spell', actorId: heroToken.id, rulesId: 'bestow-curse', magical: true },
      targetId: 'wolf',
      duration: { type: 'rounds', remainingRounds: 14_400, tickOn: 'target-turn-end' },
    })
    const wolf = token({
      id: 'wolf', x: 0, poolId: 'srd-5.1:wolf',
      dnd5eCombatState: { activeEffects: [curse] },
    })
    const ally = token({ id: 'ally', x: 20, poolId: 'srd-5.1:wolf' })
    const map: BattleMap = {
      id: 'bestow-curse-pack-tactics-map', name: 'Bestow Curse pack tactics',
      width: 100, height: 100, gridSize: 10, feetPerCell: 5,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true,
      tokens: [wolf, ally, heroToken],
    }
    const prepared = prepareDnd5eMonsterAttack({
      combatId: 'bestow-curse-pack-tactics', map, characters: [hero],
      initiativeOrder: [wolf, ally, heroToken].map((entry, index) => ({
        tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
      })),
      actorTokenId: wolf.id, targetTokenId: heroToken.id,
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.packTactics).toBe(true)
    expect(prepared.prepared.attackModes[0]).toBe('normal')
    expect(prepared.prepared.targetAttackMode).toBe('normal')
  })

  it('applies a structured attack and damage bonus against frightened or stunned targets', () => {
    const hero = {
      ...character(),
      dnd5eCombatState: {
        activeEffects: [createDnd5eConditionEffect({
          condition: 'frightened',
          source: { kind: 'monster', actorId: 'fear-source', rulesId: 'test-fear' },
          targetId: 'hero-token',
        })],
      },
    }
    const draft = createDnd5eCustomMonsterDraft()
    draft.traits = [{
      ...createDnd5eCustomMonsterTraitDraft(),
      name: '恐惧支配',
      description: '攻击恐慌或震慑目标时攻击和伤害获得 +2。',
      ruleKind: 'conditional-target-bonus',
      targetBonusConditions: ['frightened', 'stunned'],
      targetAttackBonus: 2,
      targetDamageBonus: 2,
    }]
    const monster = buildDnd5eCustomMonster(draft)
    setDnd5eRoomMonsterCatalog([monster])
    const enemy = token({
      id: 'dominator',
      poolId: monster.id,
      hp: monster.hitPoints.average,
      maxHp: monster.hitPoints.average,
    })
    const heroToken = token({
      id: 'hero-token',
      type: 'player',
      characterId: hero.id,
      hp: hero.currentHp,
      maxHp: hero.maxHp,
    })
    const map: BattleMap = {
      id: 'domination-map', name: 'Domination', width: 100, height: 100, gridSize: 10,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [enemy, heroToken],
    }
    const prepared = prepareDnd5eMonsterAttack({
      combatId: 'combat', map, characters: [hero],
      initiativeOrder: [
        { tokenId: enemy.id, label: enemy.label, emoji: '', color: '', roll: 20 },
        { tokenId: heroToken.id, label: heroToken.label, emoji: '', color: '', roll: 10 },
      ],
      actorTokenId: enemy.id, targetTokenId: heroToken.id,
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.attacks[0].attack).toMatchObject({
      toHit: draft.actions[0].toHit + 2,
      damage: [expect.objectContaining({ bonus: 3 })],
    })

    const resolved = resolvePreparedDnd5eMonsterAttack({
      prepared: prepared.prepared,
      rolls: [{ d20: 15, damageRolls: [[4]] }],
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.application?.characters[0].currentHp).toBe(33)
  })

  it('prepares the owlbear multiattack and returns one authoritative map application', () => {
    const hero = character()
    const owlbear = token({ id: 'owlbear', label: '枭熊', poolId: 'srd-5.1:owlbear', hp: 59, maxHp: 59 })
    const heroToken = token({ id: 'hero-token', label: hero.name, type: 'player', characterId: hero.id, hp: 40, maxHp: 40 })
    const map: BattleMap = { id: 'map', name: 'Map', width: 100, height: 100, gridSize: 10, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [owlbear, heroToken] }
    const prepared = prepareDnd5eMonsterAttack({
      combatId: 'combat',
      map,
      characters: [hero],
      initiativeOrder: [
        { tokenId: owlbear.id, label: owlbear.label, emoji: '', color: '', roll: 20 },
        { tokenId: heroToken.id, label: heroToken.label, emoji: '', color: '', roll: 10 },
      ],
      actorTokenId: owlbear.id,
      targetTokenId: heroToken.id,
      actionIndex: getDnd5eSrdMonster('srd-5.1:owlbear')!.actions
        .findIndex((action) => action.id === 'multiattack'),
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.action.id).toBe('multiattack')
    expect(prepared.prepared.attacks.map((entry) => entry.id)).toEqual(['beak', 'claws'])
    expect(previewDnd5eMonsterAttack(prepared.prepared, 0, 10).hit).toBe(true)

    const firstOccurrence = resolvePreparedDnd5eMonsterAttack({
      prepared: prepared.prepared,
      rolls: [
        { d20: 10, damageRolls: [[5]] },
      ],
      settleAttackCount: 1,
    })
    expect(
      firstOccurrence.result.ok,
      firstOccurrence.result.ok ? undefined : firstOccurrence.result.reason,
    ).toBe(true)
    expect(firstOccurrence.application?.characters[0].currentHp).toBe(30)
    expect(firstOccurrence.result.events.filter((event) =>
      event.type === 'attack-resolved')).toHaveLength(1)
    expect(firstOccurrence.application?.map.tokens.find((entry) =>
      entry.id === owlbear.id)?.dnd5eCombatState?.monsterMultiattackContinuation)
      .toMatchObject({
        parentActionId: 'multiattack',
        nextOccurrenceIndex: 1,
        sequenceActionIds: ['beak', 'claws'],
      })

    const spentEconomy = spendDnd5eTurnResource(
      createDnd5eTurnEconomyCounts('combat:1:owlbear'),
      'action',
    ).economy
    const clawsIndex = getDnd5eSrdMonster('srd-5.1:owlbear')!.actions
      .findIndex((action) => action.id === 'claws')
    const continued = prepareDnd5eMonsterAttack({
      combatId: 'combat',
      map: firstOccurrence.application!.map,
      characters: firstOccurrence.application!.characters,
      initiativeOrder: [
        { tokenId: owlbear.id, label: owlbear.label, emoji: '', color: '', roll: 20 },
        { tokenId: heroToken.id, label: heroToken.label, emoji: '', color: '', roll: 10 },
      ],
      actorTokenId: owlbear.id,
      targetTokenId: heroToken.id,
      actionIndex: clawsIndex,
      multiattackContinuation: {
        schemaVersion: 1,
        parentActionId: 'multiattack',
        occurrenceIndex: 1,
      },
      turnEconomy: spentEconomy,
    })
    expect(continued.ok, continued.ok ? undefined : continued.reason).toBe(true)
    if (!continued.ok) return
    const continuedResult = resolvePreparedDnd5eMonsterAttack({
      prepared: continued.prepared,
      rolls: [{ d20: 10, damageRolls: [[4, 4]] }],
      multiattackContinuation: {
        schemaVersion: 1,
        parentActionId: 'multiattack',
        occurrenceIndex: 1,
      },
    })
    expect(
      continuedResult.result.ok,
      continuedResult.result.ok ? undefined : continuedResult.result.reason,
    ).toBe(true)
    expect(continuedResult.application?.characters[0].currentHp).toBe(17)
    expect(continuedResult.application?.map.tokens.find((entry) =>
      entry.id === owlbear.id)?.dnd5eCombatState?.monsterMultiattackContinuation)
      .toBeUndefined()

    const resolved = resolvePreparedDnd5eMonsterAttack({
      prepared: prepared.prepared,
      rolls: [
        { d20: 10, damageRolls: [[5]] },
        { d20: 10, damageRolls: [[4, 4]] },
      ],
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.application?.characters[0].currentHp).toBe(17)
    expect(resolved.application?.changedCharacterIds).toEqual([hero.id])
    expect(resolved.application?.changedTokenIds).toEqual(['owlbear', heroToken.id])
  })

  it('preserves an owlbear Multiattack continuation across movement after its action is spent', () => {
    const hero = character()
    const monster = getDnd5eSrdMonster('srd-5.1:owlbear')!
    const owlbear = token({
      id: 'takeover-owlbear',
      label: '枭熊',
      poolId: monster.id,
      x: 5,
      y: 5,
      hp: 59,
      maxHp: 59,
    })
    const heroToken = token({
      id: 'takeover-hero-token',
      label: hero.name,
      type: 'player',
      characterId: hero.id,
      x: 15,
      y: 5,
      hp: hero.currentHp,
      maxHp: hero.maxHp,
    })
    const map: BattleMap = {
      id: 'takeover-multiattack-map',
      name: 'Takeover Multiattack',
      width: 100,
      height: 100,
      gridSize: 10,
      feetPerCell: 5,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      tokens: [owlbear, heroToken],
    }
    const initiativeOrder = [
      { tokenId: owlbear.id, label: owlbear.label, emoji: '', color: '', roll: 20 },
      { tokenId: heroToken.id, label: heroToken.label, emoji: '', color: '', roll: 10 },
    ]
    const multiattackIndex = monster.actions.findIndex((action) => action.id === 'multiattack')
    const clawsIndex = monster.actions.findIndex((action) => action.id === 'claws')
    const prepared = prepareDnd5eMonsterAttack({
      combatId: 'takeover-combat',
      round: 1,
      map,
      characters: [hero],
      initiativeOrder,
      actorTokenId: owlbear.id,
      targetTokenId: heroToken.id,
      actionIndex: multiattackIndex,
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return

    const firstOccurrence = resolvePreparedDnd5eMonsterAttack({
      prepared: prepared.prepared,
      rolls: [{ d20: 10, damageRolls: [[5]] }],
      settleAttackCount: 1,
    })
    expect(
      firstOccurrence.result.ok,
      firstOccurrence.result.ok ? undefined : firstOccurrence.result.reason,
    ).toBe(true)
    if (!firstOccurrence.result.ok || !firstOccurrence.application) return
    const spentEconomy = spendDnd5eTurnResource(
      createDnd5eTurnEconomyCounts('takeover-combat:1:takeover-owlbear', 30),
      'action',
    ).economy
    expect(spentEconomy.action.current).toBe(0)
    expect(firstOccurrence.application.map.tokens.find((entry) => entry.id === owlbear.id)
      ?.dnd5eCombatState?.monsterMultiattackContinuation).toMatchObject({
        parentActionId: 'multiattack',
        nextOccurrenceIndex: 1,
        sequenceActionIds: ['beak', 'claws'],
      })

    const moved = resolveDnd5eMonsterMapMove({
      combatId: 'takeover-combat',
      round: 1,
      map: firstOccurrence.application.map,
      characters: firstOccurrence.application.characters,
      initiativeOrder,
      actorTokenId: owlbear.id,
      to: { x: 5, y: 15 },
      turnEconomy: spentEconomy,
    })
    expect(moved.ok, moved.ok ? undefined : moved.reason).toBe(true)
    if (!moved.ok || !moved.result.ok || !moved.application) return
    expect(moved.result.state.combatants[owlbear.id].turn).toMatchObject({
      actionAvailable: false,
      movementRemaining: 25,
    })
    expect(moved.application.map.tokens.find((entry) => entry.id === owlbear.id)).toMatchObject({
      x: 5,
      y: 15,
      dnd5eCombatState: {
        monsterMultiattackContinuation: {
          parentActionId: 'multiattack',
          nextOccurrenceIndex: 1,
        },
      },
    })

    const continued = prepareDnd5eMonsterAttack({
      combatId: 'takeover-combat',
      round: 1,
      map: moved.application.map,
      characters: moved.application.characters,
      initiativeOrder,
      actorTokenId: owlbear.id,
      targetTokenId: heroToken.id,
      actionIndex: clawsIndex,
      multiattackContinuation: {
        schemaVersion: 1,
        parentActionId: 'multiattack',
        occurrenceIndex: 1,
      },
      turnEconomy: {
        ...spentEconomy,
        movement: {
          ...spentEconomy.movement,
          current: moved.result.state.combatants[owlbear.id].turn.movementRemaining,
        },
      },
    })
    expect(continued.ok, continued.ok ? undefined : continued.reason).toBe(true)
    if (!continued.ok) return
    const continuedResult = resolvePreparedDnd5eMonsterAttack({
      prepared: continued.prepared,
      rolls: [{ d20: 10, damageRolls: [[4, 4]] }],
      multiattackContinuation: {
        schemaVersion: 1,
        parentActionId: 'multiattack',
        occurrenceIndex: 1,
      },
    })
    expect(
      continuedResult.result.ok,
      continuedResult.result.ok ? undefined : continuedResult.result.reason,
    ).toBe(true)
    expect(continuedResult.result.events.filter((event) =>
      event.type === 'turn-resource-spent' && event.resource === 'action')).toHaveLength(0)
    expect(continuedResult.application?.map.tokens.find((entry) => entry.id === owlbear.id)
      ?.dnd5eCombatState?.monsterMultiattackContinuation).toBeUndefined()
  })

  it('applies Enlarge weapon damage to an SRD monster attack', () => {
    const hero = character()
    const wolf = token({
      id: 'wolf', poolId: 'srd-5.1:wolf', hp: 11, maxHp: 11,
      dnd5eCombatState: {
        activeEffects: [createDnd5eMechanicalEffect({
          definitionId: 'srd-5.1:spell:enlarge-reduce', label: '变巨', targetId: 'wolf',
          source: { kind: 'spell', actorId: 'wizard', rulesId: 'enlarge-reduce' },
          modifiers: { sizeRankDelta: 1, strengthRollMode: 'advantage', weaponDamageD4: 'add' },
        })],
      },
    })
    const heroToken = token({
      id: 'hero-token', label: hero.name, type: 'player', characterId: hero.id, hp: 40, maxHp: 40,
    })
    const map: BattleMap = {
      id: 'map', name: 'Map', width: 100, height: 100, gridSize: 10,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [wolf, heroToken],
    }
    const prepared = prepareDnd5eMonsterAttack({
      combatId: 'combat', map, characters: [hero],
      initiativeOrder: [
        { tokenId: wolf.id, label: wolf.label, emoji: '', color: '', roll: 20 },
        { tokenId: heroToken.id, label: heroToken.label, emoji: '', color: '', roll: 10 },
      ],
      actorTokenId: wolf.id, targetTokenId: heroToken.id,
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.sizeDamageD4Mode).toBe('add')
    const resolved = resolvePreparedDnd5eMonsterAttack({
      prepared: prepared.prepared,
      rolls: [{ d20: 15, damageRolls: [[3, 3]], sizeDamageRolls: [4] }],
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.characters[0].currentHp).toBe(28)
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'class-damage-applied', actorId: wolf.id, source: 'enlarge', amount: 4,
    }))
  })

  it('executes a V2 after-hit damage and condition mechanism through the authoritative attack transaction', () => {
    const hero = character()
    const draft = createDnd5eCustomMonsterDraft()
    draft.name = '烬爪'
    draft.headlessMechanics = [{
      ...createDnd5eCustomMonsterMechanicDraft(),
      id: 'burning-strike',
      name: '灼热追击',
      trigger: 'after-hit',
      effectKind: 'damage',
      effectTarget: 'trigger-target',
      healingDice: '1d6',
      damageType: 'fire',
      hpPercentageAtOrBelow: 100,
      limit: 'once-per-turn',
      preservedEffects: [
        { id: 'effect-0', kind: 'damage', target: 'trigger-target', dice: { count: 1, sides: 6, bonus: 0 }, damageType: 'fire' },
        { id: 'frighten', kind: 'standard-condition', target: 'trigger-target', condition: 'frightened', duration: { kind: 'rounds', rounds: 1 } },
      ],
    }]
    const monster = buildDnd5eCustomMonster(draft)
    setDnd5eRoomMonsterCatalog([monster])
    const enemy = token({ id: 'ember-claw', label: monster.name, poolId: monster.id, hp: monster.hitPoints.average, maxHp: monster.hitPoints.average })
    const heroToken = token({ id: 'hero-token', label: hero.name, type: 'player', characterId: hero.id, hp: 40, maxHp: 40 })
    const map: BattleMap = {
      id: 'map', name: 'Map', width: 100, height: 100, gridSize: 10,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [enemy, heroToken],
    }
    const prepared = prepareDnd5eMonsterAttack({
      combatId: 'combat', map, characters: [hero],
      initiativeOrder: [
        { tokenId: enemy.id, label: enemy.label, emoji: '', color: '', roll: 20 },
        { tokenId: heroToken.id, label: heroToken.label, emoji: '', color: '', roll: 10 },
      ],
      actorTokenId: enemy.id, targetTokenId: heroToken.id,
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepareDnd5eMonsterAfterHitMechanics(prepared.prepared, true)).toEqual([expect.objectContaining({
      mechanicId: 'burning-strike', targetId: heroToken.id,
      effects: [{ effectId: 'effect-0', effectName: '额外伤害', count: 1, sides: 6, bonus: 0 }],
    })])
    const pendingResolution = resolvePreparedDnd5eMonsterAttack({
      prepared: prepared.prepared,
      rolls: [{ d20: 15, damageRolls: [[4]] }],
    }).result
    expect(pendingResolution).toMatchObject({ ok: true })
    expect(pendingResolution.events).toContainEqual(expect.objectContaining({
      type: 'monster-mechanic-trigger-pending',
      snapshot: expect.objectContaining({ mechanicId: 'burning-strike', triggerTargetId: heroToken.id }),
    }))
    expect(resolvePreparedDnd5eMonsterAttack({
      prepared: prepared.prepared,
      rolls: [{ d20: 15, damageRolls: [[4]] }],
      mechanicRolls: [{
        actorId: enemy.id,
        mechanicId: 'burning-strike',
        targetId: enemy.id,
        effectRolls: [{ effectId: 'effect-0', rolls: [5] }],
      }],
    }).result).toMatchObject({ ok: false, reason: 'invalid-dice' })

    const resolved = resolvePreparedDnd5eMonsterAttack({
      prepared: prepared.prepared,
      rolls: [{ d20: 15, damageRolls: [[4]] }],
      mechanicRolls: [{
        actorId: enemy.id,
        mechanicId: 'burning-strike',
        targetId: heroToken.id,
        effectRolls: [{ effectId: 'effect-0', rolls: [5] }],
      }],
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.application?.characters[0].currentHp).toBe(30)
    expect(resolved.application?.characters[0].conditions).toContain('frightened')
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'monster-mechanic-v2-triggered', actorId: enemy.id, mechanicId: 'burning-strike', trigger: 'after-hit',
    }))
  })

  it('uses a custom critical range and validates critical-only extra damage dice', () => {
    const hero = character()
    const draft = createDnd5eCustomMonsterDraft()
    draft.actions[0].criticalThreshold = 19
    draft.actions[0].criticalExtraDamage = [{
      id: 'brutal',
      dice: '1d6',
      damageType: 'slashing',
    }]
    const monster = buildDnd5eCustomMonster(draft)
    setDnd5eRoomMonsterCatalog([monster])
    const enemy = token({
      id: 'critical-monster',
      poolId: monster.id,
      hp: monster.hitPoints.average,
      maxHp: monster.hitPoints.average,
    })
    const heroToken = token({
      id: 'hero-token',
      type: 'player',
      characterId: hero.id,
      hp: hero.currentHp,
      maxHp: hero.maxHp,
    })
    const map: BattleMap = {
      id: 'critical-map',
      name: 'Critical map',
      width: 100,
      height: 100,
      gridSize: 10,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      tokens: [enemy, heroToken],
    }
    const prepared = prepareDnd5eMonsterAttack({
      combatId: 'combat',
      map,
      characters: [hero],
      initiativeOrder: [enemy, heroToken].map((entry, index) => ({
        tokenId: entry.id,
        label: entry.label,
        emoji: '',
        color: '',
        roll: 20 - index,
      })),
      actorTokenId: enemy.id,
      targetTokenId: heroToken.id,
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(previewDnd5eMonsterAttack(prepared.prepared, 0, 19).critical).toBe(true)
    expect(resolvePreparedDnd5eMonsterAttack({
      prepared: prepared.prepared,
      rolls: [{ d20: 19, damageRolls: [[4, 3]] }],
    }).result).toMatchObject({ ok: false, reason: 'invalid-dice' })

    const resolved = resolvePreparedDnd5eMonsterAttack({
      prepared: prepared.prepared,
      rolls: [{ d20: 19, damageRolls: [[4, 3], [6]] }],
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved',
      critical: true,
    }))
    expect(resolved.application?.characters[0].currentHp).toBe(26)
  })

  it('removes a standard condition through an after-hit Headless mechanism', () => {
    const hero = { ...character(), conditions: ['frightened'] }
    const draft = createDnd5eCustomMonsterDraft()
    draft.headlessMechanics = [{
      ...createDnd5eCustomMonsterMechanicDraft(),
      id: 'rallying-hit',
      name: 'Rallying Hit',
      trigger: 'after-hit',
      hpPercentageAtOrBelow: 100,
      effectKind: 'remove-standard-condition',
      effectTarget: 'trigger-target',
      condition: 'frightened',
    }]
    const monster = buildDnd5eCustomMonster(draft)
    setDnd5eRoomMonsterCatalog([monster])
    const enemy = token({ id: 'rally-monster', poolId: monster.id })
    const heroToken = token({
      id: 'hero-token',
      type: 'player',
      hp: hero.currentHp,
      maxHp: hero.maxHp,
      dnd5eCombatState: {
        activeEffects: [createDnd5eConditionEffect({
          condition: 'frightened',
          source: { kind: 'monster', actorId: 'fear-source', rulesId: 'test-fear' },
          targetId: 'hero-token',
        })],
      },
    })
    const map: BattleMap = {
      id: 'rally-map',
      name: 'Rally map',
      width: 100,
      height: 100,
      gridSize: 10,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      tokens: [enemy, heroToken],
    }
    const prepared = prepareDnd5eMonsterAttack({
      combatId: 'combat',
      map,
      characters: [hero],
      initiativeOrder: [enemy, heroToken].map((entry, index) => ({
        tokenId: entry.id,
        label: entry.label,
        emoji: '',
        color: '',
        roll: 20 - index,
      })),
      actorTokenId: enemy.id,
      targetTokenId: heroToken.id,
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(previewDnd5eMonsterAttack(prepared.prepared, 0, 15).hit).toBe(true)
    expect(prepareDnd5eMonsterAfterHitMechanics(prepared.prepared, true)).toEqual([
      expect.objectContaining({ mechanicId: 'rallying-hit', targetId: heroToken.id, effects: [] }),
    ])
    const resolved = resolvePreparedDnd5eMonsterAttack({
      prepared: prepared.prepared,
      rolls: [{ d20: 15, damageRolls: [[4]] }],
      mechanicRolls: [{
        actorId: enemy.id,
        mechanicId: 'rallying-hit',
        targetId: heroToken.id,
        effectRolls: [],
      }],
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.result.state.combatants[heroToken.id].conditions).not.toContain('frightened')
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'monster-mechanic-v2-triggered',
      mechanicId: 'rallying-hit',
      outcomes: [expect.objectContaining({
        kind: 'remove-standard-condition',
        condition: 'frightened',
        applied: true,
      })],
    }))
  })

  it('uses one target reaction to halve one attack in a monster Multiattack', () => {
    const rogue: Character = {
      ...character(), rulesetId: 'dnd5e-2014-srd-5.1', charClass: '游荡者', level: 5,
    }
    const owlbear = token({ id: 'owlbear', label: '枭熊', poolId: 'srd-5.1:owlbear', hp: 59, maxHp: 59 })
    const rogueToken = token({ id: 'hero-token', label: rogue.name, type: 'player', characterId: rogue.id, hp: 40, maxHp: 40 })
    const map: BattleMap = {
      id: 'map', name: 'Map', width: 100, height: 100, gridSize: 10,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [owlbear, rogueToken],
    }
    const prepared = prepareDnd5eMonsterAttack({
      combatId: 'combat', map, characters: [rogue],
      initiativeOrder: [
        { tokenId: owlbear.id, label: owlbear.label, emoji: '', color: '', roll: 20 },
        { tokenId: rogueToken.id, label: rogueToken.label, emoji: '', color: '', roll: 10 },
      ],
      actorTokenId: owlbear.id,
      targetTokenId: rogueToken.id,
      actionIndex: getDnd5eSrdMonster('srd-5.1:owlbear')!.actions
        .findIndex((action) => action.id === 'multiattack'),
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eMonsterAttack({
      prepared: prepared.prepared,
      rolls: [
        { d20: 10, uncannyDodge: true, damageRolls: [[5]] },
        { d20: 10, damageRolls: [[4, 4]] },
      ],
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.characters[0].currentHp).toBe(22)
    expect(resolved.result.events).toContainEqual({
      type: 'turn-resource-spent', actorId: rogueToken.id, resource: 'reaction',
    })
  })

  it('lets a nearby Lore Bard use Cutting Words against an SRD monster attack', () => {
    const hero = character()
    const bard: Character = {
      ...character(), id: 'bard', name: '吟游诗人', rulesetId: 'dnd5e-2014-srd-5.1',
      charClass: '吟游诗人', level: 5,
      dnd5eClassChoices: { classes: { bard: { subclass: 'lore', selections: {} } } },
      classResources: { 'dnd5e-bardic-inspiration': { current: 2, max: 3 } },
    }
    const owlbear = token({ id: 'owlbear', label: '枭熊', poolId: 'srd-5.1:owlbear', hp: 59, maxHp: 59 })
    const heroToken = token({ id: 'hero-token', label: hero.name, type: 'player', characterId: hero.id, hp: 40, maxHp: 40 })
    const bardToken = token({ id: 'bard-token', label: bard.name, type: 'player', characterId: bard.id, hp: 40, maxHp: 40 })
    const map: BattleMap = {
      id: 'map', name: 'Map', width: 100, height: 100, gridSize: 10,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [owlbear, heroToken, bardToken],
    }
    const prepared = prepareDnd5eMonsterAttack({
      combatId: 'combat', map, characters: [hero, bard],
      initiativeOrder: [
        { tokenId: owlbear.id, label: owlbear.label, emoji: '', color: '', roll: 20 },
        { tokenId: bardToken.id, label: bardToken.label, emoji: '', color: '', roll: 15 },
        { tokenId: heroToken.id, label: heroToken.label, emoji: '', color: '', roll: 10 },
      ],
      actorTokenId: owlbear.id,
      targetTokenId: heroToken.id,
      actionIndex: getDnd5eSrdMonster('srd-5.1:owlbear')!.actions
        .findIndex((action) => action.id === 'multiattack'),
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eMonsterAttack({
      prepared: prepared.prepared,
      rolls: [{
        d20: 10,
        cuttingWords: { bardId: bardToken.id, roll: 8, distanceFeet: 30 },
        damageRolls: [[]],
      }, {
        d20: 1,
        damageRolls: [[], []],
      }],
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.application?.characters.find((entry) => entry.id === hero.id)?.currentHp).toBe(40)
    expect(resolved.application?.characters.find((entry) => entry.id === bard.id)?.classResources?.['dnd5e-bardic-inspiration']).toEqual({ current: 1, max: 3 })
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved', actorId: owlbear.id, targetId: heroToken.id, total: 9, hit: false,
    }))
  })

  it('applies Cutting Words to an SRD monster damage roll before target defenses', () => {
    const hero = character()
    const bard: Character = {
      ...character(), id: 'bard', name: '吟游诗人', rulesetId: 'dnd5e-2014-srd-5.1',
      charClass: '吟游诗人', level: 5,
      dnd5eClassChoices: { classes: { bard: { subclass: 'lore', selections: {} } } },
      classResources: { 'dnd5e-bardic-inspiration': { current: 2, max: 3 } },
    }
    const owlbear = token({ id: 'owlbear', label: '枭熊', poolId: 'srd-5.1:owlbear', hp: 59, maxHp: 59 })
    const heroToken = token({ id: 'hero-token', label: hero.name, type: 'player', characterId: hero.id, hp: 40, maxHp: 40 })
    const bardToken = token({ id: 'bard-token', label: bard.name, type: 'player', characterId: bard.id, hp: 40, maxHp: 40 })
    const map: BattleMap = {
      id: 'map', name: 'Map', width: 100, height: 100, gridSize: 10,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [owlbear, heroToken, bardToken],
    }
    const prepared = prepareDnd5eMonsterAttack({
      combatId: 'combat', map, characters: [hero, bard],
      initiativeOrder: [
        { tokenId: owlbear.id, label: owlbear.label, emoji: '', color: '', roll: 20 },
        { tokenId: bardToken.id, label: bardToken.label, emoji: '', color: '', roll: 15 },
        { tokenId: heroToken.id, label: heroToken.label, emoji: '', color: '', roll: 10 },
      ],
      actorTokenId: owlbear.id,
      targetTokenId: heroToken.id,
      actionIndex: getDnd5eSrdMonster('srd-5.1:owlbear')!.actions
        .findIndex((action) => action.id === 'multiattack'),
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eMonsterAttack({
      prepared: prepared.prepared,
      rolls: [{
        d20: 10,
        cuttingWordsDamage: { bardId: bardToken.id, roll: 3, distanceFeet: 30 },
        damageRolls: [[5]],
      }, {
        d20: 1,
        damageRolls: [[], []],
      }],
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.application?.characters.find((entry) => entry.id === hero.id)?.currentHp).toBe(33)
    expect(resolved.application?.characters.find((entry) => entry.id === bard.id)?.classResources?.['dnd5e-bardic-inspiration']).toEqual({ current: 1, max: 3 })
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'class-state-changed', actorId: bardToken.id, targetId: owlbear.id,
      stateKey: 'cutting-words', value: 3,
    }))
  })

  it('lets Shield turn the triggering hit and later attacks in the same Multiattack into misses', () => {
    const wizard: Character = {
      ...character(), rulesetId: 'dnd5e-2014-srd-5.1', charClass: '法师', level: 1, ac: 14,
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': ['shield'] } } } },
      classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 2 } },
    }
    const owlbear = token({ id: 'owlbear', label: '枭熊', poolId: 'srd-5.1:owlbear', hp: 59, maxHp: 59 })
    const wizardToken = token({ id: 'hero-token', label: wizard.name, type: 'player', characterId: wizard.id, hp: 40, maxHp: 40 })
    const map: BattleMap = {
      id: 'map', name: 'Map', width: 100, height: 100, gridSize: 10,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [owlbear, wizardToken],
    }
    const prepared = prepareDnd5eMonsterAttack({
      combatId: 'combat', map, characters: [wizard],
      initiativeOrder: [
        { tokenId: owlbear.id, label: owlbear.label, emoji: '', color: '', roll: 20 },
        { tokenId: wizardToken.id, label: wizardToken.label, emoji: '', color: '', roll: 10 },
      ],
      actorTokenId: owlbear.id,
      targetTokenId: wizardToken.id,
      actionIndex: getDnd5eSrdMonster('srd-5.1:owlbear')!.actions
        .findIndex((action) => action.id === 'multiattack'),
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eMonsterAttack({
      prepared: prepared.prepared,
      rolls: [
        { d20: 9, shieldSpellReaction: true, damageRolls: [[]] },
        { d20: 9, damageRolls: [[], []] },
      ],
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.characters[0].currentHp).toBe(40)
    expect(resolved.result.events.filter((event) => event.type === 'attack-resolved')).toEqual([
      expect.objectContaining({ armorClass: 17, hit: false }),
      expect.objectContaining({ armorClass: 17, hit: false }),
    ])
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'class-state-changed', actorId: wizardToken.id, stateKey: 'shield-spell', active: true,
    }))
  })

  it('lets an adjacent shield bearer impose disadvantage with Protection', () => {
    const hero = character()
    const protector: Character = {
      ...character(), id: 'protector', name: '守卫', rulesetId: 'dnd5e-2014-srd-5.1',
      charClass: '战士', equipment: { offHand: DND5E_SHIELD },
      dnd5eClassChoices: { fighter: { fightingStyles: ['protection'] } },
    }
    const owlbear = token({ id: 'owlbear', label: '枭熊', poolId: 'srd-5.1:owlbear', hp: 59, maxHp: 59 })
    const heroToken = token({ id: 'hero-token', label: hero.name, type: 'player', characterId: hero.id, hp: 40, maxHp: 40 })
    const protectorToken = token({ id: 'protector-token', label: protector.name, type: 'player', characterId: protector.id, hp: 40, maxHp: 40 })
    const map: BattleMap = {
      id: 'map', name: 'Map', width: 100, height: 100, gridSize: 10,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [owlbear, heroToken, protectorToken],
    }
    const prepared = prepareDnd5eMonsterAttack({
      combatId: 'combat', map, characters: [hero, protector],
      initiativeOrder: [
        { tokenId: owlbear.id, label: owlbear.label, emoji: '', color: '', roll: 20 },
        { tokenId: protectorToken.id, label: protectorToken.label, emoji: '', color: '', roll: 15 },
        { tokenId: heroToken.id, label: heroToken.label, emoji: '', color: '', roll: 10 },
      ],
      actorTokenId: owlbear.id,
      targetTokenId: heroToken.id,
      actionIndex: getDnd5eSrdMonster('srd-5.1:owlbear')!.actions
        .findIndex((action) => action.id === 'multiattack'),
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(previewDnd5eMonsterAttack(prepared.prepared, 0, 18, 2, true).hit).toBe(false)
    const resolved = resolvePreparedDnd5eMonsterAttack({
      prepared: prepared.prepared,
      rolls: [
        { d20: 18, d20Second: 2, protectionReactionActorId: protectorToken.id, damageRolls: [[]] },
        { d20: 2, damageRolls: [[], []] },
      ],
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.result.events).toContainEqual({
      type: 'turn-resource-spent', actorId: protectorToken.id, resource: 'reaction',
    })
    expect(resolved.application?.characters.find((entry) => entry.id === hero.id)?.currentHp).toBe(40)
  })

  it('rejects an SRD melee action when the map target is outside its reach', () => {
    const hero = character()
    const owlbear = token({ id: 'owlbear', label: '枭熊', poolId: 'srd-5.1:owlbear', hp: 59, maxHp: 59 })
    const heroToken = token({ id: 'hero-token', label: hero.name, type: 'player', characterId: hero.id, hp: 40, maxHp: 40, x: 90 })
    const map: BattleMap = { id: 'map', name: 'Map', width: 100, height: 100, gridSize: 10, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [owlbear, heroToken] }
    const prepared = prepareDnd5eMonsterAttack({
      combatId: 'combat', map, characters: [hero],
      initiativeOrder: [
        { tokenId: owlbear.id, label: owlbear.label, emoji: '', color: '', roll: 20 },
        { tokenId: heroToken.id, label: heroToken.label, emoji: '', color: '', roll: 10 },
      ],
      actorTokenId: owlbear.id, targetTokenId: heroToken.id, actionIndex: 1,
    })
    expect(prepared).toEqual({ ok: false, reason: 'target-out-of-range' })
  })

  it('forces advantage against a Barbarian who used Reckless Attack', () => {
    const hero = {
      ...character(),
      rulesetId: 'dnd5e-2014-srd-5.1' as const,
      charClass: '野蛮人',
      dnd5eCombatState: { recklessAttackTurnKey: 'combat:1:hero-token' },
    }
    const owlbear = token({ id: 'owlbear', label: '枭熊', poolId: 'srd-5.1:owlbear', hp: 59, maxHp: 59 })
    const heroToken = token({ id: 'hero-token', label: hero.name, type: 'player', characterId: hero.id, hp: 40, maxHp: 40 })
    const map: BattleMap = { id: 'map', name: 'Map', width: 100, height: 100, gridSize: 10, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [owlbear, heroToken] }
    const prepared = prepareDnd5eMonsterAttack({
      combatId: 'combat', round: 1, map, characters: [hero],
      initiativeOrder: [
        { tokenId: owlbear.id, label: owlbear.label, emoji: '', color: '', roll: 20 },
        { tokenId: heroToken.id, label: heroToken.label, emoji: '', color: '', roll: 10 },
      ],
      actorTokenId: owlbear.id, targetTokenId: heroToken.id, actionIndex: 1,
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.targetAttackMode).toBe('advantage')
    expect(previewDnd5eMonsterAttack(prepared.prepared, 0, 2, 18).roll.d20).toBe(18)
  })

  it('forces disadvantage against Patient Defense and cancels it against Reckless Attack advantage', () => {
    const baseHero = {
      ...character(),
      rulesetId: 'dnd5e-2014-srd-5.1' as const,
      charClass: '武僧',
      dnd5eCombatState: { dodgingTurnKey: 'combat:1:hero-token' },
    }
    const owlbear = token({ id: 'owlbear', label: '枭熊', poolId: 'srd-5.1:owlbear', hp: 59, maxHp: 59 })
    const heroToken = token({ id: 'hero-token', label: baseHero.name, type: 'player', characterId: baseHero.id, hp: 40, maxHp: 40 })
    const map: BattleMap = { id: 'map', name: 'Map', width: 100, height: 100, gridSize: 10, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [owlbear, heroToken] }
    const prepare = (hero: Character) => prepareDnd5eMonsterAttack({
      combatId: 'combat', round: 1, map, characters: [hero],
      initiativeOrder: [
        { tokenId: owlbear.id, label: owlbear.label, emoji: '', color: '', roll: 20 },
        { tokenId: heroToken.id, label: heroToken.label, emoji: '', color: '', roll: 10 },
      ],
      actorTokenId: owlbear.id, targetTokenId: heroToken.id, actionIndex: 1,
    })
    const dodging = prepare(baseHero)
    expect(dodging.ok).toBe(true)
    if (!dodging.ok) return
    expect(dodging.prepared.targetAttackMode).toBe('disadvantage')
    expect(previewDnd5eMonsterAttack(dodging.prepared, 0, 18, 2).roll.d20).toBe(2)

    const cancelled = prepare({
      ...baseHero,
      dnd5eCombatState: { ...baseHero.dnd5eCombatState, recklessAttackTurnKey: 'combat:1:hero-token' },
    })
    expect(cancelled.ok).toBe(true)
    if (!cancelled.ok) return
    expect(cancelled.prepared.targetAttackMode).toBe('normal')
  })

  it('grants monster attacks advantage against a stunned player target', () => {
    const hero = {
      ...character(),
      rulesetId: 'dnd5e-2014-srd-5.1' as const,
      charClass: '武僧',
      dnd5eCombatState: {
        stunnedByActorId: 'monk-token',
        stunnedAppliedTurnKey: 'combat:1:monk-token',
      },
    }
    const owlbear = token({ id: 'owlbear', label: '枭熊', poolId: 'srd-5.1:owlbear', hp: 59, maxHp: 59 })
    const heroToken = token({ id: 'hero-token', label: hero.name, type: 'player', characterId: hero.id, hp: 40, maxHp: 40 })
    const map: BattleMap = { id: 'map', name: 'Map', width: 100, height: 100, gridSize: 10, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [owlbear, heroToken] }
    const prepared = prepareDnd5eMonsterAttack({
      combatId: 'combat', round: 1, map, characters: [hero],
      initiativeOrder: [
        { tokenId: owlbear.id, label: owlbear.label, emoji: '', color: '', roll: 20 },
        { tokenId: heroToken.id, label: heroToken.label, emoji: '', color: '', roll: 10 },
      ],
      actorTokenId: owlbear.id, targetTokenId: heroToken.id, actionIndex: 1,
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.targetAttackMode).toBe('advantage')
    expect(previewDnd5eMonsterAttack(prepared.prepared, 0, 2, 18).roll.d20).toBe(18)
  })

  it('uses a player Druid\'s active Wild Shape stat block for map attacks', () => {
    const druid: Character = {
      ...character(),
      id: 'druid',
      rulesetId: 'dnd5e-2014-srd-5.1',
      charClass: '德鲁伊',
      level: 2,
      currentHp: 30,
      maxHp: 30,
      dnd5eClassChoices: { classes: { druid: { selections: { 'wild-shape-known-forms': ['srd-5.1:wolf'] } } } },
      dnd5eCombatState: {
        wildShapeFormId: 'srd-5.1:wolf', wildShapeCurrentHp: 11, wildShapeRoundsRemaining: 600,
        wildShapeOriginalCurrentHp: 30, wildShapeOriginalMaxHp: 30, wildShapeOriginalArmorClass: 16,
        wildShapeOriginalSpeed: 30, wildShapeOriginalAbilities: character().abilities,
        wildShapeOriginalSavingThrowBonuses: { str: 3, dex: 2, con: 2, int: 0, wis: 0, cha: 0 },
      },
    }
    const druidToken = token({ id: 'druid-token', label: druid.name, type: 'player', characterId: druid.id, hp: 11, maxHp: 11 })
    const goblin = token({ id: 'goblin-token', label: '哥布林', poolId: 'srd-5.1:goblin', hp: 7, maxHp: 7 })
    const map: BattleMap = {
      id: 'map', name: 'Map', width: 100, height: 100, gridSize: 10,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [druidToken, goblin],
    }
    const prepared = prepareDnd5eMonsterAttack({
      combatId: 'combat', map, characters: [druid],
      initiativeOrder: [
        { tokenId: druidToken.id, label: druidToken.label, emoji: '', color: '', roll: 20 },
        { tokenId: goblin.id, label: goblin.label, emoji: '', color: '', roll: 10 },
      ],
      actorTokenId: druidToken.id, targetTokenId: goblin.id, actionIndex: 0,
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.monster.id).toBe('srd-5.1:wolf')
    expect(prepared.prepared.action.id).toBe('bite')
    const resolved = resolvePreparedDnd5eMonsterAttack({
      prepared: prepared.prepared,
      rolls: [{ d20: 20, damageRolls: [[4, 4, 4, 4]] }],
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === goblin.id)?.hp).toBe(0)
  })
})
