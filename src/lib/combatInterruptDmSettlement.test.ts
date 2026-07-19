import { describe, expect, it } from 'vitest'
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
  DmAdjudicationInterruptPayload,
} from './combatInterruptProtocol'
import { resolveDmCombatInterruptSettlements } from './combatInterruptDmSettlement'

function queue(interrupts: SharedCombatInterrupt[], mapId = 'map-1'): SharedCombatInterruptQueueState {
  return { mapId, interrupts, updatedAt: 100 }
}

describe('DM combat interrupt settlement', () => {
  it('returns a DM adjudication only after an explicit approval', () => {
    const interrupt: SharedCombatInterrupt<DmAdjudicationInterruptPayload> = {
      ...createCombatInterrupt<DmAdjudicationInterruptPayload>({
        id: 'dm-adjudication:cast-1', mapId: 'map-1', kind: 'dm-adjudication', actorCharId: 'wizard',
        payload: {
          actionId: 'cast-1', casterName: '法师', spellId: 'test.rules:spell', spellName: '测试法术',
          spellLevel: 1, slotLevel: 1, castingTime: 'action', description: '规则正文', concentration: false,
        }, now: 100,
      }),
      status: 'answered',
      response: {
        decision: 'approved',
        effects: [{ targetTokenId: 'enemy', operation: 'damage', amount: 8 }],
        note: '豁免失败',
      },
    }
    expect(resolveDmCombatInterruptSettlements({
      queue: queue([interrupt]), mapId: 'map-1', now: 200,
      pending: { dmAdjudication: interrupt.id },
    })).toEqual([expect.objectContaining({
      kind: 'dm-adjudication', reason: 'answered',
      response: expect.objectContaining({ decision: 'approved', effects: interrupt.response?.effects }),
    })])
  })

  it('cancels an expired DM adjudication so no resource transaction can commit', () => {
    const interrupt = createCombatInterrupt<DmAdjudicationInterruptPayload>({
      id: 'dm-adjudication:cast-2', mapId: 'map-1', kind: 'dm-adjudication', actorCharId: 'wizard',
      payload: {
        actionId: 'cast-2', casterName: '法师', spellId: 'test.rules:spell', spellName: '测试法术',
        spellLevel: 1, slotLevel: 1, castingTime: 'action', description: '规则正文', concentration: false,
      }, expiresAt: 500, now: 100,
    })
    expect(resolveDmCombatInterruptSettlements({
      queue: queue([interrupt]), mapId: 'map-1', now: 600,
      pending: { dmAdjudication: interrupt.id },
    })).toEqual([expect.objectContaining({
      kind: 'dm-adjudication', reason: 'expired',
      response: { decision: 'cancelled', effects: [] },
    })])
  })

  it("settles an answered Dark One's Own Luck choice", () => {
    const interrupt: SharedCombatInterrupt<DarkOnesOwnLuckInterruptPayload> = {
      ...createCombatInterrupt<DarkOnesOwnLuckInterruptPayload>({
        id: 'dark-luck-1', mapId: 'map-1', kind: 'dark-ones-own-luck', targetCharId: 'warlock',
        payload: { targetName: 'warlock', rollType: '豁免', total: 9, targetNumber: 14 }, now: 100,
      }),
      status: 'answered',
      response: { useDarkOnesOwnLuck: true },
    }
    expect(resolveDmCombatInterruptSettlements({
      queue: queue([interrupt]), mapId: 'map-1', now: 200,
      pending: { darkOnesOwnLuck: interrupt.id },
    })).toEqual([expect.objectContaining({
      kind: 'dark-ones-own-luck', reason: 'answered', useDarkOnesOwnLuck: true,
    })])
  })

  it('resolves expired dodge interrupts with the default no-dodge response', () => {
    const dodge = createCombatInterrupt<DodgeInterruptPayload>({
      id: 'dodge-1',
      mapId: 'map-1',
      kind: 'dodge',
      payload: { targetName: 'hero', result: { moved: false, attacked: true, message: 'hit' } },
      expiresAt: 500,
      now: 100,
    })

    expect(
      resolveDmCombatInterruptSettlements({
        queue: queue([dodge]),
        mapId: 'map-1',
        now: 1000,
        pending: { dodge: 'dodge-1' },
      }),
    ).toEqual([
      {
        kind: 'dodge',
        id: 'dodge-1',
        reason: 'expired',
        finishResponse: { wantsDodge: false },
        wantsDodge: false,
      },
    ])
  })

  it('resolves answered interrupts with typed responses', () => {
    const dodge: SharedCombatInterrupt<DodgeInterruptPayload> = {
      ...createCombatInterrupt<DodgeInterruptPayload>({
        id: 'dodge-1',
        mapId: 'map-1',
        kind: 'dodge',
        payload: { targetName: 'hero', result: { moved: false, attacked: true, message: 'hit' } },
        now: 100,
      }),
      status: 'answered',
      response: { wantsDodge: true, dodgeD20: 17 },
    }
    const stable: SharedCombatInterrupt<StableMindInterruptPayload> = {
      ...createCombatInterrupt<StableMindInterruptPayload>({
        id: 'stable-1',
        mapId: 'map-1',
        kind: 'stable-mind',
        payload: {
          targetName: 'hero',
          fullDamage: 10,
          damageAfterSave: 5,
          saveD20: 12,
          saveMod: 1,
          saveTotal: 13,
          dc: 12,
        },
        now: 100,
      }),
      status: 'answered',
      response: { useStableMind: true },
    }
    const gale: SharedCombatInterrupt<GaleComboInterruptPayload> = {
      ...createCombatInterrupt<GaleComboInterruptPayload>({
        id: 'gale-1',
        mapId: 'map-1',
        kind: 'gale-combo',
        payload: { casterName: 'hero', triggerLabel: '触发' },
        now: 100,
      }),
      status: 'answered',
      response: { useGaleCombo: true },
    }
    const agile: SharedCombatInterrupt<AgileLeapInterruptPayload> = {
      ...createCombatInterrupt<AgileLeapInterruptPayload>({
        id: 'agile-1',
        mapId: 'map-1',
        kind: 'agile-leap',
        payload: { targetName: 'hero', feet: 10, uses: 1, maxUses: 2 },
        now: 100,
      }),
      status: 'answered',
      response: { useAgileLeap: true },
    }
    const opportunity: SharedCombatInterrupt<OpportunityAttackInterruptPayload> = {
      ...createCombatInterrupt<OpportunityAttackInterruptPayload>({
        id: 'opp-1',
        mapId: 'map-1',
        kind: 'opportunity-attack',
        payload: {
          attackerName: 'hero',
          targetName: 'enemy',
          attackerTokenId: 'hero-token',
          targetTokenId: 'enemy-token',
        },
        now: 100,
      }),
      status: 'answered',
      response: { useOpportunityAttack: true },
    }
    const uncanny: SharedCombatInterrupt<UncannyDodgeInterruptPayload> = {
      ...createCombatInterrupt<UncannyDodgeInterruptPayload>({
        id: 'uncanny-1', mapId: 'map-1', kind: 'uncanny-dodge', targetCharId: 'hero',
        payload: { attackerName: 'owlbear', targetName: 'hero', attackName: 'claws' }, now: 100,
      }),
      status: 'answered',
      response: { useUncannyDodge: true },
    }
    const protection: SharedCombatInterrupt<ProtectionInterruptPayload> = {
      ...createCombatInterrupt<ProtectionInterruptPayload>({
        id: 'protection-1', mapId: 'map-1', kind: 'protection', actorCharId: 'protector',
        payload: { protectorName: 'protector', attackerName: 'owlbear', targetName: 'hero', attackName: 'claws' }, now: 100,
      }),
      status: 'answered',
      response: { useProtection: true },
    }
    const shieldSpell: SharedCombatInterrupt<ShieldSpellInterruptPayload> = {
      ...createCombatInterrupt<ShieldSpellInterruptPayload>({
        id: 'shield-1', mapId: 'map-1', kind: 'shield-spell', targetCharId: 'wizard',
        payload: { attackerName: 'owlbear', targetName: 'wizard', attackName: 'claws', attackTotal: 16, armorClass: 13 }, now: 100,
      }),
      status: 'answered',
      response: { useShieldSpell: true },
    }
    const savingThrowReroll: SharedCombatInterrupt<SavingThrowRerollInterruptPayload> = {
      ...createCombatInterrupt<SavingThrowRerollInterruptPayload>({
        id: 'save-reroll-1', mapId: 'map-1', kind: 'saving-throw-reroll', targetCharId: 'hero',
        payload: { targetName: 'hero', featureName: '不屈', total: 10, dc: 14 }, now: 100,
      }),
      status: 'answered',
      response: { useSavingThrowReroll: true },
    }
    const bardicInspiration: SharedCombatInterrupt<BardicInspirationInterruptPayload> = {
      ...createCombatInterrupt<BardicInspirationInterruptPayload>({
        id: 'bardic-1', mapId: 'map-1', kind: 'bardic-inspiration', targetCharId: 'hero',
        payload: { targetName: 'hero', dieSides: 8, rollType: '豁免', total: 10, targetNumber: 14 }, now: 100,
      }),
      status: 'answered',
      response: { useBardicInspiration: true },
    }
    const strokeOfLuck: SharedCombatInterrupt<StrokeOfLuckInterruptPayload> = {
      ...createCombatInterrupt<StrokeOfLuckInterruptPayload>({
        id: 'stroke-1', mapId: 'map-1', kind: 'stroke-of-luck', actorCharId: 'hero',
        payload: { targetName: 'enemy', attackName: 'shortsword', total: 10, armorClass: 15 }, now: 100,
      }),
      status: 'answered',
      response: { useStrokeOfLuck: true },
    }

    const settlements = resolveDmCombatInterruptSettlements({
      queue: queue([dodge, stable, gale, agile, opportunity, uncanny, protection, shieldSpell, savingThrowReroll, bardicInspiration, strokeOfLuck]),
      mapId: 'map-1',
      now: 1000,
      pending: {
        dodge: 'dodge-1',
        stableMind: 'stable-1',
        galeCombo: 'gale-1',
        agileLeap: 'agile-1',
        opportunityAttack: 'opp-1',
        uncannyDodge: 'uncanny-1',
        protection: 'protection-1',
        shieldSpell: 'shield-1',
        savingThrowReroll: 'save-reroll-1',
        bardicInspiration: 'bardic-1',
        strokeOfLuck: 'stroke-1',
      },
    })

    expect(settlements).toMatchObject([
      { kind: 'dodge', reason: 'answered', wantsDodge: true, dodgeD20: 17 },
      { kind: 'stable-mind', reason: 'answered', useStableMind: true },
      { kind: 'gale-combo', reason: 'answered', decision: 'accepted' },
      { kind: 'agile-leap', reason: 'answered', useAgileLeap: true },
      { kind: 'opportunity-attack', reason: 'answered', useOpportunityAttack: true },
      { kind: 'uncanny-dodge', reason: 'answered', useUncannyDodge: true },
      { kind: 'protection', reason: 'answered', useProtection: true },
      { kind: 'shield-spell', reason: 'answered', useShieldSpell: true },
      { kind: 'saving-throw-reroll', reason: 'answered', useSavingThrowReroll: true },
      { kind: 'bardic-inspiration', reason: 'answered', useBardicInspiration: true },
      { kind: 'stroke-of-luck', reason: 'answered', useStrokeOfLuck: true },
    ])
  })

  it('ignores pending, wrong-map, and wrong-kind interrupt ids', () => {
    const pendingDodge = createCombatInterrupt<DodgeInterruptPayload>({
      id: 'dodge-1',
      mapId: 'map-1',
      kind: 'dodge',
      payload: { targetName: 'hero', result: { moved: false, attacked: true, message: 'hit' } },
      expiresAt: 2000,
      now: 100,
    })
    const stable = createCombatInterrupt<StableMindInterruptPayload>({
      id: 'stable-1',
      mapId: 'map-1',
      kind: 'stable-mind',
      payload: {
        targetName: 'hero',
        fullDamage: 10,
        damageAfterSave: 5,
        saveD20: 12,
        saveMod: 1,
        saveTotal: 13,
        dc: 12,
      },
      now: 100,
    })

    expect(
      resolveDmCombatInterruptSettlements({
        queue: queue([pendingDodge, stable]),
        mapId: 'map-1',
        now: 1000,
        pending: { dodge: 'dodge-1', galeCombo: 'stable-1' },
      }),
    ).toEqual([])

    expect(
      resolveDmCombatInterruptSettlements({
        queue: queue([pendingDodge], 'other-map'),
        mapId: 'map-1',
        now: 1000,
        pending: { dodge: 'dodge-1' },
      }),
    ).toEqual([])
  })

  it('settles Stand Against the Tide target selections and expires without redirecting', () => {
    const answered: SharedCombatInterrupt<StandAgainstTideInterruptPayload> = {
      ...createCombatInterrupt<StandAgainstTideInterruptPayload>({
        id: 'stand-answered', mapId: 'map-1', kind: 'stand-against-tide', targetCharId: 'hunter',
        payload: {
          hunterName: 'Hunter', attackerName: 'Owlbear', attackName: 'Claws',
          candidates: [{ tokenId: 'ally-token', label: 'Ally' }],
        },
        now: 100,
      }),
      status: 'answered',
      response: { targetTokenId: 'ally-token' },
    }
    const expired = createCombatInterrupt<StandAgainstTideInterruptPayload>({
      id: 'stand-expired', mapId: 'map-1', kind: 'stand-against-tide', targetCharId: 'hunter',
      payload: {
        hunterName: 'Hunter', attackerName: 'Owlbear', attackName: 'Claws',
        candidates: [{ tokenId: 'ally-token', label: 'Ally' }],
      },
      expiresAt: 500,
      now: 100,
    })
    expect(resolveDmCombatInterruptSettlements({
      queue: queue([answered]), mapId: 'map-1', now: 200,
      pending: { standAgainstTide: answered.id },
    })).toEqual([expect.objectContaining({
      kind: 'stand-against-tide', reason: 'answered', targetTokenId: 'ally-token',
    })])
    expect(resolveDmCombatInterruptSettlements({
      queue: queue([expired]), mapId: 'map-1', now: 1000,
      pending: { standAgainstTide: expired.id },
    })).toEqual([expect.objectContaining({
      kind: 'stand-against-tide', reason: 'expired', finishResponse: {},
    })])
  })

  it('settles Empowered Spell selections and expires to no rerolls', () => {
    const answered: SharedCombatInterrupt<EmpoweredSpellInterruptPayload> = {
      ...createCombatInterrupt<EmpoweredSpellInterruptPayload>({
        id: 'empowered-answered', mapId: 'map-1', kind: 'empowered-spell', actorCharId: 'sorcerer',
        payload: {
          casterName: '术士', spellName: '火球术', maximumDice: 3,
          groups: [{ key: 'effect', label: '火球术伤害', sides: 6, rolls: [1, 2, 3] }],
        },
        now: 100,
      }),
      status: 'answered',
      response: { rerollKeys: ['effect:0', 'effect:2'] },
    }
    const expired = createCombatInterrupt<EmpoweredSpellInterruptPayload>({
      id: 'empowered-expired', mapId: 'map-1', kind: 'empowered-spell', actorCharId: 'sorcerer',
      payload: {
        casterName: '术士', spellName: '火球术', maximumDice: 3,
        groups: [{ key: 'effect', label: '火球术伤害', sides: 6, rolls: [1, 2, 3] }],
      },
      expiresAt: 500,
      now: 100,
    })
    expect(resolveDmCombatInterruptSettlements({
      queue: queue([answered]), mapId: 'map-1', now: 200,
      pending: { empoweredSpell: answered.id },
    })).toEqual([expect.objectContaining({
      kind: 'empowered-spell', reason: 'answered', rerollKeys: ['effect:0', 'effect:2'],
    })])
    expect(resolveDmCombatInterruptSettlements({
      queue: queue([expired]), mapId: 'map-1', now: 1000,
      pending: { empoweredSpell: expired.id },
    })).toEqual([expect.objectContaining({
      kind: 'empowered-spell', reason: 'expired', rerollKeys: [],
    })])
  })
})
