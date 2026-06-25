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
    actionPoints: 2,
    currentAP: 2,
    ac: 10,
    speed: 30,
    initiativeBonus: 0,
    saveDC: 12,
    passivePerception: 10,
    inspiration: 0,
    mana: 0,
    maxMana: 0,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    savingThrows: [],
    skills: [],
    traits: [],
    combatSkills: [],
    equipment: {},
    conditions: [],
    notes: '',
    dmNotes: '',
    combatBuffs: {},
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
