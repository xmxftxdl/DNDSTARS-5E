import { prepareDnd5eTempleDisintegrationTarget } from './templeDisintegration'
import { dnd5eSpellInterrupted } from './spellInterruption'
import { resolvePreparedDnd5eAdjudicatedSpell, type PreparedDnd5eAdjudicatedSpell } from './adjudicatedSpellAction'
import { planDnd5eMapResultApplication, refreshDnd5eMapSpatialRelations } from './mapBridge'
import { replayDnd5eSolidExitFeatherFallChoices, type Dnd5eSolidExitFeatherFallChoice } from './solidMaterialExitSettlement'
import { previewDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange, resolveDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange,
  type Dnd5eSpellcastingSavingThrowRoll, type Dnd5eActionResult, type Dnd5eHeadlessCombatState,
  type Dnd5eUnsupportedAirborneFallPreview } from './headlessCombatEngine'
import type { MapGeometryState } from '../../lib/mapGeometry'
import type { Dnd5eMapResultPlan } from './mapBridge'

type TempleDisintegrationResolution = {
  ok: true; result: Dnd5eActionResult; application: Dnd5eMapResultPlan; geometry: MapGeometryState; destroyedStructureId?: string
  airborneFalls?: undefined; solidExitReactionState?: undefined
} | {
  ok: false; reason: string; result?: undefined; application?: undefined; geometry?: undefined
  airborneFalls?: readonly Dnd5eUnsupportedAirborneFallPreview[]; solidExitReactionState?: Dnd5eHeadlessCombatState
}

/** Host-only atomic plan. The caller must commit application.map/characters and geometry together,
 * after rechecking the request/room snapshot; no store is mutated while dice/reactions are pending. */
export function resolveDnd5eTempleDisintegration(input: {
  prepared: PreparedDnd5eAdjudicatedSpell
  geometry: MapGeometryState
  targetEntityId: string
  targetPosition: { x: number; y: number }
  targetElevationFeet: number
  worldMinute: number
  spellcastingSavingThrows?: readonly Dnd5eSpellcastingSavingThrowRoll[]
  counterspellReaction?: import('./headlessCombatEngine').Dnd5eCounterspellReaction
  sourceActionInterruptionReaction?: import('./headlessCombatEngine').Dnd5eSourceActionInterruptionReaction
  solidExitFeatherFallChoices?: readonly Dnd5eSolidExitFeatherFallChoice[]
  airborneFallDamageRollsByCombatantId?: Readonly<Record<string, readonly number[]>>
}): TempleDisintegrationResolution {
  const { prepared } = input
  const declared = prepared.payload.templeDisintegration
  if (declared && (declared.entityId !== input.targetEntityId || declared.point.x !== input.targetPosition.x ||
    declared.point.y !== input.targetPosition.y || declared.point.elevationFeet !== input.targetElevationFeet)) {
    return { ok: false as const, reason: 'temple-disintegration-target-mismatch' }
  }
  if (prepared.spell.id !== 'disintegrate' || prepared.spell.level !== 6 || prepared.ritual || prepared.castingTime !== 'action') {
    return { ok: false as const, reason: 'temple-disintegration-invalid-spell' }
  }
  const target = prepareDnd5eTempleDisintegrationTarget({ ...input, map: prepared.map,
    actorTokenId: prepared.actorToken.id, characters: prepared.characters, rangeFeet: 60 })
  if (!target.ok) return target
  // Reuse the validated spell's deterministic costs, including its action.
  // This mapped object branch must not inherit the voice-narrative slot-only mode.
  const cast = resolvePreparedDnd5eAdjudicatedSpell({
    prepared: { ...prepared, payload: { ...prepared.payload, narrativeOnly: undefined, templeDisintegration: undefined } },
    response: { decision: 'approved', effects: [] },
    worldMinute: input.worldMinute, spellcastingSavingThrows: input.spellcastingSavingThrows,
    counterspellReaction: input.counterspellReaction,
    sourceActionInterruptionReaction: input.sourceActionInterruptionReaction,
  })
  if (!cast.result.ok || !cast.application) return { ok: false as const,
    reason: cast.result.ok ? 'temple-disintegration-application-missing' : cast.result.reason }
  if (cast.result.events.some(event => event.type === 'spellcasting-prevented') ||
    dnd5eSpellInterrupted(cast.result.events, prepared.actorToken.id, prepared.spell.id)) {
    return { ok: true as const, result: cast.result, application: cast.application, geometry: input.geometry }
  }
  const before = cast.result.state
  const after = structuredClone(before)
  if (!after.companionScene || after.companionScene.map.id !== prepared.map.id) {
    return { ok: false as const, reason: 'temple-disintegration-scene-missing' }
  }
  after.companionScene = { ...after.companionScene, geometry: target.geometry, worldMinute: input.worldMinute }
  refreshDnd5eMapSpatialRelations(after, cast.application.map, [], { geometry: target.geometry })
  const reactions = replayDnd5eSolidExitFeatherFallChoices(before, after, target.unsupportedTokenIds, input.solidExitFeatherFallChoices)
  if (!reactions.ok) return { ok: false as const, reason: 'invalid-reaction' }
  const falls = previewDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange(before, reactions.state, target.unsupportedTokenIds)
  const landed = resolveDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange(before, reactions.state,
    input.airborneFallDamageRollsByCombatantId, target.unsupportedTokenIds)
  if (!landed.ok) return { ok: false as const, reason: landed.reason, airborneFalls: falls, solidExitReactionState: reactions.state }
  const events = [...cast.result.events, ...reactions.events, ...landed.events]
  const application = planDnd5eMapResultApplication({ state: landed.state, map: cast.application.map,
    geometry: target.geometry, characters: cast.application.characters, baselineCharacters: prepared.characters,
    characterIdByCombatantId: prepared.characterIdByCombatantId, events })
  return { ok: true as const, result: { ...landed, events }, application,
    geometry: target.geometry, destroyedStructureId: target.structureId }
}
