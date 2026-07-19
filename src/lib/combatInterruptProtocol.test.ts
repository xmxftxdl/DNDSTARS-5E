import { describe, expect, it } from 'vitest'
import type { Token } from '../store/maps'
import type { Character } from '../types/character'
import { createCombatInterrupt } from './combatInterruptQueue'
import {
  defaultCombatInterruptResponse,
  isCombatInterruptKind,
  resolveCombatInterruptAnswerCandidate,
} from './combatInterruptProtocol'

const baseCharacter = (patch: Partial<Character> & { id: string; name?: string }): Character => {
  const { id, name, ...rest } = patch
  return {
    id,
    name: name ?? id,
    player: 'Tester',
    avatar: ':)',
    accent: 'from-sky-500 to-cyan-500',
    race: 'Human',
    charClass: 'ranger',
    level: 1,
    background: '',
    experience: 0,
    reputation: 0,
    currentHp: 10,
    maxHp: 10,
    tempHp: 0,
    hitDice: '1d10',
    ac: 10,
    speed: 30,
    initiativeBonus: 0,
    saveDC: 12,
    passivePerception: 10,
    inspiration: 0,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    savingThrows: [],
    skills: [],
    equipment: {},
    conditions: [],
    notes: '',
    dmNotes: '',
    visibleToPlayers: true,
    ...rest,
  }
}

describe('combatInterruptProtocol', () => {
  it('returns timeout-safe default responses by kind', () => {
    expect(defaultCombatInterruptResponse('dodge')).toEqual({ wantsDodge: false })
    expect(defaultCombatInterruptResponse('stable-mind')).toEqual({ useStableMind: false })
    expect(defaultCombatInterruptResponse('gale-combo')).toEqual({ useGaleCombo: false })
    expect(defaultCombatInterruptResponse('agile-leap')).toEqual({ useAgileLeap: false })
    expect(defaultCombatInterruptResponse('opportunity-attack')).toEqual({ useOpportunityAttack: false })
    expect(defaultCombatInterruptResponse('uncanny-dodge')).toEqual({ useUncannyDodge: false })
    expect(defaultCombatInterruptResponse('saving-throw-reroll')).toEqual({ useSavingThrowReroll: false })
    expect(defaultCombatInterruptResponse('bardic-inspiration')).toEqual({ useBardicInspiration: false })
    expect(defaultCombatInterruptResponse('dark-ones-own-luck')).toEqual({ useDarkOnesOwnLuck: false })
    expect(defaultCombatInterruptResponse('stroke-of-luck')).toEqual({ useStrokeOfLuck: false })
    expect(defaultCombatInterruptResponse('shield-spell')).toEqual({ useShieldSpell: false })
    expect(defaultCombatInterruptResponse('stand-against-tide')).toEqual({})
  })

  it('type-narrows interrupts by kind', () => {
    const interrupt = createCombatInterrupt({
      id: 'dodge-1',
      mapId: 'map',
      kind: 'dodge',
      targetCharId: 'hero',
      payload: { result: { moved: false, attacked: true }, targetName: 'Hero' },
      now: 100,
    })

    expect(isCombatInterruptKind(interrupt, 'dodge')).toBe(true)
    expect(isCombatInterruptKind(interrupt, 'gale-combo')).toBe(false)
  })

  it('allows the targeted player to answer dodge interrupts', () => {
    const hero = baseCharacter({ id: 'hero', dmNotes: 'private' })
    const interrupt = createCombatInterrupt({
      id: 'dodge-2',
      mapId: 'map',
      kind: 'dodge',
      targetCharId: hero.id,
      payload: { result: { moved: false, attacked: true }, targetName: hero.name },
      now: 100,
    })

    const candidate = resolveCombatInterruptAnswerCandidate(interrupt, {
      characters: [hero],
      visibleCharacters: [],
      playerCharId: hero.id,
    })

    expect(candidate.character?.id).toBe(hero.id)
    expect(candidate.canAnswer).toBe(true)
  })

  it('allows agile leap for the assigned character even when not in visible characters', () => {
    const hero = baseCharacter({ id: 'hero', dmNotes: 'private' })
    const interrupt = createCombatInterrupt({
      id: 'agile-1',
      mapId: 'map',
      kind: 'agile-leap',
      targetCharId: hero.id,
      payload: { targetName: hero.name, feet: 10, uses: 1, maxUses: 2 },
      now: 100,
    })

    const candidate = resolveCombatInterruptAnswerCandidate(interrupt, {
      characters: [hero],
      visibleCharacters: [],
      assignedCharacterId: hero.id,
    })

    expect(candidate.canAnswer).toBe(true)
  })

  it('allows gale combo for the only visible linked player when no slot is assigned', () => {
    const hero = baseCharacter({ id: 'hero', dmNotes: 'private' })
    const tokens: Token[] = [
      {
        id: 'token-hero',
        label: 'Hero',
        x: 0,
        y: 0,
        color: '#fff',
        emoji: ':)',
        size: 1,
        type: 'player',
        characterId: hero.id,
      },
    ]
    const interrupt = createCombatInterrupt({
      id: 'gale-1',
      mapId: 'map',
      kind: 'gale-combo',
      actorCharId: hero.id,
      payload: { casterName: hero.name, triggerLabel: 'triggered' },
      now: 100,
    })

    const candidate = resolveCombatInterruptAnswerCandidate(interrupt, {
      characters: [hero],
      visibleCharacters: [],
      tokens,
    })

    expect(candidate.canAnswer).toBe(true)
  })

  it('routes opportunity attack answers to the attacker character', () => {
    const attacker = baseCharacter({ id: 'attacker', dmNotes: 'private' })
    const target = baseCharacter({ id: 'target', dmNotes: 'private' })
    const interrupt = createCombatInterrupt({
      id: 'opp-1',
      mapId: 'map',
      kind: 'opportunity-attack',
      actorCharId: attacker.id,
      targetCharId: target.id,
      payload: {
        attackerName: attacker.name,
        targetName: target.name,
        attackerTokenId: 'attacker-token',
        targetTokenId: 'target-token',
      },
      now: 100,
    })

    expect(
      resolveCombatInterruptAnswerCandidate(interrupt, {
        characters: [attacker, target],
        visibleCharacters: [],
        assignedCharacterId: attacker.id,
      }).canAnswer,
    ).toBe(true)
    expect(
      resolveCombatInterruptAnswerCandidate(interrupt, {
        characters: [attacker, target],
        visibleCharacters: [],
        assignedCharacterId: target.id,
      }).canAnswer,
    ).toBe(false)
  })

  it('routes Uncanny Dodge answers to the target character', () => {
    const attacker = baseCharacter({ id: 'attacker', dmNotes: 'private' })
    const target = baseCharacter({ id: 'target', dmNotes: 'private' })
    const interrupt = createCombatInterrupt({
      id: 'uncanny-1', mapId: 'map', kind: 'uncanny-dodge', targetCharId: target.id,
      payload: { attackerName: attacker.name, targetName: target.name, attackName: 'claw' }, now: 100,
    })
    expect(resolveCombatInterruptAnswerCandidate(interrupt, {
      characters: [attacker, target], visibleCharacters: [], assignedCharacterId: target.id,
    }).canAnswer).toBe(true)
    expect(resolveCombatInterruptAnswerCandidate(interrupt, {
      characters: [attacker, target], visibleCharacters: [], assignedCharacterId: attacker.id,
    }).canAnswer).toBe(false)
  })

  it('routes Shield spell answers to the target character', () => {
    const attacker = baseCharacter({ id: 'attacker' })
    const target = baseCharacter({ id: 'wizard', dmNotes: 'private' })
    const interrupt = createCombatInterrupt({
      id: 'shield-1', mapId: 'map', kind: 'shield-spell', targetCharId: target.id,
      payload: { attackerName: attacker.name, targetName: target.name, attackName: '利爪', attackTotal: 16, armorClass: 13 }, now: 100,
    })
    expect(resolveCombatInterruptAnswerCandidate(interrupt, {
      characters: [attacker, target], visibleCharacters: [], assignedCharacterId: target.id,
    }).canAnswer).toBe(true)
    expect(resolveCombatInterruptAnswerCandidate(interrupt, {
      characters: [attacker, target], visibleCharacters: [], assignedCharacterId: attacker.id,
    }).canAnswer).toBe(false)
  })

  it('routes class saving throw rerolls to the saving character', () => {
    const target = baseCharacter({ id: 'target', dmNotes: 'private' })
    const interrupt = createCombatInterrupt({
      id: 'save-reroll-1', mapId: 'map', kind: 'saving-throw-reroll', targetCharId: target.id,
      payload: { targetName: target.name, featureName: '不屈', total: 11, dc: 15 }, now: 100,
    })
    expect(resolveCombatInterruptAnswerCandidate(interrupt, {
      characters: [target], visibleCharacters: [], assignedCharacterId: target.id,
    }).canAnswer).toBe(true)
  })

  it('routes Bardic Inspiration use to the creature holding the die', () => {
    const target = baseCharacter({ id: 'target', dmNotes: 'private' })
    const interrupt = createCombatInterrupt({
      id: 'bardic-1', mapId: 'map', kind: 'bardic-inspiration', targetCharId: target.id,
      payload: { targetName: target.name, dieSides: 8, rollType: '豁免' as const, total: 11, targetNumber: 14 }, now: 100,
    })
    expect(resolveCombatInterruptAnswerCandidate(interrupt, {
      characters: [target], visibleCharacters: [], assignedCharacterId: target.id,
    }).canAnswer).toBe(true)
  })

  it("routes Dark One's Own Luck to the Fiend warlock making the roll", () => {
    const target = baseCharacter({ id: 'warlock', dmNotes: 'private' })
    const interrupt = createCombatInterrupt({
      id: 'dark-luck-1', mapId: 'map', kind: 'dark-ones-own-luck', targetCharId: target.id,
      payload: { targetName: target.name, rollType: '豁免' as const, total: 9, targetNumber: 14 }, now: 100,
    })
    expect(resolveCombatInterruptAnswerCandidate(interrupt, {
      characters: [target], visibleCharacters: [], assignedCharacterId: target.id,
    })).toEqual({ character: target, canAnswer: true })
  })

  it('routes Stroke of Luck to the attacking Rogue', () => {
    const rogue = baseCharacter({ id: 'rogue', dmNotes: 'private' })
    const interrupt = createCombatInterrupt({
      id: 'stroke-1', mapId: 'map', kind: 'stroke-of-luck', actorCharId: rogue.id,
      payload: { targetName: '敌人', attackName: '短剑', total: 12, armorClass: 15 }, now: 100,
    })
    expect(resolveCombatInterruptAnswerCandidate(interrupt, {
      characters: [rogue], visibleCharacters: [], assignedCharacterId: rogue.id,
    }).canAnswer).toBe(true)
  })

  it('routes Stand Against the Tide target selection to the defending Hunter', () => {
    const hunter = baseCharacter({ id: 'hunter', dmNotes: 'private' })
    const attacker = baseCharacter({ id: 'attacker' })
    const interrupt = createCombatInterrupt({
      id: 'stand-1', mapId: 'map', kind: 'stand-against-tide', targetCharId: hunter.id,
      payload: {
        hunterName: hunter.name, attackerName: attacker.name, attackName: 'claw',
        candidates: [{ tokenId: 'other-target', label: 'Other Target' }],
      },
      now: 100,
    })
    expect(resolveCombatInterruptAnswerCandidate(interrupt, {
      characters: [hunter, attacker], visibleCharacters: [], assignedCharacterId: hunter.id,
    }).canAnswer).toBe(true)
    expect(resolveCombatInterruptAnswerCandidate(interrupt, {
      characters: [hunter, attacker], visibleCharacters: [], assignedCharacterId: attacker.id,
    }).canAnswer).toBe(false)
  })

  it('rejects dead characters for any interrupt answer', () => {
    const hero = baseCharacter({ id: 'hero', currentHp: 0 })
    const interrupt = createCombatInterrupt({
      id: 'stable-1',
      mapId: 'map',
      kind: 'stable-mind',
      targetCharId: hero.id,
      payload: {
        targetName: hero.name,
        fullDamage: 8,
        damageAfterSave: 4,
        saveD20: 18,
        saveMod: 2,
        saveTotal: 20,
        dc: 12,
      },
      now: 100,
    })

    expect(
      resolveCombatInterruptAnswerCandidate(interrupt, {
        characters: [hero],
        visibleCharacters: [hero],
        playerCharId: hero.id,
      }).canAnswer,
    ).toBe(false)
  })
})
