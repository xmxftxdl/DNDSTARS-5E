import type { Character } from '../../types/character'
import type { BattleMap } from '../../store/maps'
import { createDnd5eMapCombatSnapshot, planDnd5eMapResultApplication } from './mapBridge'
import { reconcileDnd5eSourceLinkedRelations } from './headlessCombatEngine'

/** Restore source-bound forms after the authoritative exploration clock expires concentration. */
export function reconcileDnd5eCampaignForms(map: BattleMap, characters: readonly Character[], roomMaps: readonly BattleMap[] = [map]) {
  const sourceIds = new Set<string>()
  const candidates = map.tokens.filter(token => {
    const state = token.characterId
      ? characters.find(character => character.id === token.characterId)?.dnd5eCombatState
      : token.dnd5eCombatState
    const eligible = state?.wildShapeFormId && state.wildShapeMode !== 'wild-shape' &&
      !state.wildShapePermanent && !state.wildShapePermanentAfterConcentrationCompletes &&
      state.wildShapeRequiresConcentration !== false &&
      state.wildShapeSourceActorId
    if (!eligible) return false
    const sources = roomMaps.flatMap(candidate => candidate.tokens.filter(source => source.id === state.wildShapeSourceActorId))
    if (sources.length !== 1) return false
    sourceIds.add(state.wildShapeSourceActorId!)
    return true
  })
  if (!candidates.length) return { map, characters }
  const snapshot = createDnd5eMapCombatSnapshot({
    combatId: `campaign-forms:${map.id}`, map, characters, initiativeOrder: [],
    additionalCreatureTokenIds: map.tokens.filter(token => token.type !== 'obstacle').map(token => token.id),
  })
  for (const sourceId of sourceIds) {
    if (snapshot.state.combatants[sourceId]) continue
    const sourceMap = roomMaps.find(candidate => candidate.tokens.some(token => token.id === sourceId))
    if (!sourceMap) continue
    const sourceSnapshot = createDnd5eMapCombatSnapshot({ combatId: `campaign-forms-source:${sourceMap.id}`,
      map: sourceMap, characters, initiativeOrder: [], additionalCreatureTokenIds: [sourceId] })
    const source = sourceSnapshot.state.combatants[sourceId]
    if (source) snapshot.state.combatants[sourceId] = source
  }
  reconcileDnd5eSourceLinkedRelations(snapshot.state)
  const ended = candidates.filter(token => snapshot.state.combatants[token.id] &&
    !snapshot.state.combatants[token.id].classState.wildShapeFormId)
  if (!ended.length) return { map, characters }
  // External sources are read-only lifecycle evidence, never entities to publish on this map.
  for (const id of Object.keys(snapshot.state.combatants)) {
    if (!map.tokens.some(token => token.id === id)) delete snapshot.state.combatants[id]
  }
  const plan = planDnd5eMapResultApplication({ ...snapshot, map, characters })
  const tokenIds = new Set(ended.map(token => token.id))
  const characterIds = new Set(ended.flatMap(token => token.characterId ? [token.characterId] : []))
  return {
    map: { ...map, tokens: map.tokens.map(token => tokenIds.has(token.id)
      ? plan.map.tokens.find(projected => projected.id === token.id) ?? token : token) },
    characters: characters.map(character => characterIds.has(character.id)
      ? plan.characters.find(projected => projected.id === character.id) ?? character : character),
  }
}
