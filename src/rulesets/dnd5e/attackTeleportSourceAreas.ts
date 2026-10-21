import { endDnd5eConcentration, type Dnd5eCombatEvent, type Dnd5eHeadlessCombatState } from './headlessCombatEngine'
import { planDnd5eMapResultApplication } from './mapBridge'
import { collectDnd5ePersistentAreaTriggersForSourceMove, reconcileDnd5ePluginAreasAfterSourceMove } from './pluginAreas'
import { dnd5ePersistentAreaFlightCapableTokenIds, dnd5ePersistentAreaSizeRanks } from './pluginAreaTransactions'
import type { BattleMap } from '../../store/maps'
import type { Character } from '../../types/character'

/** Stage source-bound areas in the same Host snapshot as teleport arrival. */
export function prepareAttackTeleportSourceAreas(input: {
  state: Dnd5eHeadlessCombatState
  beforeMap: BattleMap
  characters: readonly Character[]
  characterIdByCombatantId: Readonly<Record<string, string>>
  actorId: string
  round: number
  turnKey: string
}) {
  const state = structuredClone(input.state)
  const events: Dnd5eCombatEvent[] = []
  const projected = planDnd5eMapResultApplication({
    state, map: input.beforeMap, characters: input.characters,
    characterIdByCombatantId: input.characterIdByCombatantId, events,
  })
  const source = reconcileDnd5ePluginAreasAfterSourceMove({
    beforeMap: input.beforeMap, afterMap: projected.map, characters: projected.characters,
    round: input.round, sourceTokenId: input.actorId,
  })
  const ended = new Set(source.endedConcentrationTokenIds)
  for (const [tokenId, characterId] of Object.entries(input.characterIdByCombatantId)) {
    if (source.endedConcentrationCharacterIds.includes(characterId)) ended.add(tokenId)
  }
  for (const tokenId of ended) {
    const actor = state.combatants[tokenId]
    if (actor?.classState.concentrationSpellId) endDnd5eConcentration(state, actor, events)
  }
  const final = planDnd5eMapResultApplication({
    state, map: source.map, characters: source.characters,
    characterIdByCombatantId: input.characterIdByCombatantId, events,
  })
  const context = { map: final.map, characters: final.characters, round: input.round }
  const candidates = collectDnd5ePersistentAreaTriggersForSourceMove({
    beforeMap: input.beforeMap, afterMap: final.map, sourceTokenId: input.actorId,
    round: input.round, turnKey: input.turnKey,
    flightCapableTokenIds: dnd5ePersistentAreaFlightCapableTokenIds(context),
    sizeRanksByTokenId: dnd5ePersistentAreaSizeRanks(context),
  })
  return { state, map: final.map, characters: final.characters, events, candidates }
}
