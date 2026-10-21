import type { Character } from '../../types/character'
import { getDnd5eSrdMonster } from './monsters'

/** UI selection hint only. Preparation and Host settlement revalidate the receipt. */
export function dnd5eCreatureFormAttackSelection(character: Character | undefined, actionIndex: number, turnKey: string | undefined) {
  const formId = character?.dnd5eCombatState?.wildShapeFormId
  const monster = formId ? getDnd5eSrdMonster(formId) : undefined
  const requested = monster?.actions[actionIndex]
  const receipt = character?.dnd5eCombatState?.monsterMultiattackContinuation
  if (!monster || !requested || !receipt || !turnKey || receipt.turnKey !== turnKey ||
      receipt.schemaVersion !== 1 || requested.id !== receipt.parentActionId || requested.kind !== 'multiattack' ||
      !Number.isInteger(receipt.nextOccurrenceIndex) || receipt.nextOccurrenceIndex < 1 ||
      receipt.nextOccurrenceIndex >= receipt.sequenceActionIds.length) return { actionIndex }
  const nextIndex = monster.actions.findIndex(action => action.id === receipt.sequenceActionIds[receipt.nextOccurrenceIndex] && action.kind === 'weapon-attack')
  if (nextIndex < 0) return { actionIndex }
  return { actionIndex: nextIndex, multiattackContinuation: {
    schemaVersion: 1 as const, parentActionId: receipt.parentActionId, occurrenceIndex: receipt.nextOccurrenceIndex,
  } }
}
