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
  ProtectionInterruptPayload,
  ShieldSpellInterruptPayload,
  StableMindInterruptPayload,
  UncannyDodgeInterruptPayload,
  SavingThrowRerollInterruptPayload,
  BardicInspirationInterruptPayload,
  DarkOnesOwnLuckInterruptPayload,
  StrokeOfLuckInterruptPayload,
  EmpoweredSpellInterruptPayload,
  StandAgainstTideInterruptPayload,
} from './combatInterruptProtocol'
import {
  buildCombatInterruptPromptViews,
  resolveCombatInterruptPromptSelection,
} from './combatInterruptPrompts'

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

  it('selects and builds an Uncanny Dodge prompt for the target player', () => {
    const hero = character('hero')
    const interrupt = createCombatInterrupt<UncannyDodgeInterruptPayload>({
      id: 'uncanny-1', mapId: 'map-1', kind: 'uncanny-dodge', targetCharId: hero.id,
      payload: { attackerName: 'Owlbear', targetName: hero.name, attackName: 'Claws' },
      expiresAt: 2000, now: 100,
    })
    const selection = resolveCombatInterruptPromptSelection({
      queue: queue([interrupt]), mapId: 'map-1', now: 1000,
      answerContext: { characters: [hero], visibleCharacters: [hero], playerCharId: hero.id },
      suppressed: {},
    })
    expect(selection['uncanny-dodge']?.character.id).toBe(hero.id)
    expect(buildCombatInterruptPromptViews(selection).uncannyDodge).toMatchObject({
      id: 'uncanny-1', targetChar: hero, attackerName: 'Owlbear', attackName: 'Claws',
    })
  })

  it('selects and builds a Protection prompt for the reacting shield bearer', () => {
    const protector = character('protector')
    const interrupt = createCombatInterrupt<ProtectionInterruptPayload>({
      id: 'protection-1', mapId: 'map-1', kind: 'protection', actorCharId: protector.id,
      payload: { protectorName: protector.name, attackerName: 'Owlbear', targetName: 'hero', attackName: 'Claws' },
      expiresAt: 2000, now: 100,
    })
    const selection = resolveCombatInterruptPromptSelection({
      queue: queue([interrupt]), mapId: 'map-1', now: 1000,
      answerContext: { characters: [protector], visibleCharacters: [protector], playerCharId: protector.id },
      suppressed: {},
    })
    expect(selection.protection?.character.id).toBe(protector.id)
    expect(buildCombatInterruptPromptViews(selection).protection).toMatchObject({
      id: 'protection-1', protectorChar: protector, attackerName: 'Owlbear', targetName: 'hero', attackName: 'Claws',
    })
  })

  it('selects and builds a Shield spell prompt for the defending caster', () => {
    const wizard = character('wizard')
    const interrupt = createCombatInterrupt<ShieldSpellInterruptPayload>({
      id: 'shield-1', mapId: 'map-1', kind: 'shield-spell', targetCharId: wizard.id,
      payload: {
        attackerName: '枭熊', targetName: wizard.name, attackName: '利爪',
        attackTotal: 16, armorClass: 13,
      },
      expiresAt: 2000, now: 100,
    })
    const selection = resolveCombatInterruptPromptSelection({
      queue: queue([interrupt]), mapId: 'map-1', now: 1000,
      answerContext: { characters: [wizard], visibleCharacters: [wizard], playerCharId: wizard.id },
      suppressed: {},
    })
    expect(selection['shield-spell']?.character.id).toBe(wizard.id)
    expect(buildCombatInterruptPromptViews(selection).shieldSpell).toMatchObject({
      id: 'shield-1', targetChar: wizard, attackerName: '枭熊', attackName: '利爪', attackTotal: 16, armorClass: 13,
    })
  })

  it('selects and builds a saving throw reroll prompt for the target player', () => {
    const hero = character('hero')
    const interrupt = createCombatInterrupt<SavingThrowRerollInterruptPayload>({
      id: 'save-reroll-1', mapId: 'map-1', kind: 'saving-throw-reroll', targetCharId: hero.id,
      payload: { targetName: hero.name, featureName: '不屈', total: 9, dc: 14 },
      expiresAt: 2000, now: 100,
    })
    const selection = resolveCombatInterruptPromptSelection({
      queue: queue([interrupt]), mapId: 'map-1', now: 1000,
      answerContext: { characters: [hero], visibleCharacters: [hero], playerCharId: hero.id },
      suppressed: {},
    })
    expect(selection['saving-throw-reroll']?.character.id).toBe(hero.id)
    expect(buildCombatInterruptPromptViews(selection).savingThrowReroll).toMatchObject({
      id: 'save-reroll-1', targetChar: hero, featureName: '不屈', total: 9, dc: 14,
    })
  })

  it('selects and builds a Bardic Inspiration prompt for the die holder', () => {
    const hero = character('hero')
    const interrupt = createCombatInterrupt<BardicInspirationInterruptPayload>({
      id: 'bardic-1', mapId: 'map-1', kind: 'bardic-inspiration', targetCharId: hero.id,
      payload: { targetName: hero.name, dieSides: 10, rollType: '攻击检定', total: 12, targetNumber: 15 },
      expiresAt: 2000, now: 100,
    })
    const selection = resolveCombatInterruptPromptSelection({
      queue: queue([interrupt]), mapId: 'map-1', now: 1000,
      answerContext: { characters: [hero], visibleCharacters: [hero], playerCharId: hero.id },
      suppressed: {},
    })
    expect(selection['bardic-inspiration']?.character.id).toBe(hero.id)
    expect(buildCombatInterruptPromptViews(selection).bardicInspiration).toMatchObject({
      id: 'bardic-1', targetChar: hero, dieSides: 10, rollType: '攻击检定', total: 12, targetNumber: 15,
    })
  })

  it("selects and builds a Dark One's Own Luck prompt for the rolling warlock", () => {
    const warlock = character('warlock')
    const interrupt = createCombatInterrupt<DarkOnesOwnLuckInterruptPayload>({
      id: 'dark-luck-1', mapId: 'map-1', kind: 'dark-ones-own-luck', targetCharId: warlock.id,
      payload: { targetName: warlock.name, rollType: '豁免', total: 9, targetNumber: 14 },
      expiresAt: 2000, now: 100,
    })
    const selection = resolveCombatInterruptPromptSelection({
      queue: queue([interrupt]), mapId: 'map-1', now: 1000,
      answerContext: { characters: [warlock], visibleCharacters: [warlock], playerCharId: warlock.id },
      suppressed: {},
    })
    expect(selection['dark-ones-own-luck']?.character.id).toBe(warlock.id)
    expect(buildCombatInterruptPromptViews(selection).darkOnesOwnLuck).toMatchObject({
      id: 'dark-luck-1', targetChar: warlock, rollType: '豁免', total: 9, targetNumber: 14,
    })
  })

  it('selects and builds a Stroke of Luck prompt for the attacking Rogue', () => {
    const rogue = character('rogue')
    const interrupt = createCombatInterrupt<StrokeOfLuckInterruptPayload>({
      id: 'stroke-1', mapId: 'map-1', kind: 'stroke-of-luck', actorCharId: rogue.id,
      payload: { targetName: '敌人', attackName: '短剑', total: 11, armorClass: 15 }, expiresAt: 2000, now: 100,
    })
    const selection = resolveCombatInterruptPromptSelection({
      queue: queue([interrupt]), mapId: 'map-1', now: 1000,
      answerContext: { characters: [rogue], visibleCharacters: [rogue], playerCharId: rogue.id }, suppressed: {},
    })
    expect(buildCombatInterruptPromptViews(selection).strokeOfLuck).toMatchObject({
      id: 'stroke-1', actorChar: rogue, targetName: '敌人', attackName: '短剑', total: 11, armorClass: 15,
    })
  })

  it('selects and builds an Empowered Spell prompt for the casting Sorcerer', () => {
    const sorcerer = character('sorcerer')
    const interrupt = createCombatInterrupt<EmpoweredSpellInterruptPayload>({
      id: 'empowered-1', mapId: 'map-1', kind: 'empowered-spell', actorCharId: sorcerer.id,
      payload: {
        casterName: sorcerer.name,
        spellName: '火球术',
        maximumDice: 3,
        groups: [{ key: 'effect', label: '火球术伤害', sides: 6, rolls: [1, 2, 3, 4, 5, 6, 1, 2] }],
      },
      expiresAt: 2000,
      now: 100,
    })
    const selection = resolveCombatInterruptPromptSelection({
      queue: queue([interrupt]), mapId: 'map-1', now: 1000,
      answerContext: { characters: [sorcerer], visibleCharacters: [sorcerer], playerCharId: sorcerer.id },
      suppressed: {},
    })
    expect(buildCombatInterruptPromptViews(selection).empoweredSpell).toMatchObject({
      id: 'empowered-1', casterChar: sorcerer, spellName: '火球术', maximumDice: 3,
    })
  })

  it('selects and builds a Stand Against the Tide target prompt for the Hunter', () => {
    const hunter = character('hunter')
    const interrupt = createCombatInterrupt<StandAgainstTideInterruptPayload>({
      id: 'stand-1', mapId: 'map-1', kind: 'stand-against-tide', targetCharId: hunter.id,
      payload: {
        hunterName: hunter.name, attackerName: 'Owlbear', attackName: 'Claws',
        candidates: [{ tokenId: 'ally-token', label: 'Ally' }],
      },
      expiresAt: 2000,
      now: 100,
    })
    const selection = resolveCombatInterruptPromptSelection({
      queue: queue([interrupt]), mapId: 'map-1', now: 1000,
      answerContext: { characters: [hunter], visibleCharacters: [hunter], playerCharId: hunter.id },
      suppressed: {},
    })
    expect(selection['stand-against-tide']?.character.id).toBe(hunter.id)
    expect(buildCombatInterruptPromptViews(selection).standAgainstTide).toMatchObject({
      id: 'stand-1', hunterChar: hunter, attackerName: 'Owlbear', attackName: 'Claws',
      candidates: [{ tokenId: 'ally-token', label: 'Ally' }], expiresAt: 2000,
    })
  })

  it('builds UI prompt views from the selected interrupts', () => {
    const hero = character('hero')
    const ally = character('ally')
    const dodge = createCombatInterrupt<DodgeInterruptPayload>({
      id: 'dodge-1',
      mapId: 'map-1',
      kind: 'dodge',
      targetCharId: hero.id,
      payload: { targetName: hero.name, result: { moved: false, attacked: true, message: 'hit' } },
      expiresAt: 2000,
      now: 100,
    })
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
      now: 101,
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
      now: 102,
    })

    const selection = resolveCombatInterruptPromptSelection({
      queue: queue([dodge, stable, opportunity]),
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

    const views = buildCombatInterruptPromptViews(selection)
    expect(views.dodge).toMatchObject({
      id: 'dodge-1',
      targetChar: hero,
      expiresAt: 2000,
    })
    expect(views.stableMind).toMatchObject({
      id: 'stable-1',
      fullDamage: 10,
      damageAfterSave: 5,
      saveD20: 12,
      saveMod: 1,
      saveTotal: 13,
      dc: 12,
    })
    expect(views.opportunityAttack).toMatchObject({
      id: 'opp-1',
      attackerChar: ally,
      targetName: hero.name,
    })
  })

  it('preserves the Berserker Retaliation trigger in the shared reaction prompt', () => {
    const berserker = character('berserker')
    const interrupt = createCombatInterrupt<OpportunityAttackInterruptPayload>({
      id: 'retaliation-1', mapId: 'map-1', kind: 'opportunity-attack', actorCharId: berserker.id,
      payload: {
        attackerName: berserker.name, targetName: 'enemy', attackerTokenId: 'berserker-token',
        targetTokenId: 'enemy-token', trigger: 'berserker-retaliation',
      },
      now: 100,
    })
    const selection = resolveCombatInterruptPromptSelection({
      queue: queue([interrupt]), mapId: 'map-1', now: 1000,
      answerContext: { characters: [berserker], visibleCharacters: [berserker], playerCharId: berserker.id },
      suppressed: {},
    })
    expect(buildCombatInterruptPromptViews(selection).opportunityAttack).toMatchObject({
      id: 'retaliation-1', trigger: 'berserker-retaliation', targetName: 'enemy',
    })
  })
})
