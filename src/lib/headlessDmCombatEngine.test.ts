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

  it('activates double arrow through headless DM authority', () => {
    const combat = state({
      characters: [
        character({
          traits: [
            {
              id: 'double-arrow',
              name: '双箭',
              level: 1,
              uses: 2,
              maxUses: 2,
              description: '',
              featureKey: 'doubleArrow',
            },
          ],
        }),
      ],
    })

    const result = resolveHeadlessDmAction(combat, {
      type: 'activate-feature',
      actorTokenId: 'hero-token',
      characterId: 'hero',
      featureKey: 'doubleArrow',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.characters[0].currentAP).toBe(1)
    expect(result.state.characters[0].combatBuffs?.doubleArrowReady).toBe(true)
  })

  it('activates eagle eye and spends a feature use through headless DM authority', () => {
    const combat = state({
      characters: [
        character({
          traits: [
            {
              id: 'eagle-eye',
              name: '鹰眼',
              level: 2,
              uses: 1,
              maxUses: 1,
              description: '',
              featureKey: 'eagleEye',
            },
          ],
        }),
      ],
    })

    const result = resolveHeadlessDmAction(combat, {
      type: 'activate-feature',
      actorTokenId: 'hero-token',
      characterId: 'hero',
      featureKey: 'eagleEye',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const hero = result.state.characters[0]
    expect(hero.currentAP).toBe(1)
    expect(hero.combatBuffs?.eagleEyeTurns).toBe(3)
    expect(hero.traits.find((trait) => trait.featureKey === 'eagleEye')?.uses).toBe(0)
  })

  it('spends qi to reduce cooldown through headless DM authority', () => {
    const cooldownSkill = skill({ id: 'cooldown-skill', name: '冷却技能', remaining: 2, cooldown: 3 })
    const combat = state({
      characters: [character({ qi: 3, combatSkills: [skill(), cooldownSkill] })],
    })

    const result = resolveHeadlessDmAction(combat, {
      type: 'qi-reduce-cooldown',
      actorTokenId: 'hero-token',
      characterId: 'hero',
      skillId: 'cooldown-skill',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const hero = result.state.characters[0]
    expect(hero.qi).toBe(2)
    expect(hero.combatSkills.find((item) => item.id === 'cooldown-skill')?.remaining).toBe(1)
  })

  it('rejects qi cooldown reduction when qi is unavailable', () => {
    const cooldownSkill = skill({ id: 'cooldown-skill', name: '冷却技能', remaining: 2, cooldown: 3 })
    const combat = state({
      characters: [character({ qi: 0, combatSkills: [skill(), cooldownSkill] })],
    })

    const result = resolveHeadlessDmAction(combat, {
      type: 'qi-reduce-cooldown',
      actorTokenId: 'hero-token',
      characterId: 'hero',
      skillId: 'cooldown-skill',
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('insufficient-resource')
    expect(result.state.characters[0].qi).toBe(0)
    expect(result.state.characters[0].combatSkills.find((item) => item.id === 'cooldown-skill')?.remaining).toBe(2)
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
    expect(result.events.find((event) => event.type === 'attack-resolved')).toMatchObject({
      type: 'attack-resolved',
      actorTokenId: 'hero-token',
      targetTokenId: 'dragon',
      skillId: 'basic-shot',
      damageValues: [8],
    })
  })

  it('lets an enemy spend AP to dodge a player attack before damage is rolled', () => {
    const combat = state({
      characters: [character({ abilities: { str: 10, dex: 10, con: 25, int: 25, wis: 25, cha: 25 } })],
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
          hp: 2,
          maxHp: 12,
          x: 245,
          y: 175,
        }),
      ]),
      enemyApByToken: { goblin: { current: 2, max: 2 } },
    })

    const result = resolveHeadlessDmAction(combat, {
      type: 'attack-token',
      actorTokenId: 'hero-token',
      characterId: 'hero',
      targetTokenId: 'goblin',
      skillId: 'basic-shot',
      targetDodgeD20: 1,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.enemyApByToken.goblin.current).toBe(1)
    expect(result.state.map.tokens.find((item) => item.id === 'goblin')?.hp).toBe(2)
    expect(result.events.find((event) => event.type === 'target-dodge-resolved')).toMatchObject({
      targetTokenId: 'goblin',
      dodged: true,
    })
    expect(result.events.find((event) => event.type === 'attack-resolved')).toMatchObject({
      hit: false,
      targetDodged: true,
      total: 0,
    })
  })

  it('continues to damage when the enemy dodge attempt fails', () => {
    const combat = state({
      characters: [character({ abilities: { str: 10, dex: 10, con: 25, int: 25, wis: 25, cha: 25 } })],
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
          hp: 2,
          maxHp: 12,
          x: 245,
          y: 175,
        }),
      ]),
      enemyApByToken: { goblin: { current: 2, max: 2 } },
    })

    const result = resolveHeadlessDmAction(combat, {
      type: 'attack-token',
      actorTokenId: 'hero-token',
      characterId: 'hero',
      targetTokenId: 'goblin',
      skillId: 'basic-shot',
      targetDodgeD20: 20,
      diceValues: [8],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.enemyApByToken.goblin.current).toBe(1)
    expect(result.state.map.tokens.find((item) => item.id === 'goblin')?.hp).toBeLessThan(2)
    expect(result.events.find((event) => event.type === 'target-dodge-resolved')).toMatchObject({
      targetTokenId: 'goblin',
      dodged: false,
    })
    expect(result.events.find((event) => event.type === 'attack-resolved')).toMatchObject({
      hit: true,
      targetDodged: false,
      damageValues: [8],
    })
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

  it('lets a player spend AP to dodge an enemy attack before damage is rolled', () => {
    const combat = state({
      initiativeIndex: 1,
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
      initiativeOrder: [entry('hero-token', 20), entry('goblin', 10)],
      enemyApByToken: { goblin: { current: 2, max: 2 } },
    })

    const result = resolveHeadlessDmAction(combat, {
      type: 'enemy-attack-token',
      actorTokenId: 'goblin',
      targetTokenId: 'hero-token',
      targetWantsDodge: true,
      targetDodgeD20: 1,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const hero = result.state.characters[0]
    const heroToken = result.state.map.tokens.find((item) => item.id === 'hero-token')
    expect(result.state.enemyApByToken.goblin.current).toBe(1)
    expect(hero.currentAP).toBe(1)
    expect(hero.currentHp).toBe(30)
    expect(heroToken?.hp).toBe(30)
    expect(result.events.find((event) => event.type === 'enemy-attack-resolved')).toMatchObject({
      actorTokenId: 'goblin',
      targetTokenId: 'hero-token',
      targetDodged: true,
      dodgeD20: 1,
      total: 0,
    })
  })

  it('applies enemy attack damage after a failed player dodge', () => {
    const combat = state({
      initiativeIndex: 1,
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
      initiativeOrder: [entry('hero-token', 20), entry('goblin', 10)],
      enemyApByToken: { goblin: { current: 2, max: 2 } },
    })

    const result = resolveHeadlessDmAction(combat, {
      type: 'enemy-attack-token',
      actorTokenId: 'goblin',
      targetTokenId: 'hero-token',
      targetWantsDodge: true,
      targetDodgeD20: 20,
      diceValues: [6],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const hero = result.state.characters[0]
    const heroToken = result.state.map.tokens.find((item) => item.id === 'hero-token')
    expect(result.state.enemyApByToken.goblin.current).toBe(1)
    expect(hero.currentAP).toBe(1)
    expect(hero.currentHp).toBeLessThan(30)
    expect(heroToken?.hp).toBe(hero.currentHp)
    expect(result.events.find((event) => event.type === 'enemy-attack-resolved')).toMatchObject({
      actorTokenId: 'goblin',
      targetTokenId: 'hero-token',
      targetDodged: false,
      dodgeD20: 20,
      damageValues: [6],
    })
  })

  it('resolves player opportunity attacks out of turn through DM authority', () => {
    const combat = state({
      initiativeIndex: 1,
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
      initiativeOrder: [entry('goblin', 20), entry('hero-token', 10)],
      enemyApByToken: { goblin: { current: 2, max: 2 } },
    })

    const result = resolveHeadlessDmAction(combat, {
      type: 'opportunity-attack-token',
      actorTokenId: 'hero-token',
      targetTokenId: 'goblin',
      d20Value: 20,
      damageValues: [6],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const hero = result.state.characters[0]
    const goblin = result.state.map.tokens.find((item) => item.id === 'goblin')
    expect(hero.currentAP).toBe(1)
    expect(goblin?.hp).toBeLessThan(12)
    const resolved = result.events.find((event) => event.type === 'opportunity-resolved')
    expect(resolved).toMatchObject({
      attackerTokenId: 'hero-token',
      targetTokenId: 'goblin',
      d20Value: 20,
      hit: true,
      isCrit: true,
      damageValues: [6],
    })
  })

  it('resolves enemy opportunity attacks and spends enemy AP', () => {
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
      enemyApByToken: { goblin: { current: 2, max: 2 } },
    })

    const result = resolveHeadlessDmAction(combat, {
      type: 'opportunity-attack-token',
      actorTokenId: 'goblin',
      targetTokenId: 'hero-token',
      d20Value: 20,
      damageValues: [6],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.enemyApByToken.goblin.current).toBe(1)
    expect(result.state.characters[0].currentHp).toBeLessThan(30)
    expect(result.events.some((event) => event.type === 'opportunity-resolved' && event.hit)).toBe(true)
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
