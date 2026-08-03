import { describe, expect, it } from 'vitest'
import type { Character } from '../../types/character'
import { defaultEquipmentForDnd5eCharacter } from './equipment'
import {
  DND5E_COMBAT_SIMULATION_MAX_TRIALS,
  simulateDnd5eCombatsAsync,
  simulateDnd5eCombats,
  validateDnd5eCombatSimulationRequest,
} from './combatSimulation'
import {
  getDnd5eSrdMonster,
  type Dnd5eMonsterStatBlock,
} from './monsters'
import {
  createDnd5eConditionEffect,
  createDnd5eMechanicalEffect,
  dnd5eActiveEffectId,
} from './activeEffects'
import {
  createDnd5eCombatant,
  dnd5eCombatantPairKey,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
} from './headlessCombatEngine'
import { createEmptyMapGeometry } from '../../lib/mapGeometry'
import type { BattleMap } from '../../store/maps'

function fighter(patch: Partial<Character> = {}): Character {
  return {
    id: 'fighter',
    name: '测试战士',
    player: 'P1',
    avatar: '',
    accent: '',
    race: '人类',
    charClass: '战士',
    level: 5,
    background: '士兵',
    experience: 0,
    reputation: 0,
    abilities: { str: 18, dex: 14, con: 16, int: 10, wis: 10, cha: 10 },
    savingThrows: ['str', 'con'],
    skills: [],
    maxHp: 52,
    currentHp: 52,
    tempHp: 0,
    hitDice: '5d10',
    ac: 18,
    speed: 30,
    initiativeBonus: 0,
    saveDC: 12,
    passivePerception: 10,
    inspiration: 0,
    conditions: [],
    notes: '',
    dmNotes: '',
    visibleToPlayers: true,
    equipment: defaultEquipmentForDnd5eCharacter({ charClass: '战士' }),
    ...patch,
  }
}

function wizard(patch: Partial<Character> = {}): Character {
  return fighter({
    id: 'wizard',
    name: '测试法师',
    charClass: '法师',
    level: 5,
    abilities: { str: 8, dex: 14, con: 14, int: 18, wis: 12, cha: 10 },
    equipment: defaultEquipmentForDnd5eCharacter({ charClass: '法师' }),
    dnd5eClassLevels: { wizard: 5 },
    dnd5eClassChoices: {
      classes: {
        wizard: {
          selections: {
            'spell-cantrips': ['fire-bolt'],
            'spell-prepared': ['fireball'],
          },
        },
      },
    },
    classResources: {
      'dnd5e-spell-slot-3': { current: 2, max: 2 },
    },
    ...patch,
  })
}

function cleric(patch: Partial<Character> = {}): Character {
  return fighter({
    id: 'cleric',
    name: '测试牧师',
    charClass: '牧师',
    level: 5,
    abilities: { str: 12, dex: 10, con: 14, int: 10, wis: 18, cha: 12 },
    equipment: defaultEquipmentForDnd5eCharacter({ charClass: '牧师' }),
    dnd5eClassLevels: { cleric: 5 },
    dnd5eClassChoices: {
      classes: {
        cleric: {
          selections: {
            'spell-prepared': ['healing-word'],
          },
        },
      },
    },
    classResources: {
      'dnd5e-spell-slot-1': { current: 2, max: 2 },
    },
    ...patch,
  })
}

function thunderwaveBard(patch: Partial<Character> = {}): Character {
  return fighter({
    id: 'thunderwave-bard',
    name: '悬崖诗人',
    charClass: '吟游诗人',
    level: 13,
    abilities: { str: 8, dex: 14, con: 14, int: 10, wis: 12, cha: 30 },
    initiativeBonus: 30,
    equipment: defaultEquipmentForDnd5eCharacter({ charClass: '吟游诗人' }),
    dnd5eClassLevels: { bard: 13 },
    dnd5eClassChoices: {
      classes: {
        bard: { selections: { 'spell-known': ['thunderwave'] } },
      },
    },
    classResources: {
      'dnd5e-spell-slot-1': { current: 1, max: 4 },
    },
    ...patch,
  })
}

function inertDefenseMonster(
  id: string,
  damageDefenseRules: Dnd5eMonsterStatBlock['damageDefenseRules'] = [],
): Dnd5eMonsterStatBlock {
  const base = getDnd5eSrdMonster('srd-5.1:goblin')!
  return {
    ...base,
    id,
    slug: id.replace(/[^a-z0-9]+/gi, '-'),
    name: `防御测试体 ${id}`,
    englishName: `Defense target ${id}`,
    armorClass: { value: 1, note: '测试' },
    hitPoints: { average: 200, dice: '200' },
    speed: { walk: 0 },
    actions: [],
    traits: [],
    damageVulnerabilities: [],
    damageResistances: [],
    damageImmunities: [],
    damageDefenseRules,
  }
}

function fighterWithWeaponSource(
  source: { magical?: boolean; specialMaterial?: 'silvered' | 'adamantine' },
): Character {
  const character = fighter({ initiativeBonus: 100 })
  const weapon = character.equipment?.mainWeapon
  if (!weapon || weapon.dnd5e?.kind !== 'weapon') throw new Error('fighter test weapon missing')
  return {
    ...character,
    equipment: {
      ...character.equipment,
      mainWeapon: {
        ...weapon,
        dnd5e: {
          ...weapon.dnd5e,
          magical: source.magical ?? false,
          ...(source.specialMaterial ? { specialMaterial: source.specialMaterial } : {}),
        },
      },
    },
  }
}

function sourceLinkedMappedSimulationFixture(
  slug: 'ankheg' | 'constrictor-snake',
  actionId: 'bite' | 'constrict',
) {
  const catalogMonster = getDnd5eSrdMonster(`srd-5.1:${slug}`)!
  const action = catalogMonster.actions.find((candidate) => candidate.id === actionId)!
  if (action.kind !== 'weapon-attack' || !action.attack) {
    throw new Error(`${catalogMonster.englishName} ${actionId} fixture is not a weapon attack`)
  }
  const monster: Dnd5eMonsterStatBlock = {
    ...catalogMonster,
    id: `room-monster:simulation-${slug}`,
    slug: `simulation-${slug}`,
    name: `Simulation ${catalogMonster.englishName}`,
    englishName: `Simulation ${catalogMonster.englishName}`,
    abilities: { ...catalogMonster.abilities, dex: 30 },
    armorClass: { value: 30, note: 'simulation fixture' },
    hitPoints: { average: 1_000, dice: '1000' },
    speed: { ...catalogMonster.speed, walk: 0 },
    actions: [{
      ...action,
      attack: {
        ...action.attack,
        toHit: 100,
      },
    }],
    bonusActions: [],
    reactions: [],
    legendaryActions: [],
    lairActions: [],
  }
  const hero = fighter({
    id: `source-linked-target-${slug}`,
    name: `Source-linked target ${slug}`,
    initiativeBonus: -100,
    speed: 0,
    ac: 1,
    maxHp: 1_000,
    currentHp: 1_000,
    equipment: {},
  })
  const map: BattleMap = {
    id: `source-linked-${slug}-map`,
    name: `Source-linked ${slug} map`,
    width: 150,
    height: 100,
    gridSize: 50,
    gridOffsetX: 0,
    gridOffsetY: 0,
    showGrid: true,
    feetPerCell: 5,
    tokens: [
      {
        id: `${slug}-token`,
        label: monster.name,
        x: 25,
        y: 25,
        color: '#f00',
        emoji: '',
        size: 1,
        type: 'enemy',
        poolId: monster.id,
        hp: monster.hitPoints.average,
        maxHp: monster.hitPoints.average,
      },
      {
        id: `${slug}-target-token`,
        label: hero.name,
        x: 75,
        y: 25,
        color: '#fff',
        emoji: '',
        size: 1,
        type: 'player',
        characterId: hero.id,
      },
    ],
  }
  return {
    monster,
    hero,
    request: {
      characters: [hero],
      monsters: [{ monsterId: monster.id, count: 1 }],
      customMonsters: [monster],
      trials: 1,
      seed: 7,
      maxRounds: 2,
      battlefield: { map, geometry: createEmptyMapGeometry(map.id) },
      strategyTraining: { enabled: true, explorationRate: 0, terminalRewardWeight: 1 },
    } as const,
  }
}

describe('D&D 5e combat simulator', () => {
  it('runs a current-map encounter with two-dimensional wall-aware tactical movement', () => {
    const hero = fighter()
    const map: BattleMap = {
      id: 'simulation-map',
      name: '二维模拟地图',
      width: 600,
      height: 600,
      gridSize: 50,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      feetPerCell: 5,
      tokens: [
        {
          id: 'hero-token',
          label: hero.name,
          x: 525,
          y: 275,
          color: '#ffffff',
          emoji: '',
          size: 1,
          type: 'player',
          characterId: hero.id,
        },
        {
          id: 'goblin-token',
          label: '地精',
          x: 75,
          y: 275,
          color: '#ff0000',
          emoji: '',
          size: 1,
          type: 'enemy',
          poolId: 'srd-5.1:goblin',
          hp: 7,
          maxHp: 7,
        },
      ],
    }
    const geometry = {
      ...createEmptyMapGeometry(map.id),
      walls: [{
        id: 'central-wall',
        kind: 'wall' as const,
        label: '中央墙',
        points: [{ x: 300, y: 0 }, { x: 300, y: 500 }],
        edgeIds: ['central-wall-edge'],
        baseHeightFeet: 0,
        heightFeet: 20,
        blocksVision: true,
        blocksMovement: true,
        blocksLineOfEffect: true,
        createdAt: 1,
      }],
    }
    const request = {
      characters: [hero],
      monsters: [{ monsterId: 'srd-5.1:goblin', count: 1 }],
      trials: 1,
      seed: 11,
      maxRounds: 10,
      battlefield: { map, geometry },
      strategyTraining: {
        enabled: true,
        explorationRate: 0.1,
        terminalRewardWeight: 1,
      },
    } as const
    const result = simulateDnd5eCombats(request)

    expect(result.mode).toBe('mapped-encounter')
    expect(result.coverage.mode).toBe('mapped-encounter')
    expect(map.tokens.find((token) => token.id === 'goblin-token')).toMatchObject({
      x: 75,
      y: 275,
      hp: 7,
    })
    expect(result.decisionLog.length).toBeGreaterThan(0)
    expect(result.decisionLog[0].actorPositionBefore).toEqual({ x: 75, y: 275 })
    expect(result.decisionLog.some((entry) =>
      entry.actorPositionAfter.y !== entry.actorPositionBefore.y)).toBe(true)
    expect(result.decisionLog.every((entry) =>
      Number.isFinite(entry.actorPositionAfter.x) &&
      Number.isFinite(entry.actorPositionAfter.y))).toBe(true)
    expect(result.decisionLog[0].providerId).toContain('simulation-exploration')
    expect(result.learnedStrategy).toMatchObject({
      explorationRate: 0.1,
      terminalRewardWeight: 1,
    })
    expect(simulateDnd5eCombats(request)).toEqual(result)
  })

  it('uses persistent-area cost for mapped player reachability and Headless movement', () => {
    const hero = fighter({
      initiativeBonus: 100,
      speed: 30,
      equipment: {},
    })
    const monster = inertDefenseMonster('test:persistent-area-movement')
    const map: BattleMap = {
      id: 'persistent-area-simulation-map',
      name: 'Persistent area movement',
      width: 600,
      height: 50,
      gridSize: 50,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      feetPerCell: 5,
      tokens: [{
        id: 'hero-token',
        label: hero.name,
        x: 25,
        y: 25,
        color: '#fff',
        emoji: '',
        size: 1,
        type: 'player',
        characterId: hero.id,
      }, {
        id: 'monster-token',
        label: monster.name,
        x: 525,
        y: 25,
        color: '#f00',
        emoji: '',
        size: 1,
        type: 'enemy',
        poolId: monster.id,
        hp: monster.hitPoints.average,
        maxHp: monster.hitPoints.average,
      }],
      dnd5ePluginAreas: [{
        id: 'grease-area',
        pluginId: 'srd-5.1',
        featureId: 'srd-5.1:spell:grease',
        sourceKind: 'core-spell',
        coreSpellId: 'grease',
        label: 'Grease',
        color: '#fde68a',
        sourceCharacterId: 'monster',
        sourceTokenId: 'monster-token',
        cells: Array.from({ length: 10 }, (_, col) => ({ col, row: 0 })),
        createdRound: 1,
        expiresAfterRound: 10,
        relation: 'any',
        includeSelf: true,
        movementCostMultiplier: 2,
        vertical: { mode: 'ground' },
      }],
    }
    const result = simulateDnd5eCombats({
      characters: [hero],
      monsters: [{ monsterId: monster.id, count: 1 }],
      customMonsters: [monster],
      trials: 1,
      seed: 17,
      maxRounds: 1,
      battlefield: { map, geometry: createEmptyMapGeometry(map.id) },
      strategyTraining: { enabled: true, explorationRate: 0, terminalRewardWeight: 1 },
    })
    const playerTurn = result.decisionLog.find((entry) => entry.actorName === hero.name)

    expect(playerTurn).toBeDefined()
    expect((playerTurn?.actorPositionAfter.x ?? 0) - (playerTurn?.actorPositionBefore.x ?? 0))
      .toBe(300)
    expect(playerTurn?.executionSteps).toContainEqual(expect.objectContaining({
      kind: 'resource',
      text: expect.stringContaining('60'),
    }))
  })

  it('uses the Bugbear javelin ranged damage in mapped tactical simulation', () => {
    const hero = fighter({
      initiativeBonus: -100,
      speed: 0,
      ac: 10,
      maxHp: 100,
      currentHp: 100,
      equipment: {},
    })
    const bugbear = getDnd5eSrdMonster('srd-5.1:bugbear')!
    const map: BattleMap = {
      id: 'bugbear-ranged-damage-map',
      name: 'Bugbear ranged damage',
      width: 800,
      height: 200,
      gridSize: 50,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      feetPerCell: 5,
      tokens: [
        {
          id: 'bugbear-token',
          label: bugbear.name,
          x: 75,
          y: 75,
          color: '#f00',
          emoji: '',
          size: 1,
          type: 'enemy',
          poolId: bugbear.id,
          hp: 27,
          maxHp: 27,
        },
        {
          id: 'hero-token',
          label: hero.name,
          x: 675,
          y: 75,
          color: '#fff',
          emoji: '',
          size: 1,
          type: 'player',
          characterId: hero.id,
        },
      ],
    }
    const result = simulateDnd5eCombats({
      characters: [hero],
      monsters: [{ monsterId: bugbear.id, count: 1 }],
      trials: 1,
      seed: 20260728,
      maxRounds: 1,
      battlefield: { map, geometry: createEmptyMapGeometry(map.id) },
      strategyTraining: { enabled: true, explorationRate: 0, terminalRewardWeight: 1 },
    })
    const decision = result.decisionLog.find((entry) => entry.actorName === bugbear.name)
    const selected = decision?.candidates.find((candidate) => candidate.selected)
    expect(selected).toMatchObject({
      actionId: 'javelin',
      metrics: {
        targetDistanceFeet: 30,
        expectedDamage: 3.75,
        hitProbability: 0.75,
      },
    })
    expect(
      decision?.executionSteps.some((step) => step.text.includes('1d6+2')),
      JSON.stringify(decision, null, 2),
    ).toBe(true)
    expect(decision?.executionSteps.some((step) => step.text.includes('2d6+2'))).toBe(false)
  })

  it('uses Pack Tactics in mapped simulation scoring and the Headless transaction', () => {
    const hero = fighter({
      initiativeBonus: -100,
      speed: 0,
      ac: 14,
      maxHp: 100,
      currentHp: 100,
      equipment: {},
    })
    const rat = getDnd5eSrdMonster('srd-5.1:giant-rat')!
    const map: BattleMap = {
      id: 'giant-rat-pack-tactics-map',
      name: 'Giant Rat Pack Tactics',
      width: 150,
      height: 50,
      gridSize: 50,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      feetPerCell: 5,
      tokens: [
        {
          id: 'rat-one',
          label: rat.name,
          x: 25,
          y: 25,
          color: '#f00',
          emoji: '',
          size: 1,
          type: 'enemy',
          poolId: rat.id,
          hp: 7,
          maxHp: 7,
        },
        {
          id: 'hero-token',
          label: hero.name,
          x: 75,
          y: 25,
          color: '#fff',
          emoji: '',
          size: 1,
          type: 'player',
          characterId: hero.id,
        },
        {
          id: 'rat-two',
          label: rat.name,
          x: 125,
          y: 25,
          color: '#f00',
          emoji: '',
          size: 1,
          type: 'enemy',
          poolId: rat.id,
          hp: 7,
          maxHp: 7,
        },
      ],
    }
    const result = simulateDnd5eCombats({
      characters: [hero],
      monsters: [{ monsterId: rat.id, count: 2 }],
      trials: 1,
      seed: 13,
      maxRounds: 1,
      battlefield: { map, geometry: createEmptyMapGeometry(map.id) },
      strategyTraining: { enabled: true, explorationRate: 0, terminalRewardWeight: 1 },
    })
    const decision = result.decisionLog.find((entry) =>
      entry.actorName === rat.name &&
      entry.actorPositionBefore.x === 25)
    const selected = decision?.candidates.find((candidate) => candidate.selected)
    expect(selected).toMatchObject({
      actionId: 'bite',
      metrics: {
        targetDistanceFeet: 5,
      },
    })
    expect(selected?.metrics.hitProbability).toBeCloseTo(0.7975, 10)
    expect(decision?.executionSteps.some((step) =>
      step.text.includes('集群战术'))).toBe(true)
    expect(decision?.outcome.headlessTransactions).toBe(1)
  })

  it.each([
    ['ankheg', 'bite'],
    ['constrictor-snake', 'constrict'],
  ] as const)(
    'carries a landed %s %s relation into the next mapped planner snapshot',
    (slug, actionId) => {
      const { monster, request } = sourceLinkedMappedSimulationFixture(slug, actionId)
      const result = simulateDnd5eCombats(request)
      const turns = result.decisionLog.filter((entry) => entry.actorName === monster.name)
      const firstSelected = turns[0]?.candidates.find((candidate) => candidate.selected)
      const secondSelected = turns[1]?.candidates.find((candidate) => candidate.selected)

      expect(turns).toHaveLength(2)
      expect(turns[0]).toMatchObject({
        round: 1,
        outcome: { hits: 1, headlessTransactions: 1 },
      })
      expect(turns[1]).toMatchObject({
        round: 2,
        outcome: { headlessTransactions: 1 },
      })
      expect(firstSelected).toMatchObject({
        actionId,
        metrics: { controlValue: expect.any(Number) },
      })
      expect(firstSelected!.metrics.controlValue).toBeGreaterThan(0)
      expect(secondSelected).toMatchObject({
        actionId,
        metrics: { controlValue: 0 },
      })
      if (slug === 'ankheg') {
        expect(secondSelected!.metrics.hitProbability)
          .toBeGreaterThan(firstSelected!.metrics.hitProbability)
      }
    },
  )

  it('releases an owned Ankheg grapple and resolves Acid Spray in the same simulated turn', () => {
    const catalog = getDnd5eSrdMonster('srd-5.1:ankheg')!
    const catalogBite = catalog.actions.find((action) => action.id === 'bite')
    const declaration = catalogBite?.attack?.onHitEffects?.find((effect) =>
      effect.kind === 'source-linked-condition')
    if (!catalogBite?.attack || !declaration) {
      throw new Error('Ankheg Bite relation fixture is missing')
    }
    const tailDeclaration = {
      ...declaration,
      id: 'tail-grapple',
      relation: {
        ...declaration.relation,
        slotGroup: 'tail',
      },
    }
    const monster = {
      ...catalog,
      id: 'room-monster:release-acid-ankheg',
      slug: 'release-acid-ankheg',
      name: 'Release Acid Ankheg',
      englishName: 'Release Acid Ankheg',
      abilities: { ...catalog.abilities, dex: 30 },
      armorClass: { value: 30, note: 'release fixture' },
      hitPoints: { average: 1_000, dice: '1000' },
      speed: { ...catalog.speed, walk: 0 },
      actions: [
        ...catalog.actions.map((action) =>
          action.id === 'acid-spray' &&
          action.rule?.kind === 'area-saving-throw' &&
          'damage' in action.rule &&
          action.rule.damage
            ? {
                ...action,
                rule: {
                  ...action.rule,
                  damage: {
                    ...action.rule.damage,
                    count: 40,
                    average: 140,
                  },
                },
              }
            : action),
        {
          ...catalogBite,
          id: 'tail-grapple-attack',
          name: 'Tail Grapple',
          attack: {
            ...catalogBite.attack,
            onHitEffects: [tailDeclaration],
          },
        },
      ],
    } as Dnd5eMonsterStatBlock
    const monsterTokenId = 'release-acid-ankheg-token'
    const heldTokenId = 'release-acid-held-token'
    const freeTokenId = 'release-acid-free-token'
    const rootId = dnd5eActiveEffectId(
      'relation',
      'grapple',
      monsterTokenId,
      declaration.relation.slotGroup,
      heldTokenId,
    )
    const grapple = createDnd5eConditionEffect({
      id: rootId,
      condition: 'grappled',
      source: {
        kind: 'monster',
        actorId: monsterTokenId,
        rulesId: `monster:${monster.id}:bite:${declaration.id}`,
      },
      targetId: heldTokenId,
      stackingKey: rootId,
      duration: { type: 'permanent' },
      escapeCheck: {
        ability: 'str',
        skill: 'athletics',
        alternativeAbility: 'dex',
        alternativeSkill: 'acrobatics',
        dc: declaration.escapeDc!,
        economy: 'action',
      },
      relation: {
        schemaVersion: 1,
        kind: 'grapple',
        sourceActorId: monsterTokenId,
        sourceActionId: 'bite',
        slotGroup: declaration.relation.slotGroup,
        maxDistanceFeet: declaration.relation.maxDistanceFeet,
        movement: 'drag-target',
        endsOnSourceIncapacitated: true,
      },
    })
    const tailRootId = dnd5eActiveEffectId(
      'relation',
      'grapple',
      monsterTokenId,
      tailDeclaration.relation.slotGroup,
      heldTokenId,
    )
    const tailGrapple = createDnd5eConditionEffect({
      id: tailRootId,
      condition: 'grappled',
      source: {
        kind: 'monster',
        actorId: monsterTokenId,
        rulesId: `monster:${monster.id}:tail-grapple-attack:${tailDeclaration.id}`,
      },
      targetId: heldTokenId,
      stackingKey: tailRootId,
      duration: { type: 'permanent' },
      escapeCheck: {
        ability: 'str',
        skill: 'athletics',
        alternativeAbility: 'dex',
        alternativeSkill: 'acrobatics',
        dc: tailDeclaration.escapeDc!,
        economy: 'action',
      },
      relation: {
        schemaVersion: 1,
        kind: 'grapple',
        sourceActorId: monsterTokenId,
        sourceActionId: 'tail-grapple-attack',
        slotGroup: tailDeclaration.relation.slotGroup,
        maxDistanceFeet: tailDeclaration.relation.maxDistanceFeet,
        movement: 'drag-target',
        endsOnSourceIncapacitated: true,
      },
    })
    const held = fighter({
      id: 'release-acid-held',
      name: 'Held target',
      initiativeBonus: -100,
      ac: 10,
      currentHp: 500,
      maxHp: 500,
      equipment: {},
      conditions: ['grappled'],
      dnd5eCombatState: { schemaVersion: 2, activeEffects: [grapple, tailGrapple] },
    })
    const free = fighter({
      id: 'release-acid-free',
      name: 'Free target',
      initiativeBonus: -100,
      ac: 10,
      currentHp: 500,
      maxHp: 500,
      equipment: {},
    })
    const battleMap: BattleMap = {
      id: 'release-acid-map',
      name: 'Release acid map',
      width: 200,
      height: 50,
      gridSize: 50,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      feetPerCell: 5,
      tokens: [
        {
          id: monsterTokenId, label: monster.name, x: 25, y: 25,
          color: '#f00', emoji: '', size: 1, type: 'enemy', poolId: monster.id,
          hp: monster.hitPoints.average, maxHp: monster.hitPoints.average,
          dnd5eCombatState: { monsterRechargeReadyByActionId: { 'acid-spray': true } },
        },
        {
          id: heldTokenId, label: held.name, x: 75, y: 25,
          color: '#fff', emoji: '', size: 1, type: 'player', characterId: held.id,
          hp: held.currentHp, maxHp: held.maxHp,
        },
        {
          id: freeTokenId, label: free.name, x: 125, y: 25,
          color: '#fff', emoji: '', size: 1, type: 'player', characterId: free.id,
          hp: free.currentHp, maxHp: free.maxHp,
        },
      ],
    }
    const result = simulateDnd5eCombats({
      characters: [held, free],
      monsters: [{ monsterId: monster.id, count: 1 }],
      customMonsters: [monster],
      trials: 1,
      seed: 2,
      maxRounds: 1,
      battlefield: { map: battleMap, geometry: createEmptyMapGeometry(battleMap.id) },
      strategyTraining: { enabled: true, explorationRate: 0, terminalRewardWeight: 1 },
    })
    const turn = result.decisionLog.find((entry) => entry.actorName === monster.name)

    expect(turn).toMatchObject({
      actionName: monster.actions.find((action) => action.id === 'acid-spray')!.name,
      outcome: {
        executed: true,
        headlessTransactions: 2,
      },
    })
    expect(turn?.candidateId).toContain(`release-grapple:${heldTokenId}:`)
    expect(turn?.candidateId).toContain(grapple.id)
    expect(turn?.candidateId).not.toContain(tailGrapple.id)
    expect(turn?.outcome.damage).toBeGreaterThan(0)
    expect(turn?.executionSteps.filter((step) => step.kind === 'transaction').length)
      .toBeGreaterThanOrEqual(2)
  })

  it('rejects Behir Constrict and a containing Multiattack against a mapped Huge target', () => {
    const catalog = getDnd5eSrdMonster('srd-5.1:behir')!
    const constrict = catalog.actions.find((action) => action.id === 'constrict')
    const multiattack = catalog.actions.find((action) =>
      action.kind === 'multiattack' && action.sequence?.includes('constrict'))
    if (!constrict?.attack || !multiattack) {
      throw new Error('Behir Constrict fixture is missing')
    }
    const sizeLimitedConstrict = {
      ...constrict,
      attack: { ...constrict.attack, targetMaxSizeRank: 3 },
    }
    const monster = {
      ...catalog,
      id: 'room-monster:size-limited-behir',
      slug: 'size-limited-behir',
      name: 'Size-limited Behir',
      englishName: 'Size-limited Behir',
      abilities: { ...catalog.abilities, dex: 30 },
      actions: [sizeLimitedConstrict, multiattack],
    } as Dnd5eMonsterStatBlock
    const hero = fighter({
      id: 'huge-simulation-target',
      name: 'Huge simulation target',
      initiativeBonus: -100,
      currentHp: 500,
      maxHp: 500,
      equipment: {},
    })
    const battleMap: BattleMap = {
      id: 'size-limited-behir-map',
      name: 'Size-limited Behir map',
      width: 150,
      height: 50,
      gridSize: 50,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      feetPerCell: 5,
      tokens: [
        {
          id: 'size-limited-behir-token', label: monster.name, x: 25, y: 25,
          color: '#f00', emoji: '', size: 2, type: 'enemy', poolId: monster.id,
          hp: monster.hitPoints.average, maxHp: monster.hitPoints.average,
        },
        {
          id: 'huge-simulation-target-token', label: hero.name, x: 75, y: 25,
          color: '#fff', emoji: '', size: 3, creatureSize: '超大型',
          type: 'player', characterId: hero.id, hp: hero.currentHp, maxHp: hero.maxHp,
        },
      ],
    }
    const result = simulateDnd5eCombats({
      characters: [hero],
      monsters: [{ monsterId: monster.id, count: 1 }],
      customMonsters: [monster],
      trials: 1,
      seed: 8675309,
      maxRounds: 1,
      battlefield: { map: battleMap, geometry: createEmptyMapGeometry(battleMap.id) },
    })
    const turn = result.decisionLog.find((entry) => entry.actorName === monster.name)

    expect(turn?.candidates.some((candidate) =>
      candidate.actionId === constrict.id ||
      candidate.actionId === multiattack.id)).toBe(false)
    expect(turn?.actionName).toBeUndefined()
  })

  it('does not consume hidden random rolls for source-linked on-hit conditions', () => {
    const { monster, hero } = sourceLinkedMappedSimulationFixture('ankheg', 'bite')
    const bite = monster.actions[0]
    if (bite.kind !== 'weapon-attack' || !bite.attack) {
      throw new Error('Ankheg Bite fixture is not a weapon attack')
    }
    const withoutRelation: Dnd5eMonsterStatBlock = {
      ...monster,
      actions: [{
        ...bite,
        attack: {
          ...bite.attack,
          onHitEffects: bite.attack.onHitEffects?.filter((effect) =>
            effect.kind !== 'source-linked-condition'),
        },
      }],
    }
    const armedHero = fighter({
      ...hero,
      equipment: defaultEquipmentForDnd5eCharacter({ charClass: '鎴樺＋' }),
    })
    const run = (source: Dnd5eMonsterStatBlock) => simulateDnd5eCombats({
      characters: [armedHero],
      monsters: [{ monsterId: source.id, count: 1 }],
      customMonsters: [source],
      trials: 1,
      seed: 2,
      maxRounds: 1,
      initialDistanceFeet: 5,
    })
    const withRelation = run(monster)
    const withoutRelationResult = run(withoutRelation)
    const rollTrace = (result: ReturnType<typeof simulateDnd5eCombats>) =>
      result.decisionLog.flatMap((entry) =>
        entry.executionSteps.filter((step) => step.kind === 'roll').map((step) => step.text))

    expect(withRelation.decisionLog.find((entry) => entry.actorName === monster.name)
      ?.outcome.hits).toBe(1)
    expect(rollTrace(withRelation)).toEqual(rollTrace(withoutRelationResult))
    expect(withRelation.participantSummaries.map((entry) => entry.averageDamage))
      .toEqual(withoutRelationResult.participantSummaries.map((entry) => entry.averageDamage))
  })

  it('moves a source-linked target through the authoritative Headless drag transaction', () => {
    const source = createDnd5eCombatant({
      id: 'drag-source',
      name: 'Drag source',
      controller: 'dm',
      initiative: 20,
      abilities: { str: 18, dex: 10, con: 14, int: 8, wis: 10, cha: 8 },
      proficiencyBonus: 2,
      armorClass: 15,
      currentHp: 30,
      maxHp: 30,
      temporaryHp: 0,
      speed: 30,
      sizeRank: 3,
      position: { x: 0, y: 0 },
      concentrating: false,
      statBlockId: 'srd-5.1:ankheg',
    })
    const ankheg = getDnd5eSrdMonster('srd-5.1:ankheg')!
    const declaration = ankheg.actions
      .find((action) => action.id === 'bite')
      ?.attack?.onHitEffects?.find((effect) => effect.kind === 'source-linked-condition')
    if (!declaration) throw new Error('Ankheg Bite relation fixture is missing')
    const grappleId = dnd5eActiveEffectId(
      'relation',
      'grapple',
      source.id,
      declaration.relation.slotGroup,
      'drag-target',
    )
    const grapple = createDnd5eConditionEffect({
      id: grappleId,
      condition: 'grappled',
      source: {
        kind: 'monster',
        actorId: source.id,
        rulesId: `monster:${ankheg.id}:bite:${declaration.id}`,
      },
      targetId: 'drag-target',
      stackingKey: grappleId,
      duration: { type: 'permanent' },
      escapeCheck: {
        ability: 'str',
        skill: 'athletics',
        alternativeAbility: 'dex',
        alternativeSkill: 'acrobatics',
        dc: declaration.escapeDc!,
        economy: 'action',
      },
      relation: {
        schemaVersion: 1,
        kind: 'grapple',
        sourceActorId: source.id,
        sourceActionId: 'bite',
        slotGroup: declaration.relation.slotGroup,
        maxDistanceFeet: declaration.relation.maxDistanceFeet,
        movement: 'drag-target',
        endsOnSourceIncapacitated: true,
      },
    })
    const target = createDnd5eCombatant({
      id: 'drag-target',
      name: 'Drag target',
      controller: 'player',
      initiative: 10,
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      proficiencyBonus: 2,
      armorClass: 10,
      currentHp: 20,
      maxHp: 20,
      temporaryHp: 0,
      speed: 30,
      sizeRank: 2,
      position: { x: 5, y: 0 },
      concentrating: false,
      classState: { activeEffects: [grapple] },
    })
    const state = startDnd5eHeadlessCombat('simulation-drag', [source, target])
    state.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey(source.id, target.id)]: 5,
    }
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'move',
      actorId: source.id,
      to: { x: 10, y: 0 },
      distance: 10,
    }, {
      transactionId: 'simulation-drag:move',
      now: 1,
    })

    expect(result.ok).toBe(true)
    expect(result.state.combatants[source.id].position).toEqual({ x: 10, y: 0 })
    expect(result.state.combatants[target.id].position).toEqual({ x: 15, y: 0 })
    expect(result.state.combatants[source.id].turn.movementRemaining).toBe(10)
    expect(result.events.filter((event) => event.type === 'moved').map((event) => event.actorId))
      .toEqual([source.id, target.id])
    const retainedEffects = result.state.combatants[target.id].classState.activeEffects
    expect(retainedEffects, JSON.stringify(result.events, null, 2)).toBeDefined()
    expect(retainedEffects).toContainEqual(expect.objectContaining({
        id: grapple.id,
        relation: expect.objectContaining({ sourceActorId: source.id }),
      }))
  })

  it('keeps seeded source-linked mapped simulation identical across sync and async entry points', async () => {
    const { request } = sourceLinkedMappedSimulationFixture('ankheg', 'bite')
    const repeatedRequest = { ...request, trials: 3 } as const

    expect(await simulateDnd5eCombatsAsync(repeatedRequest))
      .toEqual(simulateDnd5eCombats(repeatedRequest))
  })

  it('keeps a grappled player stationary and offers its fixed-DC escape candidate', () => {
    const heroTokenId = 'fixed-escape-player-token'
    const sourceTokenId = 'fixed-escape-monster-token'
    const ankheg = getDnd5eSrdMonster('srd-5.1:ankheg')!
    const escapeSource: Dnd5eMonsterStatBlock = {
      ...ankheg,
      id: 'room-monster:fixed-player-escape-ankheg',
      slug: 'fixed-player-escape-ankheg',
      name: 'Fixed player escape Ankheg',
      englishName: 'Fixed player escape Ankheg',
      armorClass: { value: 30, note: 'escape-selection fixture' },
      hitPoints: { average: 1_000, dice: '1000' },
    }
    const declaration = escapeSource.actions
      .find((action) => action.id === 'bite')
      ?.attack?.onHitEffects?.find((effect) => effect.kind === 'source-linked-condition')
    if (!declaration) throw new Error('Ankheg Bite relation fixture is missing')
    const rootId = dnd5eActiveEffectId(
      'relation',
      'grapple',
      sourceTokenId,
      declaration.relation.slotGroup,
      heroTokenId,
    )
    const root = createDnd5eConditionEffect({
      id: rootId,
      condition: 'grappled',
      source: {
        kind: 'monster',
        actorId: sourceTokenId,
        rulesId: `monster:${escapeSource.id}:bite:${declaration.id}`,
      },
      targetId: heroTokenId,
      stackingKey: rootId,
      duration: { type: 'permanent' },
      escapeCheck: {
        ability: 'str',
        skill: 'athletics',
        alternativeAbility: 'dex',
        alternativeSkill: 'acrobatics',
        dc: declaration.escapeDc!,
        economy: 'action',
      },
      relation: {
        schemaVersion: 1,
        kind: 'grapple',
        sourceActorId: sourceTokenId,
        sourceActionId: 'bite',
        slotGroup: declaration.relation.slotGroup,
        maxDistanceFeet: declaration.relation.maxDistanceFeet,
        movement: 'drag-target',
        endsOnSourceIncapacitated: true,
      },
    })
    const hero = fighter({
      id: 'fixed-escape-player',
      name: 'Fixed escape player',
      initiativeBonus: 100,
      level: 1,
      abilities: { str: 8, dex: 20, con: 12, int: 10, wis: 10, cha: 10 },
      skills: ['acrobatics'],
      equipment: {},
      conditions: ['grappled'],
      dnd5eCombatState: {
        schemaVersion: 2,
        activeEffects: [root],
      },
    })
    const battleMap: BattleMap = {
      id: 'fixed-player-escape-map',
      name: 'Fixed player escape',
      width: 100,
      height: 50,
      gridSize: 50,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      feetPerCell: 5,
      tokens: [
        {
          id: heroTokenId,
          label: hero.name,
          x: 25,
          y: 25,
          color: '#fff',
          emoji: '',
          size: 1,
          type: 'player',
          characterId: hero.id,
          hp: hero.currentHp,
          maxHp: hero.maxHp,
        },
        {
          id: sourceTokenId,
          label: escapeSource.name,
          x: 75,
          y: 25,
          color: '#f00',
          emoji: '',
          size: 1,
          type: 'enemy',
          poolId: escapeSource.id,
          hp: escapeSource.hitPoints.average,
          maxHp: escapeSource.hitPoints.average,
        },
      ],
    }
    const request = {
      characters: [hero],
      monsters: [{ monsterId: escapeSource.id, count: 1 }],
      customMonsters: [escapeSource],
      trials: 1,
      seed: 31415926,
      maxRounds: 1,
      battlefield: {
        map: battleMap,
        geometry: createEmptyMapGeometry(battleMap.id),
      },
      strategyTraining: { enabled: true, explorationRate: 0, terminalRewardWeight: 1 },
    } as const
    const first = simulateDnd5eCombats(request)
    const repeated = simulateDnd5eCombats(request)
    const playerTurn = first.decisionLog.find((entry) => entry.actorName === hero.name)

    expect(repeated).toEqual(first)
    expect(playerTurn?.candidates.map((candidate) => candidate.candidateId))
      .toContain(`escape-active-effect:${root.id}`)
    const escapeCandidate = playerTurn?.candidates.find((candidate) =>
      candidate.candidateId === `escape-active-effect:${root.id}`)
    expect(escapeCandidate).toMatchObject({
      targetId: sourceTokenId,
      nextPosition: { x: 25, y: 25 },
      metrics: { movementFeet: 0, consumesAction: true },
    })
    expect(playerTurn?.actorPositionAfter).toEqual({ x: 25, y: 25 })
    expect(playerTurn?.candidates.every((candidate) =>
      candidate.metrics.movementFeet === 0 &&
      candidate.nextPosition.x === 25 &&
      candidate.nextPosition.y === 25)).toBe(true)
  })

  it('resolves a seeded basic grapple escape as an opposed Headless contest', () => {
    const heroTokenId = 'opposed-escape-player-token'
    const sourceTokenId = 'opposed-escape-monster-token'
    const root = createDnd5eConditionEffect({
      id: 'opposed-escape-player-root',
      condition: 'grappled',
      source: { kind: 'feature', actorId: sourceTokenId, rulesId: 'basic-action:grapple' },
      targetId: heroTokenId,
      relation: {
        schemaVersion: 1,
        kind: 'grapple',
        sourceActorId: sourceTokenId,
        sourceActionId: 'basic-action:grapple',
        slotGroup: 'free-hand',
        maxDistanceFeet: 5,
        movement: 'drag-target',
        endsOnSourceIncapacitated: true,
      },
    })
    const restrained = createDnd5eConditionEffect({
      id: 'opposed-escape-player-restrained',
      condition: 'restrained',
      source: { kind: 'system', actorId: sourceTokenId, rulesId: 'basic-action:grapple' },
      targetId: heroTokenId,
      dependsOnEffectId: root.id,
    })
    const hero = fighter({
      id: 'opposed-escape-player',
      name: 'Opposed escape player',
      initiativeBonus: 100,
      level: 1,
      abilities: { str: 8, dex: 30, con: 12, int: 10, wis: 10, cha: 10 },
      equipment: {},
      conditions: ['grappled', 'restrained'],
      dnd5eCombatState: {
        schemaVersion: 2,
        activeEffects: [root, restrained],
      },
    })
    const catalogGoblin = getDnd5eSrdMonster('srd-5.1:goblin')!
    const grapplerMonster: Dnd5eMonsterStatBlock = {
      ...catalogGoblin,
      id: 'room-monster:opposed-escape-grappler',
      slug: 'opposed-escape-grappler',
      name: 'Opposed escape grappler',
      englishName: 'Opposed escape grappler',
      abilities: { ...catalogGoblin.abilities, str: 8 },
      skills: catalogGoblin.skills?.filter((skill) => skill.key !== 'athletics'),
      armorClass: { value: 30, note: 'escape-selection fixture' },
      hitPoints: { average: 1_000, dice: '1000' },
      speed: { walk: 0 },
      actions: [],
    }
    const battleMap: BattleMap = {
      id: 'opposed-player-escape-map',
      name: 'Opposed player escape',
      width: 100,
      height: 50,
      gridSize: 50,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      feetPerCell: 5,
      tokens: [
        {
          id: heroTokenId,
          label: hero.name,
          x: 25,
          y: 25,
          color: '#fff',
          emoji: '',
          size: 1,
          type: 'player',
          characterId: hero.id,
          hp: hero.currentHp,
          maxHp: hero.maxHp,
        },
        {
          id: sourceTokenId,
          label: grapplerMonster.name,
          x: 75,
          y: 25,
          color: '#f00',
          emoji: '',
          size: 1,
          type: 'enemy',
          poolId: grapplerMonster.id,
          hp: grapplerMonster.hitPoints.average,
          maxHp: grapplerMonster.hitPoints.average,
        },
      ],
    }
    const request = {
      characters: [hero],
      monsters: [{ monsterId: grapplerMonster.id, count: 1 }],
      customMonsters: [grapplerMonster],
      trials: 1,
      seed: 16180339,
      maxRounds: 1,
      battlefield: {
        map: battleMap,
        geometry: createEmptyMapGeometry(battleMap.id),
      },
      strategyTraining: { enabled: true, explorationRate: 0, terminalRewardWeight: 1 },
    } as const
    const first = simulateDnd5eCombats(request)
    const repeated = simulateDnd5eCombats(request)
    const playerTurn = first.decisionLog.find((entry) => entry.actorName === hero.name)
    const selected = playerTurn?.candidates.find((candidate) => candidate.selected)

    expect(repeated).toEqual(first)
    expect(playerTurn?.candidates.map((candidate) => candidate.candidateId))
      .toContain(`escape-grapple:${root.id}:${sourceTokenId}`)
    expect(playerTurn).toMatchObject({
      actionName: '挣脱擒抱',
      candidateId: `escape-grapple:${root.id}:${sourceTokenId}`,
      actorPositionAfter: { x: 25, y: 25 },
      outcome: { executed: true, headlessTransactions: 1 },
    })
    expect(selected?.metrics.hitProbability).toBeGreaterThan(0.5)
    expect(selected?.metrics.hitProbability).not.toBe(0.5)
    expect(playerTurn?.executionSteps.some((step) =>
      step.kind === 'roll' && step.text.includes('对抗'))).toBe(true)
  })

  it('fails closed for a monster fixed-DC relation rejected during simulation reconciliation', () => {
    const sourceTokenId = 'monster-escape-source-token'
    const monsterTokenId = 'monster-escape-target-token'
    const catalogGoblin = getDnd5eSrdMonster('srd-5.1:goblin')!
    const ankheg = getDnd5eSrdMonster('srd-5.1:ankheg')!
    const grappledMonster: Dnd5eMonsterStatBlock = {
      ...catalogGoblin,
      id: 'room-monster:fixed-escape-goblin',
      slug: 'fixed-escape-goblin',
      name: 'Fixed escape goblin',
      englishName: 'Fixed escape goblin',
      abilities: { ...catalogGoblin.abilities, dex: 30 },
      actions: [],
    }
    const declaration = ankheg.actions
      .find((action) => action.id === 'bite')
      ?.attack?.onHitEffects?.find((effect) => effect.kind === 'source-linked-condition')
    if (!declaration) throw new Error('Ankheg Bite relation fixture is missing')
    const rootId = dnd5eActiveEffectId(
      'relation',
      'grapple',
      sourceTokenId,
      declaration.relation.slotGroup,
      monsterTokenId,
    )
    const root = createDnd5eConditionEffect({
      id: rootId,
      condition: 'grappled',
      source: {
        kind: 'monster',
        actorId: sourceTokenId,
        rulesId: `monster:${ankheg.id}:bite:${declaration.id}`,
      },
      targetId: monsterTokenId,
      stackingKey: rootId,
      duration: { type: 'permanent' },
      escapeCheck: {
        ability: 'str',
        skill: 'athletics',
        alternativeAbility: 'dex',
        alternativeSkill: 'acrobatics',
        dc: declaration.escapeDc!,
        economy: 'action',
      },
      relation: {
        schemaVersion: 1,
        kind: 'grapple',
        sourceActorId: sourceTokenId,
        sourceActionId: 'bite',
        slotGroup: declaration.relation.slotGroup,
        maxDistanceFeet: declaration.relation.maxDistanceFeet,
        movement: 'drag-target',
        endsOnSourceIncapacitated: true,
      },
    })
    const hero = fighter({
      id: 'monster-escape-fallback',
      name: 'Monster escape fallback',
      initiativeBonus: -100,
    })
    const battleMap: BattleMap = {
      id: 'fixed-monster-escape-map',
      name: 'Fixed monster escape',
      width: 150,
      height: 50,
      gridSize: 50,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      feetPerCell: 5,
      tokens: [
        {
          id: monsterTokenId,
          label: grappledMonster.name,
          x: 25,
          y: 25,
          color: '#f00',
          emoji: '',
          size: 1,
          type: 'enemy',
          poolId: grappledMonster.id,
          hp: grappledMonster.hitPoints.average,
          maxHp: grappledMonster.hitPoints.average,
          dnd5eCombatState: {
            schemaVersion: 2,
            activeEffects: [root],
            conditions: [],
          },
        },
        {
          id: sourceTokenId,
          label: ankheg.name,
          x: 75,
          y: 25,
          color: '#f00',
          emoji: '',
          size: 1,
          type: 'enemy',
          poolId: ankheg.id,
          hp: ankheg.hitPoints.average,
          maxHp: ankheg.hitPoints.average,
        },
        {
          id: 'monster-escape-fallback-token',
          label: hero.name,
          x: 125,
          y: 25,
          color: '#fff',
          emoji: '',
          size: 1,
          type: 'player',
          characterId: hero.id,
          hp: hero.currentHp,
          maxHp: hero.maxHp,
        },
      ],
    }
    const result = simulateDnd5eCombats({
      characters: [hero],
      monsters: [
        { monsterId: grappledMonster.id, count: 1 },
        { monsterId: ankheg.id, count: 1 },
      ],
      customMonsters: [grappledMonster],
      trials: 1,
      seed: 27182818,
      maxRounds: 1,
      battlefield: {
        map: battleMap,
        geometry: createEmptyMapGeometry(battleMap.id),
      },
      strategyTraining: { enabled: true, explorationRate: 0, terminalRewardWeight: 1 },
    })
    const monsterTurn = result.decisionLog.find((entry) =>
      entry.actorName === grappledMonster.name)

    expect(monsterTurn?.candidates.map((candidate) => candidate.candidateId))
      .not.toContain(`escape-active-effect:${root.id}`)
    expect(monsterTurn).toMatchObject({
      actionName: undefined,
      candidateId: expect.stringContaining('dodge:'),
      actorPositionAfter: { x: 25, y: 25 },
      outcome: { executed: false, headlessTransactions: 0 },
    })
    expect(monsterTurn?.candidates.every((candidate) =>
      candidate.metrics.movementFeet === 0)).toBe(true)
  })

  it('treats the Bugbear javelin as a normal melee attack at 5 feet in simulation', () => {
    const hero = fighter({
      initiativeBonus: -100,
      speed: 0,
      ac: 10,
      maxHp: 100,
      currentHp: 100,
      equipment: {},
    })
    const bugbear = getDnd5eSrdMonster('srd-5.1:bugbear')!
    const javelinBugbear = {
      ...bugbear,
      id: 'room-monster:bugbear-javelin-only',
      slug: 'bugbear-javelin-only',
      actions: bugbear.actions.filter((action) => action.id === 'javelin'),
    } as const
    const map: BattleMap = {
      id: 'bugbear-melee-javelin-map',
      name: 'Bugbear melee javelin',
      width: 100,
      height: 50,
      gridSize: 50,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      feetPerCell: 5,
      tokens: [
        {
          id: 'bugbear-token',
          label: bugbear.name,
          x: 25,
          y: 25,
          color: '#f00',
          emoji: '',
          size: 1,
          type: 'enemy',
          poolId: javelinBugbear.id,
          hp: 27,
          maxHp: 27,
        },
        {
          id: 'hero-token',
          label: hero.name,
          x: 75,
          y: 25,
          color: '#fff',
          emoji: '',
          size: 1,
          type: 'player',
          characterId: hero.id,
        },
      ],
    }
    const result = simulateDnd5eCombats({
      characters: [hero],
      monsters: [{ monsterId: javelinBugbear.id, count: 1 }],
      customMonsters: [javelinBugbear],
      trials: 1,
      seed: 2,
      maxRounds: 1,
      battlefield: { map, geometry: createEmptyMapGeometry(map.id) },
      strategyTraining: { enabled: true, explorationRate: 0, terminalRewardWeight: 1 },
    })
    const decision = result.decisionLog.find((entry) => entry.actorName === bugbear.name)
    const selected = decision?.candidates.find((candidate) => candidate.selected)
    expect(selected).toMatchObject({
      actionId: 'javelin',
      metrics: {
        targetDistanceFeet: 5,
        expectedDamage: 6.75,
        hitProbability: 0.75,
      },
    })
    expect(decision?.executionSteps.some((step) => step.text.includes('2d6+2'))).toBe(true)
    expect(decision?.executionSteps.some((step) => step.text.includes('1d6+2'))).toBe(false)
  })

  it('simulates one ranged dagger instead of Cult Fanatic melee-only Multiattack', () => {
    const hero = fighter({
      initiativeBonus: -100,
      speed: 0,
      ac: 10,
      maxHp: 100,
      currentHp: 100,
      equipment: {},
    })
    const catalogFanatic = getDnd5eSrdMonster('srd-5.1:cult-fanatic')!
    const fanatic = {
      ...catalogFanatic,
      id: 'room-monster:cult-fanatic-stationary',
      slug: 'cult-fanatic-stationary',
      speed: { ...catalogFanatic.speed, walk: 0 },
    } as const
    const map: BattleMap = {
      id: 'cult-fanatic-ranged-map',
      name: 'Cult Fanatic ranged dagger',
      width: 300,
      height: 100,
      gridSize: 50,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      feetPerCell: 5,
      tokens: [
        {
          id: 'cult-fanatic-token',
          label: fanatic.name,
          x: 25,
          y: 25,
          color: '#f00',
          emoji: '',
          size: 1,
          type: 'enemy',
          poolId: fanatic.id,
          hp: 22,
          maxHp: 22,
        },
        {
          id: 'hero-token',
          label: hero.name,
          x: 225,
          y: 25,
          color: '#fff',
          emoji: '',
          size: 1,
          type: 'player',
          characterId: hero.id,
        },
      ],
    }
    const result = simulateDnd5eCombats({
      characters: [hero],
      monsters: [{ monsterId: fanatic.id, count: 1 }],
      customMonsters: [fanatic],
      trials: 1,
      seed: 2,
      maxRounds: 1,
      battlefield: { map, geometry: createEmptyMapGeometry(map.id) },
      strategyTraining: { enabled: true, explorationRate: 0, terminalRewardWeight: 1 },
    })
    const decision = result.decisionLog.find((entry) => entry.actorName === fanatic.name)
    const selected = decision?.candidates.find((candidate) => candidate.selected)
    expect(selected).toMatchObject({
      actionId: 'dagger',
      metrics: {
        targetDistanceFeet: 20,
        expectedDamage: 3,
        hitProbability: 0.75,
      },
    })
    expect(decision?.candidates.some((candidate) =>
      candidate.actionId === 'multiattack')).toBe(false)
  })

  it.each([
    {
      label: 'three melee attacks',
      distanceFeet: 5,
      actionId: 'multiattack',
      expectedAttackRolls: 3,
      expectedDamage: 14.3,
    },
    {
      label: 'two Hurl Flame attacks',
      distanceFeet: 40,
      actionId: 'multiattack-hurl-flame',
      expectedAttackRolls: 2,
      expectedDamage: 12,
    },
  ])(
    'simulates the Barbed Devil $label through one authoritative Headless transaction',
    ({ distanceFeet, actionId, expectedAttackRolls, expectedDamage }) => {
      const hero = fighter({
        initiativeBonus: -100,
        speed: 0,
        ac: 14,
        maxHp: 100,
        currentHp: 100,
        equipment: {},
      })
      const catalog = getDnd5eSrdMonster('srd-5.1:barbed-devil')!
      const monster = {
        ...catalog,
        id: `room-monster:barbed-devil-${distanceFeet}`,
        slug: `barbed-devil-${distanceFeet}`,
        name: `Barbed Devil ${distanceFeet}`,
        englishName: `Barbed Devil ${distanceFeet}`,
        speed: { ...catalog.speed, walk: 0 },
      } as Dnd5eMonsterStatBlock
      const gridSize = 50
      const targetX = gridSize / 2 + distanceFeet / 5 * gridSize
      const battleMap: BattleMap = {
        id: `barbed-devil-${distanceFeet}-map`,
        name: `Barbed Devil ${distanceFeet} feet`,
        width: targetX + gridSize,
        height: gridSize,
        gridSize,
        gridOffsetX: 0,
        gridOffsetY: 0,
        showGrid: true,
        feetPerCell: 5,
        tokens: [
          {
            id: 'barbed-devil-token',
            label: monster.name,
            x: gridSize / 2,
            y: gridSize / 2,
            color: '#f00',
            emoji: '',
            size: 1,
            type: 'enemy',
            poolId: monster.id,
            hp: monster.hitPoints.average,
            maxHp: monster.hitPoints.average,
          },
          {
            id: 'hero-token',
            label: hero.name,
            x: targetX,
            y: gridSize / 2,
            color: '#fff',
            emoji: '',
            size: 1,
            type: 'player',
            characterId: hero.id,
            hp: hero.currentHp,
            maxHp: hero.maxHp,
          },
        ],
      }
      const result = simulateDnd5eCombats({
        characters: [hero],
        monsters: [{ monsterId: monster.id, count: 1 }],
        customMonsters: [monster],
        trials: 1,
        seed: 20260728,
        maxRounds: 1,
        battlefield: {
          map: battleMap,
          geometry: createEmptyMapGeometry(battleMap.id),
        },
        strategyTraining: {
          enabled: true,
          explorationRate: 0,
          terminalRewardWeight: 1,
        },
      })
      const decision = result.decisionLog.find((entry) =>
        entry.actorName === monster.name)
      const selected = decision?.candidates.find((candidate) => candidate.selected)
      const attackRolls = decision?.executionSteps.filter((step) =>
        step.kind === 'roll' && step.text.includes('D20=')) ?? []

      expect(selected).toMatchObject({
        actionId,
        metrics: {
          targetDistanceFeet: distanceFeet,
          expectedDamage,
        },
      })
      expect(decision?.outcome).toMatchObject({
        executed: true,
        headlessTransactions: 1,
      })
      expect(attackRolls).toHaveLength(expectedAttackRolls)
    },
  )

  it('keeps a Repulsion Breath forced-movement coordinate for the target next turn', () => {
    const catalog = getDnd5eSrdMonster('srd-5.1:adult-bronze-dragon')!
    const breath = catalog.actions.find((action) => action.id === 'breath-weapons')
    if (breath?.rule?.kind !== 'area-saving-throw' || !breath.rule.variants) {
      throw new Error('Adult Bronze Dragon Breath Weapons fixture is missing')
    }
    const repulsion = breath.rule.variants.find((variant) =>
      variant.id === 'repulsion-breath')
    if (!repulsion) throw new Error('Repulsion Breath fixture is missing')
    const monster: Dnd5eMonsterStatBlock = {
      ...catalog,
      id: 'room-monster:repulsion-simulation-dragon',
      slug: 'repulsion-simulation-dragon',
      name: 'Repulsion simulation dragon',
      englishName: 'Repulsion simulation dragon',
      abilities: { ...catalog.abilities, dex: 30 },
      armorClass: { value: 30, note: 'simulation fixture' },
      hitPoints: { average: 1_000, dice: '1000' },
      speed: { walk: 0 },
      actions: [{
        ...breath,
        rule: {
          ...breath.rule,
          variants: [{ ...repulsion, dc: 99 }],
        },
      }],
      bonusActions: [],
      reactions: [],
      legendaryActions: [],
      lairActions: [],
      spellcasting: undefined,
    }
    const hero = fighter({
      id: 'repulsion-simulation-target',
      name: 'Repulsion simulation target',
      initiativeBonus: -100,
      speed: 0,
      ac: 30,
      currentHp: 1_000,
      maxHp: 1_000,
      equipment: {},
    })
    const map: BattleMap = {
      id: 'repulsion-simulation-map',
      name: 'Repulsion simulation map',
      width: 1_000,
      height: 100,
      gridSize: 50,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      feetPerCell: 5,
      tokens: [
        {
          id: 'repulsion-dragon-token',
          label: monster.name,
          x: 25,
          y: 25,
          color: '#f00',
          emoji: '',
          size: 1,
          type: 'enemy',
          poolId: monster.id,
          hp: monster.hitPoints.average,
          maxHp: monster.hitPoints.average,
          dnd5eCombatState: {
            monsterRechargeReadyByActionId: { 'breath-weapons': true },
          },
        },
        {
          id: 'repulsion-target-token',
          label: hero.name,
          x: 75,
          y: 25,
          color: '#fff',
          emoji: '',
          size: 1,
          type: 'player',
          characterId: hero.id,
          hp: hero.currentHp,
          maxHp: hero.maxHp,
        },
      ],
    }

    const result = simulateDnd5eCombats({
      characters: [hero],
      monsters: [{ monsterId: monster.id, count: 1 }],
      customMonsters: [monster],
      trials: 1,
      seed: 20260728,
      maxRounds: 1,
      battlefield: { map, geometry: createEmptyMapGeometry(map.id) },
      strategyTraining: { enabled: true, explorationRate: 0, terminalRewardWeight: 1 },
    })
    const dragonTurn = result.decisionLog.find((entry) => entry.actorName === monster.name)
    const targetTurn = result.decisionLog.find((entry) => entry.actorName === hero.name)

    expect(dragonTurn).toMatchObject({
      outcome: { executed: true, headlessTransactions: 1 },
    })
    expect(dragonTurn?.actionName).toContain(repulsion.name)
    expect(dragonTurn?.executionSteps.some((step) => step.kind === 'movement')).toBe(true)
    expect(targetTurn?.actorPositionBefore).toEqual({ x: 675, y: 25 })
  })

  it('applies Slowing Breath before the target moves and caps that turn at half speed', () => {
    const catalog = getDnd5eSrdMonster('srd-5.1:adult-copper-dragon')!
    const breath = catalog.actions.find((action) => action.id === 'breath-weapons')
    if (breath?.rule?.kind !== 'area-saving-throw' || !breath.rule.variants) {
      throw new Error('Adult Copper Dragon Breath Weapons fixture is missing')
    }
    const slowing = breath.rule.variants.find((variant) =>
      variant.id === 'slowing-breath')
    if (!slowing) throw new Error('Slowing Breath fixture is missing')
    const monster: Dnd5eMonsterStatBlock = {
      ...catalog,
      id: 'room-monster:slowing-simulation-dragon',
      slug: 'slowing-simulation-dragon',
      name: 'Slowing simulation dragon',
      englishName: 'Slowing simulation dragon',
      abilities: { ...catalog.abilities, dex: 30 },
      armorClass: { value: 30, note: 'simulation fixture' },
      hitPoints: { average: 1_000, dice: '1000' },
      speed: { walk: 0 },
      actions: [{
        ...breath,
        rule: {
          ...breath.rule,
          variants: [{ ...slowing, dc: 99 }],
        },
      }],
      bonusActions: [],
      reactions: [],
      legendaryActions: [],
      lairActions: [],
      spellcasting: undefined,
    }
    const hero = fighter({
      id: 'slowing-simulation-target',
      name: 'Slowing simulation target',
      initiativeBonus: -100,
      speed: 30,
      ac: 30,
      currentHp: 1_000,
      maxHp: 1_000,
      equipment: {},
    })
    const map: BattleMap = {
      id: 'slowing-simulation-map',
      name: 'Slowing simulation map',
      width: 600,
      height: 100,
      gridSize: 50,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      feetPerCell: 5,
      tokens: [
        {
          id: 'slowing-dragon-token',
          label: monster.name,
          x: 25,
          y: 25,
          color: '#f00',
          emoji: '',
          size: 1,
          type: 'enemy',
          poolId: monster.id,
          hp: monster.hitPoints.average,
          maxHp: monster.hitPoints.average,
          dnd5eCombatState: {
            monsterRechargeReadyByActionId: { 'breath-weapons': true },
          },
        },
        {
          id: 'slowing-target-token',
          label: hero.name,
          x: 275,
          y: 25,
          color: '#fff',
          emoji: '',
          size: 1,
          type: 'player',
          characterId: hero.id,
          hp: hero.currentHp,
          maxHp: hero.maxHp,
        },
      ],
    }

    const result = simulateDnd5eCombats({
      characters: [hero],
      monsters: [{ monsterId: monster.id, count: 1 }],
      customMonsters: [monster],
      trials: 1,
      seed: 20260728,
      maxRounds: 1,
      battlefield: { map, geometry: createEmptyMapGeometry(map.id) },
      strategyTraining: { enabled: true, explorationRate: 0, terminalRewardWeight: 1 },
    })
    const dragonTurn = result.decisionLog.find((entry) => entry.actorName === monster.name)
    const targetTurn = result.decisionLog.find((entry) => entry.actorName === hero.name)
    const movedPixels = targetTurn
      ? Math.hypot(
          targetTurn.actorPositionAfter.x - targetTurn.actorPositionBefore.x,
          targetTurn.actorPositionAfter.y - targetTurn.actorPositionBefore.y,
        )
      : 0

    expect(dragonTurn?.actionName).toContain(slowing.name)
    expect(dragonTurn?.executionSteps.some((step) =>
      step.text.includes('monster-area:slowing-breath-effect'))).toBe(true)
    // At 25 feet the unarmed target would need 20 feet of ordinary movement
    // to attack. Slowing Breath leaves only 15, so it must Dash instead of
    // producing a seemingly legal move-and-attack candidate.
    expect(targetTurn).toMatchObject({
      actionName: undefined,
      candidateId: 'player:fallback:dash',
      outcome: { executed: false, headlessTransactions: 1 },
    })
    expect(movedPixels).toBe(200)
  })

  it('makes a Slowing-Breath-capped monster choose one attack instead of Multiattack', () => {
    const catalog = getDnd5eSrdMonster('srd-5.1:cult-fanatic')!
    const monster: Dnd5eMonsterStatBlock = {
      ...catalog,
      id: 'room-monster:slowed-cult-fanatic',
      slug: 'slowed-cult-fanatic',
      name: 'Slowed Cult Fanatic',
      englishName: 'Slowed Cult Fanatic',
      abilities: { ...catalog.abilities, dex: 30 },
      armorClass: { value: 30, note: 'simulation fixture' },
      hitPoints: { average: 1_000, dice: '1000' },
      speed: { walk: 0 },
      actions: catalog.actions.filter((action) =>
        action.id === 'multiattack' || action.id === 'dagger'),
      bonusActions: [],
      reactions: [],
      spellcasting: undefined,
    }
    const hero = fighter({
      id: 'slowed-cult-fanatic-target',
      name: 'Slowed Cult Fanatic target',
      initiativeBonus: -100,
      speed: 0,
      ac: 1,
      currentHp: 1_000,
      maxHp: 1_000,
      equipment: {},
    })
    const slow = createDnd5eMechanicalEffect({
      id: 'preexisting-slowing-breath',
      definitionId: 'monster-area:slowing-breath-effect',
      label: 'Slowing Breath',
      source: { kind: 'monster', actorId: 'slow-source', rulesId: 'breath-weapons' },
      targetId: 'slowed-cult-fanatic-token',
      duration: { type: 'rounds', remainingRounds: 10, tickOn: 'target-turn-end' },
      modifiers: {
        speedMultiplier: 0.5,
        preventReactions: true,
        maximumAttacksPerTurn: 1,
        actionOrBonusActionOnly: true,
      },
    })
    const map: BattleMap = {
      id: 'slowed-cult-fanatic-map',
      name: 'Slowed Cult Fanatic map',
      width: 100,
      height: 50,
      gridSize: 50,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      feetPerCell: 5,
      tokens: [
        {
          id: 'slowed-cult-fanatic-token',
          label: monster.name,
          x: 25,
          y: 25,
          color: '#f00',
          emoji: '',
          size: 1,
          type: 'enemy',
          poolId: monster.id,
          hp: monster.hitPoints.average,
          maxHp: monster.hitPoints.average,
          dnd5eCombatState: { activeEffects: [slow] },
        },
        {
          id: 'slowed-cult-fanatic-target-token',
          label: hero.name,
          x: 75,
          y: 25,
          color: '#fff',
          emoji: '',
          size: 1,
          type: 'player',
          characterId: hero.id,
          hp: hero.currentHp,
          maxHp: hero.maxHp,
        },
      ],
    }

    const result = simulateDnd5eCombats({
      characters: [hero],
      monsters: [{ monsterId: monster.id, count: 1 }],
      customMonsters: [monster],
      trials: 1,
      seed: 20260728,
      maxRounds: 1,
      battlefield: { map, geometry: createEmptyMapGeometry(map.id) },
      strategyTraining: { enabled: true, explorationRate: 0, terminalRewardWeight: 1 },
    })
    const turn = result.decisionLog.find((entry) => entry.actorName === monster.name)
    const selected = turn?.candidates.find((candidate) => candidate.selected)

    expect(turn).toMatchObject({
      actionName: catalog.actions.find((action) => action.id === 'dagger')!.name,
      outcome: { executed: true, headlessTransactions: 1 },
    })
    expect(selected?.actionId).toBe('dagger')
    expect(turn?.candidates.some((candidate) =>
      candidate.actionId === 'multiattack')).toBe(false)
    expect(turn?.outcome.hits).toBeLessThanOrEqual(1)
  })

  it('runs exactly 1000 seeded trials and is reproducible', { timeout: 45_000 }, () => {
    const request = {
      characters: [fighter()],
      monsters: [{ monsterId: 'srd-5.1:goblin', count: 2 }],
      trials: 1_000,
      seed: 12345,
      initialDistanceFeet: 30,
    } as const
    const first = simulateDnd5eCombats(request)
    const second = simulateDnd5eCombats(request)
    expect(first.trials).toBe(1_000)
    expect(first.mode).toBe('quick-estimate')
    expect(first.coverage.mode).toBe('quick-estimate')
    expect(first.playerWins + first.monsterWins + first.draws).toBe(1_000)
    expect(second).toEqual(first)
    expect(first.coverage.automatedMonsterActions).toBeGreaterThan(0)
    expect(first.roundSummaries.length).toBeGreaterThan(0)
    expect(first.actionUsage.length).toBeGreaterThan(0)
    expect(first.decisionLog.length).toBeGreaterThan(0)
    expect(first.decisionLog[0]).toMatchObject({
      providerId: 'dnd5e:deterministic-tactical-v3',
      candidateCount: expect.any(Number),
      candidates: expect.any(Array),
      executionSteps: expect.any(Array),
      outcome: {
        executed: expect.any(Boolean),
        hits: expect.any(Number),
        damage: expect.any(Number),
        headlessTransactions: expect.any(Number),
      },
    })
    expect(first.decisionLog[0].candidateCount).toBe(first.decisionLog[0].candidates.length)
    const executionTexts = first.decisionLog.flatMap((entry) =>
      entry.executionSteps.map((step) => step.text))
    expect(executionTexts.some((text) => text.includes('D20='))).toBe(true)
    expect(executionTexts.some((text) => text.includes('受到') && text.includes('HP'))).toBe(true)
    expect(executionTexts.some((text) => text.includes('Headless 事务已提交'))).toBe(true)
    expect(first.decisionLog[0].candidates[0]).toMatchObject({
      rank: 1,
      selected: true,
      metrics: {
        expectedDamage: expect.any(Number),
        hitProbability: expect.any(Number),
      },
    })
    expect(first.headlessTransactionCount).toBeGreaterThan(0)
    expect(first.learnedStrategy).toMatchObject({
      schemaVersion: 1,
      sourceTrials: 1_000,
      sourceSeed: 12345,
      global: {
        sampleCount: expect.any(Number),
        confidence: expect.any(Number),
      },
      monsters: {
        'srd-5.1:goblin': {
          sampleCount: expect.any(Number),
          confidence: expect.any(Number),
        },
      },
    })
    expect(first.learnedStrategy.global.sampleCount).toBeGreaterThan(0)
  })

  it('separates training from a frozen three-way strategy evaluation', () => {
    const result = simulateDnd5eCombats({
      characters: [fighter()],
      monsters: [{ monsterId: 'srd-5.1:goblin', count: 2 }],
      trials: 90,
      seed: 424242,
      initialDistanceFeet: 30,
      strategyTraining: {
        enabled: true,
        explorationRate: 0.08,
        terminalRewardWeight: 0.75,
        evaluationFraction: 0.3,
      },
    })

    expect(result.strategyEvaluation).toMatchObject({
      trainingTrials: 63,
      evaluationTrials: 27,
      baseline: { trials: 9 },
      learnedPlayers: { trials: 9 },
      learnedMonsters: { trials: 9 },
    })
    expect(result.learnedStrategy.sourceTrials).toBe(63)
    expect(result.strategyEvaluation!.baseline.playerWins +
      result.strategyEvaluation!.baseline.monsterWins +
      result.strategyEvaluation!.baseline.draws).toBe(9)
    expect(result.strategyEvaluation!.learnedPlayers.playerWins +
      result.strategyEvaluation!.learnedPlayers.monsterWins +
      result.strategyEvaluation!.learnedPlayers.draws).toBe(9)
    expect(result.strategyEvaluation!.learnedMonsters.playerWins +
      result.strategyEvaluation!.learnedMonsters.monsterWins +
      result.strategyEvaluation!.learnedMonsters.draws).toBe(9)
    expect(result.convergence.at(-1)).toMatchObject({
      trials: 90,
      playerWinRate: result.playerWinRate,
      monsterWinRate: result.monsterWinRate,
      drawRate: result.drawRate,
    })
  })

  it('keeps seeded results identical while yielding between complete trials for Worker pause control', async () => {
    const request = {
      characters: [fighter()],
      monsters: [{ monsterId: 'srd-5.1:goblin', count: 1 }],
      trials: 24,
      seed: 20240724,
      initialDistanceFeet: 30,
      strategyTraining: { enabled: true, explorationRate: 0.08, terminalRewardWeight: 0.75 },
    } as const
    const synchronous = simulateDnd5eCombats(request)
    let checkpoints = 0
    const asynchronous = await simulateDnd5eCombatsAsync(request, {
      waitForNextBatch: async () => {
        checkpoints += 1
      },
    })

    expect(asynchronous).toEqual(synchronous)
    expect(checkpoints).toBe(request.trials)
  })

  it('settles one authoritative end-turn repeat save per actor turn deterministically', async () => {
    const poisoned = createDnd5eConditionEffect({
      id: 'quasit-poison',
      condition: 'poisoned',
      targetId: 'player:fighter',
      source: { kind: 'monster', actorId: 'quasit', rulesId: 'monster:quasit:claw:poison' },
      duration: { type: 'rounds', remainingRounds: 10, tickOn: 'target-turn-end' },
      repeatSave: { ability: 'con', dc: 1, timing: 'target-turn-end', onSuccess: 'remove' },
    })
    const request = {
      characters: [fighter({
        initiativeBonus: 30,
        conditions: ['poisoned'],
        dnd5eCombatState: {
          schemaVersion: 2,
          activeEffects: [poisoned],
        },
      })],
      monsters: [{ monsterId: 'srd-5.1:goblin', count: 1 }],
      trials: 4,
      seed: 24681357,
      maxRounds: 2,
    } as const

    const synchronous = simulateDnd5eCombats(request)
    const repeated = simulateDnd5eCombats(request)
    const asynchronous = await simulateDnd5eCombatsAsync(request)

    expect(repeated).toEqual(synchronous)
    expect(asynchronous).toEqual(synchronous)
    const firstPlayerTurn = synchronous.decisionLog.find((entry) =>
      entry.actorName === '测试战士')
    expect(firstPlayerTurn?.executionSteps.some((step) =>
      step.kind === 'roll' && step.text.includes('CON'))).toBe(true)
    expect(firstPlayerTurn?.executionSteps.some((step) =>
      step.kind === 'condition' && step.text.includes('condition:poisoned'))).toBe(true)
    expect(firstPlayerTurn?.executionSteps.filter((step) =>
      step.kind === 'transaction')).toHaveLength(3)
    expect(firstPlayerTurn?.outcome.headlessTransactions).toBe(2)
  })

  it('lets player spellcasters choose and commit an area spell against clustered enemies', () => {
    const caster = wizard()
    const map: BattleMap = {
      id: 'player-spell-map',
      name: '玩家法术模拟',
      width: 600,
      height: 400,
      gridSize: 50,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      feetPerCell: 5,
      tokens: [
        {
          id: 'wizard-token', label: caster.name, x: 75, y: 175, color: '#fff',
          emoji: '', size: 1, type: 'player', characterId: caster.id,
        },
        {
          id: 'goblin-a', label: '地精 A', x: 375, y: 150, color: '#f00',
          emoji: '', size: 1, type: 'enemy', poolId: 'srd-5.1:goblin', hp: 7, maxHp: 7,
        },
        {
          id: 'goblin-b', label: '地精 B', x: 400, y: 200, color: '#f00',
          emoji: '', size: 1, type: 'enemy', poolId: 'srd-5.1:goblin', hp: 7, maxHp: 7,
        },
      ],
    }
    const result = simulateDnd5eCombats({
      characters: [caster],
      monsters: [{ monsterId: 'srd-5.1:goblin', count: 2 }],
      trials: 1,
      seed: 9,
      battlefield: { map, geometry: createEmptyMapGeometry(map.id) },
      strategyTraining: { enabled: true, explorationRate: 0, terminalRewardWeight: 1 },
    })

    expect(result.decisionLog.some((entry) =>
      entry.actorName === caster.name && entry.actionName === '火球术')).toBe(true)
    expect(result.actionUsage).toContainEqual(expect.objectContaining({
      actorName: caster.name,
      actionName: '火球术',
      side: 'players',
      headlessTransactions: 2,
    }))
    expect(result.tacticalSummary.playerSpellUses).toBeGreaterThan(0)
    expect(result.tacticalSummary.areaActionUses).toBeGreaterThan(0)
    expect(result.tacticalSummary.averageEnemiesHitByAreaAction).toBeGreaterThan(1)
    expect(result.learnedStrategy.players[`player:${caster.id}`]?.sampleCount).toBeGreaterThan(0)
  })

  it('uses Thunderwave to push a failed save from a cliff and resolves the fall in Headless', () => {
    const caster = thunderwaveBard()
    const map: BattleMap = {
      id: 'thunderwave-cliff-map',
      name: '雷鸣波悬崖',
      width: 500,
      height: 300,
      gridSize: 50,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      feetPerCell: 5,
      tokens: [
        {
          id: 'bard-token', label: caster.name, x: 275, y: 125, elevationFeet: 40,
          color: '#fff', emoji: '', size: 1, type: 'player', characterId: caster.id,
        },
        {
          id: 'ogre-token', label: '悬崖食人魔', x: 175, y: 125, elevationFeet: 40,
          color: '#f00', emoji: '', size: 1, type: 'enemy',
          poolId: 'srd-5.1:ogre', hp: 59, maxHp: 59,
        },
      ],
    }
    const geometry = {
      ...createEmptyMapGeometry(map.id),
      obstacles: [{
        id: 'cliff-platform',
        kind: 'obstacle' as const,
        label: '四十尺平台',
        points: [
          { x: 100, y: 50 }, { x: 450, y: 50 },
          { x: 450, y: 250 }, { x: 100, y: 250 },
        ],
        baseHeightFeet: 0,
        heightFeet: 0,
        terrainElevationFeet: 40,
        terrainRegion: true,
        cover: 'none' as const,
        blocksMovement: false,
        blocksVision: false,
        blocksLineOfEffect: false,
        createdAt: 1,
      }],
    }
    const result = simulateDnd5eCombats({
      characters: [caster],
      monsters: [{ monsterId: 'srd-5.1:ogre', count: 1 }],
      trials: 1,
      seed: 2,
      maxRounds: 2,
      battlefield: { map, geometry },
      strategyTraining: { enabled: true, explorationRate: 0, terminalRewardWeight: 1 },
    })

    expect(result.coverage.automatedPlayerSpells).toBe(1)
    expect(result.coverage.totalPlayerSpells).toBe(1)
    expect(result.actionUsage.some((entry) =>
      entry.actorName === caster.name &&
      entry.actionName === '雷鸣波' &&
      entry.headlessTransactions > 0,
    )).toBe(true)
    const thunderwaveLog = result.decisionLog.find((entry) =>
      entry.actorName === caster.name &&
      entry.actionName === '雷鸣波')
    expect(thunderwaveLog?.executionSteps).toEqual(expect.arrayContaining([
      expect.objectContaining({ text: expect.stringContaining('被强制移动') }),
      expect.objectContaining({ text: expect.stringContaining('坠落 40 尺') }),
    ]))
  })

  it('applies high-ground advantage, low-ground disadvantage, and blocks ordinary cliff traversal', () => {
    const hero = fighter({
      equipment: defaultEquipmentForDnd5eCharacter({ charClass: '游侠' }),
    })
    const map: BattleMap = {
      id: 'cliff-map',
      name: '悬崖地图',
      width: 500,
      height: 300,
      gridSize: 50,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      feetPerCell: 5,
      tokens: [
        {
          id: 'hero-token', label: hero.name, x: 75, y: 125, elevationFeet: 0,
          color: '#fff', emoji: '', size: 1, type: 'player', characterId: hero.id,
        },
        {
          id: 'goblin-token', label: '高地地精', x: 425, y: 125, elevationFeet: 30,
          color: '#f00', emoji: '', size: 1, type: 'enemy',
          poolId: 'srd-5.1:goblin', hp: 30, maxHp: 30,
        },
      ],
    }
    const geometry = {
      ...createEmptyMapGeometry(map.id),
      obstacles: [{
        id: 'cliff-top',
        kind: 'obstacle' as const,
        label: '三十尺悬崖',
        points: [
          { x: 250, y: 0 },
          { x: 500, y: 0 },
          { x: 500, y: 300 },
          { x: 250, y: 300 },
        ],
        baseHeightFeet: 0,
        heightFeet: 0,
        terrainElevationFeet: 30,
        terrainRegion: true,
        cover: 'none' as const,
        blocksMovement: false,
        blocksVision: false,
        blocksLineOfEffect: false,
        createdAt: 1,
      }],
    }
    const result = simulateDnd5eCombats({
      characters: [hero],
      monsters: [{ monsterId: 'srd-5.1:goblin', count: 1 }],
      trials: 1,
      seed: 4,
      maxRounds: 3,
      battlefield: { map, geometry },
      strategyTraining: { enabled: true, explorationRate: 0, terminalRewardWeight: 1 },
    })

    const playerTurns = result.decisionLog.filter((entry) => entry.actorName === hero.name)
    expect(playerTurns.length).toBeGreaterThan(0)
    expect(playerTurns.every((entry) => entry.actorElevationAfterFeet === 0)).toBe(true)
    expect(playerTurns.some((entry) =>
      entry.executionSteps.some((step) => step.text.includes('低地劣势')))).toBe(true)
    expect(result.decisionLog.some((entry) =>
      entry.actorName === '地精' &&
      entry.executionSteps.some((step) => step.text.includes('高地优势')))).toBe(true)
  })

  it('learns a player-side healing combination from the whole-battle outcome', () => {
    const healer = cleric()
    const wounded = fighter({ id: 'wounded', name: '重伤战士', currentHp: 5 })
    const map: BattleMap = {
      id: 'healing-combo-map',
      name: '治疗配合',
      width: 500,
      height: 300,
      gridSize: 50,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      feetPerCell: 5,
      tokens: [
        {
          id: 'cleric-token', label: healer.name, x: 75, y: 100, color: '#fff',
          emoji: '', size: 1, type: 'player', characterId: healer.id,
        },
        {
          id: 'wounded-token', label: wounded.name, x: 125, y: 100, color: '#fff',
          emoji: '', size: 1, type: 'player', characterId: wounded.id, hp: 5, maxHp: 52,
        },
        {
          id: 'goblin-token', label: '地精', x: 375, y: 100, color: '#f00',
          emoji: '', size: 1, type: 'enemy', poolId: 'srd-5.1:goblin', hp: 20, maxHp: 20,
        },
      ],
    }
    const result = simulateDnd5eCombats({
      characters: [healer, wounded],
      monsters: [{ monsterId: 'srd-5.1:goblin', count: 1 }],
      trials: 1,
      seed: 13,
      maxRounds: 3,
      battlefield: { map, geometry: createEmptyMapGeometry(map.id) },
      strategyTraining: { enabled: true, explorationRate: 0, terminalRewardWeight: 1 },
    })

    expect(result.actionUsage).toContainEqual(expect.objectContaining({
      actorName: healer.name,
      actionName: '治愈真言',
      side: 'players',
      headlessTransactions: 1,
    }))
    expect(result.decisionLog.some((entry) =>
      entry.actorName === healer.name &&
      entry.targetName === wounded.name &&
      entry.actionName === '治愈真言')).toBe(true)
    expect(result.learnedStrategy.players[`player:${healer.id}`]?.sampleCount).toBeGreaterThan(0)
  })

  it('scores and resolves Aboleth Enslave as a control candidate', () => {
    const result = simulateDnd5eCombats({
      characters: [fighter()],
      monsters: [{ monsterId: 'srd-5.1:aboleth', count: 1 }],
      trials: 1,
      seed: 71,
      initialDistanceFeet: 30,
    })

    expect(result.coverage.automatedMonsterActions).toBe(4)
    expect(result.coverage.totalMonsterActions).toBe(4)
    expect(result.decisionLog.flatMap((entry) => entry.candidates)
      .some((candidate) =>
        candidate.actionId === 'enslave' &&
        (candidate.metrics.controlValue ?? 0) > 0)).toBe(true)
    expect(result.actionUsage.some((entry) =>
      entry.actionId === 'enslave' && entry.headlessTransactions > 0)).toBe(true)
  })

  it('lets an enslaved character take later turns for the Aboleth side', () => {
    const result = simulateDnd5eCombats({
      characters: [fighter(), fighter({ id: 'fighter-2', name: '第二名战士' })],
      monsters: [{ monsterId: 'srd-5.1:aboleth', count: 1 }],
      trials: 1,
      seed: 1,
      initialDistanceFeet: 30,
    })

    const controlledTurn = result.decisionLog.find((entry) =>
      entry.controlledByName === '底栖魔鱼')
    expect(controlledTurn).toMatchObject({
      providerId: 'dnd5e:deterministic-tactical-v3',
      controlledByName: '底栖魔鱼',
      outcome: { executed: true },
    })
    expect(['测试战士', '第二名战士']).toContain(controlledTurn?.actorName)
    expect(result.actionUsage.some((entry) =>
      entry.side === 'monsters' &&
      ['测试战士', '第二名战士'].includes(entry.actorName))).toBe(true)
  })

  it('reports a stronger party as more likely to beat a single goblin', () => {
    const result = simulateDnd5eCombats({
      characters: [fighter(), fighter({ id: 'fighter-2', name: '第二名战士' })],
      monsters: [{ monsterId: 'srd-5.1:goblin', count: 1 }],
      trials: 200,
      seed: 7,
    })
    expect(result.playerWinRate).toBeGreaterThan(0.9)
    expect(result.averagePlayerSurvivors).toBeGreaterThan(1)
    expect(result.participantSummaries.some((entry) => entry.name === '地精')).toBe(true)
  })

  it('includes safely automatable monster spells in decisions and coverage', () => {
    const result = simulateDnd5eCombats({
      characters: [fighter()],
      monsters: [{ monsterId: 'srd-5.1:mage', count: 1 }],
      trials: 50,
      seed: 51,
      initialDistanceFeet: 60,
    })

    expect(result.coverage.automatedMonsterSpells).toBeGreaterThan(0)
    expect(result.coverage.totalMonsterSpells).toBeGreaterThan(
      result.coverage.automatedMonsterSpells,
    )
    expect(result.participantSummaries.find((entry) => entry.side === 'monsters')?.averageDamage)
      .toBeGreaterThan(0)
    expect(result.actionUsage.some((entry) =>
      entry.actionId.startsWith('spell:') && entry.headlessTransactions > 0)).toBe(true)
  })

  it('rejects empty teams, unknown monsters and trial counts above the safe cap', () => {
    expect(validateDnd5eCombatSimulationRequest({
      characters: [],
      monsters: [{ monsterId: 'not-a-monster', count: 1 }],
      trials: DND5E_COMBAT_SIMULATION_MAX_TRIALS + 1,
    })).toEqual(expect.arrayContaining([
      '至少选择一名玩家角色。',
      '找不到怪物：not-a-monster',
      '模拟次数必须是 1 至 100000 的整数。',
    ]))
    expect(validateDnd5eCombatSimulationRequest({
      characters: [fighter()],
      monsters: [{ monsterId: 'srd-5.1:goblin', count: 1 }],
      trials: 100_000,
    })).toEqual([])
    expect(validateDnd5eCombatSimulationRequest({
      characters: [fighter()],
      monsters: [{ monsterId: 'srd-5.1:goblin', count: 1 }],
      strategyTraining: {
        enabled: true,
        evaluationFraction: 0.75,
      },
    })).toContain('策略留出评估比例必须在 0.1 到 0.5 之间。')
    expect(validateDnd5eCombatSimulationRequest({
      characters: [fighter()],
      monsters: [{ monsterId: 'srd-5.1:goblin', count: 1 }],
      trials: 1,
      battlefield: {
        map: {
          id: 'missing-monster-map',
          name: '缺少怪物',
          width: 500,
          height: 500,
          gridSize: 50,
          gridOffsetX: 0,
          gridOffsetY: 0,
          showGrid: true,
          tokens: [{
            id: 'hero-token',
            label: '测试战士',
            x: 50,
            y: 50,
            color: '#fff',
            emoji: '',
            size: 1,
            type: 'player',
            characterId: 'fighter',
          }],
        },
      },
    })).toContain('地图上缺少怪物 Token：srd-5.1:goblin（需要 1，现有 0）')
  })

  it('loads a workshop monster into the shared simulation catalog', () => {
    const goblin = getDnd5eSrdMonster('srd-5.1:goblin')
    expect(goblin).toBeDefined()
    const workshopMonster = {
      ...goblin!,
      id: 'dm-custom:worker-goblin',
      slug: 'worker-goblin',
      name: '工坊测试地精',
      englishName: 'Workshop Goblin',
      source: 'DM 自定义',
    } as const

    const request = {
      characters: [fighter()],
      monsters: [{ monsterId: workshopMonster.id, count: 1 }],
      customMonsters: [workshopMonster],
      trials: 20,
      seed: 99,
    }
    expect(validateDnd5eCombatSimulationRequest(request)).toEqual([])
    const result = simulateDnd5eCombats(request)
    expect(result.participantSummaries.some((entry) => entry.name === workshopMonster.name)).toBe(true)
    expect(result.actionUsage.some((entry) => entry.actorName === workshopMonster.name)).toBe(true)
  })

  it('runs automatic-damage monster spells through committed Headless transactions', () => {
    const mage = getDnd5eSrdMonster('srd-5.1:mage')
    expect(mage).toBeDefined()
    const missileMage = {
      ...mage!,
      id: 'dm-custom:missile-mage',
      slug: 'missile-mage',
      name: '飞弹法师',
      englishName: 'Missile Mage',
      source: 'DM 自定义',
      actions: [],
      spellcasting: {
        ...mage!.spellcasting!,
        slots: { 1: 1 },
        spells: mage!.spellcasting!.spells!.filter((spell) => spell.id === 'magic-missile'),
      },
    } as const
    const result = simulateDnd5eCombats({
      characters: [fighter()],
      monsters: [{ monsterId: missileMage.id, count: 1 }],
      customMonsters: [missileMage],
      trials: 20,
      seed: 314,
      initialDistanceFeet: 60,
    })
    expect(result.actionUsage).toContainEqual(expect.objectContaining({
      actorName: missileMage.name,
      actionId: 'spell:magic-missile:1',
      headlessTransactions: expect.any(Number),
    }))
    expect(result.actionUsage.find((entry) => entry.actionId === 'spell:magic-missile:1')
      ?.headlessTransactions).toBeGreaterThan(0)
  })

  it('runs monster Thunderwave through Headless with authoritative forced movement', () => {
    const djinni = getDnd5eSrdMonster('srd-5.1:djinni')!
    const thunderwaveDjinni: Dnd5eMonsterStatBlock = {
      ...djinni,
      id: 'dm-custom:thunderwave-djinni',
      slug: 'thunderwave-djinni',
      name: 'Thunderwave Djinni',
      englishName: 'Thunderwave Djinni',
      source: 'DM 自定义',
      abilities: { ...djinni.abilities, dex: 30 },
      speed: { walk: 0 },
      actions: [],
      spellcasting: {
        ...djinni.spellcasting!,
        spells: djinni.spellcasting!.spells!.filter((spell) => spell.id === 'thunderwave'),
      },
    }
    const first = fighter({ id: 'thunder-target-1', name: 'Thunder Target 1', currentHp: 80, maxHp: 80 })
    const second = fighter({ id: 'thunder-target-2', name: 'Thunder Target 2', currentHp: 80, maxHp: 80 })
    const map: BattleMap = {
      id: 'monster-thunderwave-map', name: 'Monster Thunderwave', width: 500, height: 300,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true,
      tokens: [
        { id: 'djinni-token', label: thunderwaveDjinni.name, x: 125, y: 125, color: '#f00', emoji: '', size: 1, type: 'enemy', poolId: thunderwaveDjinni.id, hp: 161, maxHp: 161 },
        { id: 'thunder-target-token-1', label: first.name, x: 175, y: 125, color: '#fff', emoji: '', size: 1, type: 'player', characterId: first.id },
        { id: 'thunder-target-token-2', label: second.name, x: 175, y: 175, color: '#fff', emoji: '', size: 1, type: 'player', characterId: second.id },
      ],
    }
    const result = simulateDnd5eCombats({
      characters: [first, second],
      monsters: [{ monsterId: thunderwaveDjinni.id, count: 1 }],
      customMonsters: [thunderwaveDjinni],
      trials: 6,
      seed: 1701,
      maxRounds: 2,
      battlefield: { map, geometry: createEmptyMapGeometry(map.id) },
    })

    const thunderwaveUsage = result.actionUsage.find((entry) => entry.actionId === 'spell:thunderwave:1')
    expect(thunderwaveUsage, JSON.stringify({ usage: result.actionUsage, log: result.decisionLog })).toBeDefined()
    expect(thunderwaveUsage!.headlessTransactions).toBeGreaterThan(0)
    expect(result.decisionLog.some((entry) =>
      entry.actorName === thunderwaveDjinni.name &&
      entry.executionSteps.some((step) => step.text.includes('被强制移动')),
    )).toBe(true)

    const abstractResult = simulateDnd5eCombats({
      characters: [first],
      monsters: [{ monsterId: thunderwaveDjinni.id, count: 1 }],
      customMonsters: [thunderwaveDjinni],
      trials: 2,
      seed: 1702,
      maxRounds: 1,
      initialDistanceFeet: 10,
    })
    expect(abstractResult.actionUsage.find((entry) => entry.actionId === 'spell:thunderwave:1')
      ?.headlessTransactions).toBeGreaterThan(0)
  })

  it('runs monster Sleep hit-point pools through Headless', () => {
    const mephit = getDnd5eSrdMonster('srd-5.1:dust-mephit')!
    const sleepMephit: Dnd5eMonsterStatBlock = {
      ...mephit,
      id: 'dm-custom:sleep-mephit',
      slug: 'sleep-mephit',
      name: 'Sleep Mephit',
      englishName: 'Sleep Mephit',
      source: 'DM 自定义',
      abilities: { ...mephit.abilities, dex: 30 },
      actions: [],
      spellcasting: {
        ...mephit.spellcasting!,
        spells: mephit.spellcasting!.spells!.filter((spell) => spell.id === 'sleep'),
      },
    }
    const target = fighter({ id: 'sleep-target', name: 'Sleep Target', currentHp: 4, maxHp: 52 })
    const map: BattleMap = {
      id: 'monster-sleep-map', name: 'Monster Sleep', width: 500, height: 300,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true,
      tokens: [
        { id: 'sleep-mephit-token', label: sleepMephit.name, x: 50, y: 100, color: '#f00', emoji: '', size: 1, type: 'enemy', poolId: sleepMephit.id, hp: 17, maxHp: 17 },
        { id: 'sleep-target-token', label: target.name, x: 300, y: 100, color: '#fff', emoji: '', size: 1, type: 'player', characterId: target.id },
      ],
    }
    const result = simulateDnd5eCombats({
      characters: [target],
      monsters: [{ monsterId: sleepMephit.id, count: 1 }],
      customMonsters: [sleepMephit],
      trials: 4,
      seed: 9001,
      maxRounds: 2,
      battlefield: { map, geometry: createEmptyMapGeometry(map.id) },
    })

    expect(result.actionUsage.find((entry) => entry.actionId === 'spell:sleep:1')
      ?.headlessTransactions).toBeGreaterThan(0)
    expect(result.decisionLog.some((entry) =>
      entry.actorName === sleepMephit.name &&
      entry.executionSteps.some((step) => step.text.includes('睡眠')),
    )).toBe(true)
  })

  it('preserves monster Lesser Restoration condition choices through Headless', () => {
    const couatl = getDnd5eSrdMonster('srd-5.1:couatl')!
    const restorationCouatl: Dnd5eMonsterStatBlock = {
      ...couatl,
      id: 'dm-custom:restoration-couatl',
      slug: 'restoration-couatl',
      name: 'Restoration Couatl',
      englishName: 'Restoration Couatl',
      source: 'DM 自定义',
      abilities: { ...couatl.abilities, dex: 30 },
      speed: { walk: 0 },
      actions: [],
      spellcasting: {
        ...couatl.spellcasting!,
        spells: couatl.spellcasting!.spells!.filter((spell) => spell.id === 'lesser-restoration'),
      },
    }
    const paralysis = createDnd5eConditionEffect({
      id: 'simulation-paralysis',
      condition: 'paralyzed',
      targetId: 'restoration-ally-token',
      source: { kind: 'spell', actorId: 'fighter-token', rulesId: 'hold-person' },
    })
    const hero = fighter({ id: 'restoration-enemy', name: 'Restoration Enemy', initiativeBonus: -20 })
    const map: BattleMap = {
      id: 'monster-restoration-map', name: 'Monster Restoration', width: 600, height: 300,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true,
      tokens: [
        { id: 'restoration-couatl-token', label: restorationCouatl.name, x: 100, y: 100, color: '#f00', emoji: '', size: 1, type: 'enemy', poolId: restorationCouatl.id, hp: 97, maxHp: 97 },
        {
          id: 'restoration-ally-token', label: 'Paralyzed Goblin', x: 150, y: 100,
          color: '#f00', emoji: '', size: 1, type: 'enemy', poolId: 'srd-5.1:goblin', hp: 7, maxHp: 7,
          dnd5eCombatState: { schemaVersion: 2, conditions: ['paralyzed'], activeEffects: [paralysis] },
        },
        { id: 'restoration-enemy-token', label: hero.name, x: 450, y: 100, color: '#fff', emoji: '', size: 1, type: 'player', characterId: hero.id },
      ],
    }
    const result = simulateDnd5eCombats({
      characters: [hero],
      monsters: [
        { monsterId: restorationCouatl.id, count: 1 },
        { monsterId: 'srd-5.1:goblin', count: 1 },
      ],
      customMonsters: [restorationCouatl],
      trials: 3,
      seed: 4411,
      maxRounds: 1,
      battlefield: { map, geometry: createEmptyMapGeometry(map.id) },
    })

    const restorationUsage = result.actionUsage.find((entry) => entry.actionId === 'spell:lesser-restoration:2')
    expect(restorationUsage, JSON.stringify({ usage: result.actionUsage, log: result.decisionLog })).toBeDefined()
    expect(restorationUsage!.headlessTransactions).toBeGreaterThan(0)
    expect(result.decisionLog.some((entry) =>
      entry.actorName === restorationCouatl.name &&
      entry.executionSteps.some((step) => step.kind === 'condition'),
    )).toBe(true)
  })

  it('includes Assassin on-hit poison in seeded Headless simulation and remains deterministic', () => {
    const assassin = getDnd5eSrdMonster('srd-5.1:assassin')!
    const assassinWithoutPoison: Dnd5eMonsterStatBlock = {
      ...assassin,
      id: 'dm-custom:assassin-without-poison',
      slug: 'assassin-without-poison',
      name: 'Assassin without poison',
      englishName: 'Assassin without poison',
      actions: assassin.actions.map((action) => action.kind === 'weapon-attack' && action.attack
        ? {
            ...action,
            attack: {
              ...action.attack,
              onHit: undefined,
              onHitEffects: [],
            },
          }
        : { ...action }),
    }
    const durableTarget = fighter({
      initiativeBonus: -100,
      speed: 0,
      ac: 1,
      maxHp: 1_000,
      currentHp: 1_000,
      equipment: {},
    })
    const run = (monster: Dnd5eMonsterStatBlock) => simulateDnd5eCombats({
      characters: [durableTarget],
      monsters: [{ monsterId: monster.id, count: 1 }],
      customMonsters: [monster],
      trials: 20,
      seed: 8675309,
      maxRounds: 1,
      initialDistanceFeet: 5,
    })
    const withPoison = run(assassin)
    const withoutPoison = run(assassinWithoutPoison)
    const monsterDamage = (result: ReturnType<typeof simulateDnd5eCombats>) =>
      result.participantSummaries.find((entry) => entry.side === 'monsters')?.averageDamage ?? 0

    expect(monsterDamage(withPoison)).toBeGreaterThan(monsterDamage(withoutPoison))
    expect(withPoison.actionUsage.find((entry) => entry.actionId === 'multiattack'))
      .toMatchObject({ headlessTransactions: expect.any(Number) })
    expect(withPoison.actionUsage.find((entry) => entry.actionId === 'multiattack')
      ?.headlessTransactions).toBeGreaterThan(0)
    expect(run(assassin)).toEqual(withPoison)
  })

  it('keeps complex zero-HP poison riders deterministic in seeded Headless simulation', () => {
    const giantWolfSpider = getDnd5eSrdMonster('srd-5.1:giant-wolf-spider')!
    const spiderWithoutPoison: Dnd5eMonsterStatBlock = {
      ...giantWolfSpider,
      id: 'dm-custom:giant-wolf-spider-without-poison',
      slug: 'giant-wolf-spider-without-poison',
      name: 'Giant Wolf Spider without poison',
      englishName: 'Giant Wolf Spider without poison',
      actions: giantWolfSpider.actions.map((action) =>
        action.kind === 'weapon-attack' && action.attack
          ? {
              ...action,
              attack: {
                ...action.attack,
                onHit: undefined,
                onHitEffects: [],
              },
            }
          : { ...action },
      ),
    }
    const durableTarget = fighter({
      initiativeBonus: -100,
      speed: 0,
      ac: 1,
      maxHp: 1_000,
      currentHp: 1_000,
      equipment: {},
    })
    const run = (monster: Dnd5eMonsterStatBlock) => simulateDnd5eCombats({
      characters: [durableTarget],
      monsters: [{ monsterId: monster.id, count: 1 }],
      customMonsters: [monster],
      trials: 20,
      seed: 60221407,
      maxRounds: 1,
      initialDistanceFeet: 5,
    })
    const withPoison = run(giantWolfSpider)
    const withoutPoison = run(spiderWithoutPoison)
    const monsterDamage = (result: ReturnType<typeof simulateDnd5eCombats>) =>
      result.participantSummaries.find((entry) => entry.side === 'monsters')?.averageDamage ?? 0

    expect(monsterDamage(withPoison)).toBeGreaterThan(monsterDamage(withoutPoison))
    expect(withPoison.actionUsage.find((entry) => entry.actionId === 'bite'))
      .toMatchObject({ headlessTransactions: expect.any(Number) })
    expect(withPoison.actionUsage.find((entry) => entry.actionId === 'bite')
      ?.headlessTransactions).toBeGreaterThan(0)
    expect(run(giantWolfSpider)).toEqual(withPoison)
  })

  it('keeps a mapped stable-at-zero monster incapacitated for victory but alive in survival stats', () => {
    const hero = fighter({ equipment: {} })
    const mappedResult = (stableAtZero: boolean) => {
      const map: BattleMap = {
        id: stableAtZero ? 'stable-zero-map' : 'dead-zero-map',
        name: 'Zero HP state simulation',
        width: 300,
        height: 300,
        gridSize: 50,
        gridOffsetX: 0,
        gridOffsetY: 0,
        showGrid: true,
        feetPerCell: 5,
        tokens: [
          {
            id: 'hero-token',
            label: hero.name,
            x: 50,
            y: 50,
            color: '#ffffff',
            emoji: '',
            size: 1,
            type: 'player',
            characterId: hero.id,
          },
          {
            id: 'goblin-token',
            label: 'Goblin',
            x: 100,
            y: 50,
            color: '#ff0000',
            emoji: '',
            size: 1,
            type: 'enemy',
            poolId: 'srd-5.1:goblin',
            hp: 0,
            maxHp: 7,
            dnd5eCombatState: stableAtZero ? { stableAtZero: true } : undefined,
          },
        ],
      }
      return simulateDnd5eCombats({
        characters: [hero],
        monsters: [{ monsterId: 'srd-5.1:goblin', count: 1 }],
        trials: 3,
        seed: 24681357,
        maxRounds: 1,
        battlefield: { map, geometry: createEmptyMapGeometry(map.id) },
      })
    }

    const stable = mappedResult(true)
    const dead = mappedResult(false)

    expect(stable.playerWins).toBe(3)
    expect(stable.averageMonsterSurvivors).toBe(1)
    expect(stable.participantSummaries.find((entry) => entry.side === 'monsters')
      ?.survivalRate).toBe(1)
    expect(stable.deathCauses).toEqual([])
    expect(dead.playerWins).toBe(3)
    expect(dead.averageMonsterSurvivors).toBe(0)
    expect(dead.participantSummaries.find((entry) => entry.side === 'monsters')
      ?.survivalRate).toBe(0)
    expect(mappedResult(true)).toEqual(stable)
  })

  it('counts poison-stabilized zero-HP targets as survivors without recording a death cause', () => {
    const giantCentipede = getDnd5eSrdMonster('srd-5.1:giant-centipede')!
    const fragileTarget = fighter({
      initiativeBonus: -100,
      speed: 0,
      ac: 1,
      maxHp: 11,
      currentHp: 11,
      equipment: {},
    })
    const run = () => simulateDnd5eCombats({
      characters: [fragileTarget],
      monsters: [{ monsterId: giantCentipede.id, count: 1 }],
      trials: 20,
      seed: 13572468,
      maxRounds: 1,
      initialDistanceFeet: 5,
    })

    const result = run()
    const player = result.participantSummaries.find((entry) => entry.side === 'players')

    expect(result.monsterWins).toBeGreaterThan(0)
    expect(result.averagePlayerSurvivors).toBe(1)
    expect(player?.survivalRate).toBe(1)
    expect(player?.averageRemainingHp).toBeLessThan(fragileTarget.maxHp)
    expect(result.roundSummaries.every((round) => round.averagePlayerDeaths === 0)).toBe(true)
    expect(result.deathCauses.some((cause) => cause.victimName === fragileTarget.name)).toBe(false)
    expect(run()).toEqual(result)
  })

  it('does not fall back from Headless when an Assassin Multiattack defeats its target early', () => {
    const assassin = getDnd5eSrdMonster('srd-5.1:assassin')!
    const fragileTarget = fighter({
      initiativeBonus: -100,
      speed: 0,
      ac: 1,
      maxHp: 100,
      currentHp: 1,
      equipment: {},
    })
    const request = {
      characters: [fragileTarget],
      monsters: [{ monsterId: assassin.id, count: 1 }],
      trials: 20,
      seed: 8675309,
      maxRounds: 1,
      initialDistanceFeet: 5,
    } as const
    const result = simulateDnd5eCombats(request)
    const usage = result.actionUsage.find((entry) => entry.actionId === 'multiattack')

    expect(usage?.uses).toBeGreaterThan(0)
    expect(usage?.headlessTransactions).toBe(usage?.uses)
    expect(result.headlessTransactionCount).toBeGreaterThanOrEqual(usage?.uses ?? 0)
    expect(simulateDnd5eCombats(request)).toEqual(result)
  })

  it('keeps ordinary, silvered, and magical player weapon sources distinct under one seed', () => {
    const target = inertDefenseMonster('dm-custom:lycan-defense', [{
      outcome: 'immune',
      damageTypes: ['bludgeoning', 'piercing', 'slashing'],
      delivery: 'weapon-attack',
      magical: false,
      weaponMaterialNot: 'silvered',
      reason: 'test-nonmagical-nonsilvered-immunity',
    }])
    const run = (character: Character) => simulateDnd5eCombats({
      characters: [character],
      monsters: [{ monsterId: target.id, count: 1 }],
      customMonsters: [target],
      trials: 5,
      seed: 24681357,
      maxRounds: 1,
      initialDistanceFeet: 5,
    })
    const ordinary = run(fighterWithWeaponSource({}))
    const silvered = run(fighterWithWeaponSource({ specialMaterial: 'silvered' }))
    const magicalCharacter = fighterWithWeaponSource({ magical: true })
    const magical = run(magicalCharacter)
    const playerDamage = (result: ReturnType<typeof simulateDnd5eCombats>) =>
      result.participantSummaries.find((entry) => entry.side === 'players')?.averageDamage ?? 0

    expect(playerDamage(ordinary)).toBe(0)
    expect(playerDamage(silvered)).toBeGreaterThan(0)
    expect(playerDamage(magical)).toBe(playerDamage(silvered))
    expect(run(magicalCharacter)).toEqual(magical)
  })

  it('applies spell-only defenses to both seeded Headless damage and player AI scoring', () => {
    const baseTarget = inertDefenseMonster('dm-custom:spell-source-base')
    const resistantTarget = inertDefenseMonster('dm-custom:spell-source-resistant', [{
      outcome: 'resistant',
      delivery: 'spell',
      magical: true,
      reason: 'test-spell-resistance',
    }])
    const immuneTarget = inertDefenseMonster('dm-custom:spell-source-immune', [{
      outcome: 'immune',
      delivery: 'spell',
      magical: true,
      reason: 'test-spell-immunity',
    }])
    const caster = wizard({
      initiativeBonus: 100,
      dnd5eClassChoices: {
        classes: {
          wizard: {
            selections: {
              'spell-cantrips': ['fire-bolt'],
              'spell-prepared': [],
            },
          },
        },
      },
      classResources: {},
    })
    const runAtRange = (target: Dnd5eMonsterStatBlock) => simulateDnd5eCombats({
      characters: [caster],
      monsters: [{ monsterId: target.id, count: 1 }],
      customMonsters: [target],
      trials: 20,
      seed: 13572468,
      maxRounds: 1,
      initialDistanceFeet: 60,
    })
    const base = runAtRange(baseTarget)
    const resistant = runAtRange(resistantTarget)
    const spellDamage = (result: ReturnType<typeof simulateDnd5eCombats>) =>
      result.actionUsage.find((entry) => entry.actionId.startsWith('spell:fire-bolt:'))
        ?.totalDamage ?? 0

    expect(spellDamage(base)).toBeGreaterThan(0)
    expect(spellDamage(resistant)).toBeGreaterThan(0)
    expect(spellDamage(resistant)).toBeLessThan(spellDamage(base))

    const immune = simulateDnd5eCombats({
      characters: [caster],
      monsters: [{ monsterId: immuneTarget.id, count: 1 }],
      customMonsters: [immuneTarget],
      trials: 1,
      seed: 13572468,
      maxRounds: 1,
      initialDistanceFeet: 5,
    })
    const playerDecision = immune.decisionLog.find((entry) => entry.actorName === caster.name)
    const spellCandidates = playerDecision?.candidates.filter((candidate) =>
      candidate.actionId?.startsWith('spell:')) ?? []
    const selectedCandidate = playerDecision?.candidates.find((candidate) => candidate.selected)
    expect(spellCandidates.length).toBeGreaterThan(0)
    expect(spellCandidates.every((candidate) => candidate.metrics.expectedDamage === 0)).toBe(true)
    expect(selectedCandidate?.actionId).not.toMatch(/^spell:/)
  })

  it('keeps a mapped Basilisk gaze encounter deterministic across Headless turn boundaries', () => {
    const basilisk = getDnd5eSrdMonster('srd-5.1:basilisk')
    if (!basilisk) throw new Error('Basilisk fixture is missing')
    const hero = fighter({
      id: 'basilisk-gaze-simulation-target',
      name: 'Basilisk gaze simulation target',
      initiativeBonus: -100,
      abilities: { str: 18, dex: 14, con: 3, int: 10, wis: 10, cha: 10 },
      savingThrows: [],
      maxHp: 500,
      currentHp: 500,
      speed: 0,
      equipment: {},
      dnd5eCombatState: {
        schemaVersion: 2,
        surprisedCombatId: 'simulation:0',
      },
    })
    const map: BattleMap = {
      id: 'basilisk-gaze-simulation-map',
      name: 'Basilisk gaze simulation map',
      width: 150,
      height: 50,
      gridSize: 50,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      feetPerCell: 5,
      tokens: [
        {
          id: 'basilisk-gaze-simulation-token',
          label: basilisk.name,
          x: 25,
          y: 25,
          color: '#f00',
          emoji: '',
          size: 1,
          type: 'enemy',
          poolId: basilisk.id,
          hp: basilisk.hitPoints.average,
          maxHp: basilisk.hitPoints.average,
        },
        {
          id: 'basilisk-gaze-simulation-target-token',
          label: hero.name,
          x: 75,
          y: 25,
          color: '#fff',
          emoji: '',
          size: 1,
          type: 'player',
          characterId: hero.id,
          hp: hero.currentHp,
          maxHp: hero.maxHp,
        },
      ],
    }
    const request = {
      characters: [hero],
      monsters: [{ monsterId: basilisk.id, count: 1 }],
      trials: 1,
      seed: 20260728,
      maxRounds: 1,
      battlefield: { map, geometry: createEmptyMapGeometry(map.id) },
      strategyTraining: { enabled: true, explorationRate: 0, terminalRewardWeight: 1 },
    } as const

    const first = simulateDnd5eCombats(request)
    const second = simulateDnd5eCombats(request)
    const basiliskTurn = first.decisionLog.find((entry) => entry.actorName === basilisk.name)

    expect(second).toEqual(first)
    expect(basiliskTurn).toBeDefined()
    expect(basiliskTurn?.executionSteps).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'roll',
        text: expect.stringMatching(/CON.*DC 12/),
      }),
    ]))
    expect(basiliskTurn?.executionSteps.some((step) =>
      step.kind === 'transaction' && step.text.includes('未提交'))).toBe(false)
  })

  it('honors a monster Magic Weapons trait against a conditional weapon immunity', () => {
    const wolf = getDnd5eSrdMonster('srd-5.1:wolf')!
    const form: Dnd5eMonsterStatBlock = {
      ...wolf,
      id: 'dm-custom:defense-wolf-form',
      slug: 'defense-wolf-form',
      name: '防御狼形态',
      englishName: 'Defense Wolf Form',
      hitPoints: { average: 100, dice: '100' },
      damageDefenseRules: [{
        outcome: 'immune',
        damageTypes: ['bludgeoning', 'piercing', 'slashing'],
        delivery: 'weapon-attack',
        magical: false,
      }],
    }
    const goblin = getDnd5eSrdMonster('srd-5.1:goblin')!
    const attacker = (magical: boolean): Dnd5eMonsterStatBlock => ({
      ...goblin,
      id: `dm-custom:${magical ? 'magic' : 'ordinary'}-weapon-goblin`,
      slug: `${magical ? 'magic' : 'ordinary'}-weapon-goblin`,
      name: magical ? '魔法武器地精' : '普通武器地精',
      englishName: magical ? 'Magic Weapon Goblin' : 'Ordinary Weapon Goblin',
      abilities: { ...goblin.abilities, dex: 30 },
      traits: magical
        ? [{
            name: '魔法武器',
            description: '该怪物的武器攻击视为魔法攻击。',
            automation: 'headless',
            rule: { kind: 'magic-weapons', weaponAttacksMagical: true },
          }]
        : [],
    })
    const target = fighter({
      id: 'wild-shape-target',
      name: '狼人防御目标',
      charClass: '德鲁伊',
      level: 20,
      initiativeBonus: -100,
      dnd5eClassLevels: { druid: 20 },
      dnd5eClassChoices: {
        classes: {
          druid: {
            selections: {
              'wild-shape-known-forms': [form.id],
            },
          },
        },
      },
      dnd5eCombatState: {
        wildShapeFormId: form.id,
        wildShapeCurrentHp: form.hitPoints.average,
        wildShapeRoundsRemaining: 600,
        wildShapeOriginalCurrentHp: 52,
        wildShapeOriginalMaxHp: 52,
        wildShapeOriginalArmorClass: 18,
        wildShapeOriginalSpeed: 30,
        wildShapeOriginalAbilities: { str: 18, dex: 14, con: 16, int: 10, wis: 10, cha: 10 },
        wildShapeOriginalSavingThrowBonuses: { str: 7, dex: 2, con: 6, int: 0, wis: 0, cha: 0 },
      },
    })
    const run = (source: Dnd5eMonsterStatBlock) => simulateDnd5eCombats({
      characters: [target],
      monsters: [{ monsterId: source.id, count: 1 }],
      customMonsters: [form, source],
      trials: 5,
      seed: 11223344,
      maxRounds: 1,
      initialDistanceFeet: 5,
    })
    const ordinary = run(attacker(false))
    const magical = run(attacker(true))
    const monsterDamage = (result: ReturnType<typeof simulateDnd5eCombats>) =>
      result.participantSummaries.find((entry) => entry.side === 'monsters')?.averageDamage ?? 0

    expect(monsterDamage(ordinary)).toBe(0)
    expect(monsterDamage(magical)).toBeGreaterThan(0)
  })
})
