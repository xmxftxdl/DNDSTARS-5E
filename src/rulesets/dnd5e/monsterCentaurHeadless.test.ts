import { afterEach, describe, expect, it } from 'vitest'
import { createEmptyMapGeometry, setMapGeometryRuntime } from '../../lib/mapGeometry'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { simulateDnd5eCombats } from './combatSimulation'
import {
  prepareDnd5eMonsterAttack,
  resolvePreparedDnd5eMonsterAttack,
} from './monsterAttackAction'
import type { MonsterDecisionProvider } from './monsterDecisionProvider'
import { planDnd5eMonsterTurn } from './monsterTurnPlanner'
import {
  getDnd5eSrdMonster,
  type Dnd5eMonsterStatBlock,
} from './monsters'
import { setDnd5eRoomMonsterCatalog } from './roomMonsterCatalog'

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
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    savingThrows: [],
    skills: [],
    maxHp: 100,
    currentHp: 100,
    tempHp: 0,
    hitDice: '1d8',
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

function battleMap(id: string, tokens: Token[], gridSize = 10): BattleMap {
  return {
    id,
    name: id,
    width: 800,
    height: 100,
    gridSize,
    feetPerCell: 5,
    gridOffsetX: 0,
    gridOffsetY: 0,
    showGrid: true,
    tokens,
  }
}

describe('Centaur Headless action alternatives', () => {
  afterEach(() => {
    setDnd5eRoomMonsterCatalog([])
    setMapGeometryRuntime([])
  })

  it('exposes stable melee and ranged Multiattack actions in the SRD catalog', () => {
    const centaur = getDnd5eSrdMonster('srd-5.1:centaur')

    expect(centaur?.actions.find((action) => action.id === 'multiattack')).toMatchObject({
      kind: 'multiattack',
      automation: 'headless',
      sequence: ['pike', 'hooves'],
      sequenceAttackMode: 'melee',
    })
    expect(centaur?.actions.find((action) => action.id === 'multiattack-longbow')).toMatchObject({
      kind: 'multiattack',
      automation: 'headless',
      sequence: ['longbow', 'longbow'],
      sequenceAttackMode: 'ranged',
    })
  })

  it.each([
    {
      clickedActionId: 'pike',
      targetX: 10,
      parentActionId: 'multiattack',
      expectedAttackIds: ['pike', 'hooves'],
      rolls: [
        { d20: 10, damageRolls: [[5]] },
        { d20: 10, damageRolls: [[3, 4]] },
      ],
      expectedRemainingHp: 80,
    },
    {
      clickedActionId: 'hooves',
      targetX: 10,
      parentActionId: 'multiattack',
      expectedAttackIds: ['pike', 'hooves'],
      rolls: [
        { d20: 10, damageRolls: [[5]] },
        { d20: 10, damageRolls: [[3, 4]] },
      ],
      expectedRemainingHp: 80,
    },
    {
      clickedActionId: 'longbow',
      targetX: 60,
      parentActionId: 'multiattack-longbow',
      expectedAttackIds: ['longbow', 'longbow'],
      rolls: [
        { d20: 10, damageRolls: [[4]] },
        { d20: 10, damageRolls: [[4]] },
      ],
      expectedRemainingHp: 88,
    },
  ])(
    'upgrades a Host click on $clickedActionId to $parentActionId and resolves it atomically',
    ({
      clickedActionId,
      targetX,
      parentActionId,
      expectedAttackIds,
      rolls,
      expectedRemainingHp,
    }) => {
      const hero = character()
      const centaur = getDnd5eSrdMonster('srd-5.1:centaur')!
      const actor = token({
        id: 'centaur',
        label: centaur.name,
        poolId: centaur.id,
        hp: centaur.hitPoints.average,
        maxHp: centaur.hitPoints.average,
      })
      const target = token({
        id: 'hero-token',
        label: hero.name,
        x: targetX,
        type: 'player',
        characterId: hero.id,
        hp: hero.currentHp,
        maxHp: hero.maxHp,
      })
      const map = battleMap(`centaur-${clickedActionId}`, [actor, target])
      const prepared = prepareDnd5eMonsterAttack({
        combatId: `centaur-${clickedActionId}`,
        map,
        characters: [hero],
        initiativeOrder: [
          { tokenId: actor.id, label: actor.label, emoji: '', color: '', roll: 20 },
          { tokenId: target.id, label: target.label, emoji: '', color: '', roll: 10 },
        ],
        actorTokenId: actor.id,
        targetTokenId: target.id,
        actionIndex: centaur.actions.findIndex((action) => action.id === clickedActionId),
      })

      expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
      if (!prepared.ok) return
      expect(prepared.prepared.action).toMatchObject({
        id: parentActionId,
        kind: 'multiattack',
        automation: 'headless',
      })
      expect(prepared.prepared.attacks.map((attack) => attack.id)).toEqual(expectedAttackIds)

      const resolved = resolvePreparedDnd5eMonsterAttack({
        prepared: prepared.prepared,
        rolls,
      })
      expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
      expect(resolved.result.events.filter((event) =>
        event.type === 'attack-resolved' &&
        event.actorId === actor.id &&
        event.targetId === target.id)).toHaveLength(2)
      expect(resolved.application?.characters[0]?.currentHp).toBe(expectedRemainingHp)
    },
  )

  it.each([
    {
      label: 'melee',
      targetX: 10,
      distanceFeet: 5,
      actionId: 'multiattack',
      expectedDamage: 17,
    },
    {
      label: 'ranged',
      targetX: 60,
      distanceFeet: 30,
      actionId: 'multiattack-longbow',
      expectedDamage: 9,
    },
  ])(
    'lets the tactical planner select the complete $label sequence',
    ({ targetX, distanceFeet, actionId, expectedDamage }) => {
      const catalog = getDnd5eSrdMonster('srd-5.1:centaur')!
      const centaur: Dnd5eMonsterStatBlock = {
        ...catalog,
        id: 'test:centaur-planner',
        slug: 'test-centaur-planner',
        speed: { ...catalog.speed, walk: 0 },
      }
      setDnd5eRoomMonsterCatalog([centaur])
      const actionIndex = centaur.actions.findIndex((action) => action.id === actionId)
      const actor = token({
        id: 'centaur',
        label: centaur.name,
        poolId: centaur.id,
        hp: centaur.hitPoints.average,
        maxHp: centaur.hitPoints.average,
      })
      const target = token({
        id: 'hero-token',
        label: 'Hero',
        x: targetX,
        type: 'player',
        characterId: 'hero',
        hp: 100,
        maxHp: 100,
      })
      const decisionProvider: MonsterDecisionProvider = {
        id: `test:centaur:${actionId}`,
        schemaVersion: 1,
        scoreCandidate(_context, candidate) {
          const selected = candidate.id.startsWith(`attack:${target.id}:${actionIndex}:`) &&
            candidate.metrics.targetDistanceFeet === distanceFeet &&
            candidate.metrics.movementFeet === 0
          return {
            candidateId: candidate.id,
            score: selected ? 10_000 : -10_000,
            reasons: [],
          }
        },
      }
      const plan = planDnd5eMonsterTurn(
        battleMap(`centaur-planner-${actionId}`, [actor, target]),
        actor,
        [character()],
        { decisionProvider },
      )

      expect(plan).toMatchObject({
        attacked: true,
        actionIndex,
        decision: {
          metrics: {
            targetDistanceFeet: distanceFeet,
            movementFeet: 0,
            expectedDamage,
          },
        },
      })
    },
  )

  it('simulates the ranged alternative as one Headless transaction with two attacks', () => {
    const hero = character()
    const catalog = getDnd5eSrdMonster('srd-5.1:centaur')!
    const centaur: Dnd5eMonsterStatBlock = {
      ...catalog,
      id: 'test:centaur-simulation',
      slug: 'test-centaur-simulation',
      name: 'Centaur simulation',
      englishName: 'Centaur simulation',
      speed: { ...catalog.speed, walk: 0 },
    }
    const gridSize = 50
    const actor = token({
      id: 'centaur-token',
      label: centaur.name,
      x: gridSize / 2,
      y: gridSize / 2,
      poolId: centaur.id,
      hp: centaur.hitPoints.average,
      maxHp: centaur.hitPoints.average,
    })
    const target = token({
      id: 'hero-token',
      label: hero.name,
      x: gridSize / 2 + 6 * gridSize,
      y: gridSize / 2,
      type: 'player',
      characterId: hero.id,
      hp: hero.currentHp,
      maxHp: hero.maxHp,
    })
    const map = battleMap('centaur-simulation', [actor, target], gridSize)
    const result = simulateDnd5eCombats({
      characters: [hero],
      monsters: [{ monsterId: centaur.id, count: 1 }],
      customMonsters: [centaur],
      trials: 1,
      seed: 20260728,
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
    const decision = result.decisionLog.find((entry) => entry.actorName === centaur.name)
    const selected = decision?.candidates.find((candidate) => candidate.selected)
    const attackRolls = decision?.executionSteps.filter((step) =>
      step.kind === 'roll' && step.text.includes('D20=')) ?? []

    expect(selected).toMatchObject({
      actionId: 'multiattack-longbow',
      metrics: {
        targetDistanceFeet: 30,
        expectedDamage: 9,
      },
    })
    expect(decision?.outcome).toMatchObject({
      executed: true,
      headlessTransactions: 1,
    })
    expect(attackRolls).toHaveLength(2)
  })
})
