import { afterEach, describe, expect, it } from 'vitest'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { createEmptyMapGeometry, setMapGeometryRuntime } from '../../lib/mapGeometry'
import { createDnd5eTurnEconomyCounts } from './turnEconomy'
import { resolveDnd5eMonsterMapMove } from './monsterMoveAction'
import { planDnd5eMonsterTurn } from './monsterTurnPlanner'
import {
  createDnd5eConditionEffect,
  createDnd5eMechanicalEffect,
  dnd5eActiveEffectId,
} from './activeEffects'
import type { MonsterDecisionProvider } from './monsterDecisionProvider'
import { setDnd5eRoomMonsterCatalog } from './roomMonsterCatalog'
import { getDnd5eSrdMonster, type Dnd5eMonsterStatBlock } from './monsters'

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
  afterEach(() => {
    setMapGeometryRuntime([])
    setDnd5eRoomMonsterCatalog([])
  })
  it('uses a ranged stat-block action after a legal tactical reposition without AP', () => {
    const goblin = token({ id: 'goblin', label: '哥布林', poolId: 'srd-5.1:goblin', hp: 7, maxHp: 7 })
    const hero = token({ id: 'hero-token', label: '英雄', type: 'player', characterId: 'hero', x: 50, hp: 20, maxHp: 20 })
    const plan = planDnd5eMonsterTurn(map([goblin, hero]), goblin)
    expect(plan).toMatchObject({ attacked: true, actionIndex: 1, attackerTokenId: goblin.id, targetTokenId: hero.id })
    expect(plan.moveApSpent).toBeUndefined()
  })

  it('moves between Multiattack strikes only within the remaining movement budget', () => {
    const monster = getDnd5eSrdMonster('srd-5.1:owlbear')!
    const clawsIndex = monster.actions.findIndex((action) =>
      action.id === 'claws')
    const owlbear = token({
      id: 'owlbear',
      label: 'Owlbear',
      poolId: monster.id,
      hp: monster.hitPoints.average,
      maxHp: monster.hitPoints.average,
    })
    const defeated = token({
      id: 'defeated',
      label: 'Defeated hero',
      type: 'player',
      characterId: 'defeated-character',
      x: 10,
      hp: 0,
      maxHp: 20,
    })
    const nextTarget = token({
      id: 'next-target',
      label: 'Next hero',
      type: 'player',
      characterId: 'next-character',
      x: 50,
      hp: 20,
      maxHp: 20,
    })
    const characters = [
      character({
        id: 'defeated-character',
        currentHp: 0,
        maxHp: 20,
      }),
      character({
        id: 'next-character',
        currentHp: 20,
        maxHp: 20,
      }),
    ]
    const economy = {
      ...createDnd5eTurnEconomyCounts('combat:1:owlbear'),
      movement: { current: 30, max: 30 },
    }

    const reachable = planDnd5eMonsterTurn(
      map([owlbear, defeated, nextTarget]),
      owlbear,
      characters,
      {
        requiredActionId: 'claws',
        requiredTargetId: nextTarget.id,
        movementBudgetFeet: 30,
        turnEconomy: economy,
      },
    )
    expect(reachable).toMatchObject({
      attacked: true,
      moved: true,
      actionIndex: clawsIndex,
      targetTokenId: nextTarget.id,
    })

    const unreachable = planDnd5eMonsterTurn(
      map([owlbear, defeated, { ...nextTarget, x: 100 }]),
      owlbear,
      characters,
      {
        requiredActionId: 'claws',
        requiredTargetId: nextTarget.id,
        movementBudgetFeet: 5,
        turnEconomy: {
          ...economy,
          movement: { current: 5, max: 30 },
        },
      },
    )
    expect(unreachable.attacked).toBe(false)
  })

  it('excludes targets forbidden by an earlier Multiattack occurrence', () => {
    const monster = getDnd5eSrdMonster('srd-5.1:tyrannosaurus-rex')!
    const tailIndex = monster.actions.findIndex((action) =>
      action.id === 'tail')
    const tyrannosaurus = token({
      id: 'tyrannosaurus',
      label: 'Tyrannosaurus',
      poolId: monster.id,
      hp: monster.hitPoints.average,
      maxHp: monster.hitPoints.average,
    })
    const firstTarget = token({
      id: 'first-target',
      label: 'First hero',
      type: 'player',
      characterId: 'first-character',
      x: 10,
      hp: 20,
      maxHp: 20,
    })
    const secondTarget = token({
      id: 'second-target',
      label: 'Second hero',
      type: 'player',
      characterId: 'second-character',
      x: 20,
      hp: 20,
      maxHp: 20,
    })
    const plan = planDnd5eMonsterTurn(
      map([tyrannosaurus, firstTarget, secondTarget]),
      tyrannosaurus,
      [
        character({ id: 'first-character' }),
        character({ id: 'second-character' }),
      ],
      {
        requiredActionId: 'tail',
        excludedTargetIds: [firstTarget.id],
        movementBudgetFeet: 30,
        turnEconomy:
          createDnd5eTurnEconomyCounts('combat:1:tyrannosaurus'),
      },
    )
    expect(plan).toMatchObject({
      attacked: true,
      actionIndex: tailIndex,
      targetTokenId: secondTarget.id,
    })
  })

  it('allocates the Tyrannosaurus Bite and Tail to different targets', () => {
    const monster = getDnd5eSrdMonster('srd-5.1:tyrannosaurus-rex')!
    const multiattackIndex = monster.actions.findIndex((action) =>
      action.id === 'multiattack')
    const tyrannosaurus = token({
      id: 'tyrannosaurus',
      label: 'Tyrannosaurus',
      poolId: monster.id,
      hp: monster.hitPoints.average,
      maxHp: monster.hitPoints.average,
    })
    const heroA = token({
      id: 'hero-a-token',
      label: 'Hero A',
      type: 'player',
      characterId: 'hero-a',
      x: 10,
      hp: 40,
      maxHp: 40,
    })
    const heroB = token({
      id: 'hero-b-token',
      label: 'Hero B',
      type: 'player',
      characterId: 'hero-b',
      x: 20,
      hp: 40,
      maxHp: 40,
    })
    const forceMultiattack: MonsterDecisionProvider = {
      id: 'test:tyrannosaurus-split',
      schemaVersion: 1,
      scoreCandidate(_context, candidate) {
        return {
          candidateId: candidate.id,
          score: candidate.id.startsWith(
            `attack:${heroA.id}:${multiattackIndex}:`,
          ) ? 10_000 : -10_000,
          reasons: [],
        }
      },
    }

    const plan = planDnd5eMonsterTurn(
      map([tyrannosaurus, heroA, heroB]),
      tyrannosaurus,
      [
        character({
          id: 'hero-a',
          name: 'Hero A',
          currentHp: 40,
          maxHp: 40,
        }),
        character({
          id: 'hero-b',
          name: 'Hero B',
          currentHp: 40,
          maxHp: 40,
        }),
      ],
      { decisionProvider: forceMultiattack },
    )

    expect(plan).toMatchObject({
      attacked: true,
      actionIndex: multiattackIndex,
      targetTokenId: heroA.id,
      attackTargetTokenIds: [heroA.id, heroB.id],
    })
  })

  it('uses the Hydra current head count when planning Bite occurrences', () => {
    const monster = getDnd5eSrdMonster('srd-5.1:hydra')!
    const multiattackIndex = monster.actions.findIndex((action) =>
      action.id === 'multiattack')
    const hydra = token({
      id: 'hydra',
      label: 'Hydra',
      poolId: monster.id,
      hp: monster.hitPoints.average,
      maxHp: monster.hitPoints.average,
      dnd5eCombatState: { monsterHydraHeadCount: 3 },
    })
    const hero = token({
      id: 'hero-token',
      label: 'Hero',
      type: 'player',
      characterId: 'hero',
      x: 10,
      hp: 80,
      maxHp: 80,
    })
    const forceMultiattack: MonsterDecisionProvider = {
      id: 'test:hydra-runtime-heads',
      schemaVersion: 1,
      scoreCandidate(_context, candidate) {
        return {
          candidateId: candidate.id,
          score: candidate.id.startsWith(
            `attack:${hero.id}:${multiattackIndex}:`,
          ) ? 10_000 : -10_000,
          reasons: [],
        }
      },
    }

    const plan = planDnd5eMonsterTurn(
      map([hydra, hero]),
      hydra,
      [character({ currentHp: 80, maxHp: 80 })],
      { decisionProvider: forceMultiattack },
    )

    expect(plan.attackTargetTokenIds).toEqual([
      hero.id,
      hero.id,
      hero.id,
    ])
  })

  it('plans three distinct Kraken Flings without treating CR as a character level', () => {
    const monster = getDnd5eSrdMonster('srd-5.1:kraken')!
    const multiattackIndex = monster.actions.findIndex((action) =>
      action.id === 'multiattack-flings')
    const kraken = token({
      id: 'kraken',
      label: 'Kraken',
      poolId: monster.id,
      x: 100,
      y: 50,
      hp: monster.hitPoints.average,
      maxHp: monster.hitPoints.average,
    })
    const targetPositions = [
      { x: 120, y: 50 },
      { x: 80, y: 50 },
      { x: 100, y: 70 },
    ]
    const heroes = ['a', 'b', 'c'].map((suffix, index) => {
      const id = `hero-${suffix}-token`
      const relation = createDnd5eConditionEffect({
        id: `kraken-tentacle-${suffix}`,
        condition: 'grappled',
        source: {
          kind: 'monster',
          actorId: kraken.id,
          rulesId: `monster:${monster.id}:tentacle`,
        },
        targetId: id,
        relation: {
          schemaVersion: 1,
          kind: 'grapple',
          sourceActorId: kraken.id,
          sourceActionId: 'tentacle',
          slotGroup: 'tentacle',
          maxDistanceFeet: 30,
          movement: 'drag-target',
          endsOnSourceIncapacitated: true,
        },
      })
      return token({
        id,
        label: `Hero ${suffix.toUpperCase()}`,
        type: 'player',
        characterId: `hero-${suffix}`,
        ...targetPositions[index],
        hp: 100,
        maxHp: 100,
        dnd5eCombatState: {
          schemaVersion: 2,
          activeEffects: [relation],
          conditions: ['grappled'],
        },
      })
    })
    const forceFlings: MonsterDecisionProvider = {
      id: 'test:kraken-three-flings',
      schemaVersion: 1,
      scoreCandidate(_context, candidate) {
        return {
          candidateId: candidate.id,
          score:
            candidate.id.startsWith('attack:') &&
            candidate.id.includes(`:${multiattackIndex}:`)
              ? 10_000
              : -10_000,
          reasons: [],
        }
      },
    }

    const plan = planDnd5eMonsterTurn(
      map([kraken, ...heroes]),
      kraken,
      heroes.map((hero, index) =>
        character({
          id: hero.characterId!,
          name: hero.label,
          currentHp: 100,
          maxHp: 100,
          ac: 14 + index,
        })),
      { decisionProvider: forceFlings },
    )

    expect(plan.actionIndex).toBe(multiattackIndex)
    expect(plan.attackTargetTokenIds).toHaveLength(3)
    expect(new Set(plan.attackTargetTokenIds)).toEqual(
      new Set(heroes.map((hero) => hero.id)),
    )
  })

  it('scores the Bugbear javelin with melee damage at 5 feet and ranged damage at 30 feet', () => {
    const bugbear = token({
      id: 'bugbear',
      label: 'Bugbear',
      poolId: 'srd-5.1:bugbear',
      hp: 27,
      maxHp: 27,
    })
    const hero = token({
      id: 'hero-token',
      label: 'Hero',
      type: 'player',
      characterId: 'hero',
      hp: 20,
      maxHp: 20,
    })
    const providerForDistance = (distanceFeet: number): MonsterDecisionProvider => ({
      id: `test:bugbear-javelin:${distanceFeet}`,
      schemaVersion: 1,
      scoreCandidate(_context, candidate) {
        const selected = candidate.id.startsWith(`attack:${hero.id}:1:`) &&
          candidate.metrics.targetDistanceFeet === distanceFeet
        return {
          candidateId: candidate.id,
          score: selected ? 10_000 : -10_000,
          reasons: [],
        }
      },
    })
    const planAt = (x: number, distanceFeet: number) => planDnd5eMonsterTurn(
      map([bugbear, { ...hero, x }]),
      bugbear,
      [character()],
      { decisionProvider: providerForDistance(distanceFeet) },
    )

    const melee = planAt(10, 5)
    expect(melee).toMatchObject({
      attacked: true,
      actionIndex: 1,
      attack: {
        sides: 6,
        bonus: 2,
        total: 9,
        label: expect.stringContaining('2d6+2'),
      },
      damage: 9,
      decision: {
        metrics: {
          targetDistanceFeet: 5,
          hitProbability: 0.55,
        },
      },
    })
    expect(melee.decision?.metrics?.expectedDamage).toBeCloseTo(4.95, 5)

    const ranged = planAt(60, 30)
    expect(ranged).toMatchObject({
      attacked: true,
      actionIndex: 1,
      attack: {
        sides: 6,
        bonus: 2,
        total: 5,
        label: expect.stringContaining('1d6+2'),
      },
      damage: 5,
      decision: {
        metrics: {
          targetDistanceFeet: 30,
          hitProbability: 0.55,
        },
      },
    })
    expect(ranged.decision?.metrics?.expectedDamage).toBeCloseTo(2.75, 5)
  })

  it('includes both indexed Assassin poison riders in Multiattack expected damage', () => {
    const assassin = token({
      id: 'assassin',
      label: 'Assassin',
      poolId: 'srd-5.1:assassin',
      hp: 78,
      maxHp: 78,
    })
    const hero = token({
      id: 'hero-token',
      label: 'Hero',
      type: 'player',
      characterId: 'hero',
      x: 10,
      hp: 100,
      maxHp: 100,
    })
    const forceMultiattack: MonsterDecisionProvider = {
      id: 'test:assassin-poison-multiattack',
      schemaVersion: 1,
      scoreCandidate(_context, candidate) {
        return {
          candidateId: candidate.id,
          score: candidate.id.startsWith(`attack:${hero.id}:0:`) ? 10_000 : -10_000,
          reasons: [],
        }
      },
    }

    const plan = planDnd5eMonsterTurn(
      map([assassin, hero]),
      assassin,
      [character({
        maxHp: 100,
        currentHp: 100,
        ac: 14,
        abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      })],
      { decisionProvider: forceMultiattack },
    )

    expect(plan).toMatchObject({
      attacked: true,
      actionIndex: 0,
      decision: {
        metrics: {
          hitProbability: 0.65,
        },
      },
    })
    // Each attack: (6 piercing + 24 poison * (70% full + 30% half)) * 65% hit.
    expect(plan.decision?.metrics?.expectedDamage).toBeCloseTo(34.32, 5)
    expect(plan.decision?.metrics?.expectedDamage).toBeGreaterThan(7.8)
  })

  it('does not prefer a high raw-damage weapon that the target conditionally ignores', () => {
    const goblin = getDnd5eSrdMonster('srd-5.1:goblin')!
    const ordinaryAttacker: Dnd5eMonsterStatBlock = {
      ...goblin,
      id: 'dm-custom:defense-aware-attacker',
      slug: 'defense-aware-attacker',
      name: '防御感知攻击者',
      englishName: 'Defense-aware Attacker',
      speed: { walk: 0 },
      actions: [
        {
          ...goblin.actions[0],
          id: 'huge-ordinary-slash',
          name: '巨力普通斩击',
          kind: 'weapon-attack',
          automation: 'headless',
          attack: {
            mode: 'melee',
            toHit: 20,
            reachFeet: 5,
            target: '一个目标',
            damage: [{
              count: 10,
              sides: 10,
              bonus: 0,
              average: 55,
              type: 'slashing',
            }],
          },
        },
        {
          ...goblin.actions[0],
          id: 'small-fire-strike',
          name: '微火打击',
          kind: 'weapon-attack',
          automation: 'headless',
          attack: {
            mode: 'melee',
            toHit: 20,
            reachFeet: 5,
            target: '一个目标',
            damage: [{
              count: 1,
              sides: 4,
              bonus: 0,
              average: 2,
              type: 'fire',
            }],
          },
        },
      ],
      traits: [],
    }
    const magicAttacker: Dnd5eMonsterStatBlock = {
      ...ordinaryAttacker,
      id: 'dm-custom:defense-aware-magic-attacker',
      slug: 'defense-aware-magic-attacker',
      name: '魔法防御感知攻击者',
      traits: [{
        name: '魔法武器',
        description: '武器攻击视为魔法攻击。',
        automation: 'headless',
        rule: { kind: 'magic-weapons', weaponAttacksMagical: true },
      }],
    }
    setDnd5eRoomMonsterCatalog([ordinaryAttacker, magicAttacker])
    const target = token({
      id: 'werewolf-target',
      label: '狼人目标',
      type: 'player',
      poolId: 'srd-5.1:werewolf-hybrid',
      x: 10,
      hp: 58,
      maxHp: 58,
    })
    const planFor = (monster: Dnd5eMonsterStatBlock) => {
      const attacker = token({
        id: `${monster.id}:token`,
        label: monster.name,
        poolId: monster.id,
        hp: monster.hitPoints.average,
        maxHp: monster.hitPoints.average,
      })
      return planDnd5eMonsterTurn(map([attacker, target]), attacker)
    }

    const ordinaryPlan = planFor(ordinaryAttacker)
    expect(ordinaryPlan).toMatchObject({
      attacked: true,
      actionIndex: 1,
      decision: { metrics: { expectedDamage: expect.any(Number) } },
    })
    expect(ordinaryPlan.decision?.metrics?.expectedDamage).toBeGreaterThan(0)

    const magicalPlan = planFor(magicAttacker)
    expect(magicalPlan).toMatchObject({
      attacked: true,
      actionIndex: 0,
      decision: { metrics: { expectedDamage: expect.any(Number) } },
    })
    expect(magicalPlan.decision?.metrics?.expectedDamage)
      .toBeGreaterThan(ordinaryPlan.decision?.metrics?.expectedDamage ?? 0)
  })

  it('scores structured Pack Tactics as advantage and cancels it against Dodge', () => {
    const rat = token({
      id: 'rat',
      label: 'Giant Rat',
      poolId: 'srd-5.1:giant-rat',
      hp: 7,
      maxHp: 7,
    })
    const ally = token({
      id: 'rat-ally',
      label: 'Giant Rat Ally',
      poolId: 'srd-5.1:giant-rat',
      x: 20,
      hp: 7,
      maxHp: 7,
    })
    const heroToken = token({
      id: 'hero-token',
      label: 'Hero',
      type: 'player',
      characterId: 'hero',
      x: 10,
      hp: 20,
      maxHp: 20,
    })
    const selectFiveFootBite: MonsterDecisionProvider = {
      id: 'test:pack-tactics',
      schemaVersion: 1,
      scoreCandidate(_context, candidate) {
        const selected = candidate.id.startsWith('attack:hero-token:0:') &&
          candidate.metrics.targetDistanceFeet === 5
        return { candidateId: candidate.id, score: selected ? 10_000 : -10_000, reasons: [] }
      },
    }
    const plan = (hero: Character, allyToken = ally) => planDnd5eMonsterTurn(
      map([rat, allyToken, heroToken]),
      rat,
      [hero],
      { decisionProvider: selectFiveFootBite },
    )

    expect(plan(character()).decision?.metrics?.hitProbability).toBeCloseTo(0.7975, 5)
    expect(plan(character({
      dnd5eCombatState: { dodgingTurnKey: 'combat:round:turn' },
    })).decision?.metrics?.hitProbability).toBeCloseTo(0.55, 5)

    const incapacitatedAlly = {
      ...ally,
      dnd5eCombatState: {
        activeEffects: [createDnd5eConditionEffect({
          condition: 'incapacitated',
          targetId: ally.id,
          source: { kind: 'system', rulesId: 'test-incapacitated' },
        })],
      },
    }
    expect(plan(character(), incapacitatedAlly).decision?.metrics?.hitProbability).toBeCloseTo(0.55, 5)
    expect(plan(character(), { ...ally, hp: 0 }).decision?.metrics?.hitProbability).toBeCloseTo(0.55, 5)
  })

  it('plans Cult Fanatic Multiattack only in melee and keeps one ranged dagger candidate', () => {
    const fanatic = token({
      id: 'cult-fanatic',
      label: 'Cult Fanatic',
      poolId: 'srd-5.1:cult-fanatic',
      hp: 22,
      maxHp: 22,
    })
    const hero = token({
      id: 'hero-token',
      label: 'Hero',
      type: 'player',
      characterId: 'hero',
      hp: 20,
      maxHp: 20,
    })
    const selectActionAtDistance = (
      actionIndex: number,
      distanceFeet: number,
    ): MonsterDecisionProvider => ({
      id: `test:cult-fanatic:${actionIndex}:${distanceFeet}`,
      schemaVersion: 1,
      scoreCandidate(_context, candidate) {
        const selected = candidate.id.startsWith(`attack:${hero.id}:${actionIndex}:`) &&
          candidate.metrics.targetDistanceFeet === distanceFeet
        return {
          candidateId: candidate.id,
          score: selected ? 10_000 : -10_000,
          reasons: [],
        }
      },
    })

    const melee = planDnd5eMonsterTurn(
      map([fanatic, { ...hero, x: 10 }]),
      fanatic,
      [character()],
      { decisionProvider: selectActionAtDistance(0, 5) },
    )
    expect(melee).toMatchObject({
      attacked: true,
      actionIndex: 0,
      decision: { metrics: { targetDistanceFeet: 5 } },
    })

    const ranged = planDnd5eMonsterTurn(
      map([fanatic, { ...hero, x: 40 }]),
      fanatic,
      [character()],
      { decisionProvider: selectActionAtDistance(1, 20) },
    )
    expect(ranged).toMatchObject({
      attacked: true,
      actionIndex: 1,
      decision: { metrics: { targetDistanceFeet: 20 } },
    })
  })

  it('plans the Barbed Devil three-hit melee sequence up close and two Hurl Flames at range', () => {
    const monster = getDnd5eSrdMonster('srd-5.1:barbed-devil')!
    const meleeIndex = monster.actions.findIndex((action) => action.id === 'multiattack')
    const rangedIndex = monster.actions.findIndex((action) =>
      action.id === 'multiattack-hurl-flame')
    const devil = token({
      id: 'barbed-devil',
      label: 'Barbed Devil',
      poolId: monster.id,
      hp: monster.hitPoints.average,
      maxHp: monster.hitPoints.average,
    })
    const hero = token({
      id: 'hero-token',
      label: 'Hero',
      type: 'player',
      characterId: 'hero',
      hp: 100,
      maxHp: 100,
    })
    const selectActionAtDistance = (
      actionIndex: number,
      distanceFeet: number,
    ): MonsterDecisionProvider => ({
      id: `test:barbed-devil:${actionIndex}:${distanceFeet}`,
      schemaVersion: 1,
      scoreCandidate(_context, candidate) {
        const selected = candidate.id.startsWith(`attack:${hero.id}:${actionIndex}:`) &&
          candidate.metrics.targetDistanceFeet === distanceFeet &&
          candidate.metrics.movementFeet === 0
        return {
          candidateId: candidate.id,
          score: selected ? 10_000 : -10_000,
          reasons: [],
        }
      },
    })
    const planAt = (
      targetX: number,
      actionIndex: number,
      distanceFeet: number,
    ) => planDnd5eMonsterTurn(
      map([devil, { ...hero, x: targetX }]),
      devil,
      [character({ maxHp: 100, currentHp: 100, ac: 14 })],
      { decisionProvider: selectActionAtDistance(actionIndex, distanceFeet) },
    )

    expect(monster.actions[meleeIndex]).toMatchObject({
      sequence: ['tail', 'claw', 'claw'],
      sequenceAttackMode: 'melee',
    })
    expect(monster.actions[rangedIndex]).toMatchObject({
      sequence: ['hurl-flame', 'hurl-flame'],
      sequenceAttackMode: 'ranged',
    })

    const melee = planAt(10, meleeIndex, 5)
    expect(melee).toMatchObject({
      attacked: true,
      actionIndex: meleeIndex,
      decision: {
        metrics: {
          targetDistanceFeet: 5,
          hitProbability: 0.65,
          expectedDamage: 14.3,
        },
      },
    })

    const ranged = planAt(80, rangedIndex, 40)
    expect(ranged).toMatchObject({
      attacked: true,
      actionIndex: rangedIndex,
      decision: {
        metrics: {
          targetDistanceFeet: 40,
          hitProbability: 0.6,
          expectedDamage: 12,
        },
      },
    })
  })

  it('selects an authoritative recharge area action when a dragon can catch hostile targets without allies', () => {
    const dragon = token({
      id: 'dragon', label: '成年黑龙', poolId: 'srd-5.1:adult-black-dragon',
      x: 5, y: 45, hp: 195, maxHp: 195,
      dnd5eCombatState: { monsterRechargeReadyByActionId: { 'acid-breath': true } },
    })
    const first = token({ id: 'first', label: '第一名英雄', type: 'player', characterId: 'first-character', x: 45, y: 45 })
    const second = token({ id: 'second', label: '第二名英雄', type: 'player', characterId: 'second-character', x: 85, y: 45 })
    const plan = planDnd5eMonsterTurn(map([dragon, first, second]), dragon, [
      character({ id: 'first-character', currentHp: 120, maxHp: 120 }),
      character({ id: 'second-character', currentHp: 120, maxHp: 120 }),
    ])

    expect(plan).toMatchObject({
      attacked: false,
      areaAction: {
        actionId: 'acid-breath',
        targetTokenIds: expect.arrayContaining([first.id, second.id]),
        saveAbility: 'dex',
        saveDc: 18,
      },
    })
  })

  it('actively selects the Behir lightning breath when it can cover multiple hostiles', () => {
    const behir = token({
      id: 'behir',
      label: 'Behir',
      poolId: 'srd-5.1:behir',
      x: 5,
      y: 45,
      hp: 168,
      maxHp: 168,
      dnd5eCombatState: { monsterRechargeReadyByActionId: { 'lightning-breath': true } },
    })
    const first = token({
      id: 'first',
      label: 'First Hero',
      type: 'player',
      characterId: 'first-character',
      x: 25,
      y: 45,
    })
    const second = token({
      id: 'second',
      label: 'Second Hero',
      type: 'player',
      characterId: 'second-character',
      x: 35,
      y: 45,
    })
    const plan = planDnd5eMonsterTurn(map([behir, first, second]), behir, [
      character({ id: 'first-character', currentHp: 120, maxHp: 120 }),
      character({ id: 'second-character', currentHp: 120, maxHp: 120 }),
    ])

    expect(plan.areaAction).toMatchObject({
      actionId: 'lightning-breath',
      targetTokenIds: expect.arrayContaining([first.id, second.id]),
      saveAbility: 'dex',
      saveDc: 16,
      damage: { diceCount: 12, diceSides: 10, damageType: 'lightning' },
    })
  })

  it('selects Ankheg Acid Spray for two aligned hostiles when recharge is ready', () => {
    const ankheg = token({
      id: 'ankheg',
      label: 'Ankheg',
      poolId: 'srd-5.1:ankheg',
      x: 20,
      y: 50,
      size: 2,
      hp: 39,
      maxHp: 39,
      dnd5eCombatState: {
        monsterRechargeReadyByActionId: { 'acid-spray': true },
      },
    })
    const first = token({
      id: 'first',
      label: 'First Hero',
      type: 'player',
      characterId: 'first-character',
      x: 55,
      y: 45,
      hp: 100,
      maxHp: 100,
    })
    const second = token({
      id: 'second',
      label: 'Second Hero',
      type: 'player',
      characterId: 'second-character',
      x: 85,
      y: 45,
      hp: 100,
      maxHp: 100,
    })

    const plan = planDnd5eMonsterTurn(
      map([ankheg, first, second]),
      ankheg,
      [
        character({ id: 'first-character', currentHp: 100, maxHp: 100 }),
        character({ id: 'second-character', currentHp: 100, maxHp: 100 }),
      ],
    )

    expect(plan).toMatchObject({
      attacked: false,
      attackerTokenId: ankheg.id,
      areaAction: {
        actionId: 'acid-spray',
        targetTokenIds: [first.id, second.id],
        saveAbility: 'dex',
        saveDc: 13,
        damage: { diceCount: 3, diceSides: 6, damageType: 'acid' },
      },
    })
    expect(plan.decision?.providerId).toBe('dnd5e:deterministic-tactical-v3')
  })

  it('can freely release an Ankheg Bite grapple before selecting Acid Spray', () => {
    const ankheg = token({
      id: 'ankheg',
      label: 'Ankheg',
      poolId: 'srd-5.1:ankheg',
      x: 5,
      y: 5,
      hp: 39,
      maxHp: 39,
      dnd5eCombatState: {
        monsterRechargeReadyByActionId: { 'acid-spray': true },
      },
    })
    const ankhegDefinition = getDnd5eSrdMonster('srd-5.1:ankheg')!
    const biteDeclaration = ankhegDefinition.actions
      .find((action) => action.id === 'bite')
      ?.attack?.onHitEffects?.find((effect) => effect.kind === 'source-linked-condition')
    if (!biteDeclaration) throw new Error('Ankheg Bite relation fixture is missing')
    const linkedEffectId = dnd5eActiveEffectId(
      'relation',
      'grapple',
      ankheg.id,
      biteDeclaration.relation.slotGroup,
      'held-token',
    )
    const linkedEffect = createDnd5eConditionEffect({
      id: linkedEffectId,
      condition: 'grappled',
      source: {
        kind: 'monster',
        actorId: ankheg.id,
        rulesId: `monster:${ankhegDefinition.id}:bite:${biteDeclaration.id}`,
      },
      targetId: 'held-token',
      stackingKey: linkedEffectId,
      duration: { type: 'permanent' },
      escapeCheck: {
        ability: 'str',
        skill: 'athletics',
        alternativeAbility: 'dex',
        alternativeSkill: 'acrobatics',
        dc: biteDeclaration.escapeDc!,
        economy: 'action',
      },
      relation: {
        schemaVersion: 1,
        kind: 'grapple',
        sourceActorId: ankheg.id,
        sourceActionId: 'bite',
        slotGroup: biteDeclaration.relation.slotGroup,
        maxDistanceFeet: biteDeclaration.relation.maxDistanceFeet,
        movement: 'drag-target',
        endsOnSourceIncapacitated: true,
      },
    })
    const heldCharacter = character({
      id: 'held-character',
      name: 'Held Hero',
      dnd5eCombatState: {
        schemaVersion: 2,
        activeEffects: [linkedEffect],
      },
      conditions: ['grappled'],
    })
    const held = token({
      id: 'held-token',
      label: heldCharacter.name,
      type: 'player',
      characterId: heldCharacter.id,
      x: 15,
      y: 5,
      hp: 40,
      maxHp: 40,
    })
    const freeCharacter = character({ id: 'free-character', name: 'Free Hero' })
    const free = token({
      id: 'free-token',
      label: freeCharacter.name,
      type: 'player',
      characterId: freeCharacter.id,
      x: 25,
      y: 5,
      hp: 40,
      maxHp: 40,
    })

    const selectReleasedAcidSpray: MonsterDecisionProvider = {
      id: 'test:select-released-acid-spray',
      schemaVersion: 1,
      scoreCandidate(_context, candidate) {
        return {
          candidateId: candidate.id,
          score:
            candidate.id.startsWith(`release-grapple:${held.id}:`) &&
            candidate.id.includes(':1:default:')
              ? 10_000
              : -10_000,
          reasons: [],
        }
      },
    }
    const plan = planDnd5eMonsterTurn(
      map([ankheg, held, free]),
      ankheg,
      [heldCharacter, freeCharacter],
      { decisionProvider: selectReleasedAcidSpray },
    )

    expect(plan).toMatchObject({
      attacked: false,
      releaseGrapple: { targetId: held.id, effectId: linkedEffect.id },
      areaAction: {
        actionId: 'acid-spray',
        targetTokenIds: expect.arrayContaining([held.id, free.id]),
      },
    })
    expect(plan.decision?.candidateId).toContain(`release-grapple:${held.id}:`)
    expect(plan.decision?.candidateId).toContain(linkedEffect.id)
    expect(plan.areaAction?.targetTokenIds).toHaveLength(2)
  })

  it.each([
    ['超大型'],
    ['巨型'],
  ] as const)(
    'does not offer Behir Constrict or a containing Multiattack against a %s target',
    (creatureSize) => {
      const catalog = getDnd5eSrdMonster('srd-5.1:behir')!
      const monster = {
        ...catalog,
        id: `room-monster:behir-size-limit-${creatureSize}`,
        slug: `behir-size-limit-${creatureSize}`,
        actions: catalog.actions.map((action) =>
          action.id === 'constrict' && action.attack
            ? {
                ...action,
                attack: {
                  ...action.attack,
                  targetMaxSizeRank: 3,
                },
              }
            : action),
      } as Dnd5eMonsterStatBlock
      setDnd5eRoomMonsterCatalog([monster])
      const behir = token({
        id: 'size-limit-behir',
        label: 'Behir',
        poolId: monster.id,
        x: 5,
        y: 5,
        hp: monster.hitPoints.average,
        maxHp: monster.hitPoints.average,
      })
      const hero = character({
        id: 'size-limit-hero',
        name: 'Oversized Hero',
        currentHp: 300,
        maxHp: 300,
      })
      const target = token({
        id: 'size-limit-target',
        label: hero.name,
        type: 'player',
        characterId: hero.id,
        creatureSize,
        x: 15,
        y: 5,
        hp: hero.currentHp,
        maxHp: hero.maxHp,
      })
      const constrictIndex = monster.actions.findIndex((action) => action.id === 'constrict')
      const containingMultiattackIndexes = monster.actions.flatMap((action, index) =>
        action.kind === 'multiattack' && action.sequence?.includes('constrict')
          ? [index]
          : [])
      const observedIds: string[] = []
      const observer: MonsterDecisionProvider = {
        id: 'test:observe-behir-size-candidates',
        schemaVersion: 1,
        scoreCandidate(_context, candidate) {
          observedIds.push(candidate.id)
          return { candidateId: candidate.id, score: 0, reasons: [] }
        },
      }

      planDnd5eMonsterTurn(
        map([behir, target]),
        behir,
        [hero],
        { decisionProvider: observer },
      )

      expect(observedIds.some((id) =>
        id.startsWith(`attack:${target.id}:${constrictIndex}:`) ||
        containingMultiattackIndexes.some((index) =>
          id.startsWith(`attack:${target.id}:${index}:`)))).toBe(false)
    },
  )

  it('offers a fixed-DC source-linked escape without generating movement while grappled', () => {
    const goblin = token({
      id: 'grappled-goblin',
      label: 'Grappled Goblin',
      poolId: 'srd-5.1:goblin',
      x: 5,
      y: 5,
      hp: 7,
      maxHp: 7,
    })
    const grappler = token({
      id: 'ankheg-grappler-token',
      label: 'Ankheg Grappler',
      poolId: 'srd-5.1:ankheg',
      x: 15,
      y: 5,
      hp: 39,
      maxHp: 39,
    })
    const fallbackCharacter = character({
      id: 'fixed-escape-fallback-character',
      name: 'Fixed Escape Fallback',
    })
    const fallback = token({
      id: 'fixed-escape-fallback-token',
      label: fallbackCharacter.name,
      type: 'player',
      characterId: fallbackCharacter.id,
      x: 25,
      y: 5,
      hp: fallbackCharacter.currentHp,
      maxHp: fallbackCharacter.maxHp,
    })
    const ankhegDefinition = getDnd5eSrdMonster('srd-5.1:ankheg')!
    const biteDeclaration = ankhegDefinition.actions
      .find((action) => action.id === 'bite')
      ?.attack?.onHitEffects?.find((effect) => effect.kind === 'source-linked-condition')
    if (!biteDeclaration) throw new Error('Ankheg Bite relation fixture is missing')
    const grappleId = dnd5eActiveEffectId(
      'relation',
      'grapple',
      grappler.id,
      biteDeclaration.relation.slotGroup,
      goblin.id,
    )
    const grapple = createDnd5eConditionEffect({
      id: grappleId,
      condition: 'grappled',
      source: {
        kind: 'monster',
        actorId: grappler.id,
        rulesId: `monster:${ankhegDefinition.id}:bite:${biteDeclaration.id}`,
      },
      targetId: goblin.id,
      stackingKey: grappleId,
      duration: { type: 'permanent' },
      escapeCheck: {
        ability: 'str',
        skill: 'athletics',
        alternativeAbility: 'dex',
        alternativeSkill: 'acrobatics',
        dc: biteDeclaration.escapeDc!,
        economy: 'action',
      },
      relation: {
        schemaVersion: 1,
        kind: 'grapple',
        sourceActorId: grappler.id,
        sourceActionId: 'bite',
        slotGroup: biteDeclaration.relation.slotGroup,
        maxDistanceFeet: biteDeclaration.relation.maxDistanceFeet,
        movement: 'drag-target',
        endsOnSourceIncapacitated: true,
      },
    })
    const grappledGoblin = {
      ...goblin,
      dnd5eCombatState: {
        schemaVersion: 2 as const,
        activeEffects: [
          grapple,
          createDnd5eConditionEffect({
            id: 'escape-poisoned',
            condition: 'poisoned',
            source: { kind: 'system', rulesId: 'test-poisoned' },
            targetId: goblin.id,
          }),
        ],
        // Deliberately stale: derive the speed lock from Active Effects.
        conditions: [],
      },
    }
    const seenMovement: number[] = []
    const selectEscape: MonsterDecisionProvider = {
      id: 'test:select-fixed-dc-escape',
      schemaVersion: 1,
      scoreCandidate(_context, candidate) {
        seenMovement.push(candidate.metrics.movementFeet)
        return {
          candidateId: candidate.id,
          score: candidate.id === `escape-active-effect:${grapple.id}` ? 10_000 : -10_000,
          reasons: [],
        }
      },
    }

    const plan = planDnd5eMonsterTurn(
      map([grappledGoblin, grappler, fallback]),
      grappledGoblin,
      [fallbackCharacter],
      { decisionProvider: selectEscape },
    )

    expect(plan).toMatchObject({
      moved: false,
      attacked: false,
      targetTokenId: grappler.id,
      escapeActiveEffect: { effectId: grapple.id, dc: 13 },
      decision: {
        candidateId: `escape-active-effect:${grapple.id}`,
        metrics: {
          movementFeet: 0,
          consumesAction: true,
          hitProbability: 0.25,
        },
      },
    })
    expect(seenMovement.every((movement) => movement === 0)).toBe(true)
  })

  it('scores a basic grapple escape as an opposed check instead of a fixed 50 percent', () => {
    const goblin = token({
      id: 'opposed-grappled-goblin',
      label: 'Opposed Grappled Goblin',
      poolId: 'srd-5.1:goblin',
      x: 5,
      y: 5,
      hp: 7,
      maxHp: 7,
    })
    const grapplerCharacter = character({
      id: 'expert-grappler-character',
      name: 'Expert Grappler',
      level: 17,
      abilities: { str: 20, dex: 10, con: 14, int: 10, wis: 10, cha: 10 },
      skills: ['athletics'],
    })
    const grappler = token({
      id: 'expert-grappler-token',
      label: grapplerCharacter.name,
      type: 'player',
      characterId: grapplerCharacter.id,
      x: 15,
      y: 5,
      hp: 40,
      maxHp: 40,
    })
    const grapple = createDnd5eConditionEffect({
      id: 'opposed-basic-grapple',
      condition: 'grappled',
      source: { kind: 'feature', actorId: grappler.id, rulesId: 'basic-action:grapple' },
      targetId: goblin.id,
      relation: {
        schemaVersion: 1,
        kind: 'grapple',
        sourceActorId: grappler.id,
        sourceActionId: 'basic-action:grapple',
        slotGroup: 'free-hand',
        maxDistanceFeet: 5,
        movement: 'drag-target',
        endsOnSourceIncapacitated: true,
      },
    })
    const grappledGoblin = {
      ...goblin,
      dnd5eCombatState: {
        schemaVersion: 2 as const,
        activeEffects: [grapple],
        conditions: [],
      },
    }
    const selectEscape: MonsterDecisionProvider = {
      id: 'test:select-opposed-escape',
      schemaVersion: 1,
      scoreCandidate(_context, candidate) {
        return {
          candidateId: candidate.id,
          score: candidate.id.startsWith(`escape-grapple:${grapple.id}:`)
            ? 10_000
            : -10_000,
          reasons: [],
        }
      },
    }

    const plan = planDnd5eMonsterTurn(
      map([grappledGoblin, grappler]),
      grappledGoblin,
      [grapplerCharacter],
      { decisionProvider: selectEscape },
    )

    expect(plan).toMatchObject({
      moved: false,
      attacked: false,
      targetTokenId: grappler.id,
      escapeGrapple: { grapplerId: grappler.id },
      decision: {
        candidateId: `escape-grapple:${grapple.id}:${grappler.id}`,
        metrics: {
          movementFeet: 0,
          consumesAction: true,
        },
      },
    })
    expect(plan.decision?.metrics?.hitProbability).toBeLessThan(0.2)
    expect(plan.decision?.metrics?.hitProbability).not.toBe(0.5)
  })

  it.each([
    ['dead source', 0, 15, 'feature', []],
    ['legacy-incapacitated source', 20, 15, 'feature', ['stunned']],
    ['out-of-range source', 20, 45, 'feature', []],
    ['invalid basic-action declaration', 20, 15, 'system', []],
  ] as const)(
    'does not offer an escape for a reconciled-away %s relation',
    (_label, sourceHp, sourceX, sourceKind, sourceConditions) => {
      const goblin = token({
        id: `stale-grapple-goblin:${_label}`,
        label: 'Stale Grapple Goblin',
        poolId: 'srd-5.1:goblin',
        x: 5,
        y: 5,
        hp: 7,
        maxHp: 7,
      })
      const sourceCharacter = character({
        id: `stale-source-character:${_label}`,
        name: 'Stale Source',
        currentHp: sourceHp,
        conditions: [...sourceConditions],
      })
      const source = token({
        id: `stale-source-token:${_label}`,
        label: sourceCharacter.name,
        type: 'player',
        characterId: sourceCharacter.id,
        x: sourceX,
        y: 5,
        hp: sourceHp,
        maxHp: sourceCharacter.maxHp,
      })
      const fallbackCharacter = character({
        id: `stale-fallback-character:${_label}`,
        name: 'Live Fallback',
      })
      const fallback = token({
        id: `stale-fallback-token:${_label}`,
        label: fallbackCharacter.name,
        type: 'player',
        characterId: fallbackCharacter.id,
        x: 150,
        y: 5,
        hp: fallbackCharacter.currentHp,
        maxHp: fallbackCharacter.maxHp,
      })
      const grapple = createDnd5eConditionEffect({
        id: `stale-basic-grapple:${_label}`,
        condition: 'grappled',
        source: {
          kind: sourceKind,
          actorId: source.id,
          rulesId: 'basic-action:grapple',
        },
        targetId: goblin.id,
        relation: {
          schemaVersion: 1,
          kind: 'grapple',
          sourceActorId: source.id,
          sourceActionId: 'basic-action:grapple',
          slotGroup: 'free-hand',
          maxDistanceFeet: 5,
          movement: 'drag-target',
          endsOnSourceIncapacitated: true,
        },
      })
      const staleGoblin = {
        ...goblin,
        dnd5eCombatState: {
          schemaVersion: 2 as const,
          activeEffects: [grapple],
          conditions: ['grappled'],
        },
      }
      const seenCandidateIds: string[] = []
      const seenMovementFeet: number[] = []
      const provider: MonsterDecisionProvider = {
        id: `test:reject-stale-grapple:${_label}`,
        schemaVersion: 1,
        scoreCandidate(_context, candidate) {
          seenCandidateIds.push(candidate.id)
          seenMovementFeet.push(candidate.metrics.movementFeet)
          return { candidateId: candidate.id, score: 0, reasons: [] }
        },
      }

      const plan = planDnd5eMonsterTurn(
        map([staleGoblin, source, fallback]),
        staleGoblin,
        [sourceCharacter, fallbackCharacter],
        { decisionProvider: provider },
      )

      expect(seenCandidateIds.some((id) => id.startsWith('escape-grapple:'))).toBe(false)
      expect(seenMovementFeet.some((feet) => feet > 0)).toBe(true)
      expect(plan.escapeGrapple).toBeUndefined()
      expect(plan.escapeActiveEffect).toBeUndefined()
    },
  )

  it('preserves an unrelated raw condition while reconciling a stale grapple', () => {
    const sourceCharacter = character({
      id: 'condition-preservation-source-character',
      name: 'Condition Preservation Source',
    })
    const source = token({
      id: 'condition-preservation-source-token',
      label: sourceCharacter.name,
      type: 'player',
      characterId: sourceCharacter.id,
      x: 15,
      y: 5,
      hp: sourceCharacter.currentHp,
      maxHp: sourceCharacter.maxHp,
    })
    const root = createDnd5eConditionEffect({
      id: 'condition-preservation-stale-grapple',
      condition: 'grappled',
      source: {
        kind: 'system',
        actorId: source.id,
        rulesId: 'basic-action:grapple',
      },
      targetId: 'condition-preservation-goblin',
      relation: {
        schemaVersion: 1,
        kind: 'grapple',
        sourceActorId: source.id,
        sourceActionId: 'basic-action:grapple',
        slotGroup: 'free-hand',
        maxDistanceFeet: 5,
        movement: 'drag-target',
        endsOnSourceIncapacitated: true,
      },
    })
    const selectScimitar: MonsterDecisionProvider = {
      id: 'test:condition-preservation-scimitar',
      schemaVersion: 1,
      scoreCandidate(_context, candidate) {
        return {
          candidateId: candidate.id,
          score:
            candidate.id.startsWith(`attack:${source.id}:0:`) &&
            candidate.metrics.movementFeet === 0
              ? 10_000
              : -10_000,
          reasons: [],
        }
      },
    }
    const planWithConditions = (conditions: string[]) => {
      const goblin = token({
        id: 'condition-preservation-goblin',
        label: 'Condition Preservation Goblin',
        poolId: 'srd-5.1:goblin',
        x: 5,
        y: 5,
        hp: 7,
        maxHp: 7,
        dnd5eCombatState: {
          schemaVersion: 2,
          activeEffects: [root],
          conditions,
        },
      })
      return planDnd5eMonsterTurn(
        map([goblin, source]),
        goblin,
        [sourceCharacter],
        { decisionProvider: selectScimitar },
      )
    }

    const clear = planWithConditions(['grappled'])
    const blinded = planWithConditions(['grappled', 'blinded'])

    expect(clear.escapeGrapple).toBeUndefined()
    expect(blinded.escapeGrapple).toBeUndefined()
    expect(blinded.decision?.metrics?.hitProbability)
      .toBeLessThan(clear.decision?.metrics?.hitProbability ?? 0)
  })

  it('uses active-effect sizeRankDelta when scoring a source-linked grapple rider', () => {
    const ankheg = token({
      id: 'size-test-ankheg',
      label: 'Ankheg',
      poolId: 'srd-5.1:ankheg',
      x: 5,
      y: 5,
      hp: 39,
      maxHp: 39,
    })
    const target = token({
      id: 'large-target-token',
      label: 'Large Target',
      type: 'player',
      characterId: 'large-target-character',
      creatureSize: '大型',
      x: 15,
      y: 5,
      hp: 40,
      maxHp: 40,
    })
    const selectBite: MonsterDecisionProvider = {
      id: 'test:select-size-rider-bite',
      schemaVersion: 1,
      scoreCandidate(_context, candidate) {
        return {
          candidateId: candidate.id,
          score: candidate.id.startsWith(`attack:${target.id}:0:`) ? 10_000 : -10_000,
          reasons: [],
        }
      },
    }
    const planFor = (targetToken: Token) => planDnd5eMonsterTurn(
      map([ankheg, targetToken]),
      ankheg,
      [character({
        id: 'large-target-character',
        currentHp: 40,
        maxHp: 40,
      })],
      { decisionProvider: selectBite },
    )
    const ordinary = planFor(target)
    const enlarged = planFor({
      ...target,
      dnd5eCombatState: {
        schemaVersion: 2,
        activeEffects: [createDnd5eMechanicalEffect({
          id: 'enlarged-large-target',
          definitionId: 'srd-5.1:spell:enlarge-reduce:enlarge',
          label: 'Enlarged',
          kind: 'buff',
          source: { kind: 'spell', actorId: target.id, rulesId: 'enlarge-reduce' },
          targetId: target.id,
          modifiers: { sizeRankDelta: 1 },
        })],
      },
    })

    expect(ordinary.decision?.metrics?.controlValue).toBeGreaterThan(0)
    expect(enlarged.decision?.metrics?.controlValue ?? 0).toBe(0)
  })

  it('halves the planner movement envelope while dragging a grappled target', () => {
    const goblin = token({
      id: 'goblin',
      label: 'Goblin',
      poolId: 'srd-5.1:goblin',
      x: 5,
      y: 5,
      hp: 7,
      maxHp: 7,
    })
    const relation = createDnd5eConditionEffect({
      id: 'test-drag-relation',
      condition: 'grappled',
      source: { kind: 'feature', actorId: goblin.id, rulesId: 'basic-action:grapple' },
      targetId: 'captive',
      relation: {
        schemaVersion: 1,
        kind: 'grapple',
        sourceActorId: goblin.id,
        sourceActionId: 'basic-action:grapple',
        slotGroup: 'free-hand',
        maxDistanceFeet: 5,
        movement: 'drag-target',
        endsOnSourceIncapacitated: true,
      },
    })
    const captive = token({
      id: 'captive',
      label: 'Captive',
      type: 'player',
      characterId: 'captive-character',
      x: 5,
      y: 15,
      hp: 10,
      maxHp: 10,
      dnd5eCombatState: {
        schemaVersion: 2,
        activeEffects: [relation],
        conditions: ['grappled'],
      },
    })
    const target = token({
      id: 'target',
      label: 'Target',
      type: 'player',
      characterId: 'target-character',
      x: 165,
      y: 5,
      hp: 20,
      maxHp: 20,
    })
    const maximizeMovement: MonsterDecisionProvider = {
      id: 'test:maximize-movement',
      schemaVersion: 1,
      scoreCandidate(_context, candidate) {
        return {
          candidateId: candidate.id,
          score: candidate.id.startsWith('release-grapple:')
            ? -10_000
            : candidate.metrics.movementFeet,
          reasons: [],
        }
      },
    }
    const options = {
      decisionProvider: maximizeMovement,
      simulationOptimization: { skipDashWhenAttackAvailable: true },
    } as const
    const characters = [
      character({ id: 'captive-character', currentHp: 10, maxHp: 10 }),
      character({ id: 'target-character', currentHp: 20, maxHp: 20 }),
    ]

    const dragging = planDnd5eMonsterTurn(
      { ...map([goblin, captive, target]), width: 300 },
      goblin,
      characters,
      options,
    )
    const unencumbered = planDnd5eMonsterTurn(
      {
        ...map([
          goblin,
          { ...captive, dnd5eCombatState: undefined },
          target,
        ]),
        width: 300,
      },
      goblin,
      characters,
      options,
    )
    const dependentOnly = planDnd5eMonsterTurn(
      {
        ...map([
          goblin,
          {
            ...captive,
            dnd5eCombatState: {
              schemaVersion: 2,
              activeEffects: [createDnd5eConditionEffect({
                id: 'dependent-restrained-only',
                condition: 'restrained',
                source: { kind: 'monster', actorId: goblin.id, rulesId: 'test-grapple' },
                targetId: captive.id,
                dependsOnEffectId: 'missing-grapple-root',
                relation: relation.relation,
              })],
            },
          },
          target,
        ]),
        width: 300,
      },
      goblin,
      characters,
      options,
    )

    expect(dragging.decision?.metrics?.movementFeet).toBe(15)
    expect(unencumbered.decision?.metrics?.movementFeet).toBe(30)
    expect(dependentOnly.decision?.metrics?.movementFeet).toBe(30)
  })

  it.each([
    {
      label: 'Chimera',
      poolId: 'srd-5.1:chimera',
      hp: 114,
      actionId: 'fire-breath',
      saveAbility: 'dex',
      saveDc: 15,
      diceCount: 7,
      diceSides: 8,
      damageType: 'fire',
    },
    {
      label: 'Dragon Turtle',
      poolId: 'srd-5.1:dragon-turtle',
      hp: 341,
      actionId: 'steam-breath',
      saveAbility: 'con',
      saveDc: 18,
      diceCount: 15,
      diceSides: 6,
      damageType: 'fire',
    },
    {
      label: 'Young Blue Dragon',
      poolId: 'srd-5.1:young-blue-dragon',
      hp: 152,
      actionId: 'lightning-breath',
      saveAbility: 'dex',
      saveDc: 16,
      diceCount: 10,
      diceSides: 10,
      damageType: 'lightning',
    },
    {
      label: 'Winter Wolf',
      poolId: 'srd-5.1:winter-wolf',
      hp: 75,
      actionId: 'cold-breath',
      saveAbility: 'dex',
      saveDc: 12,
      diceCount: 4,
      diceSides: 8,
      damageType: 'cold',
    },
  ])('selects the $label recharge breath when its area covers two hostiles', ({
    label,
    poolId,
    hp,
    actionId,
    saveAbility,
    saveDc,
    diceCount,
    diceSides,
    damageType,
  }) => {
    const monster = token({
      id: 'monster',
      label,
      poolId,
      x: 5,
      y: 45,
      hp,
      maxHp: hp,
      dnd5eCombatState: { monsterRechargeReadyByActionId: { [actionId]: true } },
    })
    const first = token({
      id: 'first',
      label: 'First Hero',
      type: 'player',
      characterId: 'first-character',
      x: 25,
      y: 45,
    })
    const second = token({
      id: 'second',
      label: 'Second Hero',
      type: 'player',
      characterId: 'second-character',
      x: 35,
      y: 45,
    })
    const plan = planDnd5eMonsterTurn(map([monster, first, second]), monster, [
      character({ id: 'first-character', currentHp: 200, maxHp: 200 }),
      character({ id: 'second-character', currentHp: 200, maxHp: 200 }),
    ])

    expect(plan.areaAction).toMatchObject({
      actionId,
      targetTokenIds: expect.arrayContaining([first.id, second.id]),
      saveAbility,
      saveDc,
      damage: { diceCount, diceSides, damageType },
    })
  })

  it('scores each shared-recharge breath variant and returns its stable variant id', () => {
    const dragon = token({
      id: 'dragon', label: '成年黄铜龙', poolId: 'srd-5.1:adult-brass-dragon',
      x: 5, y: 45, hp: 172, maxHp: 172,
      dnd5eCombatState: { monsterRechargeReadyByActionId: { 'breath-weapons': true } },
    })
    const first = token({
      id: 'first', label: '第一名英雄', type: 'player',
      characterId: 'first-character', x: 45, y: 45,
    })
    const second = token({
      id: 'second', label: '第二名英雄', type: 'player',
      characterId: 'second-character', x: 85, y: 45,
    })
    const plan = planDnd5eMonsterTurn(map([dragon, first, second]), dragon, [
      character({ id: 'first-character', currentHp: 120, maxHp: 120 }),
      character({ id: 'second-character', currentHp: 120, maxHp: 120 }),
    ])

    expect(plan.areaAction).toMatchObject({
      actionId: 'breath-weapons',
      variantId: 'fire-breath',
      actionName: expect.stringContaining('火焰吐息'),
      targetTokenIds: expect.arrayContaining([first.id, second.id]),
      damage: { diceCount: 13, diceSides: 6, damageType: 'fire' },
    })
    expect(plan.decision?.candidateId).toContain(':fire-breath:')
  })

  it('includes living, stable-at-zero, and pending-recovery allies in an all-creatures breath', () => {
    const dragon = token({
      id: 'dragon',
      label: 'Adult Bronze Dragon',
      poolId: 'srd-5.1:adult-bronze-dragon',
      x: 5,
      y: 45,
      hp: 212,
      maxHp: 212,
      dnd5eCombatState: { monsterRechargeReadyByActionId: { 'breath-weapons': true } },
    })
    const hero = token({
      id: 'hero-token',
      label: 'Hero',
      type: 'player',
      characterId: 'hero',
      x: 45,
      y: 45,
      hp: 100,
      maxHp: 100,
    })
    const firstAlly = token({
      id: 'first-ally',
      label: 'First Ally',
      x: 45,
      y: 45,
      hp: 100,
      maxHp: 100,
    })
    const secondAlly = token({
      id: 'second-ally',
      label: 'Second Ally',
      x: 45,
      y: 45,
      hp: 0,
      maxHp: 100,
      dnd5eCombatState: { stableAtZero: true },
    })
    const thirdAlly = token({
      id: 'third-ally',
      label: 'Third Ally',
      x: 45,
      y: 45,
      hp: 0,
      maxHp: 100,
      dnd5eCombatState: {
        undeadFortitudePending: { dc: 10, damage: 1 },
      },
    })
    const selectRepulsion: MonsterDecisionProvider = {
      id: 'test:select-repulsion',
      schemaVersion: 1,
      scoreCandidate(_context, candidate) {
        return {
          candidateId: candidate.id,
          score: candidate.id.includes(':repulsion-breath:') ? 10_000 : -10_000,
          reasons: [],
        }
      },
    }

    const plan = planDnd5eMonsterTurn(
      map([dragon, hero, firstAlly, secondAlly, thirdAlly]),
      dragon,
      [character({ currentHp: 100, maxHp: 100 })],
      { decisionProvider: selectRepulsion },
    )

    expect(plan.areaAction).toMatchObject({
      actionId: 'breath-weapons',
      variantId: 'repulsion-breath',
      targetTokenIds: expect.arrayContaining([
        hero.id,
        firstAlly.id,
        secondAlly.id,
        thirdAlly.id,
      ]),
    })
    expect(plan.decision?.metrics).toMatchObject({
      affectedEnemyCount: 1,
      affectedAllyCount: 3,
    })
    expect(plan.decision?.metrics?.controlValue).toBeLessThan(0)
  })

  it.each([
    {
      monsterId: 'srd-5.1:adult-copper-dragon',
      variantId: 'slowing-breath',
    },
    {
      monsterId: 'srd-5.1:adult-gold-dragon',
      variantId: 'weakening-breath',
    },
  ])('scores $variantId as persistent signed control', ({ monsterId, variantId }) => {
    const dragon = token({
      id: 'dragon',
      label: monsterId,
      poolId: monsterId,
      x: 5,
      y: 45,
      hp: 300,
      maxHp: 300,
      dnd5eCombatState: { monsterRechargeReadyByActionId: { 'breath-weapons': true } },
    })
    const first = token({
      id: 'first',
      label: 'First Hero',
      type: 'player',
      characterId: 'first-character',
      x: 45,
      y: 45,
      hp: 100,
      maxHp: 100,
    })
    const selectVariant: MonsterDecisionProvider = {
      id: `test:select-${variantId}`,
      schemaVersion: 1,
      scoreCandidate(_context, candidate) {
        return {
          candidateId: candidate.id,
          score: candidate.id.includes(`:${variantId}:`) ? 10_000 : -10_000,
          reasons: [],
        }
      },
    }

    const plan = planDnd5eMonsterTurn(map([dragon, first]), dragon, [
      character({ id: 'first-character', currentHp: 100, maxHp: 100 }),
    ], { decisionProvider: selectVariant })

    expect(plan.areaAction).toMatchObject({
      actionId: 'breath-weapons',
      variantId,
      targetTokenIds: [first.id],
    })
    expect(plan.decision?.metrics?.controlValue).toBeGreaterThan(0)
    expect(plan.decision?.metrics).toMatchObject({
      affectedEnemyCount: 1,
      affectedAllyCount: 0,
    })
  })

  it('values Slowing Breath more against a fast multiattacker than a single-attack target', () => {
    const catalog = getDnd5eSrdMonster('srd-5.1:adult-copper-dragon')!
    const monster = {
      ...catalog,
      id: 'room-monster:slow-weighting',
      slug: 'slow-weighting',
      speed: { walk: 0 },
      actions: catalog.actions.filter((action) => action.id === 'breath-weapons'),
    } as Dnd5eMonsterStatBlock
    setDnd5eRoomMonsterCatalog([monster])
    const dragon = token({
      id: 'dragon',
      label: monster.name,
      poolId: monster.id,
      x: 5,
      y: 45,
      hp: 500,
      maxHp: 500,
      dnd5eCombatState: { monsterRechargeReadyByActionId: { 'breath-weapons': true } },
    })
    const target = token({
      id: 'target',
      label: 'Target',
      type: 'player',
      characterId: 'target-character',
      x: 45,
      y: 45,
      hp: 100,
      maxHp: 100,
    })
    const selectSlow: MonsterDecisionProvider = {
      id: 'test:slow-weighting',
      schemaVersion: 1,
      scoreCandidate(_context, candidate) {
        return {
          candidateId: candidate.id,
          score: candidate.id.includes(':slowing-breath:') ? 10_000 : -10_000,
          reasons: [],
        }
      },
    }
    const controlValue = (targetCharacter: Character) =>
      planDnd5eMonsterTurn(map([dragon, target]), dragon, [targetCharacter], {
        decisionProvider: selectSlow,
      }).decision?.metrics?.controlValue ?? 0

    const multiattacker = controlValue(character({
      id: 'target-character',
      charClass: 'fighter',
      level: 20,
      dnd5eClassLevels: { fighter: 20 },
      speed: 60,
    }))
    const singleAttack = controlValue(character({
      id: 'target-character',
      charClass: 'wizard',
      level: 1,
      dnd5eClassLevels: { wizard: 1 },
      speed: 30,
    }))

    expect(multiattacker).toBeGreaterThan(singleAttack)
  })

  it('values Weakening Breath more against a Strength-dependent target', () => {
    const catalog = getDnd5eSrdMonster('srd-5.1:adult-gold-dragon')!
    const monster = {
      ...catalog,
      id: 'room-monster:weakening-weighting',
      slug: 'weakening-weighting',
      speed: { walk: 0 },
      actions: catalog.actions.filter((action) => action.id === 'breath-weapons'),
    } as Dnd5eMonsterStatBlock
    setDnd5eRoomMonsterCatalog([monster])
    const dragon = token({
      id: 'dragon',
      label: monster.name,
      poolId: monster.id,
      x: 5,
      y: 45,
      hp: 500,
      maxHp: 500,
      dnd5eCombatState: { monsterRechargeReadyByActionId: { 'breath-weapons': true } },
    })
    const target = token({
      id: 'target',
      label: 'Target',
      type: 'player',
      characterId: 'target-character',
      x: 45,
      y: 45,
      hp: 100,
      maxHp: 100,
    })
    const selectWeakening: MonsterDecisionProvider = {
      id: 'test:weakening-weighting',
      schemaVersion: 1,
      scoreCandidate(_context, candidate) {
        return {
          candidateId: candidate.id,
          score: candidate.id.includes(':weakening-breath:') ? 10_000 : -10_000,
          reasons: [],
        }
      },
    }
    const controlValue = (targetCharacter: Character) =>
      planDnd5eMonsterTurn(map([dragon, target]), dragon, [targetCharacter], {
        decisionProvider: selectWeakening,
      }).decision?.metrics?.controlValue ?? 0

    const strengthTarget = controlValue(character({
      id: 'target-character',
      charClass: 'fighter',
      level: 11,
      dnd5eClassLevels: { fighter: 11 },
      abilities: { str: 20, dex: 10, con: 14, int: 8, wis: 10, cha: 8 },
      savingThrows: ['str'],
      skills: ['athletics'],
    }))
    const dexterityTarget = controlValue(character({
      id: 'target-character',
      charClass: 'rogue',
      level: 1,
      dnd5eClassLevels: { rogue: 1 },
      abilities: { str: 8, dex: 20, con: 12, int: 10, wis: 10, cha: 10 },
      savingThrows: ['dex'],
      skills: ['stealth'],
    }))

    expect(strengthTarget).toBeGreaterThan(dexterityTarget)
  })

  it('uses Sanctuary only on an unprotected ally when only its bonus action remains', () => {
    const acolyte = token({
      id: 'acolyte', label: 'Acolyte', poolId: 'srd-5.1:acolyte',
      x: 5, y: 45, hp: 9, maxHp: 9,
    })
    const ally = token({
      id: 'ally', label: 'Guard', poolId: 'srd-5.1:guard',
      x: 25, y: 45, hp: 1, maxHp: 30,
    })
    const hero = token({
      id: 'hero-token', label: 'Hero', type: 'player', characterId: 'hero',
      x: 45, y: 45, hp: 1, maxHp: 100,
    })
    const economy = createDnd5eTurnEconomyCounts('turn', 30)
    economy.action.current = 0

    const plan = planDnd5eMonsterTurn(
      map([acolyte, ally, hero]),
      acolyte,
      [character({ currentHp: 1, maxHp: 100 })],
      { turnEconomy: economy },
    )

    expect(plan).toMatchObject({
      attacked: false,
      targetTokenId: ally.id,
      spellCast: {
        spellId: 'sanctuary',
        targetTokenIds: [ally.id],
        castingTime: 'bonus-action',
      },
      decision: {
        candidateId: `support:${ally.id}:sanctuary:1`,
      },
    })
    expect(plan.spellCast?.targetTokenIds).not.toContain(hero.id)

    const protectedAcolyte = {
      ...acolyte,
      dnd5eCombatState: {
        activeEffects: [createDnd5eMechanicalEffect({
          definitionId: 'srd-5.1:spell:sanctuary',
          label: 'Sanctuary',
          kind: 'buff',
          source: { kind: 'spell', actorId: 'acolyte', rulesId: 'sanctuary' },
          targetId: acolyte.id,
        })],
      },
    }
    const protectedAlly = {
      ...ally,
      dnd5eCombatState: {
        activeEffects: [createDnd5eMechanicalEffect({
          definitionId: 'srd-5.1:spell:sanctuary',
          label: 'Sanctuary',
          kind: 'buff',
          source: { kind: 'spell', actorId: 'acolyte', rulesId: 'sanctuary' },
          targetId: ally.id,
        })],
      },
    }
    const repeated = planDnd5eMonsterTurn(
      map([protectedAcolyte, protectedAlly, hero]),
      protectedAcolyte,
      [character({ currentHp: 1, maxHp: 100 })],
      { turnEconomy: economy },
    )
    expect(repeated.spellCast?.spellId).not.toBe('sanctuary')
    expect(repeated.decision?.candidateId ?? '').not.toContain(':sanctuary:')
  })

  it('uses Nimble Escape to leave melee reach and make a ranged attack without opportunity risk', () => {
    const goblin = token({
      id: 'goblin', label: '地精', poolId: 'srd-5.1:goblin',
      x: 5, y: 45, hp: 7, maxHp: 7,
      dnd5eBehaviorPreference: { schemaVersion: 1, style: 'skirmisher' },
    })
    const hero = token({
      id: 'hero-token', label: '英雄', type: 'player', characterId: 'hero',
      x: 15, y: 45, hp: 20, maxHp: 20,
    })
    const battleMap = map([goblin, hero])
    const plan = planDnd5eMonsterTurn(battleMap, goblin, [character()])

    expect(plan).toMatchObject({
      moved: true,
      attacked: true,
      actionIndex: 1,
      nimbleEscape: 'disengage',
      decision: { providerId: 'dnd5e:deterministic-tactical-v3' },
    })
    expect(plan.decision?.reasons.join(' ')).toContain('灵巧脱逃')

    const resolved = resolveDnd5eMonsterMapMove({
      combatId: 'combat',
      map: battleMap,
      characters: [character()],
      initiativeOrder: [
        { tokenId: goblin.id, label: goblin.label, emoji: '', color: '', roll: 20 },
        { tokenId: hero.id, label: hero.label, emoji: '', color: '', roll: 10 },
      ],
      actorTokenId: goblin.id,
      to: plan.newPosition!,
      nimbleEscape: plan.nimbleEscape,
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })
    expect(resolved.ok).toBe(true)
    if (!resolved.ok || !resolved.result.ok) return
    expect(resolved.result.state.combatants[goblin.id]).toMatchObject({
      disengaged: true,
      turn: { actionAvailable: true, bonusActionAvailable: false },
    })
    expect(resolved.result.events).toContainEqual({
      type: 'disengage-granted',
      actorId: goblin.id,
    })

    const spentEconomy = createDnd5eTurnEconomyCounts('turn', 30)
    spentEconomy.bonusAction.current = 0
    expect(planDnd5eMonsterTurn(
      battleMap,
      goblin,
      [character()],
      { turnEconomy: spentEconomy },
    ).nimbleEscape).toBeUndefined()
  })

  it('uses an exact path to a target-specific half-cover firing position', () => {
    const goblin = token({
      id: 'goblin', label: '地精', poolId: 'srd-5.1:goblin',
      x: 5, y: 45, hp: 7, maxHp: 7,
      dnd5eBehaviorPreference: { schemaVersion: 1, style: 'defensive' },
    })
    const hero = token({
      id: 'hero-token', label: '英雄', type: 'player', characterId: 'hero',
      x: 155, y: 45, hp: 20, maxHp: 20,
    })
    const battleMap = map([goblin, hero])
    const geometry = createEmptyMapGeometry(battleMap.id, 1)
    geometry.obstacles.push({
      id: 'half-cover',
      kind: 'obstacle',
      label: '矮石墙',
      points: [{ x: 45, y: 5 }, { x: 55, y: 5 }, { x: 55, y: 35 }, { x: 45, y: 35 }],
      blocksVision: false,
      blocksMovement: true,
      blocksLineOfEffect: false,
      cover: 'half',
      baseHeightFeet: 0,
      heightFeet: 3,
      createdAt: 1,
    })
    setMapGeometryRuntime([geometry])

    const plan = planDnd5eMonsterTurn(battleMap, goblin, [character()])

    expect(plan).toMatchObject({ moved: true, attacked: true })
    expect(plan.decision?.reasons.join(' ')).toContain('精确掩护路线')
    expect(plan.newPosition?.y).toBeLessThan(goblin.y)
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

  it('uses Dash when flight plus normal movement still cannot reach melee range', () => {
    const bat = token({ id: 'bat', label: '蝙蝠', poolId: 'srd-5.1:bat', x: 5, y: 5, hp: 1, maxHp: 1 })
    const hero = token({ id: 'hero-token', label: '英雄', type: 'player', characterId: 'hero', x: 75, y: 5, hp: 20, maxHp: 20 })
    const battleMap = map([bat, hero])

    const plan = planDnd5eMonsterTurn(battleMap, bat)

    expect(plan).toMatchObject({
      moved: true,
      dashed: true,
      attacked: false,
      newElevationFeet: 5,
      movementMode: 'fly',
    })
    expect(plan.newPosition?.x).toBe(65)
    const resolved = resolveDnd5eMonsterMapMove({
      combatId: 'combat', map: battleMap, characters: [character()],
      initiativeOrder: [
        { tokenId: bat.id, label: bat.label, emoji: '', color: '', roll: 20 },
        { tokenId: hero.id, label: hero.label, emoji: '', color: '', roll: 10 },
      ],
      actorTokenId: bat.id,
      to: plan.newPosition!,
      targetElevationFeet: plan.newElevationFeet,
      dash: plan.dashed,
    })
    expect(resolved.ok).toBe(true)
    if (!resolved.ok) return
    expect(resolved.result).toMatchObject({ ok: true })
    expect(resolved.distanceFeet).toBe(35)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === bat.id)?.elevationFeet).toBe(5)
  })

  it('raises a flying monster above a wall before routing across it', () => {
    const bat = token({
      id: 'bat', label: '蝙蝠', poolId: 'srd-5.1:bat',
      x: 5, y: 5, hp: 1, maxHp: 1,
    })
    const hero = token({
      id: 'hero-token', label: '英雄', type: 'player', characterId: 'hero',
      x: 95, y: 5, hp: 20, maxHp: 20,
    })
    const battleMap = map([bat, hero])
    const geometry = createEmptyMapGeometry(battleMap.id, 1)
    geometry.walls.push({
      id: 'wall', kind: 'wall', label: '矮墙',
      points: [{ x: 40, y: 0 }, { x: 40, y: 100 }],
      blocksVision: true, blocksMovement: true, blocksLineOfEffect: true,
      baseHeightFeet: 0, heightFeet: 10, createdAt: 1,
    })
    setMapGeometryRuntime([geometry])

    const firstTurn = planDnd5eMonsterTurn(battleMap, bat)
    expect(firstTurn).toMatchObject({
      moved: true,
      attacked: false,
      movementMode: 'fly',
      newElevationFeet: 11,
    })

    const airborneBat = { ...bat, x: 35, elevationFeet: 11 }
    const airborneMap = { ...battleMap, tokens: [airborneBat, hero] }
    const crossed = resolveDnd5eMonsterMapMove({
      combatId: 'combat',
      map: airborneMap,
      characters: [character()],
      initiativeOrder: [
        { tokenId: bat.id, label: bat.label, emoji: '', color: '', roll: 20 },
        { tokenId: hero.id, label: hero.label, emoji: '', color: '', roll: 10 },
      ],
      actorTokenId: bat.id,
      to: { x: 65, y: 5 },
      targetElevationFeet: 11,
    })
    expect(crossed.ok).toBe(true)
    if (!crossed.ok) return
    expect(crossed.result).toMatchObject({ ok: true })
    expect(crossed.application?.map.tokens.find((entry) => entry.id === bat.id)).toMatchObject({
      x: 65,
      elevationFeet: 11,
    })
  })

  it('uses flight to pursue an airborne target even when walk and fly speeds are equal', () => {
    const boneDevil = token({
      id: 'bone-devil',
      label: '骨魔',
      poolId: 'srd-5.1:bone-devil',
      x: 5,
      y: 5,
      hp: 142,
      maxHp: 142,
    })
    const airborneHero = token({
      id: 'airborne-hero',
      label: '飞行英雄',
      type: 'player',
      characterId: 'hero',
      x: 45,
      y: 5,
      elevationFeet: 20,
      hp: 20,
      maxHp: 20,
    })

    const plan = planDnd5eMonsterTurn(map([boneDevil, airborneHero]), boneDevil, [character()])

    expect(plan).toMatchObject({
      moved: true,
      movementMode: 'fly',
      newElevationFeet: 25,
      targetTokenId: airborneHero.id,
    })
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

  it('keeps the selected candidate identical to per-destination A* on complex terrain', () => {
    const barbedDevil = token({
      id: 'barbed-devil', label: 'Barbed Devil',
      poolId: 'srd-5.1:barbed-devil', x: 15, y: 85,
      hp: 110, maxHp: 110,
    })
    const hero = token({
      id: 'hero-token', label: 'Hero', type: 'player',
      characterId: 'hero', x: 175, y: 15, hp: 40, maxHp: 40,
    })
    const battleMap = map([barbedDevil, hero])
    const state = createEmptyMapGeometry(battleMap.id, 1)
    state.walls.push({
      id: 'divider', kind: 'wall', label: 'Divider',
      points: [{ x: 95, y: 0 }, { x: 95, y: 60 }],
      blocksVision: true, blocksMovement: true, blocksLineOfEffect: true,
      baseHeightFeet: 0, heightFeet: 10, createdAt: 1,
    })
    state.obstacles.push({
      id: 'mud', kind: 'obstacle', label: 'Mud',
      points: [
        { x: 40, y: 60 }, { x: 150, y: 60 },
        { x: 150, y: 100 }, { x: 40, y: 100 },
      ],
      blocksVision: false, blocksMovement: false,
      blocksLineOfEffect: false, cover: 'none',
      baseHeightFeet: 0, heightFeet: 0,
      terrainCostMultiplier: 2, traversal: 'ground', createdAt: 1,
    })
    setMapGeometryRuntime([state])

    const sharedTree = planDnd5eMonsterTurn(
      battleMap,
      barbedDevil,
      [character({ currentHp: 40, maxHp: 40 })],
    )
    const perDestination = planDnd5eMonsterTurn(
      battleMap,
      barbedDevil,
      [character({ currentHp: 40, maxHp: 40 })],
      {
        simulationOptimization: {
          candidateRouteSearch: 'per-destination',
        },
      },
    )

    expect(sharedTree).toEqual(perDestination)
    expect(sharedTree.decision?.candidateCount).toBeGreaterThan(100)
  })

  it('keeps same-cell flight elevation and movement cost identical to per-destination A*', () => {
    const bat = token({
      id: 'bat', label: 'Bat', poolId: 'srd-5.1:bat',
      x: 5, y: 5, elevationFeet: 0, hp: 1, maxHp: 1,
    })
    const hero = token({
      id: 'hero-token', label: 'Hero', type: 'player',
      characterId: 'hero', x: 15, y: 5, hp: 20, maxHp: 20,
    })
    const battleMap = map([bat, hero])
    const sharedTree = planDnd5eMonsterTurn(battleMap, bat, [character()])
    const perDestination = planDnd5eMonsterTurn(
      battleMap,
      bat,
      [character()],
      {
        simulationOptimization: {
          candidateRouteSearch: 'per-destination',
        },
      },
    )

    expect(sharedTree).toEqual(perDestination)
    expect(sharedTree).toMatchObject({
      moved: true,
      attacked: true,
      newPosition: { x: bat.x, y: bat.y },
      newElevationFeet: 5,
      decision: { metrics: { movementFeet: 5 } },
    })
  })

  it('falls back to per-destination A* when the shared route tree is truncated', () => {
    const barbedDevil = token({
      id: 'barbed-devil', label: 'Barbed Devil',
      poolId: 'srd-5.1:barbed-devil', x: 95, y: 45,
      hp: 110, maxHp: 110,
    })
    const hero = token({
      id: 'hero-token', label: 'Hero', type: 'player',
      characterId: 'hero', x: 175, y: 45, hp: 40, maxHp: 40,
    })
    const battleMap = map([barbedDevil, hero])
    const sharedTree = planDnd5eMonsterTurn(
      battleMap,
      barbedDevil,
      [character({ currentHp: 40, maxHp: 40 })],
      {
        simulationOptimization: {
          candidateRouteTreeMaximumVisited: 100,
        },
      },
    )
    const perDestination = planDnd5eMonsterTurn(
      battleMap,
      barbedDevil,
      [character({ currentHp: 40, maxHp: 40 })],
      {
        simulationOptimization: {
          candidateRouteSearch: 'per-destination',
          candidateRouteTreeMaximumVisited: 100,
        },
      },
    )

    expect(sharedTree).toEqual(perDestination)
    expect(sharedTree.decision?.candidateCount).toBeGreaterThan(100)
  })

  it('preserves the exact candidate set when closed doors can be opened', () => {
    const barbedDevil = token({
      id: 'barbed-devil', label: 'Barbed Devil',
      poolId: 'srd-5.1:barbed-devil', x: 15, y: 45,
      hp: 110, maxHp: 110,
    })
    const hero = token({
      id: 'hero-token', label: 'Hero', type: 'player',
      characterId: 'hero', x: 175, y: 45, hp: 40, maxHp: 40,
    })
    const battleMap = map([barbedDevil, hero])
    const state = createEmptyMapGeometry(battleMap.id, 1)
    state.doors.push(
      {
        id: 'door-1', kind: 'door', label: 'Door 1',
        points: [{ x: 65, y: 0 }, { x: 65, y: 100 }],
        state: 'closed', secret: false,
        blocksVision: true, blocksMovement: true, blocksLineOfEffect: true,
        baseHeightFeet: 0, heightFeet: 10, createdAt: 1,
      },
      {
        id: 'door-2', kind: 'door', label: 'Door 2',
        points: [{ x: 125, y: 0 }, { x: 125, y: 100 }],
        state: 'closed', secret: false,
        blocksVision: true, blocksMovement: true, blocksLineOfEffect: true,
        baseHeightFeet: 0, heightFeet: 10, createdAt: 1,
      },
    )
    setMapGeometryRuntime([state])
    const sharedTree = planDnd5eMonsterTurn(
      battleMap,
      barbedDevil,
      [character({ currentHp: 40, maxHp: 40 })],
    )
    const perDestination = planDnd5eMonsterTurn(
      battleMap,
      barbedDevil,
      [character({ currentHp: 40, maxHp: 40 })],
      {
        simulationOptimization: {
          candidateRouteSearch: 'per-destination',
        },
      },
    )

    expect(sharedTree).toEqual(perDestination)
    expect(sharedTree.decision?.candidateCount)
      .toBe(perDestination.decision?.candidateCount)
  })

  it('uses authoritative Dodge when an enclosed monster has no legal attack or useful movement', () => {
    const wolf = token({ id: 'wolf', label: '狼', poolId: 'srd-5.1:wolf', x: 5, y: 5, hp: 11, maxHp: 11 })
    const hero = token({
      id: 'hero-token', label: '英雄', type: 'player', characterId: 'hero',
      x: 45, y: 5, hp: 20, maxHp: 20,
    })
    const battleMap = { ...map([wolf, hero]), width: 60, height: 10 }
    const geometry = createEmptyMapGeometry(battleMap.id, 1)
    geometry.walls.push({
      id: 'wall', kind: 'wall', label: '封闭墙',
      points: [{ x: 10, y: 0 }, { x: 10, y: 10 }],
      blocksVision: true, blocksMovement: true, blocksLineOfEffect: true,
      baseHeightFeet: 0, heightFeet: 20, createdAt: 1,
    })
    setMapGeometryRuntime([geometry])

    const plan = planDnd5eMonsterTurn(battleMap, wolf)

    expect(plan).toMatchObject({
      moved: false,
      attacked: false,
      dodged: true,
      attackerTokenId: wolf.id,
      targetTokenId: hero.id,
      decision: { providerId: 'dnd5e:deterministic-tactical-v3' },
    })
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

  it('stands a prone monster by adding the half-speed cost to its Headless movement transaction', () => {
    const hero = character()
    const goblin = token({
      id: 'goblin', label: 'Goblin', poolId: 'srd-5.1:goblin', hp: 7, maxHp: 7,
      dnd5eCombatState: {
        conditions: ['prone'],
        activeEffects: [createDnd5eConditionEffect({
          condition: 'prone', targetId: 'goblin', source: { kind: 'system', rulesId: 'falling' },
        })],
      },
    })
    const heroToken = token({
      id: 'hero-token', label: hero.name, type: 'player', characterId: hero.id,
      x: 50, hp: 20, maxHp: 20,
    })
    const resolved = resolveDnd5eMonsterMapMove({
      combatId: 'combat', map: map([goblin, heroToken]), characters: [hero],
      initiativeOrder: [
        { tokenId: goblin.id, label: goblin.label, emoji: '', color: '', roll: 20 },
        { tokenId: heroToken.id, label: heroToken.label, emoji: '', color: '', roll: 10 },
      ],
      actorTokenId: goblin.id,
      to: { x: 20, y: 0 },
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })

    expect(resolved.ok).toBe(true)
    if (!resolved.ok || !resolved.result.ok) return
    expect(resolved.result.state.combatants[goblin.id]).toMatchObject({
      turn: { movementRemaining: 5 },
    })
    expect(resolved.result.state.combatants[goblin.id].conditions).not.toContain('prone')
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'turn-resource-spent', actorId: goblin.id, resource: 'movement', amount: 25,
    }))
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
