import { describe, expect, it } from 'vitest'
import { createDnd5eMechanicalEffect } from '../../rulesets/dnd5e/activeEffects'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { planMapsManualSettlement } from './manualSettlementTransaction'

const character = {
  id: 'hero',
  name: '冒险者',
  currentHp: 8,
  maxHp: 12,
  tempHp: 3,
  level: 1,
  hitDice: '1d8',
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  savingThrows: [],
  skills: [],
  conditions: [],
  inspiration: 0,
  ac: 12,
  speed: 30,
  initiativeBonus: 0,
  passivePerception: 10,
  saveDC: 10,
  rulesetId: 'dnd5e-2014-srd-5.1',
} as unknown as Character

const playerToken = {
  id: 'hero-token',
  label: '冒险者',
  type: 'player',
  characterId: 'hero',
  x: 0,
  y: 0,
  size: 1,
  color: '#fff',
  emoji: '🧙',
} as Token

const monsterToken = {
  ...playerToken,
  id: 'goblin',
  label: '地精',
  type: 'enemy',
  characterId: undefined,
  hp: 7,
  maxHp: 7,
  dnd5eCombatState: { temporaryHp: 2 },
} as Token

const map = {
  id: 'map-1',
  tokens: [playerToken, monsterToken],
} as BattleMap

describe('planMapsManualSettlement', () => {
  it('absorbs character damage with temporary hit points through Headless settlement', () => {
    const plan = planMapsManualSettlement({
      map,
      characters: [character],
      targetId: playerToken.id,
      operation: 'damage',
      amount: 5,
    })
    expect(plan?.hitPoints).toBeUndefined()
    expect(plan?.application?.characterPatches?.hero).toMatchObject({
      currentHp: 6,
      tempHp: 0,
    })
    expect(plan?.headless?.result.events).toContainEqual(expect.objectContaining({
      type: 'damage-applied',
      targetId: playerToken.id,
      amount: 5,
    }))
    expect(plan?.log.kind).toBe('damage')
  })

  it('ends Gaseous Form when DM damage reduces the character to zero hit points', () => {
    const gaseousForm = createDnd5eMechanicalEffect({
      definitionId: 'srd-5.1:spell:gaseous-form',
      label: '气化形体',
      targetId: character.id,
      source: { kind: 'spell', actorId: character.id, rulesId: 'gaseous-form' },
      duration: {
        type: 'concentration',
        sourceActorId: character.id,
        concentrationId: 'gaseous-form',
        remainingRounds: 600,
      },
      breakOn: ['reduced-to-zero'],
      modifiers: { speedOverrideFeet: 10, flySpeedFeet: 10, hoverWhileFlying: true },
    })
    const gaseousCharacter = {
      ...character,
      currentHp: 8,
      tempHp: 0,
      concentrating: true,
      dnd5eCombatState: {
        schemaVersion: 2,
        activeEffects: [gaseousForm],
        concentrationSpellId: 'gaseous-form',
        concentrationTargetIds: [character.id],
        concentrationRoundsRemaining: 600,
      },
    } as Character

    const plan = planMapsManualSettlement({
      map,
      characters: [gaseousCharacter],
      targetId: playerToken.id,
      operation: 'damage',
      amount: 8,
    })

    expect(plan?.application?.characterPatches?.hero).toMatchObject({ currentHp: 0 })
    expect(plan?.application?.characterPatches?.hero?.dnd5eCombatState?.activeEffects)
      .not.toContainEqual(expect.objectContaining({ definitionId: 'srd-5.1:spell:gaseous-form' }))
    expect(plan?.application?.characterPatches?.hero?.dnd5eCombatState)
      .not.toHaveProperty('concentrationSpellId')
    expect(plan?.headless?.result.events).toContainEqual(expect.objectContaining({
      type: 'active-effect-removed',
      targetId: playerToken.id,
      reason: 'reduced-to-zero',
    }))
  })

  it('supports token-only monster healing', () => {
    const plan = planMapsManualSettlement({
      map,
      characters: [],
      targetId: monsterToken.id,
      operation: 'healing',
      amount: 2,
    })
    expect(plan?.hitPoints).toMatchObject({
      tokenId: 'goblin',
      currentHp: 7,
      maxHp: 7,
    })
  })

  it('supports temporary hit points for a token-only monster', () => {
    const plan = planMapsManualSettlement({
      map,
      characters: [],
      targetId: monsterToken.id,
      operation: 'temporary-hit-points',
      amount: 4,
    })
    expect(plan?.hitPoints).toMatchObject({
      tokenId: 'goblin',
      currentHp: 7,
      maxHp: 7,
      temporaryHp: 4,
    })
    expect(plan?.log.details).toContain('临时 HP 2 → 4')
  })

  it('lets the DM increase a token-only monster temporary HP exactly', () => {
    const plan = planMapsManualSettlement({
      map,
      characters: [],
      targetId: monsterToken.id,
      operation: 'increase-temporary-hit-points',
      amount: 4,
    })
    expect(plan?.hitPoints).toMatchObject({
      tokenId: 'goblin',
      currentHp: 7,
      maxHp: 7,
      temporaryHp: 6,
    })
    expect(plan?.log.details).toContain('临时 HP 2 → 6')
  })

  it('lets the DM decrease monster temporary HP without going below zero', () => {
    const plan = planMapsManualSettlement({
      map,
      characters: [],
      targetId: monsterToken.id,
      operation: 'decrease-temporary-hit-points',
      amount: 7,
    })
    expect(plan?.hitPoints).toMatchObject({ temporaryHp: 0 })
    expect(plan?.log.details).toContain('临时 HP 2 → 0')
  })

  it('restores a defeated animated object and transfers only overkill damage to the object', () => {
    const animatedObject: Token = {
      ...monsterToken,
      id: 'animated-blade',
      label: '活化物件 · 飞刀',
      poolId: 'srd-5.1:animated-object:tiny:fly-hover:slashing',
      hp: 20,
      maxHp: 20,
      dnd5eCombatState: undefined,
      dnd5eSummon: {
        schemaVersion: 1,
        pluginId: 'core-srd-spell',
        featureId: 'spell:animate-objects',
        sourceCharacterId: 'wizard',
        sourceTokenId: 'wizard-token',
        createdRound: 1,
        expiresAfterRound: 10,
        concentrationId: 'animate-objects',
        side: 'player',
        truePolymorphOriginalObject: {
          schemaVersion: 1,
          id: 'blade-object',
          label: '飞刀',
          x: 25,
          y: 25,
          color: '#aaa',
          emoji: '🔪',
          size: 1,
          hp: 10,
          maxHp: 10,
        },
      },
    }
    const plan = planMapsManualSettlement({
      map: { ...map, tokens: [animatedObject] },
      characters: [],
      targetId: animatedObject.id,
      operation: 'damage',
      amount: 25,
    })

    expect(plan?.hitPoints).toBeUndefined()
    expect(plan?.application?.map.tokens).toContainEqual(expect.objectContaining({
      id: 'blade-object',
      type: 'obstacle',
      hp: 5,
      maxHp: 10,
    }))
    expect(plan?.application?.map.tokens.some((token) => token.id === animatedObject.id)).toBe(false)
    expect(plan?.headless?.result.events).toContainEqual(expect.objectContaining({
      type: 'damage-applied',
      targetId: animatedObject.id,
      amount: 25,
      hpBefore: 20,
      hpAfter: 0,
    }))
    expect(plan?.log.details).toContain('原物件 HP 10 → 5')
  })

  it('routes True Polymorph damage through the form pool and carries only overflow to the body', () => {
    const transformedCharacter = {
      ...character,
      currentHp: 94,
      maxHp: 162,
      tempHp: 0,
      concentrating: true,
      level: 20,
      hitDice: '20d6',
      abilities: { str: 10, dex: 10, con: 14, int: 20, wis: 10, cha: 10 },
      savingThrows: [],
      skills: [],
      conditions: [],
      inspiration: 0,
      ac: 13,
      speed: 30,
      initiativeBonus: 0,
      passivePerception: 10,
      saveDC: 19,
      rulesetId: 'dnd5e-2014-srd-5.1',
      dnd5eCombatState: {
        schemaVersion: 2,
        wildShapeFormId: 'srd-5.1:brown-bear',
        wildShapeMode: 'true-polymorph' as const,
        wildShapeSourceActorId: character.id,
        wildShapeSourceActivityId: 'true-polymorph',
        wildShapeMaximumChallengeRating: 20,
        wildShapeCurrentHp: 34,
        wildShapeRoundsRemaining: 600,
        wildShapeOriginalCurrentHp: 94,
        wildShapeOriginalMaxHp: 162,
        wildShapeOriginalArmorClass: 13,
        wildShapeOriginalSpeed: 30,
        wildShapeOriginalSizeRank: 2,
        wildShapeOriginalAbilities: { str: 10, dex: 10, con: 10, int: 20, wis: 10, cha: 10 },
        wildShapeOriginalSavingThrowBonuses: { str: 0, dex: 0, con: 0, int: 11, wis: 6, cha: 0 },
        wildShapeOriginalSavingThrowProficiencies: ['int', 'wis'],
        wildShapeOriginalSkillProficiencies: [],
        wildShapeOriginalPassivePerception: 10,
        concentrationSpellId: 'true-polymorph',
        concentrationSpellLevel: 9,
        concentrationTargetIds: [playerToken.id],
        concentrationRoundsRemaining: 600,
      },
    } as Character
    const transformedToken = {
      ...playerToken,
      hp: 34,
      maxHp: 34,
    }
    const transformedMap = { ...map, tokens: [transformedToken] }
    const plan = planMapsManualSettlement({
      map: transformedMap,
      characters: [transformedCharacter],
      targetId: transformedToken.id,
      operation: 'damage',
      amount: 35,
    })

    expect(plan?.hitPoints).toBeUndefined()
    expect(plan?.application?.characterPatches?.[character.id]).toMatchObject({
      currentHp: 93,
      maxHp: 162,
    })
    expect(plan?.application?.characterPatches?.[character.id]?.dnd5eCombatState)
      .not.toHaveProperty('wildShapeFormId')
    expect(plan?.application?.characterPatches?.[character.id]?.dnd5eCombatState)
      .not.toHaveProperty('wildShapeCurrentHp')
    expect(plan?.application?.tokenPatches?.[playerToken.id]).toMatchObject({
      hp: 93,
      maxHp: 162,
    })
    expect(plan?.log.message).toContain('超额 1')
    expect(plan?.headless?.result.events).toContainEqual({
      type: 'concentration-check-required',
      targetId: playerToken.id,
      dc: 17,
    })

    const partial = planMapsManualSettlement({
      map: transformedMap,
      characters: [transformedCharacter],
      targetId: transformedToken.id,
      operation: 'damage',
      amount: 10,
    })
    expect(partial?.application?.tokenPatches?.[playerToken.id]).toMatchObject({
      hp: 24,
      maxHp: 34,
    })
    expect(partial?.log.message).toContain('形态 HP 34 → 24，超额 0')
    expect(partial?.log.details).toContain('本体 HP 94 → 94')
  })
})
