import { afterEach, describe, expect, it } from 'vitest'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { createEmptyMapGeometry, setMapGeometryRuntime } from '../../lib/mapGeometry'
import { createDnd5eTurnEconomyCounts } from './turnEconomy'
import { resolveDnd5eMonsterMapMove } from './monsterMoveAction'
import { planDnd5eMonsterTurn } from './monsterTurnPlanner'

function token(patch: Partial<Token>): Token {
  return { id: 'token', label: 'Token', x: 0, y: 0, color: '', emoji: '', size: 1, type: 'enemy', hp: 10, maxHp: 10, ...patch }
}

function map(tokens: Token[]): BattleMap {
  return { id: 'map', name: 'Map', width: 200, height: 100, gridSize: 10, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5, tokens }
}

function character(patch: Partial<Character> = {}): Character {
  return { id: 'hero', name: '英雄', player: 'P1', avatar: '', accent: '', race: '', charClass: '', level: 1, background: '', experience: 0, reputation: 0, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, savingThrows: [], skills: [], maxHp: 20, currentHp: 20, tempHp: 0, hitDice: '1d8', ac: 14, speed: 30, initiativeBonus: 0, saveDC: 10, passivePerception: 10, inspiration: 0, conditions: [], notes: '', dmNotes: '', visibleToPlayers: true, ...patch }
}

describe('SRD monster 5e turn planner', () => {
  afterEach(() => setMapGeometryRuntime([]))
  it('uses a ranged stat-block action without AP movement when the target is in range', () => {
    const goblin = token({ id: 'goblin', label: '哥布林', poolId: 'srd-5.1:goblin', hp: 7, maxHp: 7 })
    const hero = token({ id: 'hero-token', label: '英雄', type: 'player', characterId: 'hero', x: 50, hp: 20, maxHp: 20 })
    const plan = planDnd5eMonsterTurn(map([goblin, hero]), goblin)
    expect(plan).toMatchObject({ moved: false, attacked: true, actionIndex: 1, attackerTokenId: goblin.id, targetTokenId: hero.id })
    expect(plan.moveApSpent).toBeUndefined()
  })

  it('uses the monster speed and may move and attack in the same 5e turn', () => {
    const wolf = token({ id: 'wolf', label: '狼', poolId: 'srd-5.1:wolf', hp: 11, maxHp: 11 })
    const hero = token({ id: 'hero-token', label: '英雄', type: 'player', characterId: 'hero', x: 90, hp: 20, maxHp: 20 })
    const plan = planDnd5eMonsterTurn(map([wolf, hero]), wolf)
    expect(plan.moved).toBe(true)
    expect(plan.attacked).toBe(true)
    expect(plan.newPosition?.x).toBe(85)
    expect(plan.moveApSpent).toBeUndefined()
  })

  it.each([
    {
      label: '当前生命值最低',
      priority: 'lowest-current-hp' as const,
      nearCharacter: character({ id: 'near-character', currentHp: 18, maxHp: 20, ac: 12 }),
      farCharacter: character({ id: 'far-character', currentHp: 4, maxHp: 20, ac: 18 }),
      threat: {} as Record<string, number>,
      expected: 'far-token',
    },
    {
      label: '生命值百分比最低',
      priority: 'lowest-hp-percentage' as const,
      nearCharacter: character({ id: 'near-character', currentHp: 5, maxHp: 10, ac: 12 }),
      farCharacter: character({ id: 'far-character', currentHp: 20, maxHp: 100, ac: 18 }),
      threat: {} as Record<string, number>,
      expected: 'far-token',
    },
    {
      label: 'AC 最低',
      priority: 'lowest-armor-class' as const,
      nearCharacter: character({ id: 'near-character', currentHp: 18, maxHp: 20, ac: 19 }),
      farCharacter: character({ id: 'far-character', currentHp: 18, maxHp: 20, ac: 11 }),
      threat: {} as Record<string, number>,
      expected: 'far-token',
    },
    {
      label: '仇恨最高',
      priority: 'highest-threat' as const,
      nearCharacter: character({ id: 'near-character', currentHp: 18, maxHp: 20, ac: 12 }),
      farCharacter: character({ id: 'far-character', currentHp: 18, maxHp: 20, ac: 18 }),
      threat: { 'near-token': 3, 'far-token': 21 },
      expected: 'far-token',
    },
  ])('honors the DM target priority: $label', ({ priority, nearCharacter, farCharacter, threat, expected }) => {
    const goblin = token({
      id: 'goblin', poolId: 'srd-5.1:goblin', hp: 7, maxHp: 7,
      dnd5eTargetingPreference: { schemaVersion: 1, priority },
      dnd5eCombatState: { monsterThreatByTargetId: threat },
    })
    const near = token({
      id: 'near-token', type: 'player', characterId: nearCharacter.id,
      x: 20, hp: nearCharacter.currentHp, maxHp: nearCharacter.maxHp,
    })
    const far = token({
      id: 'far-token', type: 'player', characterId: farCharacter.id,
      x: 50, hp: farCharacter.currentHp, maxHp: farCharacter.maxHp,
    })

    expect(planDnd5eMonsterTurn(map([goblin, near, far]), goblin, [nearCharacter, farCharacter]).targetTokenId)
      .toBe(expected)
  })

  it('uses a flying monster\'s fly speed on the two-dimensional battle map', () => {
    const bat = token({ id: 'bat', label: '蝙蝠', poolId: 'srd-5.1:bat', x: 5, y: 5, hp: 1, maxHp: 1 })
    const hero = token({ id: 'hero-token', label: '英雄', type: 'player', characterId: 'hero', x: 75, y: 5, hp: 20, maxHp: 20 })
    const battleMap = map([bat, hero])

    const plan = planDnd5eMonsterTurn(battleMap, bat)

    expect(plan).toMatchObject({ moved: true, attacked: true, attackerTokenId: bat.id, targetTokenId: hero.id })
    expect(plan.newPosition?.x).toBe(65)
    const resolved = resolveDnd5eMonsterMapMove({
      combatId: 'combat', map: battleMap, characters: [character()],
      initiativeOrder: [
        { tokenId: bat.id, label: bat.label, emoji: '', color: '', roll: 20 },
        { tokenId: hero.id, label: hero.label, emoji: '', color: '', roll: 10 },
      ],
      actorTokenId: bat.id,
      to: plan.newPosition!,
    })
    expect(resolved.ok).toBe(true)
    if (!resolved.ok) return
    expect(resolved.result.ok).toBe(true)
    expect(resolved.distanceFeet).toBe(30)
  })

  it('routes around an occupied cell instead of abandoning movement', () => {
    const wolf = token({ id: 'wolf', label: '狼', poolId: 'srd-5.1:wolf', x: 5, y: 45, hp: 11, maxHp: 11 })
    const obstacle = token({ id: 'rock', label: '石头', type: 'obstacle', x: 15, y: 45 })
    const hero = token({ id: 'hero-token', label: '英雄', type: 'player', characterId: 'hero', x: 95, y: 45, hp: 20, maxHp: 20 })

    const plan = planDnd5eMonsterTurn(map([wolf, obstacle, hero]), wolf)

    expect(plan).toMatchObject({ moved: true, attacked: true, attackerTokenId: wolf.id, targetTokenId: hero.id })
    expect(plan.newPosition?.x).toBeGreaterThan(wolf.x)
    expect(plan.newPosition?.y).not.toBe(wolf.y)
  })

  it('makes a turned undead Dash away from the source without attacking', () => {
    const skeleton = token({
      id: 'skeleton', label: '骷髅', poolId: 'srd-5.1:skeleton', x: 50, hp: 13, maxHp: 13,
      dnd5eCombatState: { turnedByClericId: 'cleric-token', turnedRoundsRemaining: 10, conditions: ['turned'] },
    })
    const cleric = token({ id: 'cleric-token', label: '牧师', type: 'player', characterId: 'cleric', x: 0, hp: 20, maxHp: 20 })
    const battleMap = map([skeleton, cleric])
    const plan = planDnd5eMonsterTurn(battleMap, skeleton)
    expect(plan).toMatchObject({ moved: true, dashed: true, attacked: false, attackerTokenId: skeleton.id })
    expect(plan.newPosition).toBeDefined()
    expect((plan.newPosition!.x - cleric.x) ** 2 + (plan.newPosition!.y - cleric.y) ** 2)
      .toBeGreaterThan((skeleton.x - cleric.x) ** 2 + (skeleton.y - cleric.y) ** 2)
  })

  it('applies map movement through the pure dnd5e movement resource', () => {
    const hero = character()
    const goblin = token({ id: 'goblin', label: '哥布林', poolId: 'srd-5.1:goblin', hp: 7, maxHp: 7 })
    const heroToken = token({ id: 'hero-token', label: hero.name, type: 'player', characterId: hero.id, x: 50, hp: 20, maxHp: 20 })
    const battleMap = map([goblin, heroToken])
    const resolved = resolveDnd5eMonsterMapMove({
      combatId: 'combat', map: battleMap, characters: [hero],
      initiativeOrder: [
        { tokenId: goblin.id, label: goblin.label, emoji: '', color: '', roll: 20 },
        { tokenId: heroToken.id, label: heroToken.label, emoji: '', color: '', roll: 10 },
      ],
      actorTokenId: goblin.id,
      to: { x: 20, y: 0 },
    })
    expect(resolved.ok).toBe(true)
    if (!resolved.ok) return
    expect(resolved.result.ok).toBe(true)
    expect(resolved.distanceFeet).toBe(10)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === goblin.id)?.x).toBe(20)
  })

  it('settles a turned monster Dash and movement in one Headless transaction', () => {
    const cleric = { ...character(), id: 'cleric', name: '牧师' }
    const skeleton = token({
      id: 'skeleton', label: '骷髅', poolId: 'srd-5.1:skeleton', x: 50, hp: 13, maxHp: 13,
      dnd5eCombatState: { turnedByClericId: 'cleric-token', turnedRoundsRemaining: 10, conditions: ['turned'] },
    })
    const clericToken = token({ id: 'cleric-token', label: cleric.name, type: 'player', characterId: cleric.id, x: 0, hp: 20, maxHp: 20 })
    const battleMap = map([skeleton, clericToken])
    const resolved = resolveDnd5eMonsterMapMove({
      combatId: 'combat', map: battleMap, characters: [cleric], dash: true,
      initiativeOrder: [
        { tokenId: skeleton.id, label: skeleton.label, emoji: '', color: '', roll: 20 },
        { tokenId: clericToken.id, label: clericToken.label, emoji: '', color: '', roll: 10 },
      ],
      actorTokenId: skeleton.id,
      to: { x: 160, y: 0 },
    })
    expect(resolved.ok).toBe(true)
    if (!resolved.ok) return
    expect(resolved.result.ok).toBe(true)
    expect(resolved.distanceFeet).toBe(55)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === skeleton.id)?.x).toBe(160)
  })

  it('spends the monster object interaction for one door and rejects a second door in the same route', () => {
    const goblin = token({ id: 'goblin', poolId: 'srd-5.1:goblin', x: 5, y: 5, hp: 7, maxHp: 7 })
    const hero = character()
    const heroToken = token({ id: 'hero-token', type: 'player', characterId: hero.id, x: 45, y: 5 })
    const battleMap = { ...map([goblin, heroToken]), width: 60, height: 10 }
    const geometry = createEmptyMapGeometry(battleMap.id, 1)
    geometry.doors.push(
      {
        id: 'door-1', kind: 'door', label: '门一', points: [{ x: 10, y: 0 }, { x: 10, y: 10 }],
        state: 'closed', secret: false, blocksVision: true, blocksMovement: true, blocksLineOfEffect: true,
        baseHeightFeet: 0, heightFeet: 10, createdAt: 1,
      },
      {
        id: 'door-2', kind: 'door', label: '门二', points: [{ x: 30, y: 0 }, { x: 30, y: 10 }],
        state: 'closed', secret: false, blocksVision: true, blocksMovement: true, blocksLineOfEffect: true,
        baseHeightFeet: 0, heightFeet: 10, createdAt: 1,
      },
    )
    setMapGeometryRuntime([geometry])
    const initiativeOrder = [
      { tokenId: goblin.id, label: goblin.label, emoji: '', color: '', roll: 20 },
      { tokenId: heroToken.id, label: heroToken.label, emoji: '', color: '', roll: 10 },
    ]
    expect(resolveDnd5eMonsterMapMove({
      combatId: 'combat', map: battleMap, characters: [hero], initiativeOrder,
      actorTokenId: goblin.id, to: { x: 35, y: 5 },
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })).toEqual({ ok: false, reason: 'movement-blocked' })

    geometry.doors.pop()
    setMapGeometryRuntime([geometry])
    const throughOneDoor = resolveDnd5eMonsterMapMove({
      combatId: 'combat', map: battleMap, characters: [hero], initiativeOrder,
      actorTokenId: goblin.id, to: { x: 25, y: 5 },
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })
    expect(throughOneDoor.ok).toBe(true)
    if (throughOneDoor.ok && throughOneDoor.result.ok) {
      expect(throughOneDoor.doorsToOpen).toEqual(['door-1'])
      expect(throughOneDoor.result.state.combatants[goblin.id].turn.objectInteractionAvailable).toBe(false)
    }
    const noInteraction = createDnd5eTurnEconomyCounts('turn', 30)
    noInteraction.objectInteraction!.current = 0
    expect(resolveDnd5eMonsterMapMove({
      combatId: 'combat', map: battleMap, characters: [hero], initiativeOrder,
      actorTokenId: goblin.id, to: { x: 25, y: 5 }, turnEconomy: noInteraction,
    })).toEqual({ ok: false, reason: 'object-interaction-unavailable' })
  })
})
