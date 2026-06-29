import { describe, expect, it } from 'vitest'
import type { InitiativeEntry } from '../components/map/InitiativeTracker'
import type { BattleMap, Token } from '../store/maps'
import type { Character, CombatSkill } from '../types/character'
import {
  createFixedHeadlessDiceRoller,
  createSeededHeadlessDiceRoller,
  resolveHeadlessDmAction,
  resolveHeadlessGaleComboConsumption,
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
    const calmMind = {
      id: 'calm-mind',
      name: '静心',
      level: 1,
      uses: 0,
      maxUses: 0,
      description: '',
      featureKey: 'calmMind' as const,
    }
    const hero = character({
      currentAP: 0,
      combatBuffs: {
        eagleEyeTurns: 2,
        movedFeetThisTurn: 10,
        tookDamageThisTurn: true,
      },
      combatSkills: [
        skill({ usedThisTurn: true }),
        skill({ id: 'cooldown-skill', name: '冷却技能', cooldown: 3, cdReduction: 1, remaining: 0, usedThisTurn: true }),
      ],
      traits: [calmMind],
    })
    const bench = character({ id: 'bench', name: '未参战角色', currentAP: 0 })
    const started = startHeadlessCombat(
      state({
        characters: [hero, bench],
        enemyApByToken: { dragon: { current: 0, max: 2 } },
      }),
    )

    expect(started.characters[0].currentAP).toBe(2)
    expect(started.characters[0].combatSkills[0].usedThisTurn).toBe(false)
    expect(started.characters[0].combatSkills[1].remaining).toBe(2)
    expect(started.characters[0].combatSkills[1].usedThisTurn).toBe(false)
    expect(started.characters[0].combatBuffs?.calmMind).toBe(true)
    expect(started.characters[0].combatBuffs?.eagleEyeTurns).toBe(1)
    expect(started.characters[0].combatBuffs?.movedFeetThisTurn).toBeUndefined()
    expect(started.characters[0].combatBuffs?.tookDamageThisTurn).toBeUndefined()
    expect(started.characters[0].combatBuffs?.turnStartKey).toBe('turn-1-0-hero-token')
    expect(started.characters.find((item) => item.id === 'bench')?.currentAP).toBe(0)
    expect(started.enemyApByToken.dragon).toEqual({ current: 2, max: 2 })
  })

  it('can clear map combat statuses during headless combat start', () => {
    const hero = character({
      conditions: ['燃烧', '眩晕'],
      tempHp: 5,
      combatBuffs: { outOfBreathTurns: 2, calmSpiritStacks: 3 },
    })
    const started = startHeadlessCombat(
      state({
        characters: [hero],
        map: map([
          token({
            id: 'hero-token',
            label: '新冒险者',
            type: 'player',
            characterId: hero.id,
            hp: hero.currentHp,
            maxHp: hero.maxHp,
            x: 175,
            y: 175,
            burningTurns: 2,
            huntingMarkStacks: 3,
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
            stunTurns: 1,
            poisonTurns: 2,
          }),
        ]),
      }),
      undefined,
      { clearStatuses: true },
    )

    const nextHero = started.characters[0]
    const heroToken = started.map.tokens.find((item) => item.id === 'hero-token')
    const dragon = started.map.tokens.find((item) => item.id === 'dragon')
    expect(nextHero.conditions).toEqual([])
    expect(nextHero.tempHp).toBe(0)
    expect(nextHero.combatBuffs?.outOfBreathTurns).toBeUndefined()
    expect(nextHero.combatBuffs?.calmSpiritStacks).toBeUndefined()
    expect(heroToken?.burningTurns).toBe(0)
    expect(heroToken?.huntingMarkStacks).toBe(0)
    expect(dragon?.stunTurns).toBe(0)
    expect(dragon?.poisonTurns).toBe(0)
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

  it('validates disengage through DM authority and spends 2 AP', () => {
    const result = resolveHeadlessDmAction(state(), {
      type: 'disengage',
      actorTokenId: 'hero-token',
      characterId: 'hero',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.characters[0].currentAP).toBe(0)
    expect(result.state.disengagedCharacterIds).toContain('hero')
    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: 'ap-spent',
        tokenId: 'hero-token',
        characterId: 'hero',
        amount: 2,
        before: 2,
        after: 0,
      }),
    )
  })

  it('rejects disengage when AP is insufficient', () => {
    const result = resolveHeadlessDmAction(
      state({
        characters: [character({ currentAP: 1 })],
      }),
      {
        type: 'disengage',
        actorTokenId: 'hero-token',
        characterId: 'hero',
      },
    )

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('insufficient-ap')
  })

  it('uses a non-damage skill through DM authority and spends AP', () => {
    const utility = skill({
      id: 'utility-skill',
      name: '辅助技能',
      apCost: 1,
      cooldown: 2,
      damageCount: 0,
      damageSides: 0,
    })
    const result = resolveHeadlessDmAction(
      state({ characters: [character({ combatSkills: [skill(), utility] })] }),
      {
        type: 'use-skill',
        actorTokenId: 'hero-token',
        characterId: 'hero',
        skillId: 'utility-skill',
      },
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const hero = result.state.characters[0]
    const resolvedSkill = hero.combatSkills.find((item) => item.id === 'utility-skill')
    expect(hero.currentAP).toBe(1)
    expect(resolvedSkill?.remaining).toBe(2)
    expect(resolvedSkill?.usedThisTurn).toBe(true)
  })

  it('uses Gale Combo to waive AP for a non-damage skill', () => {
    const utility = skill({
      id: 'utility-skill',
      name: '辅助技能',
      apCost: 1,
      cooldown: 1,
      damageCount: 0,
      damageSides: 0,
    })
    const result = resolveHeadlessDmAction(
      state({
        characters: [
          character({
            currentAP: 0,
            combatBuffs: { galeComboReady: true },
            combatSkills: [skill(), utility],
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
      }),
      {
        type: 'use-skill',
        actorTokenId: 'hero-token',
        characterId: 'hero',
        skillId: 'utility-skill',
      },
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const hero = result.state.characters[0]
    expect(hero.currentAP).toBe(0)
    expect(hero.combatBuffs?.galeComboReady).toBeUndefined()
    expect(hero.traits.find((item) => item.featureKey === 'galeCombo')?.uses).toBe(0)
    expect(result.events.some((event) => event.type === 'ap-spent')).toBe(false)
  })

  it('validates enemy movement through DM authority and spends enemy AP', () => {
    const result = resolveHeadlessDmAction(
      state({ initiativeIndex: 1 }),
      {
        type: 'enemy-move-token',
        actorTokenId: 'dragon',
        targetPosition: { x: 385, y: 175 },
        apCost: 1,
      },
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.enemyApByToken.dragon).toEqual({ current: 1, max: 2 })
    expect(result.state.map.tokens.find((item) => item.id === 'dragon')).toMatchObject({ x: 385, y: 175 })
    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: 'ap-spent',
        tokenId: 'dragon',
        amount: 1,
        before: 2,
        after: 1,
      }),
    )
    expect(result.events.map((event) => event.type)).toContain('token-moved')
  })

  it('rejects enemy movement when enemy AP is insufficient', () => {
    const result = resolveHeadlessDmAction(
      state({
        initiativeIndex: 1,
        enemyApByToken: { dragon: { current: 0, max: 2 } },
      }),
      {
        type: 'enemy-move-token',
        actorTokenId: 'dragon',
        targetPosition: { x: 385, y: 175 },
        apCost: 1,
      },
    )

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('insufficient-ap')
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

  it('resolves stable mind as an interrupt outside the actor turn', () => {
    const combat = state({
      initiativeIndex: 1,
      characters: [
        character({
          currentAP: 2,
          traits: [
            {
              id: 'stable-mind',
              name: '残影脱身',
              level: 1,
              uses: 1,
              maxUses: 1,
              description: '',
              featureKey: 'stableMind',
            },
          ],
        }),
      ],
    })

    const result = resolveHeadlessDmAction(combat, {
      type: 'stable-mind',
      actorTokenId: 'hero-token',
      characterId: 'hero',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const hero = result.state.characters[0]
    expect(hero.currentAP).toBe(1)
    expect(hero.traits.find((trait) => trait.featureKey === 'stableMind')?.uses).toBe(0)
    expect(result.events).toContainEqual({
      type: 'ap-spent',
      tokenId: 'hero-token',
      characterId: 'hero',
      amount: 1,
      before: 2,
      after: 1,
    })
  })

  it('resolves arcane surge as an interrupt outside the actor turn', () => {
    const combat = state({
      initiativeIndex: 1,
      characters: [
        character({
          currentHp: 6,
          traits: [
            {
              id: 'arcane-surge',
              name: '魔法浪涌',
              level: 1,
              uses: 1,
              maxUses: 1,
              description: '',
              featureKey: 'arcaneSurge',
            },
          ],
        }),
      ],
    })

    const result = resolveHeadlessDmAction(combat, {
      type: 'arcane-surge',
      actorTokenId: 'hero-token',
      characterId: 'hero',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const hero = result.state.characters[0]
    const heroToken = result.state.map.tokens.find((item) => item.id === 'hero-token')
    expect(hero.currentHp).toBe(1)
    expect(heroToken?.hp).toBe(1)
    expect(hero.traits.find((trait) => trait.featureKey === 'arcaneSurge')?.uses).toBe(0)
  })

  it('rejects stable mind when AP is unavailable', () => {
    const combat = state({
      initiativeIndex: 1,
      characters: [
        character({
          currentAP: 0,
          traits: [
            {
              id: 'stable-mind',
              name: '残影脱身',
              level: 1,
              uses: 1,
              maxUses: 1,
              description: '',
              featureKey: 'stableMind',
            },
          ],
        }),
      ],
    })

    const result = resolveHeadlessDmAction(combat, {
      type: 'stable-mind',
      actorTokenId: 'hero-token',
      characterId: 'hero',
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('insufficient-ap')
  })

  it('activates still water through headless DM authority for allies within 15 feet', () => {
    const stillWater = {
      id: 'still-water',
      name: '心如止水',
      level: 2,
      uses: 0,
      maxUses: 0,
      description: '',
      featureKey: 'stillWater' as const,
    }
    const calmMind = {
      id: 'calm-mind',
      name: '静心',
      level: 1,
      uses: 0,
      maxUses: 0,
      description: '',
      featureKey: 'calmMind' as const,
    }
    const combat = state({
      characters: [
        character({
          traits: [stillWater, calmMind],
          combatBuffs: { calmMind: true },
          currentAP: 2,
        }),
        character({
          id: 'ally-near',
          name: '近处友方',
          tempHp: 5,
          traits: [calmMind],
          combatBuffs: { outOfBreathTurns: 1 },
        }),
        character({
          id: 'ally-far',
          name: '远处友方',
          traits: [calmMind],
          combatBuffs: { outOfBreathTurns: 1 },
        }),
      ],
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
          id: 'ally-near-token',
          label: 'Near Ally',
          type: 'player',
          characterId: 'ally-near',
          hp: 30,
          maxHp: 30,
          x: 385,
          y: 175,
        }),
        token({
          id: 'ally-far-token',
          label: 'Far Ally',
          type: 'player',
          characterId: 'ally-far',
          hp: 30,
          maxHp: 30,
          x: 455,
          y: 175,
        }),
      ]),
    })

    const result = resolveHeadlessDmAction(combat, {
      type: 'activate-feature',
      actorTokenId: 'hero-token',
      characterId: 'hero',
      featureKey: 'stillWater',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const hero = result.state.characters.find((item) => item.id === 'hero')!
    const near = result.state.characters.find((item) => item.id === 'ally-near')!
    const far = result.state.characters.find((item) => item.id === 'ally-far')!
    expect(hero.currentAP).toBe(1)
    expect(hero.tempHp).toBe(20)
    expect(near.tempHp).toBe(20)
    expect(near.combatBuffs?.outOfBreathTurns).toBeUndefined()
    expect(near.combatBuffs?.stillWaterBreathImmunityTurns).toBe(2)
    expect(far.tempHp).toBe(0)
    expect(far.combatBuffs?.outOfBreathTurns).toBe(1)
    expect(result.events).toContainEqual({
      type: 'log',
      text: '新冒险者 激活心如止水：15尺内 2 名友方获得 20 临时生命，2回合免气喘。',
    })
  })

  it('activates finale through headless DM authority with two AP and one feature use', () => {
    const combat = state({
      characters: [
        character({
          currentAP: 2,
          traits: [
            {
              id: 'finale',
              name: '曲终',
              level: 1,
              uses: 1,
              maxUses: 1,
              description: '',
              featureKey: 'finale',
            },
          ],
        }),
      ],
    })

    const result = resolveHeadlessDmAction(combat, {
      type: 'activate-feature',
      actorTokenId: 'hero-token',
      characterId: 'hero',
      featureKey: 'finale',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const hero = result.state.characters[0]
    expect(hero.currentAP).toBe(0)
    expect(hero.combatBuffs?.finaleReady).toBe(true)
    expect(hero.traits.find((trait) => trait.featureKey === 'finale')?.uses).toBe(0)
    expect(result.events).toContainEqual({
      type: 'log',
      text: '新冒险者 激活曲终：等待下一名敌对生物狩猎印记叠至 4 层。',
    })
  })

  it('cancels finale readiness through headless DM authority without spending AP', () => {
    const combat = state({
      characters: [
        character({
          currentAP: 1,
          combatBuffs: { finaleReady: true },
          traits: [
            {
              id: 'finale',
              name: '曲终',
              level: 1,
              uses: 0,
              maxUses: 1,
              description: '',
              featureKey: 'finale',
            },
          ],
        }),
      ],
    })

    const result = resolveHeadlessDmAction(combat, {
      type: 'activate-feature',
      actorTokenId: 'hero-token',
      characterId: 'hero',
      featureKey: 'finale',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const hero = result.state.characters[0]
    expect(hero.currentAP).toBe(1)
    expect(hero.combatBuffs?.finaleReady).toBeUndefined()
    expect(result.events).toContainEqual({
      type: 'log',
      text: '新冒险者 取消曲终待触发。',
    })
  })

  it('resolves illusion dance saves, resource spend, pull, and no-move through headless DM authority', () => {
    const combat = state({
      characters: [
        character({
          currentAP: 2,
          qi: 2,
          traits: [
            {
              id: 'illusion-dance',
              name: '迷幻舞步',
              level: 2,
              uses: 1,
              maxUses: 1,
              description: '',
              featureKey: 'illusionDance',
            },
          ],
        }),
      ],
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
          id: 'dragon',
          label: '红龙雏龙',
          type: 'enemy',
          poolId: 'wyrmling-red',
          hp: 52,
          maxHp: 52,
          x: 455,
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
      initiativeOrder: [entry('hero-token', 20), entry('dragon', 15), entry('goblin', 10)],
      enemyApByToken: { dragon: { current: 2, max: 2 }, goblin: { current: 2, max: 2 } },
    })

    const result = resolveHeadlessDmAction(combat, {
      type: 'activate-feature',
      actorTokenId: 'hero-token',
      characterId: 'hero',
      featureKey: 'illusionDance',
      targetTokenIds: ['dragon', 'goblin'],
      targetPackets: [
        { targetTokenId: 'dragon', saveD20: 1 },
        { targetTokenId: 'goblin', saveD20: 20 },
      ],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const hero = result.state.characters[0]
    const dragon = result.state.map.tokens.find((item) => item.id === 'dragon')!
    const goblin = result.state.map.tokens.find((item) => item.id === 'goblin')!
    expect(hero.currentAP).toBe(1)
    expect(hero.qi).toBe(1)
    expect(hero.traits.find((trait) => trait.featureKey === 'illusionDance')?.uses).toBe(0)
    expect(dragon.x).toBeLessThan(455)
    expect(dragon.noMoveTurns).toBe(1)
    expect(dragon.illusionDanceTurns).toBe(1)
    expect(goblin.x).toBe(245)
    expect(goblin.noMoveTurns ?? 0).toBe(0)
    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: 'status-save-resolved',
        targetTokenId: 'dragon',
        condition: '迷幻舞步',
        success: false,
      }),
    )
    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: 'status-save-resolved',
        targetTokenId: 'goblin',
        condition: '迷幻舞步',
        success: true,
      }),
    )
  })

  it('activates shadow veil by consuming hunting marks through headless DM authority', () => {
    const combat = state({
      characters: [
        character({
          currentAP: 2,
          traits: [
            {
              id: 'shadow-veil',
              name: '影遁之术',
              level: 1,
              uses: 1,
              maxUses: 1,
              description: '',
              featureKey: 'shadowVeil',
            },
          ],
        }),
      ],
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
          huntingMarkStacks: 3,
          x: 245,
          y: 175,
        }),
      ]),
      enemyApByToken: { goblin: { current: 2, max: 2 } },
    })

    const result = resolveHeadlessDmAction(combat, {
      type: 'activate-feature',
      actorTokenId: 'hero-token',
      characterId: 'hero',
      featureKey: 'shadowVeil',
      targetTokenId: 'goblin',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const hero = result.state.characters[0]
    const goblin = result.state.map.tokens.find((item) => item.id === 'goblin')!
    expect(hero.currentAP).toBe(1)
    expect(hero.combatBuffs?.shadowVeilTargetId).toBe('goblin')
    expect(hero.traits.find((trait) => trait.featureKey === 'shadowVeil')?.uses).toBe(0)
    expect(goblin.huntingMarkStacks).toBe(1)
    expect(result.events).toContainEqual({
      type: 'log',
      text: '新冒险者 激活影遁之术：Goblin 印记 -2，本回合攻击 +1D6。',
    })
  })

  it('activates tracking arrow by adding one hunting mark through headless DM authority', () => {
    const combat = state({
      characters: [
        character({
          currentAP: 2,
          traits: [
            {
              id: 'tracking-arrow',
              name: '追踪箭',
              level: 1,
              uses: 1,
              maxUses: 1,
              description: '',
              featureKey: 'trackingArrow',
            },
          ],
        }),
      ],
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
          huntingMarkStacks: 2,
          x: 245,
          y: 175,
        }),
      ]),
      enemyApByToken: { goblin: { current: 2, max: 2 } },
    })

    const result = resolveHeadlessDmAction(combat, {
      type: 'activate-feature',
      actorTokenId: 'hero-token',
      characterId: 'hero',
      featureKey: 'trackingArrow',
      targetTokenId: 'goblin',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const hero = result.state.characters[0]
    const goblin = result.state.map.tokens.find((item) => item.id === 'goblin')!
    expect(hero.currentAP).toBe(1)
    expect(hero.traits.find((trait) => trait.featureKey === 'trackingArrow')?.uses).toBe(0)
    expect(goblin.huntingMarkStacks).toBe(3)
    expect(result.events).toContainEqual({
      type: 'log',
      text: '新冒险者 激活追踪箭：Goblin 狩猎印记 +1（3/4）。',
    })
  })

  it('triggers finale through tracking arrow when hunting marks reach four', () => {
    const combat = state({
      characters: [
        character({
          currentAP: 2,
          combatBuffs: { finaleReady: true },
          traits: [
            {
              id: 'tracking-arrow',
              name: '追踪箭',
              level: 1,
              uses: 1,
              maxUses: 1,
              description: '',
              featureKey: 'trackingArrow',
            },
            {
              id: 'finale',
              name: '曲终',
              level: 2,
              uses: 0,
              maxUses: 1,
              description: '',
              featureKey: 'finale',
            },
          ],
        }),
      ],
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
          hp: 50,
          maxHp: 50,
          huntingMarkStacks: 3,
          x: 245,
          y: 175,
        }),
      ]),
      enemyApByToken: { goblin: { current: 2, max: 2 } },
    })

    const result = resolveHeadlessDmAction(combat, {
      type: 'activate-feature',
      actorTokenId: 'hero-token',
      characterId: 'hero',
      featureKey: 'trackingArrow',
      targetTokenId: 'goblin',
      finaleDamageValues: [10, 10, 10, 10, 10, 10, 8],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const hero = result.state.characters[0]
    const goblin = result.state.map.tokens.find((item) => item.id === 'goblin')!
    expect(hero.currentAP).toBe(1)
    expect(hero.combatBuffs?.finaleReady).toBeUndefined()
    expect(goblin.huntingMarkStacks).toBe(0)
    expect(goblin.stunTurns).toBe(1)
    expect(goblin.hp).toBe(0)
    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: 'dice-rolled',
        notation: '6d10+1d8',
        values: [10, 10, 10, 10, 10, 10, 8],
        total: 68,
      }),
    )
  })

  it('activates flexible body through headless DM authority by spending AP and qi', () => {
    const combat = state({
      characters: [
        character({
          currentAP: 2,
          qi: 2,
          traits: [
            {
              id: 'flexible-body',
              name: '灵活身躯',
              level: 3,
              uses: 0,
              maxUses: 0,
              description: '',
              featureKey: 'flexibleBody',
            },
          ],
        }),
      ],
    })

    const result = resolveHeadlessDmAction(combat, {
      type: 'activate-feature',
      actorTokenId: 'hero-token',
      characterId: 'hero',
      featureKey: 'flexibleBody',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const hero = result.state.characters[0]
    expect(hero.currentAP).toBe(1)
    expect(hero.qi).toBe(1)
    expect(hero.combatBuffs?.flexibleBodyBonus).toBe(9)
    expect(result.events).toContainEqual({
      type: 'log',
      text: '新冒险者 激活灵活身躯：下次闪避/敏捷豁免 +9。',
    })
  })

  it('activates showtime through headless DM authority by spending AP, qi, and one use', () => {
    const combat = state({
      characters: [
        character({
          currentAP: 2,
          qi: 2,
          traits: [
            {
              id: 'showtime',
              name: '演出时间',
              level: 1,
              uses: 1,
              maxUses: 1,
              description: '',
              featureKey: 'showtime',
            },
          ],
        }),
      ],
    })

    const result = resolveHeadlessDmAction(combat, {
      type: 'activate-feature',
      actorTokenId: 'hero-token',
      characterId: 'hero',
      featureKey: 'showtime',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const hero = result.state.characters[0]
    expect(hero.currentAP).toBe(1)
    expect(hero.qi).toBe(1)
    expect(hero.combatBuffs?.showtimeTurns).toBe(2)
    expect(hero.traits.find((trait) => trait.featureKey === 'showtime')?.uses).toBe(0)
  })

  it('activates wind blade through headless DM authority by spending qi', () => {
    const combat = state({
      characters: [
        character({
          currentAP: 0,
          qi: 2,
          traits: [
            {
              id: 'wind-blade',
              name: '风刃乱舞',
              level: 1,
              uses: 0,
              maxUses: 0,
              description: '',
              featureKey: 'windBlade',
            },
          ],
        }),
      ],
    })

    const result = resolveHeadlessDmAction(combat, {
      type: 'activate-feature',
      actorTokenId: 'hero-token',
      characterId: 'hero',
      featureKey: 'windBlade',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const hero = result.state.characters[0]
    expect(hero.currentAP).toBe(0)
    expect(hero.qi).toBe(1)
    expect(hero.combatBuffs?.windBladeFreeDodgeTurns).toBe(1)
  })

  it('spends one calm spirit stack to arm free movement through headless DM authority', () => {
    const combat = state({
      characters: [
        character({
          combatBuffs: { calmSpiritStacks: 3 },
          traits: [
            {
              id: 'calm-spirit',
              name: '安定心神',
              level: 2,
              uses: 0,
              maxUses: 0,
              description: '',
              featureKey: 'calmSpirit',
            },
          ],
        }),
      ],
    })

    const result = resolveHeadlessDmAction(combat, {
      type: 'calm-spirit',
      actorTokenId: 'hero-token',
      characterId: 'hero',
      effect: 'move',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.characters[0].combatBuffs?.calmSpiritStacks).toBe(2)
    expect(result.state.characters[0].combatBuffs?.calmSpiritMoveFeet).toBe(15)
  })

  it('resolves calm spirit movement through headless DM authority', () => {
    const combat = state({
      characters: [character({ currentAP: 0, combatBuffs: { calmSpiritMoveFeet: 15 } })],
    })

    const result = resolveHeadlessDmAction(combat, {
      type: 'move-token',
      actorTokenId: 'hero-token',
      characterId: 'hero',
      targetPosition: { x: 385, y: 175 },
      mode: 'calm-spirit-move',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const hero = result.state.characters[0]
    expect(hero.currentAP).toBe(0)
    expect(hero.combatBuffs?.calmSpiritMoveFeet).toBeUndefined()
    expect(result.state.map.tokens.find((item) => item.id === 'hero-token')).toMatchObject({ x: 385, y: 175 })
    expect(result.events.map((event) => event.type)).not.toContain('ap-spent')
    expect(result.events.map((event) => event.type)).not.toContain('opportunity-triggered')
  })

  it('spends two calm spirit stacks to arm crit bonus through headless DM authority', () => {
    const combat = state({
      characters: [
        character({
          combatBuffs: { calmSpiritStacks: 4 },
          traits: [
            {
              id: 'calm-spirit',
              name: '安定心神',
              level: 3,
              uses: 0,
              maxUses: 0,
              description: '',
              featureKey: 'calmSpirit',
            },
          ],
        }),
      ],
    })

    const result = resolveHeadlessDmAction(combat, {
      type: 'calm-spirit',
      actorTokenId: 'hero-token',
      characterId: 'hero',
      effect: 'crit',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.characters[0].combatBuffs?.calmSpiritStacks).toBe(2)
    expect(result.state.characters[0].combatBuffs?.calmSpiritCritBonusPercent).toBe(40)
  })

  it('spends three calm spirit stacks to reduce a selected cooldown through headless DM authority', () => {
    const cooldownSkill = skill({ id: 'cooldown-skill', name: '冷却技能', cooldown: 3, remaining: 2 })
    const combat = state({
      characters: [
        character({
          combatBuffs: { calmSpiritStacks: 3 },
          combatSkills: [skill(), cooldownSkill],
          traits: [
            {
              id: 'calm-spirit',
              name: '安定心神',
              level: 1,
              uses: 0,
              maxUses: 0,
              description: '',
              featureKey: 'calmSpirit',
            },
          ],
        }),
      ],
    })

    const result = resolveHeadlessDmAction(combat, {
      type: 'calm-spirit',
      actorTokenId: 'hero-token',
      characterId: 'hero',
      effect: 'cooldown',
      skillId: 'cooldown-skill',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const hero = result.state.characters[0]
    expect(hero.combatBuffs?.calmSpiritStacks).toBeUndefined()
    expect(hero.combatSkills.find((item) => item.id === 'cooldown-skill')?.remaining).toBe(1)
  })

  it('spends four calm spirit stacks to refresh AP and skill use through headless DM authority', () => {
    const combat = state({
      characters: [
        character({
          currentAP: 0,
          actionPoints: 2,
          combatBuffs: { calmSpiritStacks: 4 },
          combatSkills: [skill({ usedThisTurn: true })],
          traits: [
            {
              id: 'calm-spirit',
              name: '安定心神',
              level: 1,
              uses: 0,
              maxUses: 0,
              description: '',
              featureKey: 'calmSpirit',
            },
          ],
        }),
      ],
    })

    const result = resolveHeadlessDmAction(combat, {
      type: 'calm-spirit',
      actorTokenId: 'hero-token',
      characterId: 'hero',
      effect: 'extraTurn',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const hero = result.state.characters[0]
    expect(hero.currentAP).toBe(2)
    expect(hero.combatBuffs?.calmSpiritStacks).toBeUndefined()
    expect(hero.combatSkills[0].usedThisTurn).toBe(false)
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

  it('resolves agile leap movement without AP cost through headless DM authority', () => {
    const combat = state({
      characters: [
        character({
          currentAP: 0,
          combatBuffs: { agileLeapMoveFeet: 10 },
          traits: [
            {
              id: 'agile-leap',
              name: '灵巧跳跃',
              level: 1,
              uses: 1,
              maxUses: 2,
              description: '',
              featureKey: 'agileLeap',
            },
          ],
        }),
      ],
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
      targetPosition: { x: 315, y: 175 },
      mode: 'agile-leap',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const hero = result.state.characters[0]
    expect(hero.currentAP).toBe(0)
    expect(hero.combatBuffs?.agileLeapMoveFeet).toBeUndefined()
    expect(hero.traits.find((trait) => trait.featureKey === 'agileLeap')?.uses).toBe(0)
    expect(result.state.map.tokens.find((item) => item.id === 'hero-token')).toMatchObject({ x: 315, y: 175 })
    expect(result.events.map((event) => event.type)).not.toContain('ap-spent')
    expect(result.events.map((event) => event.type)).not.toContain('opportunity-triggered')
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

  it('resolves multi-shot packets through headless DM with one AP spend and per-arrow damage', () => {
    const multiShot = skill({
      id: 'multi-shot',
      name: '多重射击',
      skillTreeId: 'multiShot',
      damageCount: 1,
      damageSides: 4,
      arrowShots: 2,
      cooldown: 2,
      remaining: 0,
    })
    const combat = state({
      characters: [character({ combatSkills: [skill(), multiShot] })],
      enemyApByToken: { dragon: { current: 0, max: 2 } },
    })

    const result = resolveHeadlessDmAction(combat, {
      type: 'attack-token',
      actorTokenId: 'hero-token',
      characterId: 'hero',
      targetTokenId: 'dragon',
      skillId: 'multi-shot',
      targetPackets: [
        { targetTokenId: 'dragon', diceValues: [4] },
        { targetTokenId: 'dragon', diceValues: [3] },
      ],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const hero = result.state.characters[0]
    const dragon = result.state.map.tokens.find((item) => item.id === 'dragon')
    const resolved = result.events.filter((event) => event.type === 'attack-resolved')
    expect(hero.currentAP).toBe(1)
    expect(hero.combatSkills.find((item) => item.id === 'multi-shot')?.remaining).toBe(2)
    expect(dragon?.hp).toBeLessThan(52)
    expect(resolved).toHaveLength(2)
    expect(resolved[0]).toMatchObject({ damageValues: [4], apCost: 1 })
    expect(resolved[1]).toMatchObject({ damageValues: [3], apCost: 0 })
  })

  it('resolves encircle packets with no-move and one stun save when all arrows target the same enemy', () => {
    const encircle = skill({
      id: 'encircle',
      name: '包围',
      skillTreeId: 'encircle',
      damageCount: 2,
      damageSides: 6,
      arrowShots: 5,
      cooldown: 4,
      remaining: 0,
    })
    const combat = state({
      characters: [character({ skillRanks: { encircle: 5 }, combatSkills: [skill(), encircle] })],
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
          hp: 80,
          maxHp: 80,
          x: 245,
          y: 175,
        }),
      ]),
      enemyApByToken: { goblin: { current: 0, max: 2 } },
    })

    const result = resolveHeadlessDmAction(combat, {
      type: 'attack-token',
      actorTokenId: 'hero-token',
      characterId: 'hero',
      targetTokenId: 'goblin',
      skillId: 'encircle',
      targetPackets: [
        {
          targetTokenId: 'goblin',
          diceValues: [6, 6],
          targetDodgeMode: 'skip',
          noMoveOnHit: true,
          noMoveTurns: 1,
          effectSave: { ability: 'con', d20: 1 },
          stunOnFailedEffectSave: true,
        },
        { targetTokenId: 'goblin', diceValues: [6, 6], targetDodgeMode: 'skip', noMoveOnHit: true, noMoveTurns: 1 },
        { targetTokenId: 'goblin', diceValues: [6, 6], targetDodgeMode: 'skip', noMoveOnHit: true, noMoveTurns: 1 },
        { targetTokenId: 'goblin', diceValues: [6, 6], targetDodgeMode: 'skip', noMoveOnHit: true, noMoveTurns: 1 },
        { targetTokenId: 'goblin', diceValues: [6, 6], targetDodgeMode: 'skip', noMoveOnHit: true, noMoveTurns: 1 },
      ],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const target = result.state.map.tokens.find((item) => item.id === 'goblin')
    const resolved = result.events.filter((event) => event.type === 'attack-resolved')
    expect(result.state.characters[0].currentAP).toBe(1)
    expect(result.state.characters[0].combatSkills.find((item) => item.id === 'encircle')?.remaining).toBe(4)
    expect(target?.hp).toBeLessThan(80)
    expect(target?.noMoveTurns).toBe(1)
    expect(target?.stunTurns).toBeGreaterThan(0)
    expect(resolved).toHaveLength(5)
    expect(result.events.find((event) => event.type === 'status-save-resolved')).toMatchObject({
      targetTokenId: 'goblin',
      condition: '眩晕',
      ability: 'con',
      success: false,
    })
  })

  it('resolves AOE target packets with shared damage dice and per-target dex saves', () => {
    const arrowStorm = skill({
      id: 'arrow-storm',
      name: '箭雨风暴',
      skillTreeId: 'arrowStorm',
      damageCount: 2,
      damageSides: 6,
      cooldown: 3,
      remaining: 0,
    })
    const combat = state({
      characters: [character({ saveDC: 12, combatSkills: [skill(), arrowStorm] })],
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
          id: 'goblin-a',
          label: 'Goblin A',
          type: 'enemy',
          poolId: 'goblin',
          hp: 20,
          maxHp: 20,
          x: 245,
          y: 175,
        }),
        token({
          id: 'goblin-b',
          label: 'Goblin B',
          type: 'enemy',
          poolId: 'goblin',
          hp: 20,
          maxHp: 20,
          x: 315,
          y: 175,
        }),
      ]),
      enemyApByToken: { 'goblin-a': { current: 0, max: 2 }, 'goblin-b': { current: 0, max: 2 } },
    })

    const result = resolveHeadlessDmAction(combat, {
      type: 'aoe-attack',
      actorTokenId: 'hero-token',
      characterId: 'hero',
      skillId: 'arrow-storm',
      diceValues: [6, 6],
      saveMode: 'half',
      targetPackets: [
        { targetTokenId: 'goblin-a', saveD20: 1 },
        { targetTokenId: 'goblin-b', saveD20: 20 },
      ],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const resolved = result.events.filter((event) => event.type === 'aoe-target-resolved')
    expect(result.state.characters[0].currentAP).toBe(1)
    expect(result.state.characters[0].combatSkills.find((item) => item.id === 'arrow-storm')?.remaining).toBe(3)
    expect(resolved).toHaveLength(2)
    expect(resolved[0]).toMatchObject({ targetTokenId: 'goblin-a', saveSuccess: false, apCost: 1 })
    expect(resolved[1]).toMatchObject({ targetTokenId: 'goblin-b', saveSuccess: true, apCost: 0 })
    expect(result.state.map.tokens.find((item) => item.id === 'goblin-a')?.hp).toBeLessThan(
      result.state.map.tokens.find((item) => item.id === 'goblin-b')?.hp ?? 0,
    )
  })

  it('applies knockback only to failed whirlwind kick saves', () => {
    const whirlwindKick = skill({
      id: 'whirlwind-kick',
      name: '旋风飞腿',
      skillTreeId: 'whirlwindKick',
      tags: ['melee'],
      damageCount: 3,
      damageSides: 4,
      cooldown: 2,
      remaining: 0,
    })
    const combat = state({
      characters: [character({ saveDC: 12, combatSkills: [skill(), whirlwindKick] })],
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
          id: 'goblin-a',
          label: 'Goblin A',
          type: 'enemy',
          poolId: 'goblin',
          hp: 20,
          maxHp: 20,
          x: 245,
          y: 175,
        }),
        token({
          id: 'goblin-b',
          label: 'Goblin B',
          type: 'enemy',
          poolId: 'goblin',
          hp: 20,
          maxHp: 20,
          x: 175,
          y: 245,
        }),
      ]),
      enemyApByToken: { 'goblin-a': { current: 0, max: 2 }, 'goblin-b': { current: 0, max: 2 } },
    })

    const result = resolveHeadlessDmAction(combat, {
      type: 'aoe-attack',
      actorTokenId: 'hero-token',
      characterId: 'hero',
      skillId: 'whirlwind-kick',
      diceValues: [4, 4, 4],
      saveMode: 'half',
      knockbackOnFailedSave: true,
      targetPackets: [
        { targetTokenId: 'goblin-a', saveD20: 1 },
        { targetTokenId: 'goblin-b', saveD20: 20 },
      ],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const failedTarget = result.state.map.tokens.find((item) => item.id === 'goblin-a')
    const savedTarget = result.state.map.tokens.find((item) => item.id === 'goblin-b')
    expect(failedTarget?.knockbackTurns).toBe(1)
    expect(savedTarget?.knockbackTurns ?? 0).toBe(0)
    expect(result.events).toContainEqual({
      type: 'status-added',
      targetTokenId: 'goblin-a',
      characterId: undefined,
      condition: '击飞',
      turns: 1,
    })
  })

  it('applies per-target AOE extra damage without changing other targets', () => {
    const whirlwindKick = skill({
      id: 'whirlwind-kick',
      name: 'Whirlwind Kick',
      skillTreeId: 'whirlwindKick',
      tags: ['melee'],
      damageCount: 3,
      damageSides: 4,
      cooldown: 2,
      remaining: 0,
    })
    const combat = state({
      characters: [
        character({
          abilities: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
          saveDC: 12,
          combatSkills: [skill(), whirlwindKick],
        }),
      ],
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
          id: 'knocked',
          label: 'Knocked',
          type: 'enemy',
          hp: 40,
          maxHp: 40,
          x: 245,
          y: 175,
        }),
        token({
          id: 'standing',
          label: 'Standing',
          type: 'enemy',
          hp: 40,
          maxHp: 40,
          x: 175,
          y: 245,
        }),
      ]),
      enemyApByToken: { knocked: { current: 0, max: 2 }, standing: { current: 0, max: 2 } },
    })

    const result = resolveHeadlessDmAction(combat, {
      type: 'aoe-attack',
      actorTokenId: 'hero-token',
      characterId: 'hero',
      skillId: 'whirlwind-kick',
      diceValues: [4, 4, 4],
      saveMode: 'half',
      targetPackets: [
        { targetTokenId: 'knocked', saveD20: 1, extraDamageGroups: [{ values: [6], sides: 6 }] },
        { targetTokenId: 'standing', saveD20: 1 },
      ],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const knocked = result.state.map.tokens.find((item) => item.id === 'knocked')
    const standing = result.state.map.tokens.find((item) => item.id === 'standing')
    expect(knocked?.hp).toBe(22)
    expect(standing?.hp).toBe(28)
    const resolved = result.events.filter((event) => event.type === 'aoe-target-resolved')
    expect(resolved[0]).toMatchObject({ targetTokenId: 'knocked', damageValues: [4, 4, 4, 6], total: 18 })
    expect(resolved[1]).toMatchObject({ targetTokenId: 'standing', damageValues: [4, 4, 4], total: 12 })
    expect(result.events).toContainEqual({ type: 'dice-rolled', notation: '1d6', values: [6], total: 6 })
  })

  it('applies focus shot stun only to failed constitution saves', () => {
    const focusShot = skill({
      id: 'focus-shot',
      name: '聚能射击',
      skillTreeId: 'focusShot',
      tags: ['ranged'],
      damageCount: 4,
      damageSides: 6,
      cooldown: 3,
      remaining: 0,
    })
    const combat = state({
      characters: [character({ saveDC: 12, combatSkills: [skill(), focusShot] })],
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
          id: 'goblin-a',
          label: 'Goblin A',
          type: 'enemy',
          poolId: 'goblin',
          hp: 20,
          maxHp: 20,
          x: 245,
          y: 175,
        }),
        token({
          id: 'goblin-b',
          label: 'Goblin B',
          type: 'enemy',
          poolId: 'goblin',
          hp: 20,
          maxHp: 20,
          x: 315,
          y: 175,
        }),
      ]),
      enemyApByToken: { 'goblin-a': { current: 0, max: 2 }, 'goblin-b': { current: 0, max: 2 } },
    })

    const result = resolveHeadlessDmAction(combat, {
      type: 'aoe-attack',
      actorTokenId: 'hero-token',
      characterId: 'hero',
      skillId: 'focus-shot',
      diceValues: [6, 6, 6, 6],
      saveMode: 'fail-half',
      stunOnFailedConSave: true,
      targetPackets: [
        { targetTokenId: 'goblin-a', saveD20: 20, stunSaveD20: 1 },
        { targetTokenId: 'goblin-b', saveD20: 20, stunSaveD20: 20 },
      ],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const failedTarget = result.state.map.tokens.find((item) => item.id === 'goblin-a')
    const savedTarget = result.state.map.tokens.find((item) => item.id === 'goblin-b')
    expect(failedTarget?.stunTurns).toBe(1)
    expect(savedTarget?.stunTurns ?? 0).toBe(0)
    expect(result.events).toContainEqual({
      type: 'status-added',
      targetTokenId: 'goblin-a',
      characterId: undefined,
      condition: '眩晕',
      turns: 1,
    })
    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: 'status-save-resolved',
        targetTokenId: 'goblin-a',
        condition: '眩晕',
        success: false,
      }),
    )
  })

  it('supports spiral blade no-damage dex saves in AOE packets', () => {
    const spiralBlade = skill({
      id: 'spiral-blade',
      name: '螺旋刀刃',
      skillTreeId: 'spiralBlade',
      tags: ['melee'],
      damageCount: 2,
      damageSides: 6,
      cooldown: 4,
      remaining: 0,
    })
    const combat = state({
      characters: [character({ saveDC: 12, combatSkills: [skill(), spiralBlade] })],
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
          id: 'goblin-a',
          label: 'Goblin A',
          type: 'enemy',
          poolId: 'goblin',
          hp: 20,
          maxHp: 20,
          x: 245,
          y: 175,
        }),
        token({
          id: 'goblin-b',
          label: 'Goblin B',
          type: 'enemy',
          poolId: 'goblin',
          hp: 20,
          maxHp: 20,
          x: 175,
          y: 245,
        }),
      ]),
      enemyApByToken: { 'goblin-a': { current: 0, max: 2 }, 'goblin-b': { current: 0, max: 2 } },
    })

    const result = resolveHeadlessDmAction(combat, {
      type: 'aoe-attack',
      actorTokenId: 'hero-token',
      characterId: 'hero',
      skillId: 'spiral-blade',
      diceValues: [6, 6],
      saveMode: 'none',
      targetPackets: [
        { targetTokenId: 'goblin-a', saveD20: 1 },
        { targetTokenId: 'goblin-b', saveD20: 20 },
      ],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const failedTarget = result.state.map.tokens.find((item) => item.id === 'goblin-a')
    const savedTarget = result.state.map.tokens.find((item) => item.id === 'goblin-b')
    expect(failedTarget?.hp).toBeLessThan(20)
    expect(savedTarget?.hp).toBe(20)
  })

  it('applies AOE self cooldown reduction after marking the skill used', () => {
    const windTraceShot = skill({
      id: 'wind-trace-shot',
      name: '风痕贯射',
      skillTreeId: 'windTraceShot',
      tags: ['ranged'],
      damageCount: 5,
      damageSides: 6,
      cooldown: 4,
      remaining: 0,
    })
    const combat = state({
      characters: [character({ combatSkills: [skill(), windTraceShot] })],
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
          hp: 30,
          maxHp: 30,
          x: 245,
          y: 175,
        }),
      ]),
      enemyApByToken: { goblin: { current: 0, max: 2 } },
    })

    const result = resolveHeadlessDmAction(combat, {
      type: 'aoe-attack',
      actorTokenId: 'hero-token',
      characterId: 'hero',
      skillId: 'wind-trace-shot',
      diceValues: [6, 6, 6, 6, 6, 6, 6],
      selfCooldownReduction: 1,
      targetPackets: [{ targetTokenId: 'goblin' }],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.characters[0].combatSkills.find((item) => item.id === 'wind-trace-shot')?.remaining).toBe(3)
  })

  it('applies rage shot restraint through headless effect saves', () => {
    const rageShot = skill({
      id: 'rage-shot',
      name: '怒气爆射',
      skillTreeId: 'rageShot',
      damageCount: 2,
      damageSides: 6,
      cooldown: 3,
      remaining: 0,
    })
    const combat = state({
      characters: [character({ saveDC: 20, combatSkills: [skill(), rageShot] })],
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
          hp: 20,
          maxHp: 20,
          x: 245,
          y: 175,
        }),
      ]),
      enemyApByToken: { goblin: { current: 0, max: 2 } },
    })

    const result = resolveHeadlessDmAction(combat, {
      type: 'attack-token',
      actorTokenId: 'hero-token',
      characterId: 'hero',
      targetTokenId: 'goblin',
      skillId: 'rage-shot',
      targetPackets: [
        {
          targetTokenId: 'goblin',
          diceValues: [6, 6],
          targetDodgeMode: 'skip',
          effectSave: { ability: 'str', d20: 1 },
          restrainedOnFailedEffectSave: true,
        },
      ],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.map.tokens.find((item) => item.id === 'goblin')?.restrainedTurns).toBe(1)
    expect(result.events).toContainEqual({
      type: 'status-added',
      targetTokenId: 'goblin',
      characterId: undefined,
      condition: '束缚',
      turns: 1,
    })
  })

  it('pulls bind shot targets and arms the next burst kick bonus', () => {
    const bindShot = skill({
      id: 'bind-shot',
      name: '捆绑射击',
      skillTreeId: 'bindShot',
      damageCount: 1,
      damageSides: 6,
      cooldown: 3,
      remaining: 0,
    })
    const combat = state({
      characters: [character({ saveDC: 20, combatSkills: [skill(), bindShot] })],
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
          hp: 20,
          maxHp: 20,
          x: 315,
          y: 175,
        }),
      ]),
      enemyApByToken: { goblin: { current: 0, max: 2 } },
    })

    const result = resolveHeadlessDmAction(combat, {
      type: 'attack-token',
      actorTokenId: 'hero-token',
      characterId: 'hero',
      targetTokenId: 'goblin',
      skillId: 'bind-shot',
      targetPackets: [
        {
          targetTokenId: 'goblin',
          diceValues: [6],
          targetDodgeMode: 'skip',
          effectSave: { ability: 'str', d20: 1 },
          pullOnFailedEffectSave: true,
          pullCells: 2,
          smallOrMediumOnly: true,
          grantBurstKickExtraD6OnHit: 1,
        },
      ],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.map.tokens.find((item) => item.id === 'goblin')?.x).toBeLessThan(315)
    expect(result.state.characters[0].combatBuffs?.burstKickExtraD6).toBe(1)
    expect(result.events.map((event) => event.type)).toContain('token-moved')
  })

  it('does not pull or restrain large bind shot targets but still arms burst kick bonus', () => {
    const bindShot = skill({
      id: 'bind-shot',
      name: '捆绑射击',
      skillTreeId: 'bindShot',
      damageCount: 1,
      damageSides: 6,
      cooldown: 3,
      remaining: 0,
    })
    const combat = state({
      characters: [character({ saveDC: 20, combatSkills: [skill(), bindShot] })],
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
          id: 'ogre',
          label: 'Ogre',
          type: 'enemy',
          poolId: 'ogre',
          hp: 40,
          maxHp: 40,
          x: 315,
          y: 175,
          creatureSize: '大型',
          size: 2,
        }),
      ]),
      enemyApByToken: { ogre: { current: 0, max: 2 } },
    })

    const result = resolveHeadlessDmAction(combat, {
      type: 'attack-token',
      actorTokenId: 'hero-token',
      characterId: 'hero',
      targetTokenId: 'ogre',
      skillId: 'bind-shot',
      targetPackets: [
        {
          targetTokenId: 'ogre',
          diceValues: [6],
          targetDodgeMode: 'skip',
          effectSave: { ability: 'str', d20: 1 },
          restrainedOnFailedEffectSave: true,
          pullOnFailedEffectSave: true,
          pullCells: 2,
          smallOrMediumOnly: true,
          grantBurstKickExtraD6OnHit: 1,
        },
      ],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const target = result.state.map.tokens.find((item) => item.id === 'ogre')
    expect(target?.x).toBe(315)
    expect(target?.restrainedTurns ?? 0).toBe(0)
    expect(result.state.characters[0].combatBuffs?.burstKickExtraD6).toBe(1)
    expect(result.events.map((event) => event.type)).not.toContain('token-moved')
  })

  it('consumes bind shot bonus dice on burst kick and stuns on failed con saves', () => {
    const burstKick = skill({
      id: 'burst-kick',
      name: '爆裂踢',
      skillTreeId: 'burstKick',
      tags: ['melee'],
      damageCount: 2,
      damageSides: 4,
      cooldown: 2,
      remaining: 0,
    })
    const combat = state({
      characters: [
        character({
          saveDC: 20,
          combatBuffs: { burstKickExtraD6: 1 },
          combatSkills: [skill(), burstKick],
        }),
      ],
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
          hp: 20,
          maxHp: 20,
          x: 245,
          y: 175,
        }),
      ]),
      enemyApByToken: { goblin: { current: 0, max: 2 } },
    })

    const result = resolveHeadlessDmAction(combat, {
      type: 'attack-token',
      actorTokenId: 'hero-token',
      characterId: 'hero',
      targetTokenId: 'goblin',
      skillId: 'burst-kick',
      targetPackets: [
        {
          targetTokenId: 'goblin',
          diceValues: [4, 4],
          extraDamageValues: [6],
          extraDamageSides: 6,
          targetDodgeMode: 'skip',
          effectSave: { ability: 'con', d20: 1 },
          stunOnFailedEffectSave: true,
          clearBurstKickExtraD6OnUse: true,
        },
      ],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const attack = result.events.find((event) => event.type === 'attack-resolved')
    expect(attack).toMatchObject({ damageValues: [4, 4, 6] })
    expect(result.state.map.tokens.find((item) => item.id === 'goblin')?.stunTurns).toBe(1)
    expect(result.state.characters[0].combatBuffs?.burstKickExtraD6).toBeUndefined()
  })

  it('reduces a selected skill cooldown after reflux magic arrow hits', () => {
    const refluxMagicArrow = skill({
      id: 'reflux-magic-arrow',
      name: '回流魔箭',
      skillTreeId: 'refluxMagicArrow',
      damageCount: 3,
      damageSides: 6,
      cooldown: 4,
      remaining: 0,
    })
    const coolingSkill = skill({ id: 'cooling-skill', name: '冷却中技能', cooldown: 3, remaining: 2 })
    const combat = state({
      characters: [character({ combatSkills: [skill(), refluxMagicArrow, coolingSkill] })],
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
          hp: 30,
          maxHp: 30,
          x: 245,
          y: 175,
        }),
      ]),
      enemyApByToken: { goblin: { current: 0, max: 2 } },
    })

    const result = resolveHeadlessDmAction(combat, {
      type: 'attack-token',
      actorTokenId: 'hero-token',
      characterId: 'hero',
      targetTokenId: 'goblin',
      skillId: 'reflux-magic-arrow',
      targetPackets: [
        {
          targetTokenId: 'goblin',
          diceValues: [6, 6, 6],
          targetDodgeMode: 'skip',
          cooldownReductionSkillId: 'cooling-skill',
          cooldownReductionAmount: 1,
        },
      ],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.characters[0].combatSkills.find((item) => item.id === 'cooling-skill')?.remaining).toBe(1)
    expect(result.state.characters[0].combatSkills.find((item) => item.id === 'reflux-magic-arrow')?.remaining).toBe(4)
    expect(result.events).toContainEqual({
      type: 'log',
      text: '新冒险者：冷却中技能 冷却 -1（2→1）。',
    })
  })

  it('clears target statuses and reduces anti-magic arrow cooldown by removed count', () => {
    const antiMagicArrow = skill({
      id: 'anti-magic-arrow',
      name: '破魔箭',
      skillTreeId: 'antiMagicArrow',
      damageCount: 5,
      damageSides: 6,
      cooldown: 4,
      remaining: 0,
    })
    const combat = state({
      characters: [character({ combatSkills: [skill(), antiMagicArrow] })],
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
          hp: 40,
          maxHp: 40,
          x: 245,
          y: 175,
          burningTurns: 2,
          poisonTurns: 1,
          vulnerableTurns: 1,
        }),
      ]),
      enemyApByToken: { goblin: { current: 0, max: 2 } },
    })

    const result = resolveHeadlessDmAction(combat, {
      type: 'attack-token',
      actorTokenId: 'hero-token',
      characterId: 'hero',
      targetTokenId: 'goblin',
      skillId: 'anti-magic-arrow',
      targetPackets: [
        {
          targetTokenId: 'goblin',
          diceValues: [6, 6, 6, 6, 6],
          extraDamageValues: [6, 6],
          extraDamageSides: 6,
          targetDodgeMode: 'skip',
          vulnerableOnHit: true,
          clearTargetStatusesOnHit: true,
          selfCooldownReductionPerClearedStatus: true,
        },
      ],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const target = result.state.map.tokens.find((item) => item.id === 'goblin')
    expect(target?.burningTurns ?? 0).toBe(0)
    expect(target?.poisonTurns ?? 0).toBe(0)
    expect(target?.vulnerableTurns).toBe(1)
    expect(result.state.characters[0].combatSkills.find((item) => item.id === 'anti-magic-arrow')?.remaining).toBe(1)
    const attack = result.events.find((event) => event.type === 'attack-resolved')
    expect(attack).toMatchObject({ damageValues: [6, 6, 6, 6, 6, 6, 6] })
    expect(result.events).toContainEqual({
      type: 'log',
      text: '破魔箭 移除 Goblin 3 个状态。',
    })
    expect(result.events).toContainEqual({
      type: 'log',
      text: '新冒险者：破魔箭 冷却 -3（4→1）。',
    })
  })

  it('resolves explosive arrow critical fire dice after the crit multiplier and applies fire marks', () => {
    const explosiveArrow = skill({
      id: 'explosive-arrow',
      name: '爆裂箭',
      skillTreeId: 'explosiveArrow',
      damageCount: 1,
      damageSides: 6,
      cooldown: 4,
      remaining: 0,
      statusOnHit: 'burning',
      statusDuration: 3,
    })
    const combat = state({
      characters: [
        character({
          abilities: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
          skillRanks: { explosiveArrow: 4 },
          combatSkills: [skill(), explosiveArrow],
        }),
      ],
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
          hp: 40,
          maxHp: 40,
          x: 245,
          y: 175,
        }),
      ]),
      enemyApByToken: { goblin: { current: 0, max: 2 } },
    })

    const result = resolveHeadlessDmAction(combat, {
      type: 'attack-token',
      actorTokenId: 'hero-token',
      characterId: 'hero',
      targetTokenId: 'goblin',
      skillId: 'explosive-arrow',
      targetPackets: [
        {
          targetTokenId: 'goblin',
          diceValues: [6],
          postCritDamageGroups: [
            { values: [6, 6], sides: 6 },
            { values: [12], sides: 12 },
          ],
          targetDodgeMode: 'skip',
          isCrit: true,
          burningOnHit: true,
          burningTurns: 2,
          igniteOnHit: true,
          igniteTurns: 2,
        },
      ],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const target = result.state.map.tokens.find((item) => item.id === 'goblin')
    const attack = result.events.find((event) => event.type === 'attack-resolved')
    expect(attack).toMatchObject({
      damageValues: [6, 6, 6, 12],
      damageBeforeDefense: 31,
      isCrit: true,
      hit: true,
    })
    expect(result.events).toContainEqual({ type: 'dice-rolled', notation: '2d6', values: [6, 6], total: 12 })
    expect(result.events).toContainEqual({ type: 'dice-rolled', notation: '1d12', values: [12], total: 12 })
    expect(target?.burningTurns).toBe(2)
    expect(target?.igniteTurns).toBe(2)
    expect(result.events.filter((event) => event.type === 'status-added').map((event) => event.condition)).toEqual([
      '燃烧',
      '点燃',
    ])
  })

  it('halves cluster shot damage only in the 10 to 20 feet falloff band', () => {
    const clusterShot = skill({
      id: 'cluster-shot',
      name: '集束射击',
      skillTreeId: 'clusterShot',
      damageCount: 2,
      damageSides: 6,
      cooldown: 3,
      remaining: 0,
    })
    const combat = state({
      characters: [
        character({
          abilities: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
          combatSkills: [skill(), clusterShot],
        }),
      ],
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
          id: 'near-goblin',
          label: 'Near Goblin',
          type: 'enemy',
          poolId: 'goblin',
          hp: 40,
          maxHp: 40,
          x: 245,
          y: 175,
        }),
        token({
          id: 'far-goblin',
          label: 'Far Goblin',
          type: 'enemy',
          poolId: 'goblin',
          hp: 40,
          maxHp: 40,
          x: 385,
          y: 175,
        }),
      ]),
      enemyApByToken: { 'near-goblin': { current: 0, max: 2 }, 'far-goblin': { current: 0, max: 2 } },
    })

    const near = resolveHeadlessDmAction(combat, {
      type: 'attack-token',
      actorTokenId: 'hero-token',
      characterId: 'hero',
      targetTokenId: 'near-goblin',
      skillId: 'cluster-shot',
      targetPackets: [
        {
          targetTokenId: 'near-goblin',
          diceValues: [6, 6],
          targetDodgeMode: 'skip',
          halveDamageOnRangeFeet: { minExclusive: 10, maxInclusive: 20 },
        },
      ],
    })
    const far = resolveHeadlessDmAction(combat, {
      type: 'attack-token',
      actorTokenId: 'hero-token',
      characterId: 'hero',
      targetTokenId: 'far-goblin',
      skillId: 'cluster-shot',
      targetPackets: [
        {
          targetTokenId: 'far-goblin',
          diceValues: [6, 6],
          targetDodgeMode: 'skip',
          halveDamageOnRangeFeet: { minExclusive: 10, maxInclusive: 20 },
        },
      ],
    })

    expect(near.ok).toBe(true)
    expect(far.ok).toBe(true)
    if (!near.ok || !far.ok) return
    const nearAttack = near.events.find((event) => event.type === 'attack-resolved')
    const farAttack = far.events.find((event) => event.type === 'attack-resolved')
    expect(nearAttack).toMatchObject({ targetTokenId: 'near-goblin' })
    expect(farAttack).toMatchObject({ targetTokenId: 'far-goblin' })
    if (nearAttack?.type !== 'attack-resolved' || farAttack?.type !== 'attack-resolved') return
    expect(farAttack.total).toBe(Math.floor(nearAttack.total / 2))
  })

  it('resolves wind kick combo knockback bonus, push, cooldown reduction, and temporary knockback cleanup', () => {
    const windKickCombo = skill({
      id: 'wind-kick-combo',
      name: '踏风连踢',
      skillTreeId: 'windKickCombo',
      tags: [],
      damageCount: 3,
      damageSides: 4,
      cooldown: 4,
      remaining: 0,
    })
    const hero = character({
      skillRanks: { windKickCombo: 5 },
      combatBuffs: { windKickTreatKnockbackTargetId: 'goblin' },
      combatSkills: [skill(), windKickCombo],
    })
    const combat = state({
      characters: [hero],
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
          hp: 40,
          maxHp: 40,
          x: 245,
          y: 175,
        }),
      ]),
      enemyApByToken: { goblin: { current: 0, max: 2 } },
    })

    const result = resolveHeadlessDmAction(combat, {
      type: 'attack-token',
      actorTokenId: 'hero-token',
      characterId: 'hero',
      targetTokenId: 'goblin',
      skillId: 'wind-kick-combo',
      targetPackets: [
        {
          targetTokenId: 'goblin',
          diceValues: [4, 4, 4],
          extraDamageValues: [6],
          extraDamageSides: 6,
          targetDodgeMode: 'skip',
          pushTargetOnHit: true,
          pushCells: 1,
          selfCooldownReductionOnHit: 1,
          clearWindKickTreatKnockbackOnUse: true,
        },
      ],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const target = result.state.map.tokens.find((item) => item.id === 'goblin')
    const actor = result.state.characters.find((item) => item.id === 'hero')
    expect(target?.x).toBe(315)
    expect(actor?.combatBuffs?.windKickTreatKnockbackTargetId).toBeUndefined()
    expect(actor?.combatSkills.find((item) => item.id === 'wind-kick-combo')?.remaining).toBe(3)
    const attack = result.events.find((event) => event.type === 'attack-resolved')
    expect(attack).toMatchObject({ damageValues: [4, 4, 4, 6], hit: true })
    expect(result.events.some((event) => event.type === 'token-moved' && event.tokenId === 'goblin')).toBe(true)
  })

  it('resolves eagle strike knockback save disadvantage and cooldown reduction through headless DM', () => {
    const eagleStrike = skill({
      id: 'eagle-strike',
      name: 'Eagle Strike',
      skillTreeId: 'eagleStrike',
      tags: ['melee'],
      damageCount: 3,
      damageSides: 6,
      cooldown: 4,
      remaining: 0,
    })
    const hero = character({
      saveDC: 12,
      skillRanks: { eagleStrike: 5 },
      combatSkills: [skill(), eagleStrike],
    })
    const combat = state({
      characters: [hero],
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
          hp: 80,
          maxHp: 80,
          knockbackTurns: 1,
          x: 245,
          y: 175,
        }),
      ]),
      enemyApByToken: { goblin: { current: 0, max: 2 } },
    })

    const result = resolveHeadlessDmAction(combat, {
      type: 'attack-token',
      actorTokenId: 'hero-token',
      characterId: 'hero',
      targetTokenId: 'goblin',
      skillId: 'eagle-strike',
      targetPackets: [
        {
          targetTokenId: 'goblin',
          diceValues: [6, 6, 6],
          extraDamageGroups: [{ values: [6, 6, 6, 6], sides: 6 }],
          targetDodgeMode: 'skip',
          effectSave: { ability: 'dex', d20: 15, d20Second: 1, disadvantage: true },
          knockbackOnFailedEffectSave: true,
          knockbackTurns: 1,
          selfCooldownReductionOnHit: 3,
        },
      ],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const target = result.state.map.tokens.find((item) => item.id === 'goblin')
    const actor = result.state.characters.find((item) => item.id === 'hero')
    expect(target?.knockbackTurns).toBe(1)
    expect(actor?.combatSkills.find((item) => item.id === 'eagle-strike')?.remaining).toBe(1)
    const attack = result.events.find((event) => event.type === 'attack-resolved')
    expect(attack).toMatchObject({ damageValues: [6, 6, 6, 6, 6, 6, 6], hit: true })
    const save = result.events.find((event) => event.type === 'status-save-resolved')
    expect(save).toMatchObject({ targetTokenId: 'goblin', d20Value: 1, success: false })
  })

  it('rejects rise kick unless the actor is prone and does not spend AP', () => {
    const riseKick = skill({
      id: 'rise-kick',
      name: '起身踢',
      skillTreeId: 'riseKick',
      tags: ['melee'],
      damageCount: 2,
      damageSides: 4,
      cooldown: 4,
      remaining: 0,
    })
    const combat = state({
      characters: [character({ combatSkills: [skill(), riseKick], conditions: [] })],
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
          hp: 40,
          maxHp: 40,
          x: 245,
          y: 175,
        }),
      ]),
      enemyApByToken: { goblin: { current: 0, max: 2 } },
    })

    const result = resolveHeadlessDmAction(combat, {
      type: 'attack-token',
      actorTokenId: 'hero-token',
      characterId: 'hero',
      targetTokenId: 'goblin',
      skillId: 'rise-kick',
      targetPackets: [
        {
          targetTokenId: 'goblin',
          diceValues: [4, 4],
          targetDodgeMode: 'skip',
          clearActorConditionOnHit: '倒地',
        },
      ],
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('invalid-skill')
    expect(result.state.characters[0].currentAP).toBe(2)
    expect(result.state.characters[0].combatSkills.find((item) => item.id === 'rise-kick')?.remaining).toBe(0)
  })

  it('resolves rise kick by clearing prone and granting high-rank free movement on damage', () => {
    const riseKick = skill({
      id: 'rise-kick',
      name: '起身踢',
      skillTreeId: 'riseKick',
      tags: ['melee'],
      damageCount: 4,
      damageSides: 4,
      cooldown: 4,
      remaining: 0,
    })
    const combat = state({
      characters: [
        character({
          conditions: ['倒地'],
          skillRanks: { riseKick: 4 },
          combatSkills: [skill(), riseKick],
        }),
      ],
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
          hp: 40,
          maxHp: 40,
          x: 245,
          y: 175,
        }),
      ]),
      enemyApByToken: { goblin: { current: 0, max: 2 } },
    })

    const result = resolveHeadlessDmAction(combat, {
      type: 'attack-token',
      actorTokenId: 'hero-token',
      characterId: 'hero',
      targetTokenId: 'goblin',
      skillId: 'rise-kick',
      targetPackets: [
        {
          targetTokenId: 'goblin',
          diceValues: [4, 4, 4, 4],
          targetDodgeMode: 'skip',
          clearActorConditionOnHit: '倒地',
          grantFreeMoveFeetOnHit: 10,
        },
      ],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const actor = result.state.characters.find((item) => item.id === 'hero')
    expect(actor?.conditions).not.toContain('倒地')
    expect(actor?.combatBuffs?.freeMoveFeet).toBe(10)
    expect(actor?.currentAP).toBe(1)
    expect(actor?.combatSkills.find((item) => item.id === 'rise-kick')?.remaining).toBe(4)
    const attack = result.events.find((event) => event.type === 'attack-resolved')
    expect(attack).toMatchObject({ damageValues: [4, 4, 4, 4], hit: true })
  })

  it('grants shadow dance free movement and validates the follow-up skill move through DM authority', () => {
    const shadowDance = skill({
      id: 'shadow-dance',
      name: '影遁舞步',
      skillTreeId: 'shadowDance',
      tags: ['melee'],
      damageCount: 3,
      damageSides: 6,
      cooldown: 4,
      remaining: 0,
    })
    const hero = character({
      skillRanks: { shadowDance: 3 },
      combatSkills: [skill(), shadowDance],
    })
    const combat = state({
      characters: [hero],
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
          hp: 40,
          maxHp: 40,
          x: 245,
          y: 175,
        }),
      ]),
      enemyApByToken: { goblin: { current: 0, max: 2 } },
    })

    const attack = resolveHeadlessDmAction(combat, {
      type: 'attack-token',
      actorTokenId: 'hero-token',
      characterId: 'hero',
      targetTokenId: 'goblin',
      skillId: 'shadow-dance',
      targetPackets: [
        {
          targetTokenId: 'goblin',
          diceValues: [6, 6, 6],
          targetDodgeMode: 'skip',
          grantFreeMoveFeetOnHit: 15,
          grantDisengageOnHit: true,
          grantWindKickTreatKnockbackOnHit: true,
        },
      ],
    })

    expect(attack.ok).toBe(true)
    if (!attack.ok) return
    const afterAttackHero = attack.state.characters.find((item) => item.id === 'hero')
    expect(afterAttackHero?.currentAP).toBe(1)
    expect(afterAttackHero?.combatBuffs?.freeMoveFeet).toBe(15)
    expect(afterAttackHero?.combatBuffs?.windKickTreatKnockbackTargetId).toBe('goblin')
    expect(attack.state.disengagedCharacterIds).toContain('hero')
    expect(afterAttackHero?.combatSkills.find((item) => item.id === 'shadow-dance')?.remaining).toBe(4)

    const move = resolveHeadlessDmAction(attack.state, {
      type: 'move-token',
      actorTokenId: 'hero-token',
      characterId: 'hero',
      targetPosition: { x: 385, y: 175 },
      mode: 'skill-free-move',
    })

    expect(move.ok).toBe(true)
    if (!move.ok) return
    const movedHero = move.state.characters.find((item) => item.id === 'hero')
    expect(movedHero?.currentAP).toBe(1)
    expect(movedHero?.combatBuffs?.freeMoveFeet).toBeUndefined()
    expect(move.state.map.tokens.find((item) => item.id === 'hero-token')).toMatchObject({ x: 385, y: 175 })
    expect(move.events.map((event) => event.type)).not.toContain('ap-spent')
    expect(move.events.map((event) => event.type)).not.toContain('opportunity-triggered')
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

  it('adds hunting mark backlash dice when a marked enemy attacks the hunter', () => {
    const combat = state({
      initiativeIndex: 1,
      characters: [
        character({
          traits: [
            {
              id: 'hunting-mark',
              name: '狩猎印记',
              level: 1,
              uses: 0,
              maxUses: 0,
              description: '',
              featureKey: 'huntingMark',
            },
          ],
        }),
      ],
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
          huntingMarkStacks: 1,
        }),
      ]),
      initiativeOrder: [entry('hero-token', 20), entry('goblin', 10)],
      enemyApByToken: { goblin: { current: 2, max: 2 } },
    })

    const result = resolveHeadlessDmAction(
      combat,
      {
        type: 'enemy-attack-token',
        actorTokenId: 'goblin',
        targetTokenId: 'hero-token',
        diceValues: [1],
        huntingBacklashValues: [4],
      },
      createFixedHeadlessDiceRoller([]),
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual({ type: 'dice-rolled', notation: '1d4', values: [4], total: 4 })
    expect(result.events.find((event) => event.type === 'enemy-attack-resolved')).toMatchObject({
      damageValues: [1, 4],
      diceTotal: 5,
    })
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

  it('applies flexible body bonus to the enemy attack dodge check and clears it', () => {
    const combat = state({
      initiativeIndex: 1,
      characters: [character({ combatBuffs: { flexibleBodyBonus: 5 } })],
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
      targetDodgeD20: 11,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const hero = result.state.characters[0]
    expect(hero.currentAP).toBe(1)
    expect(hero.currentHp).toBe(30)
    expect(hero.combatBuffs?.flexibleBodyBonus).toBeUndefined()
    expect(result.events.find((event) => event.type === 'enemy-attack-resolved')).toMatchObject({
      targetDodged: true,
      dodgeD20: 11,
      targetAc: 19,
      total: 0,
    })
  })

  it('lets wind blade dodge an enemy attack without spending AP', () => {
    const combat = state({
      initiativeIndex: 1,
      characters: [
        character({
          currentAP: 0,
          combatBuffs: { windBladeFreeDodgeTurns: 1 },
        }),
      ],
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
    expect(hero.currentAP).toBe(0)
    expect(hero.currentHp).toBe(30)
    expect(result.events).toContainEqual({
      type: 'log',
      text: '新冒险者 的风刃乱舞生效：本次闪避不消耗 AP。',
    })
    expect(result.events.find((event) => event.type === 'enemy-attack-resolved')).toMatchObject({
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

  it('applies round wrap status ticks and DOT through headless DM authority', () => {
    const woundedHero = character({
      currentHp: 20,
      currentAP: 0,
      conditions: ['燃烧'],
    })
    const combat = state({
      characters: [woundedHero],
      initiativeIndex: 1,
      enemyApByToken: { dragon: { current: 0, max: 2 } },
      map: map([
        token({
          id: 'hero-token',
          label: 'Hero',
          type: 'player',
          characterId: woundedHero.id,
          hp: 20,
          maxHp: 30,
          x: 175,
          y: 175,
          burningTurns: 1,
        }),
        token({
          id: 'dragon',
          label: 'Dragon',
          type: 'enemy',
          poolId: 'wyrmling-red',
          hp: 52,
          maxHp: 52,
          x: 455,
          y: 175,
        }),
      ]),
    })

    const result = resolveHeadlessDmAction(combat, {
      type: 'end-turn',
      actorTokenId: 'dragon',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const hero = result.state.characters.find((item) => item.id === woundedHero.id)
    const heroToken = result.state.map.tokens.find((item) => item.id === 'hero-token')
    expect(result.state.round).toBe(2)
    expect(hero?.currentAP).toBe(2)
    expect(hero?.currentHp).toBeLessThan(20)
    expect(hero?.conditions).not.toContain('燃烧')
    expect(heroToken?.burningTurns).toBe(0)
    expect(result.state.enemyApByToken.dragon.current).toBe(2)
  })

  it('applies player end-turn cooldown ticks in headless DM authority', () => {
    const cooldownSkill = skill({ id: 'cooldown-skill', name: '冷却技能', cooldown: 3, remaining: 2 })
    const combat = state({
      characters: [character({ combatSkills: [skill(), cooldownSkill] })],
    })

    const result = resolveHeadlessDmAction(combat, {
      type: 'end-turn',
      actorTokenId: 'hero-token',
      characterId: 'hero',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.characters[0].combatSkills.find((item) => item.id === 'cooldown-skill')?.remaining).toBe(1)
  })

  it('applies player turn-start effects when headless DM advances to a player turn', () => {
    const calmMind = {
      id: 'calm-mind',
      name: '静心',
      level: 1,
      uses: 0,
      maxUses: 0,
      description: '',
      featureKey: 'calmMind' as const,
    }
    const hero = character({
      combatBuffs: {
        eagleEyeTurns: 2,
        movedFeetThisTurn: 15,
        tookDamageThisTurn: true,
      },
      combatSkills: [skill({ usedThisTurn: true })],
      traits: [calmMind],
    })
    const combat = state({
      characters: [hero],
      initiativeIndex: 0,
      initiativeOrder: [entry('dragon', 20), entry('hero-token', 10)],
    })

    const result = resolveHeadlessDmAction(combat, {
      type: 'end-turn',
      actorTokenId: 'dragon',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const nextHero = result.state.characters[0]
    expect(result.state.initiativeIndex).toBe(1)
    expect(nextHero.combatSkills[0].usedThisTurn).toBe(false)
    expect(nextHero.combatBuffs?.calmMind).toBe(true)
    expect(nextHero.combatBuffs?.eagleEyeTurns).toBe(1)
    expect(nextHero.combatBuffs?.movedFeetThisTurn).toBeUndefined()
    expect(nextHero.combatBuffs?.tookDamageThisTurn).toBeUndefined()
    expect(nextHero.combatBuffs?.turnStartKey).toBe('turn-1-1-hero-token')
    expect(result.events.some((event) => event.type === 'turn-started' && event.characterId === 'hero')).toBe(true)
  })

  it('applies first-turn calm mind check when ending a turn in headless DM authority', () => {
    const combat = state({
      characters: [
        character({
          combatBuffs: { calmMindFirstTurnPending: true },
          traits: [
            {
              id: 'calm-mind',
              name: '静心',
              level: 1,
              uses: 0,
              maxUses: 0,
              description: '',
              featureKey: 'calmMind',
            },
          ],
        }),
      ],
    })

    const result = resolveHeadlessDmAction(combat, {
      type: 'end-turn',
      actorTokenId: 'hero-token',
      characterId: 'hero',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.characters[0].combatBuffs?.calmMind).toBe(true)
    expect(result.state.characters[0].combatBuffs?.calmMindFirstTurnPending).toBeUndefined()
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

  it('consumes a prepared Gale Combo marker through the headless framework', () => {
    const combat = state({
      characters: [
        character({
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

    const result = resolveHeadlessGaleComboConsumption(combat, {
      characterId: 'hero',
      actionLabel: '基础射击',
    })

    expect(result.ok).toBe(true)
    const hero = result.state.characters[0]
    expect(hero.combatBuffs?.galeComboReady).toBeUndefined()
    expect(hero.traits[0].uses).toBe(0)
    expect(result.events.some((event) => event.type === 'log' && event.text.includes('消耗疾风连击'))).toBe(true)
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

  it('resolves Double Arrow through headless attack packets', () => {
    const combat = state({
      characters: [
        character({
          combatBuffs: { doubleArrowReady: true },
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

    const result = resolveHeadlessDmAction(
      combat,
      {
        type: 'attack-token',
        actorTokenId: 'hero-token',
        characterId: 'hero',
        targetTokenId: 'dragon',
        skillId: 'basic-shot',
        targetPackets: [
          {
            targetTokenId: 'dragon',
            damageDiceCount: 2,
            diceValues: [4, 5],
            extraDamageValues: [3],
            extraDamageSides: 4,
            targetDodgeMode: 'skip',
            clearDoubleArrowReadyOnUse: true,
            spendDoubleArrowUseOnHit: true,
          },
        ],
      },
      createFixedHeadlessDiceRoller([]),
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const hero = result.state.characters[0]
    expect(hero.currentAP).toBe(1)
    expect(hero.combatBuffs?.doubleArrowReady).toBeUndefined()
    expect(hero.traits.find((trait) => trait.featureKey === 'doubleArrow')?.uses).toBe(1)
    const resolved = result.events.find((event) => event.type === 'attack-resolved')
    expect(resolved?.damageValues).toEqual([4, 5, 3])
    expect(result.events).toContainEqual({ type: 'dice-rolled', notation: '2d8', values: [4, 5], total: 9 })
    expect(result.events).toContainEqual({ type: 'dice-rolled', notation: '1d4', values: [3], total: 3 })
  })

  it('resolves Precise Strike consumption through headless attack packets', () => {
    const combat = state({
      characters: [
        character({
          combatBuffs: { preciseStrikeReady: true },
          traits: [
            {
              id: 'precise-strike',
              name: '精准打击',
              level: 1,
              uses: 1,
              maxUses: 1,
              description: '',
              featureKey: 'preciseStrike',
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
        targetPackets: [
          {
            targetTokenId: 'dragon',
            diceValues: [6],
            targetDodgeMode: 'skip',
            isCrit: true,
            clearPreciseStrikeReadyOnHit: true,
            spendPreciseStrikeUseOnHit: true,
          },
        ],
      },
      createFixedHeadlessDiceRoller([]),
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const hero = result.state.characters[0]
    expect(hero.combatBuffs?.preciseStrikeReady).toBeUndefined()
    expect(hero.traits.find((trait) => trait.featureKey === 'preciseStrike')?.uses).toBe(0)
    const resolved = result.events.find((event) => event.type === 'attack-resolved')
    expect(resolved?.isCrit).toBe(true)
  })

  it('resolves Shadow Veil bonus damage and clears its target marker through headless packets', () => {
    const combat = state({
      characters: [
        character({
          combatBuffs: { shadowVeilTargetId: 'dragon' },
          traits: [
            {
              id: 'shadow-veil',
              name: '影遁之术',
              level: 1,
              uses: 0,
              maxUses: 0,
              description: '',
              featureKey: 'shadowVeil',
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
        targetPackets: [
          {
            targetTokenId: 'dragon',
            diceValues: [5],
            extraDamageValues: [4],
            extraDamageSides: 6,
            targetDodgeMode: 'skip',
            clearShadowVeilTargetOnUse: true,
          },
        ],
      },
      createFixedHeadlessDiceRoller([]),
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const hero = result.state.characters[0]
    expect(hero.combatBuffs?.shadowVeilTargetId).toBeUndefined()
    const resolved = result.events.find((event) => event.type === 'attack-resolved')
    expect(resolved?.damageValues).toEqual([5, 4])
    expect(result.events).toContainEqual({ type: 'dice-rolled', notation: '1d6', values: [4], total: 4 })
  })

  it('resolves grouped feature damage, hunting mark gain, and Silent Draw marking through headless packets', () => {
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
          id: 'dragon',
          label: 'Dragon',
          type: 'enemy',
          poolId: 'wyrmling-red',
          hp: 20,
          maxHp: 52,
          huntingMarkStacks: 1,
          x: 455,
          y: 175,
        }),
      ]),
      characters: [
        character({
          traits: [
            {
              id: 'silent-draw',
              name: '无声起弦',
              level: 1,
              uses: 0,
              maxUses: 0,
              description: '',
              featureKey: 'silentDraw',
            },
            {
              id: 'hunting-mark',
              name: '狩猎印记',
              level: 1,
              uses: 0,
              maxUses: 0,
              description: '',
              featureKey: 'huntingMark',
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
        targetPackets: [
          {
            targetTokenId: 'dragon',
            diceValues: [5],
            extraDamageGroups: [
              { values: [2], sides: 6 },
              { values: [7], sides: 8 },
            ],
            targetDodgeMode: 'skip',
            addHuntingMarkOnDamage: true,
            markSilentDrawUsedOnHit: true,
          },
        ],
      },
      createFixedHeadlessDiceRoller([]),
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const hero = result.state.characters[0]
    const dragon = result.state.map.tokens.find((item) => item.id === 'dragon')
    expect(hero.combatBuffs?.silentDrawUsed).toBe(true)
    expect(dragon?.huntingMarkStacks).toBe(2)
    const resolved = result.events.find((event) => event.type === 'attack-resolved')
    expect(resolved?.damageValues).toEqual([5, 2, 7])
    expect(result.events).toContainEqual({ type: 'dice-rolled', notation: '1d6', values: [2], total: 2 })
    expect(result.events).toContainEqual({ type: 'dice-rolled', notation: '1d8', values: [7], total: 7 })
  })

  it('lets hunting combo packets ignore target dodge and add critical damage', () => {
    const combat = state({
      characters: [
        character({
          abilities: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
        }),
      ],
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
          id: 'marked-goblin',
          label: 'Marked Goblin',
          type: 'enemy',
          poolId: 'goblin',
          hp: 40,
          maxHp: 40,
          huntingMarkStacks: 1,
          x: 245,
          y: 175,
        }),
      ]),
      enemyApByToken: { 'marked-goblin': { current: 2, max: 2 } },
    })

    const result = resolveHeadlessDmAction(combat, {
      type: 'attack-token',
      actorTokenId: 'hero-token',
      characterId: 'hero',
      targetTokenId: 'marked-goblin',
      skillId: 'basic-shot',
      targetPackets: [
        {
          targetTokenId: 'marked-goblin',
          diceValues: [8],
          targetDodgeMode: 'attempt',
          targetDodgeD20: 20,
          ignoreTargetDodge: true,
          isCrit: true,
          additionalCritMultiplier: 0.2,
        },
      ],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.enemyApByToken['marked-goblin'].current).toBe(2)
    expect(result.events.some((event) => event.type === 'target-dodge-resolved')).toBe(false)
    const resolved = result.events.find((event) => event.type === 'attack-resolved')
    expect(resolved).toMatchObject({
      damageValues: [8],
      damageBeforeDefense: 11,
      isCrit: true,
      hit: true,
    })
  })

  it('applies armor-piercing splash behind a critical basic shot and spends the feature use', () => {
    const combat = state({
      characters: [
        character({
          abilities: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
          traits: [
            {
              id: 'armor-piercing-arrow',
              name: 'Armor Piercing Arrow',
              level: 1,
              uses: 1,
              maxUses: 1,
              description: '',
              featureKey: 'armorPiercingArrow',
            },
          ],
        }),
      ],
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
          id: 'target',
          label: 'Target',
          type: 'enemy',
          hp: 40,
          maxHp: 40,
          x: 245,
          y: 175,
        }),
        token({
          id: 'behind',
          label: 'Behind',
          type: 'enemy',
          hp: 40,
          maxHp: 40,
          x: 455,
          y: 175,
        }),
        token({
          id: 'side',
          label: 'Side',
          type: 'enemy',
          hp: 40,
          maxHp: 40,
          x: 455,
          y: 245,
        }),
      ]),
      enemyApByToken: { target: { current: 0, max: 2 }, behind: { current: 0, max: 2 }, side: { current: 0, max: 2 } },
    })

    const result = resolveHeadlessDmAction(combat, {
      type: 'attack-token',
      actorTokenId: 'hero-token',
      characterId: 'hero',
      targetTokenId: 'target',
      skillId: 'basic-shot',
      targetPackets: [
        {
          targetTokenId: 'target',
          diceValues: [8],
          targetDodgeMode: 'skip',
          isCrit: true,
          armorPiercingSplashOnCrit: true,
          armorPiercingRangeFeet: 15,
          spendArmorPiercingUseOnSplash: true,
        },
      ],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const target = result.state.map.tokens.find((item) => item.id === 'target')
    const behind = result.state.map.tokens.find((item) => item.id === 'behind')
    const side = result.state.map.tokens.find((item) => item.id === 'side')
    const hero = result.state.characters.find((item) => item.id === 'hero')
    expect(target?.hp).toBe(30)
    expect(behind?.hp).toBe(35)
    expect(side?.hp).toBe(40)
    expect(hero?.traits.find((item) => item.featureKey === 'armorPiercingArrow')?.uses).toBe(0)
  })

  it('resolves required player attack rolls before dodge and damage', () => {
    const combat = state({
      characters: [
        character({
          abilities: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
        }),
      ],
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
          hp: 40,
          maxHp: 40,
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
      targetPackets: [
        {
          targetTokenId: 'goblin',
          attackRoll: { d20: 1, ability: 'dex', targetAc: 20 },
          targetDodgeMode: 'attempt',
          targetDodgeD20: 1,
        },
      ],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.map.tokens.find((item) => item.id === 'goblin')?.hp).toBe(40)
    expect(result.state.enemyApByToken.goblin.current).toBe(2)
    expect(result.events.some((event) => event.type === 'target-dodge-resolved')).toBe(false)
    const resolved = result.events.find((event) => event.type === 'attack-resolved')
    expect(resolved).toMatchObject({ hit: false, targetDodged: false, total: 0 })
  })

  it('uses calm spirit crit threshold on required attack rolls and clears the bonus', () => {
    const combat = state({
      characters: [
        character({
          abilities: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
          combatBuffs: { calmSpiritCritBonusPercent: 40 },
        }),
      ],
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
          hp: 40,
          maxHp: 40,
          x: 245,
          y: 175,
        }),
      ]),
      enemyApByToken: { goblin: { current: 0, max: 2 } },
    })

    const result = resolveHeadlessDmAction(combat, {
      type: 'attack-token',
      actorTokenId: 'hero-token',
      characterId: 'hero',
      targetTokenId: 'goblin',
      skillId: 'basic-shot',
      targetPackets: [
        {
          targetTokenId: 'goblin',
          attackRoll: { d20: 12, ability: 'dex', targetAc: 20, critThreshold: 12 },
          diceValues: [8],
          targetDodgeMode: 'skip',
          clearCalmSpiritCritBonusOnUse: true,
        },
      ],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.characters[0].combatBuffs?.calmSpiritCritBonusPercent).toBeUndefined()
    const resolved = result.events.find((event) => event.type === 'attack-resolved')
    expect(resolved).toMatchObject({ hit: true, isCrit: true, damageBeforeDefense: 10 })
  })
})
