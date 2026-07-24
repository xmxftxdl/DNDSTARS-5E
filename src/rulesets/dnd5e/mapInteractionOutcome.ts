import type {
  RoomJournalMutation,
  SharedRoomJournalState,
} from '../../lib/roomCommunications'
import type { SceneInteractionOutcomeEffect } from '../../lib/sceneOrchestration'
import type { Dnd5eInventoryCurrencyGrant } from '../../types/inventory'
import type { Dnd5eSceneInteractionOutcomeStep } from './headlessCombatEngine'

export type Dnd5eMapInteractionOutcomeReferenceFailure =
  | 'interaction-handout-unavailable'
  | 'interaction-task-unavailable'
  | 'interaction-player-audience-unavailable'

export type Dnd5eMapInteractionOutcomeTransactionFailure =
  | Dnd5eMapInteractionOutcomeReferenceFailure
  | 'invalid-interaction-outcome'

export function validateDnd5eMapInteractionOutcomeReferences(input: {
  effects: readonly SceneInteractionOutcomeEffect[]
  journal: SharedRoomJournalState
  triggeringMemberId?: string
}): { ok: true } | { ok: false; reason: Dnd5eMapInteractionOutcomeReferenceFailure } {
  for (const effect of input.effects) {
    if (
      effect.kind === 'handout' &&
      !input.journal.handouts.some((entry) => entry.id === effect.handoutId)
    ) {
      return { ok: false, reason: 'interaction-handout-unavailable' }
    }
    if (
      effect.kind === 'handout' &&
      effect.audience === 'triggering-player' &&
      !input.triggeringMemberId
    ) {
      return { ok: false, reason: 'interaction-player-audience-unavailable' }
    }
    if (
      effect.kind === 'task' &&
      effect.operation === 'complete' &&
      !input.journal.sharedNotes.some((entry) => entry.id === effect.taskId && entry.kind === 'task')
    ) {
      return { ok: false, reason: 'interaction-task-unavailable' }
    }
  }
  return { ok: true }
}

export function dnd5eMapInteractionCurrencyGrants(
  effects: readonly SceneInteractionOutcomeEffect[],
): Dnd5eInventoryCurrencyGrant[] {
  return effects.flatMap((effect) => effect.kind === 'currency'
    ? [{ currency: effect.currency, amount: effect.amount }]
    : [])
}

export function dnd5eMapInteractionHeadlessSteps(input: {
  effects: readonly SceneInteractionOutcomeEffect[]
  damageRollsByEffectId: Readonly<Record<string, readonly number[]>>
}): Dnd5eSceneInteractionOutcomeStep[] {
  return input.effects.flatMap((effect): Dnd5eSceneInteractionOutcomeStep[] => {
    if (effect.kind === 'damage') {
      const rolls = input.damageRollsByEffectId[effect.id] ?? []
      if (
        rolls.length !== effect.count ||
        rolls.some((roll) => !Number.isInteger(roll) || roll < 1 || roll > effect.sides)
      ) {
        throw new Error(`invalid-interaction-damage-rolls:${effect.id}`)
      }
      return [{
        id: effect.id,
        kind: 'damage',
        amount: Math.max(0, rolls.reduce((sum, roll) => sum + roll, 0) + effect.bonus),
        damageType: effect.damageType,
      }]
    }
    if (effect.kind === 'condition') {
      return [{
        id: effect.id,
        kind: 'condition',
        condition: effect.condition,
        duration: effect.duration.type === 'permanent'
          ? { type: 'permanent' }
          : {
              type: 'rounds',
              remainingRounds: effect.duration.rounds,
              tickOn: 'target-turn-end',
            },
      }]
    }
    return []
  })
}

export function dnd5eMapInteractionJournalMutations(input: {
  effects: readonly SceneInteractionOutcomeEffect[]
  journal: SharedRoomJournalState
  triggeringMemberId?: string
  receiptId: string
}): RoomJournalMutation[] {
  const validation = validateDnd5eMapInteractionOutcomeReferences(input)
  if (!validation.ok) throw new Error(validation.reason)

  return input.effects.flatMap((effect, index): RoomJournalMutation[] => {
    const authorityReceiptId = `${input.receiptId}:effect:${index}:${effect.id}`
    if (effect.kind === 'handout') {
      const source = input.journal.handouts.find((entry) => entry.id === effect.handoutId)!
      return [{
        operation: 'add-handout',
        title: source.title,
        body: source.body,
        audience: effect.audience === 'all' ? 'all' : [input.triggeringMemberId!],
        imageId: source.imageId,
        imageMimeType: source.imageMimeType,
        imageName: source.imageName,
        authorityReceiptId,
      }]
    }
    if (effect.kind === 'task' && effect.operation === 'add') {
      return [{
        operation: 'add-shared-note',
        kind: 'task',
        title: effect.title,
        body: effect.body,
        authorityReceiptId,
      }]
    }
    if (effect.kind === 'task' && effect.operation === 'complete') {
      return [{
        operation: 'update-shared-note',
        id: effect.taskId!,
        status: 'done',
        authorityReceiptId,
      }]
    }
    return []
  })
}

/**
 * Prepares every authoritative side effect before any Store is mutated. The
 * caller may then execute one Headless result, one inventory grant bundle and
 * the idempotent journal mutations under the same interaction receipt.
 */
export function prepareDnd5eMapInteractionOutcomeTransaction(input: {
  effects: readonly SceneInteractionOutcomeEffect[]
  damageRollsByEffectId: Readonly<Record<string, readonly number[]>>
  journal: SharedRoomJournalState
  triggeringMemberId?: string
  receiptId: string
}): {
  ok: true
  transaction: {
    receiptId: string
    headlessSteps: Dnd5eSceneInteractionOutcomeStep[]
    currencyGrants: Dnd5eInventoryCurrencyGrant[]
    journalMutations: RoomJournalMutation[]
  }
} | {
  ok: false
  reason: Dnd5eMapInteractionOutcomeTransactionFailure
} {
  const references = validateDnd5eMapInteractionOutcomeReferences(input)
  if (!references.ok) return references
  try {
    return {
      ok: true,
      transaction: {
        receiptId: input.receiptId,
        headlessSteps: dnd5eMapInteractionHeadlessSteps(input),
        currencyGrants: dnd5eMapInteractionCurrencyGrants(input.effects),
        journalMutations: dnd5eMapInteractionJournalMutations(input),
      },
    }
  } catch {
    return { ok: false, reason: 'invalid-interaction-outcome' }
  }
}
