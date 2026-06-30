import { describe, expect, it } from 'vitest'
import type { Token } from '../store/maps'
import type { Character } from '../types/character'
import {
  createCombatInterrupt,
  type SharedCombatInterrupt,
  type SharedCombatInterruptQueueState,
} from './combatInterruptQueue'
import type {
  AgileLeapInterruptPayload,
  DodgeInterruptPayload,
  GaleComboInterruptPayload,
  OpportunityAttackInterruptPayload,
  StableMindInterruptPayload,
} from './combatInterruptProtocol'
import { resolveCombatInterruptPromptSelection } from './combatInterruptPrompts'

function character(id: string, patch: Partial<Character> = {}): Character {
  return {
    id,
    name: id,
    currentHp: 10,
    maxHp: 10,
    ...patch,
  } as Character
}

function token(id: string, characterId: string): Token {
  return {
    id,
    type: 'player',
    label: id,
    characterId,
  } as Token
}

function queue(interrupts: SharedCombatInterrupt[], mapId = 'map-1'): SharedCombatInterruptQueueState {
  return { mapId, interrupts, updatedAt: 100 }
}

describe('combat interrupt prompt selection', () => {
  it('selects an answerable dodge prompt for the current map', () => {
    const hero = character('hero')
    const interrupt = createCombatInterrupt<DodgeInterruptPayload>({
      id: 'dodge-1',
      mapId: 'map-1',
      kind: 'dodge',
      targetCharId: hero.id,
      payload: {
        targetName: hero.name,
        result: { moved: false, attacked: true, message: 'hit' },
      },
      expiresAt: 2000,
      now: 100,
    })

    const selection = resolveCombatInterruptPromptSelection({
      queue: queue([interrupt]),
      mapId: 'map-1',
      now: 1000,
      answerContext: {
        characters: [hero],
        visibleCharacters: [hero],
        playerCharId: hero.id,
      },
      suppressed: {},
    })

    expect(selection.dodge?.interrupt.id).toBe('dodge-1')
    expect(selection.dodge?.character.id).toBe(hero.id)
  })

  it('ignores wrong-map, expired, and suppressed interrupts', () => {
    const hero = character('hero')
    const wrongMap = createCombatInterrupt<DodgeInterruptPayload>({
      id: 'wrong-map',
      mapId: 'other-map',
      kind: 'dodge',
      targetCharId: hero.id,
      payload: { targetName: hero.name, result: { moved: false, attacked: true, message: 'hit' } },
      expiresAt: 2000,
      now: 100,
    })
    const expired = createCombatInterrupt<DodgeInterruptPayload>({
      id: 'expired',
      mapId: 'map-1',
      kind: 'dodge',
      targetCharId: hero.id,
      payload: { targetName: hero.name, result: { moved: false, attacked: true, message: 'hit' } },
      expiresAt: 500,
      now: 100,
    })
    const suppressed = createCombatInterrupt<DodgeInterruptPayload>({
      id: 'suppressed',
      mapId: 'map-1',
      kind: 'dodge',
      targetCharId: hero.id,
      payload: { targetName: hero.name, result: { moved: false, attacked: true, message: 'hit' } },
      expiresAt: 2000,
      now: 100,
    })

    const selection = resolveCombatInterruptPromptSelection({
      queue: queue([wrongMap, expired, suppressed]),
      mapId: 'map-1',
      now: 1000,
      answerContext: {
        characters: [hero],
        visibleCharacters: [hero],
        playerCharId: hero.id,
      },
      suppressed: { dodge: new Set(['suppressed']) },
    })

    expect(selection.dodge).toBeUndefined()
  })

  it('uses the actor character for gale combo and opportunity prompts', () => {
    const hero = character('hero')
    const ally = character('ally')
    const gale = createCombatInterrupt<GaleComboInterruptPayload>({
      id: 'gale-1',
      mapId: 'map-1',
      kind: 'gale-combo',
      actorCharId: hero.id,
      payload: { casterName: hero.name, triggerLabel: 'trigger' },
      now: 100,
    })
    const opportunity = createCombatInterrupt<OpportunityAttackInterruptPayload>({
      id: 'opp-1',
      mapId: 'map-1',
      kind: 'opportunity-attack',
      actorCharId: ally.id,
      payload: {
        attackerName: ally.name,
        targetName: hero.name,
        attackerTokenId: 'ally-token',
        targetTokenId: 'hero-token',
      },
      now: 101,
    })

    const selection = resolveCombatInterruptPromptSelection({
      queue: queue([gale, opportunity]),
      mapId: 'map-1',
      now: 1000,
      answerContext: {
        characters: [hero, ally],
        visibleCharacters: [hero, ally],
        playerCharId: hero.id,
        tokens: [token('hero-token', hero.id), token('ally-token', ally.id)],
      },
      suppressed: {},
    })

    expect(selection['gale-combo']?.character.id).toBe(hero.id)
    expect(selection['opportunity-attack']?.character.id).toBe(ally.id)
  })

  it('selects stable mind and agile leap target prompts', () => {
    const hero = character('hero')
    const stable = createCombatInterrupt<StableMindInterruptPayload>({
      id: 'stable-1',
      mapId: 'map-1',
      kind: 'stable-mind',
      targetCharId: hero.id,
      payload: {
        targetName: hero.name,
        fullDamage: 10,
        damageAfterSave: 5,
        saveD20: 12,
        saveMod: 1,
        saveTotal: 13,
        dc: 12,
      },
      now: 100,
    })
    const agile = createCombatInterrupt<AgileLeapInterruptPayload>({
      id: 'agile-1',
      mapId: 'map-1',
      kind: 'agile-leap',
      targetCharId: hero.id,
      payload: {
        targetName: hero.name,
        feet: 10,
        uses: 1,
        maxUses: 2,
      },
      now: 101,
    })

    const selection = resolveCombatInterruptPromptSelection({
      queue: queue([stable, agile]),
      mapId: 'map-1',
      now: 1000,
      answerContext: {
        characters: [hero],
        visibleCharacters: [hero],
        playerCharId: hero.id,
      },
      suppressed: {},
    })

    expect(selection['stable-mind']?.character.id).toBe(hero.id)
    expect(selection['agile-leap']?.character.id).toBe(hero.id)
  })
})
