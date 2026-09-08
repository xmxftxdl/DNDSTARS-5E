import { afterEach, describe, expect, it } from 'vitest'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { setMapGeometryRuntime } from '../../lib/mapGeometry'
import { createDnd5eTurnEconomyCounts } from './turnEconomy'
import { createDnd5eConditionEffect, createDnd5eMechanicalEffect, dnd5eActiveEffectId } from './activeEffects'
import { prepareDnd5eMonsterMovementSavingThrows, resolveDnd5eMonsterMapMove } from './monsterMoveAction'

function character(patch: Partial<Character> = {}): Character {
  return {
    id: 'hero',
    name: 'Hero',
    player: 'P1',
    avatar: '',
    accent: '',
    race: '',
    charClass: '',
    level: 1,
    background: '',
    experience: 0,
    reputation: 0,
    rulesetId: 'dnd5e-2014-srd-5.1',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    savingThrows: [],
    skills: [],
    maxHp: 20,
    currentHp: 20,
    tempHp: 0,
    hitDice: '1d8',
    ac: 14,
    speed: 30,
    initiativeBonus: 0,
    saveDC: 10,
    passivePerception: 10,
    inspiration: 0,
    conditions: [],
    notes: '',
    dmNotes: '',
    visibleToPlayers: true,
    ...patch,
  }
}

function token(patch: Partial<Token>): Token {
  return {
    id: 'token',
    label: 'Token',
    x: 0,
    y: 0,
    color: '',
    emoji: '',
    size: 1,
    type: 'enemy',
    hp: 10,
    maxHp: 10,
    ...patch,
  }
}

function ankhegDragFixture() {
  const ankheg = token({
    id: 'ankheg',
    label: 'Ankheg',
    poolId: 'srd-5.1:ankheg',
    x: 5,
    y: 5,
    hp: 39,
    maxHp: 39,
  })
  const relationId = dnd5eActiveEffectId('relation', 'grapple', ankheg.id, 'bite', 'hero-token')
  const relation = createDnd5eConditionEffect({
    id: relationId,
    condition: 'grappled',
    source: {
      kind: 'monster',
      actorId: ankheg.id,
      rulesId: 'monster:srd-5.1:ankheg:bite:bite-grapple',
    },
    targetId: 'hero-token',
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
      sourceActorId: ankheg.id,
      sourceActionId: 'bite',
      slotGroup: 'bite',
      maxDistanceFeet: 5,
      movement: 'drag-target',
      endsOnSourceIncapacitated: true,
    },
    stackingKey: relationId,
  })
  const hero = character({
    dnd5eCombatState: {
      schemaVersion: 2,
      activeEffects: [relation],
    },
    conditions: ['grappled'],
  })
  const heroToken = token({
    id: 'hero-token',
    label: hero.name,
    type: 'player',
    characterId: hero.id,
    x: 5,
    y: 15,
    hp: hero.currentHp,
    maxHp: hero.maxHp,
  })
  const map: BattleMap = {
    id: 'map',
    name: 'Map',
    width: 100,
    height: 100,
    gridSize: 10,
    gridOffsetX: 0,
    gridOffsetY: 0,
    showGrid: true,
    feetPerCell: 5,
    tokens: [ankheg, heroToken],
  }
  return {
    ankheg,
    hero,
    heroToken,
    map,
    initiativeOrder: [
      { tokenId: ankheg.id, label: ankheg.label, emoji: '', color: '', roll: 20 },
      { tokenId: heroToken.id, label: heroToken.label, emoji: '', color: '', roll: 10 },
    ],
  }
}

describe('D&D 5e monster map movement', () => {
  afterEach(() => setMapGeometryRuntime([]))

  it('charges Grease on the ground but not while flying over the same cells', () => {
    const snake = token({
      id: 'flying-snake',
      label: 'Flying Snake',
      poolId: 'srd-5.1:flying-snake',
      x: 5,
      y: 5,
      hp: 5,
      maxHp: 5,
    })
    const hero = character()
    const heroToken = token({
      id: 'hero-token',
      label: hero.name,
      type: 'player',
      characterId: hero.id,
      x: 85,
      y: 85,
      hp: hero.currentHp,
      maxHp: hero.maxHp,
    })
    const greaseMap: BattleMap = {
      id: 'map',
      name: 'Map',
      width: 100,
      height: 100,
      gridSize: 10,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      feetPerCell: 5,
      tokens: [snake, heroToken],
      dnd5ePluginAreas: [{
        id: 'grease', pluginId: 'srd-5.1', featureId: 'srd-5.1:spell:grease',
        sourceKind: 'core-spell', coreSpellId: 'grease', label: 'Grease', color: '#facc15',
        sourceCharacterId: 'caster', sourceTokenId: 'caster-token',
        cells: Array.from({ length: 10 }, (_, row) => [
          { col: 1, row },
          { col: 2, row },
        ]).flat(),
        createdRound: 1, expiresAfterRound: 100,
        vertical: { mode: 'ground' }, relation: 'any', includeSelf: true,
        movementCostMultiplier: 2,
      }],
    }
    const initiativeOrder = [
      { tokenId: snake.id, label: snake.label, emoji: '', color: '', roll: 20 },
      { tokenId: heroToken.id, label: heroToken.label, emoji: '', color: '', roll: 10 },
    ]
    const grounded = resolveDnd5eMonsterMapMove({
      combatId: 'combat',
      map: greaseMap,
      characters: [hero],
      initiativeOrder,
      actorTokenId: snake.id,
      to: { x: 25, y: 5 },
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 60),
    })
    expect(grounded.ok).toBe(true)
    if (!grounded.ok) return
    expect(grounded.traversalMode).toBe('walk')
    expect(grounded.path).toEqual([{ x: 5, y: 5 }, { x: 15, y: 5 }, { x: 25, y: 5 }])
    expect(grounded.result.events).toContainEqual(expect.objectContaining({
      type: 'turn-resource-spent',
      actorId: snake.id,
      resource: 'movement',
      // Walking 10 physical feet through Grease spends 20 feet from the
      // common movement allowance; switching to flight can use the remainder.
      amount: 20,
    }))

    const flyingMap: BattleMap = {
      ...greaseMap,
      tokens: [{ ...snake, elevationFeet: 10 }, heroToken],
    }
    const airborne = resolveDnd5eMonsterMapMove({
      combatId: 'combat',
      map: flyingMap,
      characters: [hero],
      initiativeOrder,
      actorTokenId: snake.id,
      to: { x: 25, y: 5 },
      targetElevationFeet: 10,
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 60),
    })
    expect(airborne.ok).toBe(true)
    if (!airborne.ok) return
    expect(airborne.traversalMode).toBe('fly')
    expect(airborne.path).toEqual(grounded.path)
    expect(airborne.movementTraces?.[0]?.pathElevationsFeet).toEqual([10, 10, 10])
    expect(airborne.result.events).toContainEqual(expect.objectContaining({
      type: 'turn-resource-spent',
      actorId: snake.id,
      resource: 'movement',
      amount: 10,
    }))
  })

  it('uses a Fly active effect when a walking monster plans airborne movement', () => {
    const fly = createDnd5eMechanicalEffect({
      id: 'walking-monster-fly',
      definitionId: 'srd-5.1:spell:fly',
      label: 'Fly',
      targetId: 'walking-monster',
      source: { kind: 'spell', actorId: 'caster', rulesId: 'fly' },
      duration: { type: 'concentration', sourceActorId: 'caster', concentrationId: 'fly' },
      modifiers: { flySpeedFeet: 60 },
    })
    const walker = token({
      id: 'walking-monster',
      label: 'Walking Monster',
      poolId: 'srd-5.1:goblin',
      x: 5,
      y: 5,
      elevationFeet: 10,
      dnd5eCombatState: { schemaVersion: 2, activeEffects: [fly] },
    })
    const hero = character()
    const heroToken = token({
      id: 'hero-token',
      label: hero.name,
      type: 'player',
      characterId: hero.id,
      x: 85,
      y: 85,
      hp: hero.currentHp,
      maxHp: hero.maxHp,
    })
    const map: BattleMap = {
      id: 'fly-effect-map',
      name: 'Fly effect map',
      width: 100,
      height: 100,
      gridSize: 10,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      feetPerCell: 5,
      tokens: [walker, heroToken],
    }
    const result = resolveDnd5eMonsterMapMove({
      combatId: 'combat',
      map,
      characters: [hero],
      initiativeOrder: [
        { tokenId: walker.id, label: walker.label, emoji: '', color: '', roll: 20 },
        { tokenId: heroToken.id, label: heroToken.label, emoji: '', color: '', roll: 10 },
      ],
      actorTokenId: walker.id,
      to: { x: 25, y: 5 },
      targetElevationFeet: 20,
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 60),
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.result.ok, result.result.ok ? undefined : result.result.reason).toBe(true)
    expect(result.movementTraces?.[0]).toMatchObject({
      tokenId: walker.id,
      to: { x: 25, y: 5 },
    })
    expect(result.movementTraces?.[0]?.pathElevationsFeet.at(-1)).toBe(20)
    expect(result.application?.map.tokens.find((entry) => entry.id === walker.id)).toMatchObject({
      x: 25,
      y: 5,
      elevationFeet: 20,
    })
  })

  it('routes a Small airborne monster around a legacy Wind Wall and charges the routed distance', () => {
    const sword = token({
      id: 'flying-sword',
      label: 'Flying Sword',
      poolId: 'srd-5.1:flying-sword',
      creatureSize: '小型',
      x: 270,
      y: 370,
      elevationFeet: 5,
      hp: 17,
      maxHp: 17,
    })
    const hero = character()
    const heroToken = token({
      id: 'hero-token',
      label: hero.name,
      type: 'player',
      characterId: hero.id,
      x: 370,
      y: 570,
      hp: hero.currentHp,
      maxHp: hero.maxHp,
    })
    const map: BattleMap = {
      id: 'wind-wall-flight-map',
      name: 'Wind Wall flight map',
      width: 400,
      height: 600,
      gridSize: 20,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      feetPerCell: 5,
      tokens: [sword, heroToken],
      dnd5ePluginAreas: [{
        id: 'legacy-wind-wall',
        pluginId: 'srd-5.1',
        featureId: 'srd-5.1:spell:wind-wall',
        sourceKind: 'core-spell',
        coreSpellId: 'wind-wall',
        label: 'Wind Wall',
        color: '#bae6fd',
        sourceCharacterId: 'caster',
        sourceTokenId: 'caster-token',
        cells: Array.from({ length: 10 }, (_, index) => ({ col: 6 + index, row: 20 })),
        createdRound: 1,
        expiresAfterRound: 11,
        vertical: { mode: 'volume', baseElevationFeet: 0, heightFeet: 15 },
        // Deliberately omit `blocking`: old live areas must adopt the current
        // Wind Wall rule before the first movement settlement.
      }],
    }
    setMapGeometryRuntime([{
      mapId: map.id,
      walls: [],
      doors: [],
      obstacles: [],
      vision: { enabled: false, defaultRangeFeet: 60, sharePartyVision: true, ambientLight: 'bright' },
      updatedAt: 1,
    }])

    const result = resolveDnd5eMonsterMapMove({
      combatId: 'combat',
      round: 1,
      map,
      characters: [hero],
      initiativeOrder: [
        { tokenId: sword.id, label: sword.label, emoji: sword.emoji, color: sword.color, roll: 20 },
        { tokenId: heroToken.id, label: heroToken.label, emoji: heroToken.emoji, color: heroToken.color, roll: 10 },
      ],
      actorTokenId: sword.id,
      to: { x: 290, y: 470 },
      targetElevationFeet: 5,
      traversalMode: 'fly',
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 50),
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.result.ok, result.result.ok ? undefined : result.result.reason).toBe(true)
    expect(result.distanceFeet).toBe(35)
    expect(result.path).toEqual([
      { x: 270, y: 370 },
      { x: 290, y: 390 },
      { x: 310, y: 390 },
      { x: 330, y: 390 },
      { x: 330, y: 410 },
      { x: 330, y: 430 },
      { x: 310, y: 450 },
      { x: 290, y: 470 },
    ])
    expect(result.result.events).toContainEqual(expect.objectContaining({
      type: 'turn-resource-spent',
      actorId: sword.id,
      resource: 'movement',
      amount: 35,
    }))
  })

  it('moves a grappled target with the monster and spends double movement', () => {
    const { ankheg, hero, heroToken, map, initiativeOrder } = ankhegDragFixture()
    const result = resolveDnd5eMonsterMapMove({
      combatId: 'combat',
      map,
      characters: [hero],
      initiativeOrder,
      actorTokenId: ankheg.id,
      to: { x: 25, y: 5 },
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.result.ok).toBe(true)
    expect(result.result.events).toContainEqual(expect.objectContaining({
      type: 'turn-resource-spent',
      actorId: ankheg.id,
      resource: 'movement',
      amount: 20,
    }))
    expect(result.result.events).toContainEqual(expect.objectContaining({
      type: 'moved',
      actorId: heroToken.id,
      from: { x: 5, y: 15 },
      to: { x: 25, y: 15 },
    }))
    expect(result.movementTraces).toMatchObject([
      {
        tokenId: ankheg.id,
        to: { x: 25, y: 5 },
        path: [{ x: 5, y: 5 }, { x: 15, y: 5 }, { x: 25, y: 5 }],
      },
      {
        tokenId: heroToken.id,
        to: { x: 25, y: 15 },
        path: [{ x: 5, y: 15 }, { x: 15, y: 15 }, { x: 25, y: 15 }],
      },
    ])
    expect(result.application?.map.tokens.find((entry) => entry.id === ankheg.id))
      .toMatchObject({ x: 25, y: 5 })
    expect(result.application?.map.tokens.find((entry) => entry.id === heroToken.id))
      .toMatchObject({ x: 25, y: 15 })
    expect(result.application?.changedTokenIds).toEqual(expect.arrayContaining([
      ankheg.id,
      heroToken.id,
    ]))
  })

  it('does not let the dragged target occupy and block the monster source path', () => {
    const { ankheg, hero, map, initiativeOrder } = ankhegDragFixture()
    map.tokens = map.tokens.map((entry) => entry.id === 'hero-token'
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

    const result = resolveDnd5eMonsterMapMove({
      combatId: 'combat',
      map,
      characters: [hero],
      initiativeOrder,
      actorTokenId: ankheg.id,
      to: { x: 25, y: 5 },
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.distanceFeet).toBe(10)
    expect(result.path).toEqual([{ x: 5, y: 5 }, { x: 15, y: 5 }, { x: 25, y: 5 }])
  })

  it('rejects movement by a monster that is itself grappled', () => {
    const { ankheg, hero, map, initiativeOrder } = ankhegDragFixture()
    const grapple = createDnd5eConditionEffect({
      id: 'hero-basic-grapple',
      condition: 'grappled',
      source: { kind: 'feature', actorId: 'hero-token', rulesId: 'basic-action:grapple' },
      targetId: ankheg.id,
      duration: { type: 'permanent' },
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
    const grappledMap: BattleMap = {
      ...map,
      tokens: map.tokens.map((entry) => entry.id === ankheg.id
        ? {
            ...entry,
            dnd5eCombatState: {
              schemaVersion: 2,
              conditions: ['grappled'],
              activeEffects: [grapple],
            },
          }
        : entry),
    }

    expect(resolveDnd5eMonsterMapMove({
      combatId: 'combat',
      map: grappledMap,
      characters: [hero],
      initiativeOrder,
      actorTokenId: ankheg.id,
      to: { x: 25, y: 5 },
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })).toEqual({ ok: false, reason: 'movement-locked' })
  })

  it('rejects dragging when the target translation crosses a wall despite an endpoint detour', () => {
    const { ankheg, hero, map, initiativeOrder } = ankhegDragFixture()
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

    expect(resolveDnd5eMonsterMapMove({
      combatId: 'combat',
      map,
      characters: [hero],
      initiativeOrder,
      actorTokenId: ankheg.id,
      to: { x: 25, y: 5 },
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 60),
    })).toEqual({ ok: false, reason: 'movement-blocked' })
  })

  it('opens one unlocked door before validating the dragged target through it', () => {
    const { ankheg, hero, map, initiativeOrder } = ankhegDragFixture()
    setMapGeometryRuntime([{
      mapId: map.id,
      walls: [],
      doors: [{
        id: 'shared-door',
        kind: 'door',
        label: 'Shared door',
        points: [{ x: 10, y: 0 }, { x: 10, y: 20 }],
        state: 'closed',
        secret: false,
        blocksVision: true,
        blocksMovement: true,
        blocksLineOfEffect: true,
        baseHeightFeet: 0,
        heightFeet: 10,
        createdAt: 1,
      }],
      obstacles: [],
      vision: { enabled: false, defaultRangeFeet: 60, sharePartyVision: true, ambientLight: 'bright' },
      updatedAt: 1,
    }])

    const result = resolveDnd5eMonsterMapMove({
      combatId: 'combat',
      map,
      characters: [hero],
      initiativeOrder,
      actorTokenId: ankheg.id,
      to: { x: 25, y: 5 },
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.doorsToOpen).toEqual(['shared-door'])
    expect(result.result.ok).toBe(true)
    expect(result.application?.map.tokens.find((entry) => entry.id === ankheg.id))
      .toMatchObject({ x: 25, y: 5 })
    expect(result.application?.map.tokens.find((entry) => entry.id === 'hero-token'))
      .toMatchObject({ x: 25, y: 15 })
    expect(result.application?.characters.find((entry) => entry.id === hero.id)
      ?.dnd5eCombatState?.activeEffects).toContainEqual(expect.objectContaining({
        id: dnd5eActiveEffectId('relation', 'grapple', ankheg.id, 'bite', 'hero-token'),
      }))
  })

  it('doubles difficult-terrain and vertical movement costs while dragging', () => {
    const { ankheg, hero, map, initiativeOrder } = ankhegDragFixture()
    setMapGeometryRuntime([{
      mapId: map.id,
      walls: [],
      doors: [],
      obstacles: [{
        id: 'steep-mud',
        kind: 'obstacle',
        label: 'Steep mud',
        points: [{ x: 10, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 100 }, { x: 10, y: 100 }],
        blocksVision: false,
        blocksMovement: false,
        blocksLineOfEffect: false,
        cover: 'none',
        baseHeightFeet: 0,
        heightFeet: 0,
        terrainCostMultiplier: 2,
        terrainRegion: true,
        terrainElevationFeet: 10,
        createdAt: 1,
      }],
      vision: { enabled: false, defaultRangeFeet: 60, sharePartyVision: true, ambientLight: 'bright' },
      updatedAt: 1,
    }])

    const result = resolveDnd5eMonsterMapMove({
      combatId: 'combat',
      map,
      characters: [hero],
      initiativeOrder,
      actorTokenId: ankheg.id,
      to: { x: 25, y: 5 },
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 90),
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.distanceFeet).toBe(20)
    expect(result.result.ok).toBe(true)
    expect(result.result.events).toContainEqual(expect.objectContaining({
      type: 'turn-resource-spent',
      actorId: ankheg.id,
      resource: 'movement',
      amount: 60,
    }))
  })

  it('resolves Dash and Disengage in the same authoritative movement transaction', () => {
    const goblin = token({
      id: 'goblin', poolId: 'srd-5.1:goblin', x: 5, y: 5, hp: 7, maxHp: 7,
    })
    const hero = character()
    const heroToken = token({
      id: 'hero-token', type: 'player', characterId: hero.id,
      x: 145, y: 45, hp: hero.currentHp, maxHp: hero.maxHp,
    })
    const map: BattleMap = {
      id: 'basic-move-map', name: 'Basic move map', width: 160, height: 60,
      gridSize: 10, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [goblin, heroToken],
    }
    const initiativeOrder = [
      { tokenId: goblin.id, label: goblin.label, emoji: '', color: '', roll: 20 },
      { tokenId: heroToken.id, label: heroToken.label, emoji: '', color: '', roll: 10 },
    ]
    const dashed = resolveDnd5eMonsterMapMove({
      combatId: 'combat', map, characters: [hero], initiativeOrder,
      actorTokenId: goblin.id, to: { x: 75, y: 5 }, dash: true,
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })
    expect(dashed.ok).toBe(true)
    if (!dashed.ok) return
    expect(dashed.result.ok, dashed.result.ok ? undefined : dashed.result.reason).toBe(true)
    expect(dashed.result.events).toContainEqual(expect.objectContaining({
      type: 'turn-resource-spent', actorId: goblin.id, resource: 'action',
    }))

    const disengaged = resolveDnd5eMonsterMapMove({
      combatId: 'combat', map, characters: [hero], initiativeOrder,
      actorTokenId: goblin.id, to: { x: 25, y: 5 }, disengage: true,
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })
    expect(disengaged.ok).toBe(true)
    if (!disengaged.ok) return
    expect(disengaged.result.ok, disengaged.result.ok ? undefined : disengaged.result.reason).toBe(true)
    expect(disengaged.result.state.combatants[goblin.id].disengaged).toBe(true)
  })

  it('uses the monster Strength score for running and standing long jumps', () => {
    const goblin = token({
      id: 'goblin', poolId: 'srd-5.1:goblin', x: 5, y: 5, hp: 7, maxHp: 7,
      dnd5eCombatState: { schemaVersion: 2, runningJumpApproachFeet: 10 },
    })
    const hero = character()
    const heroToken = token({
      id: 'hero-token', type: 'player', characterId: hero.id,
      x: 65, y: 45, hp: hero.currentHp, maxHp: hero.maxHp,
    })
    const map: BattleMap = {
      id: 'jump-map', name: 'Jump map', width: 80, height: 60,
      gridSize: 10, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [goblin, heroToken],
    }
    const initiativeOrder = [
      { tokenId: goblin.id, label: goblin.label, emoji: '', color: '', roll: 20 },
      { tokenId: heroToken.id, label: heroToken.label, emoji: '', color: '', roll: 10 },
    ]
    const running = resolveDnd5eMonsterMapMove({
      combatId: 'combat', map, characters: [hero], initiativeOrder,
      actorTokenId: goblin.id, to: { x: 15, y: 5 },
      traversalMode: 'long-jump-running',
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })
    expect(running.ok).toBe(true)
    if (running.ok) expect(running.result.ok).toBe(true)

    expect(resolveDnd5eMonsterMapMove({
      combatId: 'combat', map, characters: [hero], initiativeOrder,
      actorTokenId: goblin.id, to: { x: 15, y: 5 },
      traversalMode: 'long-jump-standing',
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })).toEqual({ ok: false, reason: 'jump-too-far' })
  })

  it('applies an active Jump spell multiplier while prevalidating a standing long jump', () => {
    const jump = createDnd5eMechanicalEffect({
      id: 'goblin-jump-spell',
      definitionId: 'srd-5.1:spell:jump',
      label: '跳跃术',
      targetId: 'jumping-goblin',
      source: { kind: 'spell', actorId: 'caster', rulesId: 'jump' },
      modifiers: { jumpDistanceMultiplier: 3 },
    })
    const goblin = token({
      id: 'jumping-goblin', poolId: 'srd-5.1:goblin', x: 5, y: 5, hp: 7, maxHp: 7,
      dnd5eCombatState: { schemaVersion: 2, activeEffects: [jump] },
    })
    const hero = character()
    const heroToken = token({
      id: 'hero-token', type: 'player', characterId: hero.id,
      x: 65, y: 45, hp: hero.currentHp, maxHp: hero.maxHp,
    })
    const map: BattleMap = {
      id: 'standing-jump-spell-map', name: 'Standing jump spell map', width: 80, height: 60,
      gridSize: 10, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [goblin, heroToken],
    }
    const initiativeOrder = [
      { tokenId: goblin.id, label: goblin.label, emoji: '', color: '', roll: 20 },
      { tokenId: heroToken.id, label: heroToken.label, emoji: '', color: '', roll: 10 },
    ]

    const standing = resolveDnd5eMonsterMapMove({
      combatId: 'combat', map, characters: [hero], initiativeOrder,
      actorTokenId: goblin.id, to: { x: 15, y: 5 },
      traversalMode: 'long-jump-standing',
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })

    expect(standing.ok).toBe(true)
    if (standing.ok) expect(standing.result.ok).toBe(true)
  })

  it('uses an active Spider Climb effect as the monster walking speed', () => {
    const spiderClimb = createDnd5eMechanicalEffect({
      id: 'goblin-spider-climb',
      definitionId: 'activity:spider-climb:spider-climb:modifiers:0',
      label: '蛛行术',
      targetId: 'climbing-goblin',
      source: { kind: 'spell', actorId: 'caster', rulesId: 'spider-climb' },
      modifiers: { climbSpeedEqualsWalking: true },
    })
    const goblin = token({
      id: 'climbing-goblin', poolId: 'srd-5.1:goblin', x: 5, y: 5, hp: 7, maxHp: 7,
      dnd5eCombatState: { schemaVersion: 2, activeEffects: [spiderClimb] },
    })
    const hero = character()
    const heroToken = token({
      id: 'hero-token', type: 'player', characterId: hero.id,
      x: 85, y: 45, hp: hero.currentHp, maxHp: hero.maxHp,
    })
    const climbMap: BattleMap = {
      id: 'spider-climb-map', name: 'Spider Climb map', width: 100, height: 60,
      gridSize: 10, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [goblin, heroToken],
    }

    const result = resolveDnd5eMonsterMapMove({
      combatId: 'combat', map: climbMap, characters: [hero],
      initiativeOrder: [
        { tokenId: goblin.id, label: goblin.label, emoji: '', color: '', roll: 20 },
        { tokenId: heroToken.id, label: heroToken.label, emoji: '', color: '', roll: 10 },
      ],
      actorTokenId: goblin.id,
      to: { x: 45, y: 5 },
      traversalMode: 'climb',
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.distanceFeet).toBe(20)
    expect(result.result.events).toContainEqual(expect.objectContaining({
      type: 'turn-resource-spent', actorId: goblin.id, resource: 'movement', amount: 20,
    }))
  })

  it('moves a carried engulfed target without treating it as an occupied blocker', () => {
    const mound = token({
      id: 'mound', label: 'Shambling Mound', poolId: 'srd-5.1:shambling-mound',
      x: 5, y: 5, hp: 136, maxHp: 136, size: 2,
    })
    const relation = createDnd5eConditionEffect({
      id: 'mound-engulf',
      condition: 'grappled',
      source: { kind: 'monster', actorId: mound.id, rulesId: 'monster:srd-5.1:shambling-mound:engulf' },
      targetId: 'carried-token',
      relation: {
        schemaVersion: 1,
        kind: 'engulfed',
        sourceActorId: mound.id,
        sourceActionId: 'engulf',
        slotGroup: 'engulf',
        maxDistanceFeet: 5,
        movement: 'carry-target',
        endsOnSourceIncapacitated: false,
      },
    })
    const carriedToken = token({
      id: 'carried-token', type: 'enemy', poolId: 'srd-5.1:goblin',
      x: 5, y: 5, hp: 7, maxHp: 7,
      dnd5eCombatState: {
        schemaVersion: 2,
        conditions: ['grappled'],
        activeEffects: [relation],
      },
    })
    const hero = character()
    const heroToken = token({
      id: 'hero-token', type: 'player', characterId: hero.id,
      x: 85, y: 85, hp: 20, maxHp: 20,
    })
    const map: BattleMap = {
      id: 'carry-map', name: 'Carry map', width: 100, height: 100,
      gridSize: 10, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [mound, carriedToken, heroToken],
    }
    const result = resolveDnd5eMonsterMapMove({
      combatId: 'combat', map, characters: [hero],
      initiativeOrder: [
        { tokenId: mound.id, label: mound.label, emoji: '', color: '', roll: 20 },
        { tokenId: carriedToken.id, label: carriedToken.label, emoji: '', color: '', roll: 15 },
        { tokenId: heroToken.id, label: heroToken.label, emoji: '', color: '', roll: 10 },
      ],
      actorTokenId: mound.id, to: { x: 25, y: 5 },
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.result.ok, result.result.ok ? undefined : result.result.reason).toBe(true)
    expect(result.result.state.combatants[carriedToken.id]?.position).toEqual({ x: 25, y: 5 })
    expect(result.application?.map.tokens.find((entry) => entry.id === carriedToken.id))
      .toMatchObject({ x: 25, y: 5 })
    expect(result.movementTraces).toContainEqual(expect.objectContaining({
      tokenId: carriedToken.id,
      to: { x: 25, y: 5 },
    }))
  })

  it('prepares and resolves a monster after-movement save for Compulsion', () => {
    const controller = character({
      id: 'bard', name: 'Bard', saveDC: 15,
      dnd5eCombatState: {
        schemaVersion: 2,
        activityDirectionalCommands: {
          compulsion: {
            schemaVersion: 1,
            commandKey: 'compulsion',
            sourceActivityId: 'spell:compulsion:set-direction',
            angleDegrees: 0,
            updatedTurnKey: 'combat:1:bard-token:normal',
          },
        },
      },
    })
    const controllerToken = token({
      id: 'bard-token', label: controller.name, type: 'player', characterId: controller.id,
      x: 85, y: 85, hp: 20, maxHp: 20,
    })
    const compulsion = createDnd5eMechanicalEffect({
      id: 'compulsion-target',
      definitionId: 'activity:compulsion:compulsion-target:extension',
      label: '强迫术·受强迫',
      source: { kind: 'spell', actorId: controllerToken.id, rulesId: 'compulsion' },
      targetId: 'ape',
      duration: { type: 'rounds', remainingRounds: 10, tickOn: 'target-turn-end' },
      repeatSave: { ability: 'wis', dc: 15, timing: 'after-movement', onSuccess: 'remove' },
      legacyCondition: 'directional-compulsion:compulsion',
    })
    const ape = token({
      id: 'ape', label: 'Ape', poolId: 'srd-5.1:ape', x: 5, y: 5, hp: 19, maxHp: 19,
      dnd5eCombatState: {
        schemaVersion: 2,
        conditions: ['directional-compulsion:compulsion'],
        activeEffects: [compulsion],
      },
    })
    const map: BattleMap = {
      id: 'compulsion-map', name: 'Compulsion map', width: 100, height: 100,
      gridSize: 10, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [ape, controllerToken],
    }
    const initiativeOrder = [
      { tokenId: ape.id, label: ape.label, emoji: '', color: '', roll: 20 },
      { tokenId: controllerToken.id, label: controllerToken.label, emoji: '', color: '', roll: 10 },
    ]
    const prepared = prepareDnd5eMonsterMovementSavingThrows({
      combatId: 'combat', map, characters: [controller], initiativeOrder,
      actorTokenId: ape.id, to: { x: 25, y: 5 },
    })
    expect(prepared?.movementRepeatSavingThrows).toEqual([
      expect.objectContaining({
        effectId: compulsion.id,
        sourceActorId: controllerToken.id,
        requirement: expect.objectContaining({ ability: 'wis', dc: 15, modifier: 1 }),
      }),
    ])

    const missingRoll = resolveDnd5eMonsterMapMove({
      combatId: 'combat', map, characters: [controller], initiativeOrder,
      actorTokenId: ape.id, to: { x: 25, y: 5 },
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })
    expect(missingRoll.ok ? missingRoll.result.ok ? 'ok' : missingRoll.result.reason : missingRoll.reason)
      .toBe('invalid-dice')

    const resolved = resolveDnd5eMonsterMapMove({
      combatId: 'combat', map, characters: [controller], initiativeOrder,
      actorTokenId: ape.id, to: { x: 25, y: 5 },
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
      movementRepeatSavingThrows: [{ effectId: compulsion.id, d20: 20 }],
    })
    expect(resolved.ok).toBe(true)
    if (!resolved.ok) return
    expect(resolved.result.ok).toBe(true)
    if (!resolved.result.ok) return
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'saving-throw-resolved', targetId: ape.id, ability: 'wis', success: true,
    }))
    expect(resolved.result.state.combatants[ape.id]?.classState.activeEffects)
      .not.toContainEqual(expect.objectContaining({ id: compulsion.id }))
  })
})
