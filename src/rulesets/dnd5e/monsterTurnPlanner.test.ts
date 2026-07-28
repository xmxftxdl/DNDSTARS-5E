import { afterEach, describe, expect, it } from 'vitest'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { createEmptyMapGeometry, setMapGeometryRuntime } from '../../lib/mapGeometry'
import { createDnd5eTurnEconomyCounts } from './turnEconomy'
import { resolveDnd5eMonsterMapMove } from './monsterMoveAction'
import { planDnd5eMonsterTurn } from './monsterTurnPlanner'
import { createDnd5eConditionEffect, createDnd5eMechanicalEffect } from './activeEffects'
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
