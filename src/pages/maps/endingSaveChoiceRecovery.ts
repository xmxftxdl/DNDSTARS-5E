import {durableD20RollId} from '../../lib/rollConfirmation'
import type {SharedCombatInterrupt} from '../../lib/combatInterruptQueue'
import type {ExistingCombatInterruptDecision} from '../../lib/combatInterruptRequestRuntime'
export function endingSaveChoiceId(transactionId: string | null | undefined, mapId: string, kind: string, targetId: string): string | undefined {
  if (!transactionId) return
  try { if (JSON.parse(transactionId)[0] !== 'effect-end-save') return } catch { return }
  return durableD20RollId({mapId,sourceMode:'end-save-choice',transactionId:JSON.stringify([transactionId,kind,targetId]),occurrenceIndex:0})
}
export function restoreEndingSaveChoice(existing: SharedCombatInterrupt | undefined, expected: {id:string;mapId:string;kind:string;targetId:string;responseKey:string}): ExistingCombatInterruptDecision<boolean> {
  if (!existing) return {type:'publish'}
  if (existing.id !== expected.id || existing.mapId !== expected.mapId || existing.kind !== expected.kind || existing.targetCharId !== expected.targetId) throw Error('ending-save-choice-mismatch')
  if (existing.status === 'rolled-back') throw Error('ending-save-choice-rolled-back')
  if (existing.status === 'answered' || existing.status === 'done') {
    const value = existing.response?.[expected.responseKey]
    if (typeof value !== 'boolean') throw Error('ending-save-choice-response-invalid')
    return {type:'resolve',value}
  }
  return {type:'wait'}
}
