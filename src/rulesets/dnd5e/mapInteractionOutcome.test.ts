import { describe, expect, it } from 'vitest'
import { normalizeSharedRoomJournal } from '../../lib/roomCommunications'
import type { SceneInteractionOutcomeEffect } from '../../lib/sceneOrchestration'
import {
  dnd5eMapInteractionCurrencyGrants,
  dnd5eMapInteractionHeadlessSteps,
  dnd5eMapInteractionJournalMutations,
  prepareDnd5eMapInteractionOutcomeTransaction,
  validateDnd5eMapInteractionOutcomeReferences,
} from './mapInteractionOutcome'

const journal = normalizeSharedRoomJournal({
  handouts: [{
    id: 'handout-source',
    title: '旧信',
    body: '信中记录了一串数字。',
    audience: 'all',
    authorMemberId: 'dm',
    authorName: 'DM',
    createdAt: 1,
    updatedAt: 1,
  }],
  campaignEntries: [],
  sharedNotes: [{
    id: 'task-open-door',
    kind: 'task',
    status: 'open',
    title: '打开密门',
    body: '',
    authorMemberId: 'dm',
    authorName: 'DM',
    lastEditorMemberId: 'dm',
    lastEditorName: 'DM',
    createdAt: 1,
    updatedAt: 1,
  }],
  updatedAt: 1,
})

describe('D&D 5e map interaction outcome', () => {
  it('builds authoritative damage and condition steps from host rolls', () => {
    const effects: SceneInteractionOutcomeEffect[] = [
      { id: 'trap', kind: 'damage', count: 2, sides: 6, bonus: 1, damageType: 'piercing' },
      { id: 'poisoned', kind: 'condition', condition: 'poisoned', duration: { type: 'rounds', rounds: 3 } },
    ]
    expect(dnd5eMapInteractionHeadlessSteps({
      effects,
      damageRollsByEffectId: { trap: [2, 5] },
    })).toEqual([
      { id: 'trap', kind: 'damage', amount: 8, damageType: 'piercing' },
      {
        id: 'poisoned',
        kind: 'condition',
        condition: 'poisoned',
        duration: { type: 'rounds', remainingRounds: 3, tickOn: 'target-turn-end' },
      },
    ])
    expect(() => dnd5eMapInteractionHeadlessSteps({
      effects,
      damageRollsByEffectId: { trap: [7, 1] },
    })).toThrow('invalid-interaction-damage-rolls:trap')
  })

  it('plans currency, private handouts, new tasks, and task completion with stable receipts', () => {
    const effects: SceneInteractionOutcomeEffect[] = [
      { id: 'coins', kind: 'currency', currency: 'gp', amount: 12 },
      { id: 'letter', kind: 'handout', handoutId: 'handout-source', audience: 'triggering-player' },
      { id: 'new-task', kind: 'task', operation: 'add', title: '寻找钥匙', body: '检查地下室。' },
      { id: 'done', kind: 'task', operation: 'complete', taskId: 'task-open-door', title: '', body: '' },
    ]
    expect(dnd5eMapInteractionCurrencyGrants(effects)).toEqual([{ currency: 'gp', amount: 12 }])
    expect(validateDnd5eMapInteractionOutcomeReferences({
      effects,
      journal,
      triggeringMemberId: 'player-1',
    })).toEqual({ ok: true })
    expect(dnd5eMapInteractionJournalMutations({
      effects,
      journal,
      triggeringMemberId: 'player-1',
      receiptId: 'interaction-receipt',
    })).toEqual([
      expect.objectContaining({
        operation: 'add-handout',
        audience: ['player-1'],
        authorityReceiptId: 'interaction-receipt:effect:1:letter',
      }),
      expect.objectContaining({
        operation: 'add-shared-note',
        authorityReceiptId: 'interaction-receipt:effect:2:new-task',
      }),
      expect.objectContaining({
        operation: 'update-shared-note',
        id: 'task-open-door',
        status: 'done',
        authorityReceiptId: 'interaction-receipt:effect:3:done',
      }),
    ])
  })

  it('fails closed when private references or player ownership are unavailable', () => {
    expect(validateDnd5eMapInteractionOutcomeReferences({
      effects: [{ id: 'missing', kind: 'handout', handoutId: 'missing', audience: 'all' }],
      journal,
    })).toEqual({ ok: false, reason: 'interaction-handout-unavailable' })
    expect(validateDnd5eMapInteractionOutcomeReferences({
      effects: [{ id: 'private', kind: 'handout', handoutId: 'handout-source', audience: 'triggering-player' }],
      journal,
    })).toEqual({ ok: false, reason: 'interaction-player-audience-unavailable' })
    expect(validateDnd5eMapInteractionOutcomeReferences({
      effects: [{
        id: 'missing-task',
        kind: 'task',
        operation: 'complete',
        taskId: 'missing',
        title: '',
        body: '',
      }],
      journal,
    })).toEqual({ ok: false, reason: 'interaction-task-unavailable' })
  })

  it('prepares Headless, inventory and journal effects under one receipt before commit', () => {
    const result = prepareDnd5eMapInteractionOutcomeTransaction({
      effects: [
        { id: 'trap', kind: 'damage', count: 1, sides: 6, bonus: 0, damageType: 'piercing' },
        { id: 'coins', kind: 'currency', currency: 'gp', amount: 3 },
        { id: 'letter', kind: 'handout', handoutId: 'handout-source', audience: 'triggering-player' },
      ],
      damageRollsByEffectId: { trap: [4] },
      journal,
      triggeringMemberId: 'player-1',
      receiptId: 'interaction-receipt',
    })

    expect(result).toMatchObject({
      ok: true,
      transaction: {
        receiptId: 'interaction-receipt',
        headlessSteps: [{ id: 'trap', kind: 'damage', amount: 4, damageType: 'piercing' }],
        currencyGrants: [{ currency: 'gp', amount: 3 }],
        journalMutations: [{
          operation: 'add-handout',
          authorityReceiptId: 'interaction-receipt:effect:2:letter',
        }],
      },
    })
  })

  it('rejects the entire prepared transaction when one damage roll is invalid', () => {
    expect(prepareDnd5eMapInteractionOutcomeTransaction({
      effects: [{ id: 'trap', kind: 'damage', count: 1, sides: 6, bonus: 0, damageType: 'piercing' }],
      damageRollsByEffectId: { trap: [7] },
      journal,
      receiptId: 'interaction-receipt',
    })).toEqual({ ok: false, reason: 'invalid-interaction-outcome' })
  })
})
