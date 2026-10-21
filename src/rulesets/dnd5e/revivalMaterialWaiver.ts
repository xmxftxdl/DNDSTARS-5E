import type { Character } from '../../types/character'
import type { BattleMap } from '../../store/maps'
import type { Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts'
import { dnd5eCharacterHasRevivalMaterialWaiver } from './pluginApi'

/** Fail closed for mixed-purpose spells, alternate outcomes and unverified targets. */
export function dnd5eRevivalMaterialWaived(input: {
  activity?: Dnd5eActivityDefinitionV1
  targetIds: readonly string[]
  map: BattleMap
  characters: readonly Character[]
}): boolean {
  const activity = input.activity
  if (!activity || activity.target.kind !== 'creature' || !input.targetIds.length) return false
  const operations = activity.outcomes.flatMap(outcome => outcome.operations)
  if (!operations.length || operations.some(operation => operation.kind !== 'revive' || operation.target !== 'target')) return false
  return input.targetIds.every(id => {
    const token = input.map.tokens.find(candidate => candidate.id === id)
    const character = token?.characterId ? input.characters.find(candidate => candidate.id === token.characterId) : undefined
    return !!character && dnd5eCharacterHasRevivalMaterialWaiver(character)
  })
}
