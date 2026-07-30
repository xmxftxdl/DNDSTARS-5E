import { describe, expect, it } from 'vitest'
import type { Character } from '../../types/character'
import { createEmptyMapGeometry } from '../../lib/mapGeometry'
import type { BattleMap, Token } from '../../store/maps'
import { simulateDnd5eCombats } from './combatSimulation'
import {
  getDnd5eSrdMonster,
  setDnd5eRoomMonsterCatalog,
  type Dnd5eMonsterStatBlock,
} from './monsters'
import {
  createDnd5eConditionEffect,
  dnd5eActiveEffectId,
} from './activeEffects'
import { dnd5eMonsterActionAutomation } from './monsterSchema'
import { planDnd5eMonsterTurn } from './monsterTurnPlanner'

function inertHero(id: string, name: string): Character {
  return {
    id,
    name,
    player: id,
    avatar: '',
    accent: '',
    race: 'Human',
    charClass: 'Fighter',
    level: 1,
    background: '',
    experience: 0,
    reputation: 0,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    savingThrows: [],
    skills: [],
    maxHp: 500,
    currentHp: 500,
    tempHp: 0,
    hitDice: '1d10',
    ac: 10,
    speed: 0,
    initiativeBonus: -100,
    saveDC: 10,
    passivePerception: 10,
    inspiration: 0,
    conditions: [],
    notes: '',
    dmNotes: '',
    visibleToPlayers: true,
    equipment: {},
  }
}

function monsterToken(
  monster: Dnd5eMonsterStatBlock,
  patch: Partial<Token> = {},
): Token {
  return {
    id: `${monster.slug}-token`,
    label: monster.name,
    x: 25,
    y: 25,
    color: '#ff0000',
    emoji: '',
    size: 1,
    type: 'enemy',
    poolId: monster.id,
    hp: monster.hitPoints.average,
    maxHp: monster.hitPoints.average,
    ...patch,
  }
}

function heroToken(
  hero: Character,
  x: number,
  y = 25,
): Token {
  return {
    id: `${hero.id}-token`,
    label: hero.name,
    x,
    y,
    color: '#ffffff',
    emoji: '',
    size: 1,
    type: 'player',
    characterId: hero.id,
    hp: hero.currentHp,
    maxHp: hero.maxHp,
  }
}

function battleMap(id: string, tokens: readonly Token[]): BattleMap {
  return {
    id,
    name: id,
    width: 250,
    height: 100,
    gridSize: 50,
    gridOffsetX: 0,
    gridOffsetY: 0,
    showGrid: true,
    feetPerCell: 5,
    tokens: [...tokens],
  }
}

function firstMonsterTurn(
  result: ReturnType<typeof simulateDnd5eCombats>,
  monster: Dnd5eMonsterStatBlock,
) {
  return result.decisionLog.find((entry) => entry.actorName === monster.name)
}

function attackRollTexts(
  turn: NonNullable<ReturnType<typeof firstMonsterTurn>>,
): readonly string[] {
  return turn.executionSteps
    .filter((step) => step.kind === 'roll' && step.text.includes('攻击'))
    .map((step) => step.text)
}

describe('D&D 5e simulation monster Multiattack occurrence targets', () => {
  it('carries the Tyrannosaurus Bite and Tail target allocation into Headless resolution', () => {
    const monster = getDnd5eSrdMonster('srd-5.1:tyrannosaurus-rex')!
    const first = inertHero('split-target-a', 'Split Target A')
    const second = inertHero('split-target-b', 'Split Target B')
    const map = battleMap('simulation-tyrannosaurus-split-targets', [
      monsterToken(monster),
      heroToken(first, 75),
      heroToken(second, 125),
    ])

    const result = simulateDnd5eCombats({
      characters: [first, second],
      monsters: [{ monsterId: monster.id, count: 1 }],
      trials: 1,
      seed: 20260729,
      maxRounds: 1,
      battlefield: {
        map,
        geometry: createEmptyMapGeometry(map.id),
      },
      strategyTraining: {
        enabled: true,
        explorationRate: 0,
        terminalRewardWeight: 1,
      },
    })
    const turn = firstMonsterTurn(result, monster)

    expect(turn, JSON.stringify(result.decisionLog, null, 2)).toBeDefined()
    expect(turn).toMatchObject({
      actionName: monster.actions.find((action) => action.id === 'multiattack')!.name,
      outcome: {
        executed: true,
      },
    })
    expect(turn!.outcome.headlessTransactions).toBeGreaterThan(0)
    const rolls = attackRollTexts(turn!)
    expect(rolls).toHaveLength(2)
    expect(rolls.some((text) => text.includes(first.name))).toBe(true)
    expect(rolls.some((text) => text.includes(second.name))).toBe(true)
  })

  it('uses the mapped Hydra head count as the concrete Bite occurrence count', () => {
    const monster = getDnd5eSrdMonster('srd-5.1:hydra')!
    const hero = inertHero('three-head-target', 'Three Head Target')
    const map = battleMap('simulation-hydra-runtime-head-count', [
      monsterToken(monster, {
        dnd5eCombatState: { monsterHydraHeadCount: 3 },
      }),
      heroToken(hero, 75),
    ])

    const result = simulateDnd5eCombats({
      characters: [hero],
      monsters: [{ monsterId: monster.id, count: 1 }],
      trials: 1,
      seed: 31415926,
      maxRounds: 1,
      battlefield: {
        map,
        geometry: createEmptyMapGeometry(map.id),
      },
      strategyTraining: {
        enabled: true,
        explorationRate: 0,
        terminalRewardWeight: 1,
      },
    })
    const turn = firstMonsterTurn(result, monster)

    expect(turn, JSON.stringify(result.decisionLog, null, 2)).toBeDefined()
    expect(turn).toMatchObject({
      actionName: monster.actions.find((action) => action.id === 'multiattack')!.name,
      outcome: {
        executed: true,
        headlessTransactions: 1,
      },
    })
    expect(attackRollTexts(turn!)).toHaveLength(3)
  })

  it('carries three Kraken Fling relation targets through an all-special Multiattack', () => {
    const catalog = getDnd5eSrdMonster('srd-5.1:kraken')!
    const multiattack = catalog.actions.find((action) =>
      action.id === 'multiattack-flings')
    const fling = catalog.actions.find((action) => action.id === 'fling')
    const tentacle = catalog.actions.find((action) => action.id === 'tentacle')
    if (!multiattack || !fling || !tentacle) {
      throw new Error('Kraken Fling fixture is missing')
    }
    expect(dnd5eMonsterActionAutomation(multiattack)).toBe('headless')
    expect(dnd5eMonsterActionAutomation(fling)).toBe('headless')
    const monster: Dnd5eMonsterStatBlock = {
      ...catalog,
      name: 'Simulation Kraken',
      englishName: 'Simulation Kraken',
      abilities: { ...catalog.abilities, dex: 30 },
      speed: { ...catalog.speed, walk: 0, swim: 0 },
      // Retain the relation declaration so Headless can validate the seeded
      // grapples, but keep the weapon itself out of tactical candidates.
      actions: [
        multiattack,
        { ...tentacle, automation: 'dm-adjudication' },
        fling,
      ],
    }
    const krakenToken = monsterToken(monster, { id: 'simulation-kraken-token' })
    const heroes = [
      inertHero('fling-target-a', 'Fling Target A'),
      inertHero('fling-target-b', 'Fling Target B'),
      inertHero('fling-target-c', 'Fling Target C'),
    ]
    const targetPositions = [
      { x: 75, y: 25 },
      { x: 25, y: 75 },
      { x: 75, y: 75 },
    ] as const
    const targetTokens = heroes.map((hero, index) => {
      const position = targetPositions[index]!
      const token = heroToken(hero, position.x, position.y)
      const rootId = dnd5eActiveEffectId(
        'relation',
        'grapple',
        krakenToken.id,
        'tentacle',
        token.id,
      )
      const restrainedId = dnd5eActiveEffectId(
        'relation-dependent',
        'grapple',
        krakenToken.id,
        'tentacle',
        token.id,
        'restrained',
      )
      const source = {
        kind: 'monster' as const,
        actorId: krakenToken.id,
        rulesId: `monster:${monster.id}:tentacle:tentacle-grapple`,
      }
      const grappled = createDnd5eConditionEffect({
        id: rootId,
        stackingKey: rootId,
        condition: 'grappled',
        source,
        targetId: token.id,
        escapeCheck: {
          ability: 'str',
          skill: 'athletics',
          alternativeAbility: 'dex',
          alternativeSkill: 'acrobatics',
          dc: 18,
          economy: 'action',
        },
        relation: {
          schemaVersion: 1,
          kind: 'grapple',
          sourceActorId: krakenToken.id,
          sourceActionId: 'tentacle',
          slotGroup: 'tentacle',
          maxDistanceFeet: 30,
          movement: 'drag-target',
          endsOnSourceIncapacitated: true,
        },
      })
      const restrained = createDnd5eConditionEffect({
        id: restrainedId,
        stackingKey: restrainedId,
        condition: 'restrained',
        source,
        targetId: token.id,
        dependsOnEffectId: rootId,
      })
      return {
        ...token,
        dnd5eCombatState: {
          schemaVersion: 2 as const,
          activeEffects: [grappled, restrained],
          conditions: ['grappled', 'restrained'],
        },
      } satisfies Token
    })
    const map = {
      ...battleMap('simulation-kraken-all-special-targets', [
        krakenToken,
        ...targetTokens,
      ]),
      width: 1_000,
      height: 1_000,
    }
    setDnd5eRoomMonsterCatalog([monster])
    const planned = planDnd5eMonsterTurn(map, krakenToken, heroes)
    expect(planned, JSON.stringify(planned, null, 2)).toMatchObject({
      actionIndex: 0,
      attackTargetTokenIds: expect.arrayContaining(
        targetTokens.map((token) => token.id),
      ),
    })

    const result = simulateDnd5eCombats({
      characters: heroes,
      monsters: [{ monsterId: monster.id, count: 1 }],
      customMonsters: [monster],
      trials: 1,
      seed: 27182818,
      maxRounds: 1,
      battlefield: {
        map,
        geometry: createEmptyMapGeometry(map.id),
      },
      strategyTraining: {
        enabled: true,
        explorationRate: 0,
        terminalRewardWeight: 1,
      },
    })
    const turn = firstMonsterTurn(result, monster)

    expect(turn, JSON.stringify(result.decisionLog, null, 2)).toMatchObject({
      actionName: multiattack.name,
      outcome: {
        executed: true,
        headlessTransactions: 1,
        damage: 0,
      },
    })
    const flings = turn!.executionSteps.filter((step) =>
      step.kind === 'result' &&
      step.text.includes('特殊动作 fling'))
    expect(flings, JSON.stringify(turn!.executionSteps, null, 2)).toHaveLength(3)
    for (const hero of heroes) {
      expect(flings.some((step) => step.text.includes(hero.name))).toBe(true)
    }
  })
})
