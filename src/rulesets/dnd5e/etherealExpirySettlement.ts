import type { BattleMap } from '../../store/maps'
import type { Character } from '../../types/character'
import type { MapGeometryState } from '../../lib/mapGeometry'
import { dnd5eActivePlanarPhase } from './activeEffects'
import { settleDnd5eEtherealReturns } from './etherealReturnSettlement'
import { planDnd5eMapResultApplication } from './mapBridge'
import { replayDnd5eSolidExitFeatherFallChoices, type Dnd5eSolidExitFeatherFallChoice } from './solidMaterialExitSettlement'
import { previewDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange,
  resolveDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange, type Dnd5eHeadlessCombatState } from './headlessCombatEngine'

/** Expiry, ejection and falling are one provisional result until the Host commits it. */
export function resolveDnd5eEtherealExpiry(input: {
  before: Dnd5eHeadlessCombatState
  after: Dnd5eHeadlessCombatState
  map: BattleMap
  geometry: MapGeometryState
  characters: readonly Character[]
  characterIdByCombatantId: Readonly<Record<string, string>>
  choices?: readonly Dnd5eSolidExitFeatherFallChoice[]
  rolls?: Readonly<Record<string, readonly number[]>>
}) {
  const ids = Object.values(input.before.combatants).filter(actor =>
    dnd5eActivePlanarPhase(actor.classState.activeEffects).plane === 'ethereal' &&
    input.after.combatants[actor.id] &&
    dnd5eActivePlanarPhase(input.after.combatants[actor.id].classState.activeEffects).plane === 'material').map(actor => actor.id)
  const returned = settleDnd5eEtherealReturns({
    before: input.before, result: { ok: true, state: input.after, events: [] },
    map: input.map, geometry: input.geometry,
  })
  if (!returned.ok) return { ok: false as const, reason: returned.reason }
  const reactions = replayDnd5eSolidExitFeatherFallChoices(input.before, returned.state, ids, input.choices)
  if (!reactions.ok) return { ok: false as const, reason: 'invalid-reaction' }
  const falls = previewDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange(input.before, reactions.state, ids)
  const landed = resolveDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange(input.before, reactions.state, input.rolls, ids)
  if (!landed.ok) return { ok: false as const, reason: landed.reason, falls, reactionState: reactions.state }
  const events = [...returned.events, ...reactions.events, ...landed.events]
  return { ok: true as const, state: landed.state, events,
    application: planDnd5eMapResultApplication({ state: landed.state, map: input.map, geometry: input.geometry,
      characters: input.characters, characterIdByCombatantId: input.characterIdByCombatantId, events }) }
}
