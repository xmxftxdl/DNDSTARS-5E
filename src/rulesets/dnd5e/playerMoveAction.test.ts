import { afterEach, describe, expect, it } from 'vitest'
import type { SharedPlayerActionState } from '../../lib/sharedCombatTypes'
import type { BattleMap } from '../../store/maps'
import type { Character } from '../../types/character'
import { createDnd5eTurnEconomyCounts } from './turnEconomy'
import { prepareDnd5ePlayerMove, resolveDnd5ePlayerDodge, resolvePreparedDnd5ePlayerMove } from './playerMoveAction'
import { dnd5eConditionsFromActiveEffects } from './activeEffects'
import { migrateLegacyDnd5eConditions } from './legacyActiveEffectMigration'
import { setMapGeometryRuntime } from '../../lib/mapGeometry'

function character(): Character {
  return {
    id: 'hero', name: '英雄', player: 'P1', avatar: '', accent: '', race: '人类', charClass: '战士', level: 3,
    background: '', experience: 0, reputation: 0, rulesetId: 'dnd5e-2014-srd-5.1',
    abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 }, savingThrows: [], skills: [],
    maxHp: 30, currentHp: 30, tempHp: 0, hitDice: '3d10', ac: 18, speed: 30, initiativeBonus: 1,
    saveDC: 0, passivePerception: 10, inspiration: 0, 
    conditions: [], notes: '', dmNotes: '', visibleToPlayers: true,
  }
}

const map: BattleMap = {
  id: 'map', name: '地图', width: 300, height: 200, gridSize: 10, gridOffsetX: 0, gridOffsetY: 0,
  showGrid: true, feetPerCell: 5,
  tokens: [
    { id: 'hero-token', label: '英雄', x: 5, y: 5, color: '', emoji: '', size: 1, type: 'player', characterId: 'hero', hp: 30, maxHp: 30 },
    { id: 'enemy-token', label: '敌人', x: 105, y: 5, color: '', emoji: '', size: 1, type: 'enemy', hp: 10, maxHp: 10 },
  ],
}

const action: SharedPlayerActionState = {
  id: 'move', mapId: 'map', combatId: 'combat', sourceMode: 'player', status: 'pending', type: 'move-token',
  actorTokenId: 'hero-token', characterId: 'hero', targetPosition: { x: 25, y: 5 }, round: 1, initiativeIndex: 0,
  seq: 1, updatedAt: 1,
}

describe('D&D 5e player map movement', () => {
  afterEach(() => setMapGeometryRuntime([]))

  it('routes around a DM-authored movement blocker instead of crossing it', () => {
    setMapGeometryRuntime([{
      mapId: map.id,
      walls: [{
        id: 'wall', kind: 'wall', label: '墙', points: [{ x: 15, y: 0 }, { x: 15, y: 20 }],
        blocksVision: false, blocksMovement: true, blocksLineOfEffect: false,
        baseHeightFeet: 0, heightFeet: 10, createdAt: 1,
      }],
      doors: [], obstacles: [],
      vision: { enabled: false, defaultRangeFeet: 60, sharePartyVision: true, ambientLight: 'bright' }, updatedAt: 1,
    }])
    const prepared = prepareDnd5ePlayerMove({
      action, map, characters: [character()],
      initiativeOrder: [{ tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 }],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.distanceFeet).toBeGreaterThan(10)
    expect(prepared.prepared.path).not.toContainEqual({ x: 15, y: 5 })
  })

  it('spends movement feet through the 5e Headless engine and never changes AP', () => {
    const hero = character()
    const prepared = prepareDnd5ePlayerMove({
      action, map, characters: [hero],
      initiativeOrder: [
        { tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy-token', label: '敌人', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.distanceFeet).toBe(10)
    const resolved = resolvePreparedDnd5ePlayerMove({ prepared: prepared.prepared })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.result.events).toContainEqual(expect.objectContaining({ type: 'turn-resource-spent', resource: 'movement', amount: 10 }))
    expect(resolved.application?.map.tokens.find((token) => token.id === 'hero-token')).toMatchObject({ x: 25, y: 5 })
  })

  it('rejects movement beyond the remaining speed allowance', () => {
    const economy = createDnd5eTurnEconomyCounts('turn', 30)
    economy.movement.current = 5
    expect(prepareDnd5ePlayerMove({
      action, map, characters: [character()],
      initiativeOrder: [{ tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 }],
      turnEconomy: economy,
    })).toEqual({ ok: false, reason: 'insufficient-movement' })
  })

  it('recomputes ground elevation from DM geometry and blocks forged steps above 10 feet', () => {
    const terrain = {
      mapId: map.id,
      walls: [], doors: [], windows: [], lights: [],
      obstacles: [{
        id: 'ledge', kind: 'obstacle' as const, label: '高台',
        points: [{ x: 10, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 10 }, { x: 10, y: 10 }],
        blocksVision: false, blocksMovement: false, blocksLineOfEffect: false, cover: 'none' as const,
        baseHeightFeet: 0, heightFeet: 0, terrainElevationFeet: 15, createdAt: 1,
      }],
      vision: { enabled: false, defaultRangeFeet: 60, sharePartyVision: true, ambientLight: 'bright' as const },
      updatedAt: 1,
    }
    setMapGeometryRuntime([terrain])
    const input = {
      action: { ...action, targetElevationFeet: 999 },
      map,
      characters: [character()],
      initiativeOrder: [{ tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 }],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    }
    expect(prepareDnd5ePlayerMove(input)).toEqual({ ok: false, reason: 'movement-blocked' })
    terrain.obstacles[0].terrainElevationFeet = 10
    setMapGeometryRuntime([terrain])
    const prepared = prepareDnd5ePlayerMove(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.toElevationFeet).toBe(10)
  })

  it('half-speed careful movement consumes twice the traversed distance in Headless', () => {
    const prepared = prepareDnd5ePlayerMove({
      action: { ...action, dnd5eCarefulMovement: true },
      map,
      characters: [character()],
      initiativeOrder: [
        { tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy-token', label: '敌人', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.movementCostFeet).toBe(20)
    const resolved = resolvePreparedDnd5ePlayerMove({ prepared: prepared.prepared })
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'turn-resource-spent', resource: 'movement', amount: 20,
    }))
  })

  it('charges double movement while an enemy crosses Spirit Guardians', () => {
    const guardedMap: BattleMap = {
      ...map,
      dnd5ePluginAreas: [{
        id: 'spirit-guardians', pluginId: 'srd-5.1', featureId: 'srd-5.1:spell:spirit-guardians',
        sourceKind: 'core-spell', coreSpellId: 'spirit-guardians', label: '灵体卫士', color: '#fef3c7',
        sourceCharacterId: 'enemy', sourceTokenId: 'enemy-token', cells: [{ col: 1, row: 0 }, { col: 2, row: 0 }],
        createdRound: 1, expiresAfterRound: 100, relation: 'enemy', includeSelf: false,
        movementCostMultiplier: 2,
      }],
    }
    const prepared = prepareDnd5ePlayerMove({
      action,
      map: guardedMap,
      characters: [character()],
      initiativeOrder: [
        { tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy-token', label: '敌人', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({ distanceFeet: 10, movementCostFeet: 15 })
  })

  it('spends half speed to stand from prone before moving and clears the condition', () => {
    const hero = character()
    const activeEffects = migrateLegacyDnd5eConditions({ targetId: hero.id, conditions: ['prone'] })
    hero.conditions = dnd5eConditionsFromActiveEffects(activeEffects)
    hero.dnd5eCombatState = { schemaVersion: 2, activeEffects }
    const proneAction = { ...action, targetPosition: { x: 15, y: 5 } }
    const prepared = prepareDnd5ePlayerMove({
      action: proneAction, map, characters: [hero],
      initiativeOrder: [
        { tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy-token', label: '敌人', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({ distanceFeet: 5, movementCostFeet: 20, standFromProne: true })
    const resolved = resolvePreparedDnd5ePlayerMove({ prepared: prepared.prepared })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.result.state.combatants['hero-token'].turn.movementRemaining).toBe(10)
    expect(resolved.application?.characters[0].conditions).toEqual([])
    expect(resolved.result.events).toContainEqual({ type: 'condition-ended', targetId: 'hero-token', condition: 'prone' })
  })

  it('lets a prone player crawl without automatically standing', () => {
    const hero = character()
    const activeEffects = migrateLegacyDnd5eConditions({ targetId: hero.id, conditions: ['prone'] })
    hero.conditions = dnd5eConditionsFromActiveEffects(activeEffects)
    hero.dnd5eCombatState = { schemaVersion: 2, activeEffects }
    const prepared = prepareDnd5ePlayerMove({
      action: { ...action, targetPosition: { x: 15, y: 5 }, dnd5eStandFromProne: false },
      map,
      characters: [hero],
      initiativeOrder: [
        { tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy-token', label: '敌人', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({ distanceFeet: 5, movementCostFeet: 10, standFromProne: false })
    const resolved = resolvePreparedDnd5ePlayerMove({ prepared: prepared.prepared })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.result.state.combatants['hero-token'].turn.movementRemaining).toBe(20)
    expect(resolved.application?.characters[0].conditions).toContain('prone')
  })

  it('persists the Dodge action marker into the character combat state', () => {
    const dodgeAction: SharedPlayerActionState = { ...action, id: 'dodge', type: 'dodge' }
    const resolved = resolveDnd5ePlayerDodge({
      action: dodgeAction,
      map,
      characters: [character()],
      initiativeOrder: [
        { tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy-token', label: '敌人', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })
    expect(resolved).toMatchObject({ ok: true })
    if (!resolved.ok) return
    expect(resolved.result.events).toContainEqual({
      type: 'turn-resource-spent', actorId: 'hero-token', resource: 'action',
    })
    expect(resolved.application.characters[0].dnd5eCombatState?.dodgingTurnKey).toBe('combat:1:hero-token')
  })
})
