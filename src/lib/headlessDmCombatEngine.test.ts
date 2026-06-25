import { describe, expect, it } from 'vitest'
import type { InitiativeEntry } from '../components/map/InitiativeTracker'
import type { BattleMap, Token } from '../store/maps'
import type { Character, CombatSkill } from '../types/character'
import {
  createFixedHeadlessDiceRoller,
  createSeededHeadlessDiceRoller,
  resolveHeadlessDmAction,
  resolveHeadlessGaleComboChoice,
  startHeadlessCombat,
  type HeadlessDmCombatState,
} from './headlessDmCombatEngine'

function skill(patch: Partial<CombatSkill> = {}): CombatSkill {
  return {
    id: 'basic-shot',
    name: '基础射击',
    emoji: '🏹',
    description: '',
    apCost: 1,
    cooldown: 0,
    cdReduction: 0,
    remaining: 0,
    usedThisTurn: false,
    damageCount: 1,
    damageSides: 8,
    damageBonus: 0,
    arrowShots: 1,
    tags: ['ranged'],
    skillTreeId: 'basicShot',
    ...patch,
  }
}

function character(patch: Partial<Character> = {}): Character {
  return {
    id: 'hero',
    name: '新冒险者',
    player: '玩家1',
    avatar: '🧝',
    accent: '',
    race: '',
    charClass: '弓手',
    level: 5,
    background: '',
    experience: 0,
    reputation: 0,
    abilities: { str: 25, dex: 30, con: 25, int: 25, wis: 25, cha: 25 },
    savingThrows: [],
    skills: [],
    maxHp: 30,
    currentHp: 30,
    tempHp: 0,
    hitDice: '1d8',
    ac: 14,
    speed: 30,
    initiativeBonus: 0,
    saveDC: 12,
    actionPoints: 2,
    currentAP: 2,
    passivePerception: 10,
    inspiration: 0,
    mana: 0,
    maxMana: 0,
    traits: [],
    combatSkills: [skill()],
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
    x: 35,
    y: 35,
    color: '#fff',
    emoji: '',
    size: 1,
    type: 'player',
    ...patch,
  }
}

function entry(tokenId: string, roll: number): InitiativeEntry {
  return { tokenId, label: tokenId, emoji: '', color: '#fff', roll }
}

function map(tokens: Token[]): BattleMap {
  return {
    id: 'map',
    name: 'Map',
    width: 700,
    height: 700,
    gridSize: 70,
    gridOffsetX: 0,
    gridOffsetY: 0,
    showGrid: true,
    feetPerCell: 5,
    tokens,
  }
}

function state(overrides: Partial<HeadlessDmCombatState> = {}): HeadlessDmCombatState {
  const hero = character()
  const battleMap = map([
    token({
      id: 'hero-token',
      label: '新冒险者',
      type: 'player',
      characterId: hero.id,
      hp: hero.currentHp,
      maxHp: hero.maxHp,
      x: 175,
      y: 175,
    }),
    token({
      id: 'dragon',
      label: '红龙雏龙',
      type: 'enemy',
      poolId: 'wyrmling-red',
      hp: 52,
      maxHp: 52,
      x: 455,
      y: 175,
    }),
  ])
  return {
    map: battleMap,
    characters: [hero],
    active: true,
    round: 1,
    initiativeIndex: 0,
    initiativeOrder: [entry('hero-token', 20), entry('dragon', 10)],
    enemyApByToken: { dragon: { current: 2, max: 2 } },
    ...overrides,
  }
}

describe('headless DM combat engine', () => {
  it('starts combat by resetting player and enemy AP at round scope', () => {
    const started = startHeadlessCombat(
      state({
        characters: [character({ currentAP: 0 })],
        enemyApByToken: { dragon: { current: 0, max: 2 } },
      }),
    )

    expect(started.characters[0].currentAP).toBe(2)
    expect(started.enemyApByToken.dragon).toEqual({ current: 2, max: 2 })
  })

  it('accepts player movement only through DM validation and spends AP', () => {
    const result = resolveHeadlessDmAction(state(), {
      type: 'move-token',
      actorTokenId: 'hero-token',
      characterId: 'hero',
      targetPosition: { x: 245, y: 175 },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.characters[0].currentAP).toBe(1)
    expect(result.state.map.tokens.find((item) => item.id === 'hero-token')).toMatchObject({ x: 245, y: 175 })
    expect(result.events.map((event) => event.type)).toContain('ap-spent')
    expect(result.events.map((event) => event.type)).toContain('token-moved')
  })

  it('emits opportunity trigger events when validated movement leaves enemy reach', () => {
    const combat = state({
      map: map([
        token({
          id: 'hero-token',
          label: 'Hero',
          type: 'player',
          characterId: 'hero',
          hp: 30,
          maxHp: 30,
          x: 175,
          y: 175,
        }),
        token({
          id: 'goblin',
          label: 'Goblin',
          type: 'enemy',
          poolId: 'goblin',
          hp: 12,
          maxHp: 12,
          x: 245,
          y: 175,
        }),
      ]),
      enemyApByToken: { goblin: { current: 1, max: 2 } },
    })

    const result = resolveHeadlessDmAction(combat, {
      type: 'move-token',
      actorTokenId: 'hero-token',
      characterId: 'hero',
      targetPosition: { x: 385, y: 175 },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual({
      type: 'opportunity-triggered',
      attackerTokenId: 'goblin',
      movingTokenId: 'hero-token',
    })
  })

  it('does not emit opportunity triggers for disengaged movers', () => {
    const combat = state({
      disengagedCharacterIds: ['hero'],
      map: map([
        token({
          id: 'hero-token',
          label: 'Hero',
          type: 'player',
          characterId: 'hero',
          hp: 30,
          maxHp: 30,
          x: 175,
          y: 175,
        }),
        token({
          id: 'goblin',
          label: 'Goblin',
          type: 'enemy',
          poolId: 'goblin',
          hp: 12,
          maxHp: 12,
          x: 245,
          y: 175,
        }),
      ]),
      enemyApByToken: { goblin: { current: 1, max: 2 } },
    })

    const result = resolveHeadlessDmAction(combat, {
      type: 'move-token',
      actorTokenId: 'hero-token',
      characterId: 'hero',
      targetPosition: { x: 385, y: 175 },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events.some((event) => event.type === 'opportunity-triggered')).toBe(false)
  })

  it('applies calm-mind movement effects when a validated move spends AP', () => {
    const result = resolveHeadlessDmAction(
      state({
        characters: [
          character({
            combatBuffs: { calmMind: true },
            traits: [
              {
                id: 'calm-mind',
                name: 'Calm Mind',
                level: 1,
                uses: 0,
                maxUses: 0,
                description: '',
                featureKey: 'calmMind',
              },
            ],
          }),
        ],
      }),
      {
        type: 'move-token',
        actorTokenId: 'hero-token',
        characterId: 'hero',
        targetPosition: { x: 245, y: 175 },
      },
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const hero = result.state.characters[0]
    expect(hero.currentAP).toBe(1)
    expect(hero.combatBuffs?.calmMind).toBeUndefined()
    expect(hero.combatBuffs?.outOfBreathTurns).toBe(2)
    expect(hero.combatBuffs?.movedFeetThisTurn).toBe(1)
    const moved = result.events.find((event) => event.type === 'token-moved')
    expect(moved?.triggersMoveEffects).toBe(true)
  })

  it('rejects movement outside the actor speed and leaves state unchanged', () => {
    const before = state()
    const result = resolveHeadlessDmAction(before, {
      type: 'move-token',
      actorTokenId: 'hero-token',
      characterId: 'hero',
      targetPosition: { x: 665, y: 665 },
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('out-of-range')
    expect(result.state.characters[0].currentAP).toBe(2)
    expect(result.state.map.tokens.find((item) => item.id === 'hero-token')).toMatchObject({ x: 175, y: 175 })
  })

  it('resolves a player skill attack with deterministic dice, attack-defense adjustment, AP spend, and HP sync', () => {
    const result = resolveHeadlessDmAction(
      state(),
      {
        type: 'attack-token',
        actorTokenId: 'hero-token',
        characterId: 'hero',
        targetTokenId: 'dragon',
        skillId: 'basic-shot',
        diceValues: [8],
      },
      createFixedHeadlessDiceRoller([]),
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const dragon = result.state.map.tokens.find((item) => item.id === 'dragon')
    expect(result.state.characters[0].currentAP).toBe(1)
    expect(dragon?.hp).toBeLessThan(52)
    expect(result.events.some((event) => event.type === 'dice-rolled' && event.total === 8)).toBe(true)
    expect(result.events.some((event) => event.type === 'damage-applied' && event.targetTokenId === 'dragon')).toBe(true)
  })

  it('rejects player attacks that are not on the current initiative actor', () => {
    const result = resolveHeadlessDmAction(
      state({ initiativeIndex: 1 }),
      {
        type: 'attack-token',
        actorTokenId: 'hero-token',
        characterId: 'hero',
        targetTokenId: 'dragon',
        skillId: 'basic-shot',
        diceValues: [8],
      },
      createFixedHeadlessDiceRoller([]),
    )

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('stale-turn')
  })

  it('resolves enemy attacks from stat block dice and applies damage to character plus token mirror', () => {
    const combat = state({
      initiativeIndex: 1,
      map: map([
        token({
          id: 'hero-token',
          label: '新冒险者',
          type: 'player',
          characterId: 'hero',
          hp: 30,
          maxHp: 30,
          x: 175,
          y: 175,
        }),
        token({
          id: 'goblin',
          label: 'Goblin',
          type: 'enemy',
          poolId: 'goblin',
          hp: 12,
          maxHp: 12,
          x: 245,
          y: 175,
        }),
      ]),
      initiativeOrder: [entry('hero-token', 20), entry('goblin', 10)],
      enemyApByToken: { goblin: { current: 2, max: 2 } },
    })

    const result = resolveHeadlessDmAction(
      combat,
      { type: 'enemy-attack-token', actorTokenId: 'goblin', targetTokenId: 'hero-token', diceValues: [6] },
      createFixedHeadlessDiceRoller([]),
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const hero = result.state.characters[0]
    const heroToken = result.state.map.tokens.find((item) => item.id === 'hero-token')
    expect(result.state.enemyApByToken.goblin.current).toBe(1)
    expect(hero.currentHp).toBeLessThan(30)
    expect(heroToken?.hp).toBe(hero.currentHp)
  })

  it('advances turns and resets all AP only when a new round starts', () => {
    const combat = state({
      characters: [character({ currentAP: 0 })],
      enemyApByToken: { dragon: { current: 0, max: 2 } },
    })

    const firstAdvance = resolveHeadlessDmAction(combat, {
      type: 'end-turn',
      actorTokenId: 'hero-token',
      characterId: 'hero',
    })
    expect(firstAdvance.ok).toBe(true)
    if (!firstAdvance.ok) return
    expect(firstAdvance.state.round).toBe(1)
    expect(firstAdvance.state.characters[0].currentAP).toBe(0)

    const secondAdvance = resolveHeadlessDmAction(firstAdvance.state, {
      type: 'end-turn',
      actorTokenId: 'dragon',
    })
    expect(secondAdvance.ok).toBe(true)
    if (!secondAdvance.ok) return
    expect(secondAdvance.state.round).toBe(2)
    expect(secondAdvance.state.characters[0].currentAP).toBe(2)
    expect(secondAdvance.state.enemyApByToken.dragon.current).toBe(2)
  })

  it('seeded dice roller is reproducible for batch simulations', () => {
    const a = createSeededHeadlessDiceRoller('same-seed').rollDice(4, 6)
    const b = createSeededHeadlessDiceRoller('same-seed').rollDice(4, 6)
    expect(a).toEqual(b)
  })

  it('arms Gale Combo in the headless framework without spending its use immediately', () => {
    const combat = state({
      characters: [
        character({
          traits: [
            {
              id: 'gale-combo',
              name: '疾风连击',
              level: 1,
              uses: 1,
              maxUses: 1,
              description: '',
              featureKey: 'galeCombo',
            },
          ],
        }),
      ],
    })

    const result = resolveHeadlessGaleComboChoice(combat, {
      characterId: 'hero',
      accepted: true,
      triggerLabel: '对目标造成击飞，且目标豁免失败',
    })

    expect(result.ok).toBe(true)
    const hero = result.state.characters[0]
    expect(hero.combatBuffs?.galeComboReady).toBe(true)
    expect(hero.traits[0].uses).toBe(1)
  })

  it('uses Gale Combo to waive the next attack AP, then spends one use and clears the marker', () => {
    const combat = state({
      characters: [
        character({
          currentAP: 0,
          combatBuffs: { galeComboReady: true },
          traits: [
            {
              id: 'gale-combo',
              name: '疾风连击',
              level: 1,
              uses: 1,
              maxUses: 1,
              description: '',
              featureKey: 'galeCombo',
            },
          ],
        }),
      ],
    })

    const result = resolveHeadlessDmAction(
      combat,
      {
        type: 'attack-token',
        actorTokenId: 'hero-token',
        characterId: 'hero',
        targetTokenId: 'dragon',
        skillId: 'basic-shot',
        diceValues: [5],
      },
      createFixedHeadlessDiceRoller([]),
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const hero = result.state.characters[0]
    expect(hero.currentAP).toBe(0)
    expect(hero.traits[0].uses).toBe(0)
    expect(hero.combatBuffs?.galeComboReady).toBeUndefined()
    expect(result.events.some((event) => event.type === 'ap-spent')).toBe(false)
    expect(result.events.some((event) => event.type === 'log' && event.text.includes('消耗疾风连击'))).toBe(true)
    const damageIndex = result.events.findIndex((event) => event.type === 'damage-applied')
    const galeComboIndex = result.events.findIndex(
      (event) => event.type === 'log' && event.text.includes('消耗疾风连击'),
    )
    expect(damageIndex).toBeGreaterThanOrEqual(0)
    expect(galeComboIndex).toBeGreaterThan(damageIndex)
  })
})
