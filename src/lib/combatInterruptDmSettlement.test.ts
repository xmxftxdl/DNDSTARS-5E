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
  StableMindInterruptPayload,
} from './combatInterruptProtocol'
import { resolveDmCombatInterruptSettlements } from './combatInterruptDmSettlement'

function queue(interrupts: SharedCombatInterrupt[], mapId = 'map-1'): SharedCombatInterruptQueueState {
  return { mapId, interrupts, updatedAt: 100 }
}

describe('DM combat interrupt settlement', () => {
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

    const settlements = resolveDmCombatInterruptSettlements({
      queue: queue([dodge, stable, gale, agile, opportunity]),
      mapId: 'map-1',
      now: 1000,
      pending: {
        dodge: 'dodge-1',
        stableMind: 'stable-1',
        galeCombo: 'gale-1',
        agileLeap: 'agile-1',
        opportunityAttack: 'opp-1',
      },
    })

    expect(settlements).toMatchObject([
      { kind: 'dodge', reason: 'answered', wantsDodge: true, dodgeD20: 17 },
      { kind: 'stable-mind', reason: 'answered', useStableMind: true },
      { kind: 'gale-combo', reason: 'answered', decision: 'accepted' },
      { kind: 'agile-leap', reason: 'answered', useAgileLeap: true },
      { kind: 'opportunity-attack', reason: 'answered', useOpportunityAttack: true },
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
})
