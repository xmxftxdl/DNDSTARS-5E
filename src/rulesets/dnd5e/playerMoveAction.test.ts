import { afterEach, describe, expect, it } from 'vitest'
import type { SharedPlayerActionState } from '../../lib/sharedCombatTypes'
import type { BattleMap } from '../../store/maps'
import type { Character } from '../../types/character'
import { createDnd5eTurnEconomyCounts } from './turnEconomy'
import {
  prepareDnd5eExplorationMove,
  prepareDnd5ePlayerMove,
  resolveDnd5ePlayerDodge,
  resolvePreparedDnd5ePlayerMove,
} from './playerMoveAction'
import {
  createDnd5eConditionEffect,
  createDnd5eMechanicalEffect,
  dnd5eConditionsFromActiveEffects,
} from './activeEffects'
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

function playerGrappleRelation() {
  return createDnd5eConditionEffect({
    id: 'hero-grapple-relation',
    condition: 'grappled',
    source: { kind: 'feature', actorId: 'hero-token', rulesId: 'basic-action:grapple' },
    targetId: 'enemy-token',
    relation: {
      schemaVersion: 1,
      kind: 'grapple',
      sourceActorId: 'hero-token',
      sourceActionId: 'basic-action:grapple',
      slotGroup: 'free-hand',
      maxDistanceFeet: 5,
      movement: 'drag-target',
      endsOnSourceIncapacitated: true,
    },
  })
}

function playerDragMap(): BattleMap {
  return {
    ...map,
    tokens: [
      { ...map.tokens[0], x: 5, y: 5 },
      {
        ...map.tokens[1],
        x: 5,
        y: 15,
        dnd5eCombatState: {
          schemaVersion: 2,
          activeEffects: [playerGrappleRelation()],
          conditions: ['grappled'],
        },
      },
    ],
  }
}

describe('D&D 5e player map movement', () => {
  afterEach(() => setMapGeometryRuntime([]))

  it('allows an owned living player Token to move outside combat without turn economy', () => {
    const prepared = prepareDnd5eExplorationMove({
      action: {
        ...action,
        combatId: undefined,
        targetPosition: { x: 25, y: 5 },
      },
      map,
      characters: [character()],
    })

    expect(prepared).toMatchObject({
      ok: true,
      prepared: {
        actor: { id: 'hero' },
        actorToken: { id: 'hero-token' },
        to: { x: 25, y: 5 },
        toElevationFeet: 0,
      },
    })
    if (!prepared.ok) return
    expect(prepared.prepared.path.at(0)).toEqual({ x: 5, y: 5 })
    expect(prepared.prepared.path.at(-1)).toEqual({ x: 25, y: 5 })
  })

  it('routes ground exploration around Grease but lets an airborne Token fly over it', () => {
    const blockers = [1, 2, 3, 4, 5].flatMap((col) => [1, 3].map((row) => ({
      id: `blocker-${col}-${row}`,
      label: 'Blocker',
      x: col * 10 + 5,
      y: row * 10 + 5,
      color: '',
      emoji: '',
      size: 1,
      type: 'obstacle' as const,
    })))
    const greaseMap: BattleMap = {
      ...map,
      width: 70,
      height: 50,
      tokens: [
        { ...map.tokens[0], x: 5, y: 25 },
        ...blockers,
      ],
      dnd5ePluginAreas: [{
        id: 'grease-area',
        pluginId: 'srd-5.1',
        featureId: 'srd-5.1:spell:grease',
        sourceKind: 'core-spell',
        coreSpellId: 'grease',
        label: 'Grease',
        color: '#fde68a',
        sourceCharacterId: 'caster',
        sourceTokenId: 'caster-token',
        cells: [1, 2, 3, 4, 5].map((col) => ({ col, row: 2 })),
        createdRound: 1,
        expiresAfterRound: 10,
        relation: 'any',
        includeSelf: true,
        movementCostMultiplier: 2,
        vertical: { mode: 'ground' },
      }],
    }
    const explorationAction: SharedPlayerActionState = {
      ...action,
      combatId: undefined,
      targetPosition: { x: 65, y: 25 },
    }

    const grounded = prepareDnd5eExplorationMove({
      action: explorationAction,
      map: greaseMap,
      characters: [character()],
    })
    const airborne = prepareDnd5eExplorationMove({
      action: explorationAction,
      map: {
        ...greaseMap,
        tokens: greaseMap.tokens.map((candidate) =>
          candidate.id === 'hero-token'
            ? { ...candidate, elevationFeet: 10 }
            : candidate),
      },
      characters: [character()],
    })

    expect(grounded.ok).toBe(true)
    expect(airborne.ok).toBe(true)
    if (!grounded.ok || !airborne.ok) return
    expect(grounded.prepared.path.some((point) => point.y !== 25)).toBe(true)
    expect(airborne.prepared.path).toHaveLength(7)
    expect(airborne.prepared.path.every((point) => point.y === 25)).toBe(true)
    expect(airborne.prepared.pathElevationsFeet.every((elevation) => elevation === 10)).toBe(true)
  })

  it('rejects exploration movement for a combat envelope, a defeated actor, or another Token', () => {
    expect(prepareDnd5eExplorationMove({
      action,
      map,
      characters: [character()],
    })).toEqual({ ok: false, reason: 'invalid-action' })

    expect(prepareDnd5eExplorationMove({
      action: { ...action, combatId: undefined },
      map,
      characters: [{ ...character(), currentHp: 0 }],
    })).toEqual({ ok: false, reason: 'invalid-actor' })

    expect(prepareDnd5eExplorationMove({
      action: {
        ...action,
        combatId: undefined,
        actorTokenId: 'enemy-token',
      },
      map,
      characters: [character()],
    })).toEqual({ ok: false, reason: 'invalid-actor' })
  })

  it('keeps exploration movement behind DM-authored walls', () => {
    setMapGeometryRuntime([{
      mapId: map.id,
      walls: [{
        id: 'sealed-wall',
        kind: 'wall',
        label: 'Sealed wall',
        points: [{ x: 10, y: 0 }, { x: 10, y: 200 }],
        blocksVision: true,
        blocksMovement: true,
        blocksLineOfEffect: true,
        baseHeightFeet: 0,
        heightFeet: 10,
        createdAt: 1,
      }],
      doors: [],
      obstacles: [],
      vision: {
        enabled: false,
        defaultRangeFeet: 60,
        sharePartyVision: true,
        ambientLight: 'bright',
      },
      updatedAt: 1,
    }])

    expect(prepareDnd5eExplorationMove({
      action: {
        ...action,
        combatId: undefined,
        targetPosition: { x: 25, y: 5 },
      },
      map,
      characters: [character()],
    })).toEqual({ ok: false, reason: 'movement-blocked' })
  })

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
      initiativeOrder: [
        { tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy-token', label: '敌人', emoji: '', color: '', roll: 10 },
      ],
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

  it('moves a grappled target with the player and spends double movement', () => {
    const dragMap = playerDragMap()
    const prepared = prepareDnd5ePlayerMove({
      action: { ...action, targetPosition: { x: 25, y: 5 } },
      map: dragMap,
      characters: [character()],
      initiativeOrder: [
        { tokenId: 'hero-token', label: 'Hero', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy-token', label: 'Enemy', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })

    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({
      distanceFeet: 10,
      movementCostFeet: 20,
      movementTraces: [
        {
          tokenId: 'hero-token',
          to: { x: 25, y: 5 },
          path: [{ x: 5, y: 5 }, { x: 15, y: 5 }, { x: 25, y: 5 }],
        },
        {
          tokenId: 'enemy-token',
          to: { x: 25, y: 15 },
          path: [{ x: 5, y: 15 }, { x: 15, y: 15 }, { x: 25, y: 15 }],
        },
      ],
    })
    const resolved = resolvePreparedDnd5ePlayerMove({ prepared: prepared.prepared })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'turn-resource-spent',
      actorId: 'hero-token',
      resource: 'movement',
      amount: 20,
    }))
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'moved',
      actorId: 'enemy-token',
      from: { x: 5, y: 15 },
      to: { x: 25, y: 15 },
    }))
    expect(resolved.application?.map.tokens.find((token) => token.id === 'hero-token'))
      .toMatchObject({ x: 25, y: 5 })
    expect(resolved.application?.map.tokens.find((token) => token.id === 'enemy-token'))
      .toMatchObject({ x: 25, y: 15 })
    expect(resolved.application?.changedTokenIds).toEqual(expect.arrayContaining([
      'hero-token',
      'enemy-token',
    ]))
  })

  it('does not let the dragged target occupy and block the source path', () => {
    const dragMap = playerDragMap()
    dragMap.tokens = dragMap.tokens.map((entry) => entry.id === 'enemy-token'
      ? { ...entry, x: 15, y: 5 }
      : entry)
    setMapGeometryRuntime([{
      mapId: map.id,
      walls: [{
        id: 'corridor-bottom',
        kind: 'wall',
        label: 'Corridor bottom',
        points: [{ x: 0, y: 10 }, { x: 40, y: 10 }],
        blocksVision: false,
        blocksMovement: true,
        blocksLineOfEffect: false,
        baseHeightFeet: 0,
        heightFeet: 10,
        createdAt: 1,
      }],
      doors: [],
      obstacles: [],
      vision: { enabled: false, defaultRangeFeet: 60, sharePartyVision: true, ambientLight: 'bright' },
      updatedAt: 1,
    }])

    const prepared = prepareDnd5ePlayerMove({
      action: { ...action, targetPosition: { x: 25, y: 5 } },
      map: dragMap,
      characters: [character()],
      initiativeOrder: [
        { tokenId: 'hero-token', label: 'Hero', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy-token', label: 'Enemy', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })

    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({
      distanceFeet: 10,
      path: [{ x: 5, y: 5 }, { x: 15, y: 5 }, { x: 25, y: 5 }],
    })
  })

  it('reconciles an orphaned grapple before checking whether player movement is locked', () => {
    const hero = character()
    const orphanedGrapple = createDnd5eConditionEffect({
      id: 'orphaned-grapple',
      condition: 'grappled',
      source: { kind: 'feature', actorId: 'missing-source', rulesId: 'basic-action:grapple' },
      targetId: 'hero-token',
      relation: {
        schemaVersion: 1,
        kind: 'grapple',
        sourceActorId: 'missing-source',
        sourceActionId: 'basic-action:grapple',
        slotGroup: 'free-hand',
        maxDistanceFeet: 5,
        movement: 'drag-target',
        endsOnSourceIncapacitated: true,
      },
    })
    hero.conditions = ['grappled']
    hero.dnd5eCombatState = { schemaVersion: 2, activeEffects: [orphanedGrapple] }

    const prepared = prepareDnd5ePlayerMove({
      action: { ...action, targetPosition: { x: 15, y: 5 } },
      map,
      characters: [hero],
      initiativeOrder: [
        { tokenId: 'hero-token', label: 'Hero', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy-token', label: 'Enemy', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })

    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.state.combatants['hero-token'].conditions).not.toContain('grappled')
  })

  it('requests and consumes independent falling dice for the source and each dragged target', () => {
    const hero = character()
    const safeFall = createDnd5eMechanicalEffect({
      id: 'hero-safe-fall',
      definitionId: 'test:safe-fall',
      label: 'Safe fall',
      source: { kind: 'feature', actorId: 'hero-token', rulesId: 'test:safe-fall' },
      targetId: 'hero-token',
      modifiers: { safeFallFeet: 20 },
    })
    hero.dnd5eCombatState = { schemaVersion: 2, activeEffects: [safeFall] }
    const dragMap = playerDragMap()
    dragMap.tokens = dragMap.tokens.map((entry) => ({
      ...entry,
      elevationFeet: 20,
      ...(entry.id === 'enemy-token' ? { hp: 30, maxHp: 30 } : {}),
    }))

    const prepared = prepareDnd5ePlayerMove({
      action: {
        ...action,
        targetPosition: { x: 25, y: 5 },
        dnd5eTraversalMode: 'fall',
        targetElevationFeet: 0,
      },
      map: dragMap,
      characters: [hero],
      initiativeOrder: [
        { tokenId: 'hero-token', label: 'Hero', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy-token', label: 'Enemy', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 60),
    })

    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.fallingDamageDiceByCombatantId).toEqual({
      'hero-token': 0,
      'enemy-token': 2,
    })
    const resolved = resolvePreparedDnd5ePlayerMove({
      prepared: prepared.prepared,
      fallingDamageRollsByCombatantId: {
        'enemy-token': [6, 5],
      },
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.result.events).not.toContainEqual(expect.objectContaining({
      type: 'damage-applied',
      targetId: 'hero-token',
    }))
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'damage-applied',
      targetId: 'enemy-token',
      amount: 11,
    }))
    expect(resolved.application?.map.tokens.find((entry) => entry.id === 'enemy-token')?.hp).toBe(19)
  })

  it('rejects dragging when the translated target route crosses a wall even if its endpoint has a detour', () => {
    setMapGeometryRuntime([{
      mapId: map.id,
      walls: [{
        id: 'drag-lane-wall',
        kind: 'wall',
        label: 'Drag lane wall',
        points: [{ x: 10, y: 11 }, { x: 10, y: 19 }],
        blocksVision: false,
        blocksMovement: true,
        blocksLineOfEffect: false,
        baseHeightFeet: 0,
        heightFeet: 10,
        createdAt: 1,
      }],
      doors: [],
      obstacles: [],
      vision: { enabled: false, defaultRangeFeet: 60, sharePartyVision: true, ambientLight: 'bright' },
      updatedAt: 1,
    }])

    expect(prepareDnd5ePlayerMove({
      action: { ...action, targetPosition: { x: 25, y: 5 } },
      map: playerDragMap(),
      characters: [character()],
      initiativeOrder: [
        { tokenId: 'hero-token', label: 'Hero', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy-token', label: 'Enemy', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 60),
    })).toEqual({ ok: false, reason: 'movement-blocked' })
  })

  it('doubles terrain-adjusted movement cost while dragging through difficult terrain', () => {
    setMapGeometryRuntime([{
      mapId: map.id,
      walls: [],
      doors: [],
      obstacles: [{
        id: 'mud',
        kind: 'obstacle',
        label: 'Mud',
        points: [{ x: 10, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 100 }, { x: 10, y: 100 }],
        blocksVision: false,
        blocksMovement: false,
        blocksLineOfEffect: false,
        cover: 'none',
        baseHeightFeet: 0,
        heightFeet: 0,
        terrainCostMultiplier: 2,
        createdAt: 1,
      }],
      vision: { enabled: false, defaultRangeFeet: 60, sharePartyVision: true, ambientLight: 'bright' },
      updatedAt: 1,
    }])

    const prepared = prepareDnd5ePlayerMove({
      action: { ...action, targetPosition: { x: 25, y: 5 } },
      map: playerDragMap(),
      characters: [character()],
      initiativeOrder: [
        { tokenId: 'hero-token', label: 'Hero', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy-token', label: 'Enemy', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 60),
    })

    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({
      distanceFeet: 10,
      movementCostFeet: 40,
    })
  })

  it('doubles vertical traversal cost while flying with a grappled target', () => {
    const hero = character()
    hero.speed = 60
    hero.dnd5eMovementSpeeds = { fly: 60 }
    const prepared = prepareDnd5ePlayerMove({
      action: {
        ...action,
        targetPosition: { x: 25, y: 5 },
        dnd5eTraversalMode: 'fly',
        targetElevationFeet: 40,
      },
      map: playerDragMap(),
      characters: [hero],
      initiativeOrder: [
        { tokenId: 'hero-token', label: 'Hero', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy-token', label: 'Enemy', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 120),
    })

    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({
      distanceFeet: 10,
      toElevationFeet: 40,
      movementCostFeet: 100,
    })
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

  it('treats a legacy token without elevation as standing on its terrain surface', () => {
    setMapGeometryRuntime([{
      mapId: map.id,
      walls: [],
      doors: [],
      windows: [],
      lights: [],
      obstacles: [{
        id: 'plateau',
        kind: 'obstacle',
        label: 'Plateau',
        points: [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 10 }, { x: 0, y: 10 }],
        blocksVision: false,
        blocksMovement: false,
        blocksLineOfEffect: false,
        cover: 'none',
        baseHeightFeet: 0,
        heightFeet: 0,
        terrainRegion: true,
        terrainElevationFeet: 20,
        createdAt: 1,
      }],
      vision: { enabled: false, defaultRangeFeet: 60, sharePartyVision: true, ambientLight: 'bright' },
      updatedAt: 1,
    }])

    const prepared = prepareDnd5ePlayerMove({
      action,
      map,
      characters: [character()],
      initiativeOrder: [
        { tokenId: 'hero-token', label: 'Hero', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy-token', label: 'Enemy', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })

    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({
      toElevationFeet: 20,
      pathElevationsFeet: [20, 20, 20],
      movementCostFeet: 10,
    })
    expect(prepared.prepared.state.combatants['hero-token'].elevationFeet).toBe(20)
  })

  it('validates a flying move as one three-dimensional trajectory over a tall wall', () => {
    const hero = character()
    hero.speed = 60
    hero.dnd5eMovementSpeeds = { fly: 60 }
    setMapGeometryRuntime([{
      mapId: map.id,
      walls: [{
        id: 'high-wall', kind: 'wall', label: '高墙',
        points: [{ x: 15, y: 0 }, { x: 15, y: map.height }],
        blocksVision: true, blocksMovement: true, blocksLineOfEffect: true,
        baseHeightFeet: 0, heightFeet: 10, createdAt: 1,
      }],
      doors: [], windows: [], obstacles: [], lights: [],
      vision: { enabled: false, defaultRangeFeet: 60, sharePartyVision: true, ambientLight: 'bright' },
      updatedAt: 1,
    }])
    const prepared = prepareDnd5ePlayerMove({
      action: {
        ...action,
        targetPosition: { x: 25, y: 5 },
        dnd5eTraversalMode: 'fly',
        targetElevationFeet: 40,
      },
      map,
      characters: [hero],
      initiativeOrder: [
        { tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy-token', label: '敌人', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 60),
    })
    expect(prepared).toEqual(expect.objectContaining({ ok: true }))
    if (!prepared.ok) return
    expect(prepared.prepared.toElevationFeet).toBe(40)
    expect(prepared.prepared.pathElevationsFeet[0]).toBe(0)
    expect(prepared.prepared.pathElevationsFeet.at(-1)).toBe(40)
    expect(prepared.prepared.movementCostFeet).toBe(50)
    const resolved = resolvePreparedDnd5ePlayerMove({ prepared: prepared.prepared })
    expect(resolved.result).toEqual(expect.objectContaining({ ok: true }))
    expect(resolved.application?.map.tokens.find((token) => token.id === 'hero-token'))
      .toMatchObject({ x: 25, y: 5, elevationFeet: 40 })
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

  it('charges Grease on the ground but not while flying over the same cells', () => {
    const greaseMap: BattleMap = {
      ...map,
      dnd5ePluginAreas: [{
        id: 'grease', pluginId: 'srd-5.1', featureId: 'srd-5.1:spell:grease',
        sourceKind: 'core-spell', coreSpellId: 'grease', label: 'Grease', color: '#facc15',
        sourceCharacterId: 'enemy', sourceTokenId: 'enemy-token',
        cells: Array.from({ length: 20 }, (_, row) => [
          { col: 1, row },
          { col: 2, row },
        ]).flat(),
        createdRound: 1, expiresAfterRound: 100,
        vertical: { mode: 'ground' }, relation: 'any', includeSelf: true,
        movementCostMultiplier: 2,
      }],
    }
    const hero = character()
    hero.speed = 60
    hero.dnd5eMovementSpeeds = { fly: 60 }
    const initiativeOrder = [
      { tokenId: 'hero-token', label: 'Hero', emoji: '', color: '', roll: 20 },
      { tokenId: 'enemy-token', label: 'Enemy', emoji: '', color: '', roll: 10 },
    ]
    const grounded = prepareDnd5ePlayerMove({
      action,
      map: greaseMap,
      characters: [hero],
      initiativeOrder,
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 60),
    })
    expect(grounded.ok).toBe(true)
    if (!grounded.ok) return
    expect(grounded.prepared).toMatchObject({
      distanceFeet: 10,
      movementCostFeet: 20,
      pathElevationsFeet: [0, 0, 0],
    })

    const flyingMap: BattleMap = {
      ...greaseMap,
      tokens: greaseMap.tokens.map((entry) => entry.id === 'hero-token'
        ? { ...entry, elevationFeet: 10 }
        : entry),
    }
    const airborne = prepareDnd5ePlayerMove({
      action: {
        ...action,
        dnd5eTraversalMode: 'fly',
        targetElevationFeet: 10,
      },
      map: flyingMap,
      characters: [hero],
      initiativeOrder,
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 60),
    })
    expect(airborne.ok).toBe(true)
    if (!airborne.ok) return
    expect(airborne.prepared.path).toEqual(grounded.prepared.path)
    expect(airborne.prepared).toMatchObject({
      distanceFeet: 10,
      movementCostFeet: 10,
      pathElevationsFeet: [10, 10, 10],
    })
  })

  it('charges Spirit Guardians inside its volume but not above it', () => {
    const guardedMap: BattleMap = {
      ...map,
      dnd5ePluginAreas: [{
        id: 'spirit-guardians', pluginId: 'srd-5.1', featureId: 'srd-5.1:spell:spirit-guardians',
        sourceKind: 'core-spell', coreSpellId: 'spirit-guardians', label: '灵体卫士', color: '#fef3c7',
        sourceCharacterId: 'enemy', sourceTokenId: 'enemy-token', cells: [{ col: 1, row: 0 }, { col: 2, row: 0 }],
        createdRound: 1, expiresAfterRound: 100, relation: 'enemy', includeSelf: false,
        anchorMode: 'source-token', anchorTokenId: 'enemy-token',
        vertical: { mode: 'volume', baseElevationFeet: -15, heightFeet: 30, anchorOffsetFeet: -15 },
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

    const hero = character()
    hero.speed = 60
    hero.dnd5eMovementSpeeds = { fly: 60 }
    const airborne = prepareDnd5ePlayerMove({
      action: {
        ...action,
        dnd5eTraversalMode: 'fly',
        targetElevationFeet: 20,
      },
      map: {
        ...guardedMap,
        tokens: guardedMap.tokens.map((entry) => entry.id === 'hero-token'
          ? { ...entry, elevationFeet: 20 }
          : entry),
      },
      characters: [hero],
      initiativeOrder: [
        { tokenId: 'hero-token', label: 'Hero', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy-token', label: 'Enemy', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 60),
    })
    expect(airborne.ok).toBe(true)
    if (!airborne.ok) return
    expect(airborne.prepared).toMatchObject({
      distanceFeet: 10,
      movementCostFeet: 10,
      pathElevationsFeet: [20, 20, 20],
    })
  })

  it('charges double movement through Ice Storm difficult terrain', () => {
    const stormMap: BattleMap = {
      ...map,
      dnd5ePluginAreas: [{
        id: 'ice-storm', pluginId: 'srd-5.1', featureId: 'srd-5.1:spell:ice-storm',
        sourceKind: 'core-spell', coreSpellId: 'ice-storm', label: '冰风暴·冰雹地面', color: '#bfdbfe',
        sourceCharacterId: 'enemy', sourceTokenId: 'enemy-token',
        cells: Array.from({ length: 20 }, (_, row) => [
          { col: 1, row },
          { col: 2, row },
        ]).flat(),
        createdRound: 1, expiresAfterRound: 2, expiresAtSourceTurnEndAfterRound: 2,
        relation: 'any', includeSelf: true, movementCostMultiplier: 2,
      }],
    }
    const prepared = prepareDnd5ePlayerMove({
      action,
      map: stormMap,
      characters: [character()],
      initiativeOrder: [
        { tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy-token', label: '敌人', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({ distanceFeet: 10, movementCostFeet: 20 })
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

  it('keeps a prone player crawling and exposes why standing was prevented', () => {
    const hero = character()
    const proneEffects = migrateLegacyDnd5eConditions({ targetId: hero.id, conditions: ['prone'] })
    const laughter = createDnd5eMechanicalEffect({
      definitionId: 'srd-5.1:spell:hideous-laughter:repeat-save',
      label: '狂笑术',
      source: { kind: 'spell', actorId: 'enemy-token', rulesId: 'hideous-laughter' },
      targetId: hero.id,
      duration: { type: 'concentration', sourceActorId: 'enemy-token' },
    })
    const activeEffects = [...proneEffects, laughter]
    hero.conditions = dnd5eConditionsFromActiveEffects(activeEffects)
    hero.dnd5eCombatState = { schemaVersion: 2, activeEffects }
    const prepared = prepareDnd5ePlayerMove({
      action: { ...action, targetPosition: { x: 15, y: 5 }, dnd5eStandFromProne: true },
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
    expect(prepared.prepared).toMatchObject({
      standFromProne: false,
      standPreventedBy: 'hideous-laughter',
      movementCostFeet: 10,
    })
    const resolved = resolvePreparedDnd5ePlayerMove({ prepared: prepared.prepared })
    expect(resolved.result.ok).toBe(true)
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
