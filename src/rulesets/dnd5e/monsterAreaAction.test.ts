import { afterEach, describe, expect, it } from 'vitest'
import {
  createEmptyMapGeometry,
  setMapGeometryRuntime,
} from '../../lib/mapGeometry'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import {
  dnd5eMonsterAreaForcedMovementPlans,
  prepareDnd5eMonsterAreaAction,
  resolvePreparedDnd5eMonsterAreaAction,
} from './monsterAreaAction'
import { migrateLegacyDnd5eConditions } from './legacyActiveEffectMigration'

function token(patch: Partial<Token>): Token {
  return {
    id: 'token',
    label: 'Token',
    x: 25,
    y: 25,
    color: '',
    emoji: '',
    size: 1,
    type: 'enemy',
    hp: 40,
    maxHp: 40,
    ...patch,
  }
}

function character(id: string, currentHp = 40): Character {
  return {
    id,
    name: id,
    player: 'P1',
    avatar: '',
    accent: '',
    race: '',
    charClass: 'Fighter',
    level: 5,
    background: '',
    experience: 0,
    reputation: 0,
    abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 10, cha: 10 },
    savingThrows: ['str', 'con'],
    skills: [],
    maxHp: 40,
    currentHp,
    tempHp: 0,
    hitDice: '5d10',
    ac: 14,
    speed: 30,
    initiativeBonus: 2,
    saveDC: 10,
    passivePerception: 10,
    inspiration: 0,
    conditions: [],
    notes: '',
    dmNotes: '',
    visibleToPlayers: true,
  }
}

function battleMap(id: string, tokens: Token[]): BattleMap {
  return {
    id,
    name: id,
    width: 800,
    height: 300,
    gridSize: 50,
    gridOffsetX: 0,
    gridOffsetY: 0,
    showGrid: true,
    feetPerCell: 5,
    tokens,
  }
}

function initiative(tokens: readonly Token[]) {
  return tokens.map((entry, index) => ({
    tokenId: entry.id,
    label: entry.label,
    emoji: entry.emoji ?? '',
    color: entry.color ?? '',
    roll: 20 - index,
  }))
}

describe('monster area action map authority', () => {
  afterEach(() => setMapGeometryRuntime([]))

  it('authoritatively includes hostiles, monster allies, neutral NPCs, and living downed players', () => {
    const dragon = token({
      id: 'dragon',
      label: 'Adult Bronze Dragon',
      poolId: 'srd-5.1:adult-bronze-dragon',
      hp: 212,
      maxHp: 212,
    })
    const hostile = token({
      id: 'hostile',
      type: 'player',
      characterId: 'hostile-character',
      x: 75,
      y: 25,
    })
    const ally = token({ id: 'ally', type: 'enemy', x: 125, y: 25 })
    const neutral = token({ id: 'neutral', type: 'npc', x: 175, y: 25 })
    const downed = token({
      id: 'downed',
      type: 'player',
      characterId: 'downed-character',
      x: 225,
      y: 25,
      hp: 0,
    })
    const regeneratingMonster = token({
      id: 'regenerating',
      type: 'enemy',
      x: 275,
      y: 25,
      hp: 0,
      dnd5eCombatState: { monsterRegenerationPendingAtZero: true },
    })
    const stableMonster = token({
      id: 'stable-at-zero',
      type: 'enemy',
      x: 275,
      y: 25,
      hp: 0,
      dnd5eCombatState: { stableAtZero: true },
    })
    const legacyBanished = token({
      id: 'legacy-banished',
      type: 'enemy',
      x: 75,
      y: 25,
      dnd5eCombatState: { conditions: ['banished'] },
    })
    const effectBanished = token({
      id: 'effect-banished',
      type: 'player',
      characterId: 'effect-banished-character',
      x: 75,
      y: 25,
    })
    const map = battleMap('all-creatures', [
      dragon,
      hostile,
      ally,
      neutral,
      downed,
      regeneratingMonster,
      stableMonster,
      legacyBanished,
      effectBanished,
    ])
    const banishedCharacter = character('effect-banished-character')
    banishedCharacter.dnd5eCombatState = {
      activeEffects: migrateLegacyDnd5eConditions({
        targetId: effectBanished.id,
        conditions: ['\u653e\u9010'],
      }),
    }
    const characters = [
      character('hostile-character'),
      character('downed-character', 0),
      banishedCharacter,
    ]

    const prepared = prepareDnd5eMonsterAreaAction({
      combatId: 'combat',
      map,
      characters,
      initiativeOrder: initiative(map.tokens.filter((entry) => entry.id !== neutral.id)),
      actorTokenId: dragon.id,
      actionId: 'breath-weapons',
      variantId: 'repulsion-breath',
      targetTokenIds: [
        hostile.id,
        ally.id,
        neutral.id,
        downed.id,
        regeneratingMonster.id,
        stableMonster.id,
      ],
      areaTargetCell: { col: 5, row: 0 },
    })

    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.targetTokens.map((entry) => entry.id).sort()).toEqual(
      [
        hostile.id,
        ally.id,
        neutral.id,
        downed.id,
        regeneratingMonster.id,
        stableMonster.id,
      ].sort(),
    )
    expect(prepared.prepared.state.combatants[neutral.id]).toBeDefined()
    expect(prepared.prepared.state.combatants[downed.id].deathSaves.dead).toBe(false)
    expect(prepared.prepared.state.combatants[stableMonster.id].deathSaves).toMatchObject({
      stable: true,
      dead: false,
    })
    expect(prepared.prepared.targetTokens.map((entry) => entry.id)).not.toContain(
      legacyBanished.id,
    )
    expect(prepared.prepared.targetTokens.map((entry) => entry.id)).not.toContain(
      effectBanished.id,
    )
  })

  it('submits a zero-distance authoritative push when a movement wall stops repulsion', () => {
    const dragon = token({
      id: 'dragon',
      poolId: 'srd-5.1:adult-bronze-dragon',
      hp: 212,
      maxHp: 212,
    })
    const hero = token({
      id: 'hero',
      type: 'player',
      characterId: 'hero-character',
      x: 75,
      y: 25,
    })
    const map = battleMap('wall-stop', [dragon, hero])
    const geometry = createEmptyMapGeometry(map.id)
    geometry.walls.push({
      id: 'wall',
      kind: 'wall',
      label: 'Wall',
      points: [{ x: 100, y: 0 }, { x: 100, y: 100 }],
      material: 'stone',
      blocksVision: false,
      blocksMovement: true,
      blocksLineOfEffect: false,
      baseHeightFeet: 0,
      heightFeet: 10,
      createdAt: 1,
    })
    setMapGeometryRuntime([geometry])
    const prepared = prepareDnd5eMonsterAreaAction({
      combatId: 'combat',
      map,
      characters: [character('hero-character')],
      initiativeOrder: initiative(map.tokens),
      actorTokenId: dragon.id,
      actionId: 'breath-weapons',
      variantId: 'repulsion-breath',
      targetTokenIds: [hero.id],
      areaTargetCell: { col: 1, row: 0 },
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const movements = dnd5eMonsterAreaForcedMovementPlans(prepared.prepared)
    expect(movements).toMatchObject([{
      targetId: hero.id,
      to: { x: hero.x, y: hero.y },
      distanceFeet: 0,
      fallDistanceFeet: 0,
    }])

    const resolved = resolvePreparedDnd5eMonsterAreaAction({
      prepared: prepared.prepared,
      resolution: {
        targetSavingThrows: [{ targetId: hero.id, d20: 1 }],
        damageRolls: [],
        forcedMovements: movements,
      },
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === hero.id))
      .toMatchObject({ x: hero.x, y: hero.y })
  })

  it('maps a grounded repulsion push off a cliff and settles its falling damage', () => {
    const dragon = token({
      id: 'dragon',
      poolId: 'srd-5.1:adult-bronze-dragon',
      x: 175,
      y: 25,
      elevationFeet: 40,
      hp: 212,
      maxHp: 212,
    })
    const hero = token({
      id: 'hero',
      type: 'player',
      characterId: 'hero-character',
      x: 125,
      y: 25,
      elevationFeet: 40,
    })
    const map = battleMap('cliff-push', [dragon, hero])
    const geometry = createEmptyMapGeometry(map.id)
    geometry.obstacles.push({
      id: 'plateau',
      kind: 'obstacle',
      label: 'Plateau',
      cover: 'none',
      points: [
        { x: 100, y: 0 },
        { x: 500, y: 0 },
        { x: 500, y: 100 },
        { x: 100, y: 100 },
      ],
      baseHeightFeet: 0,
      heightFeet: 0,
      terrainElevationFeet: 40,
      terrainRegion: true,
      blocksMovement: false,
      blocksVision: false,
      blocksLineOfEffect: false,
      createdAt: 1,
    })
    setMapGeometryRuntime([geometry])
    const prepared = prepareDnd5eMonsterAreaAction({
      combatId: 'combat',
      map,
      characters: [character('hero-character')],
      initiativeOrder: initiative(map.tokens),
      actorTokenId: dragon.id,
      actionId: 'breath-weapons',
      variantId: 'repulsion-breath',
      targetTokenIds: [hero.id],
      areaTargetCell: { col: 2, row: 0 },
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const [movement] = dnd5eMonsterAreaForcedMovementPlans(prepared.prepared)
    expect(movement).toMatchObject({
      targetId: hero.id,
      to: { x: 25, y: 25 },
      distanceFeet: 10,
      sourceElevationFeet: 40,
      landingGroundElevationFeet: 0,
      groundedAtSource: true,
      fallDistanceFeet: 40,
      toElevationFeet: 0,
    })

    const resolved = resolvePreparedDnd5eMonsterAreaAction({
      prepared: prepared.prepared,
      resolution: {
        targetSavingThrows: [{ targetId: hero.id, d20: 1 }],
        damageRolls: [],
        forcedMovements: [{
          targetId: movement.targetId,
          to: movement.to,
          distanceFeet: movement.distanceFeet,
          toElevationFeet: movement.toElevationFeet,
          fallingDamageRolls: [6, 6, 6, 6],
        }],
      },
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === hero.id)).toMatchObject({
      x: 25,
      y: 25,
      elevationFeet: 0,
    })
    expect(resolved.application?.characters.find((entry) => entry.id === 'hero-character')?.currentHp)
      .toBe(16)
  })

  it('resolves Ankheg Acid Spray and spends its recharge resource', () => {
    const ankheg = token({
      id: 'ankheg',
      label: 'Ankheg',
      poolId: 'srd-5.1:ankheg',
      hp: 39,
      maxHp: 39,
      dnd5eCombatState: {
        monsterRechargeReadyByActionId: { 'acid-spray': true },
      },
    })
    const hero = token({
      id: 'hero',
      label: 'Hero',
      type: 'player',
      characterId: 'hero-character',
      x: 75,
      y: 25,
    })
    const map = battleMap('ankheg-acid-spray', [ankheg, hero])
    const prepared = prepareDnd5eMonsterAreaAction({
      combatId: 'combat',
      map,
      characters: [character('hero-character')],
      initiativeOrder: initiative(map.tokens),
      actorTokenId: ankheg.id,
      actionId: 'acid-spray',
      targetTokenIds: [hero.id],
      areaTargetCell: { col: 1, row: 0 },
    })

    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eMonsterAreaAction({
      prepared: prepared.prepared,
      resolution: {
        targetSavingThrows: [{ targetId: hero.id, d20: 1 }],
        damageRolls: [3, 4, 5],
        forcedMovements: [],
      },
    })

    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.application?.characters.find((entry) => entry.id === 'hero-character')?.currentHp)
      .toBe(28)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === ankheg.id)
      ?.dnd5eCombatState?.monsterRechargeReadyByActionId?.['acid-spray'])
      .toBe(false)
  })
})
