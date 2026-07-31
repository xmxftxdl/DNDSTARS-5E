import { afterEach, describe, expect, it } from 'vitest'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { setMapGeometryRuntime } from '../../lib/mapGeometry'
import { createDnd5eTurnEconomyCounts } from './turnEconomy'
import { createDnd5eConditionEffect, dnd5eActiveEffectId } from './activeEffects'
import { resolveDnd5eMonsterMapMove } from './monsterMoveAction'

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
})
