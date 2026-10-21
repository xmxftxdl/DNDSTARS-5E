import type { Dnd5eSpellTargetingSession } from '../../application/combat/spells/SpellTargetingContracts'
import type { GridCell } from '../../lib/gridCombat'
import type { MapGeometryState } from '../../lib/mapGeometry'
import type { BattleMap } from '../../store/maps'
import { dnd5ePluginSpellDefinition } from '../../rulesets/dnd5e/pluginApi'
import { dnd5ePluginSpellActivity } from '../../rulesets/dnd5e/pluginSpellTransaction'
import { planDnd5eMapObjectFlightAtAnchor } from '../../rulesets/dnd5e/mapObjectFlight'

/** The preview and the Host use the same flight planner. Saves remain unresolved. */
export function objectLaunchTargetingPlan(input: {
  targeting: Dnd5eSpellTargetingSession; map: BattleMap; geometry?: MapGeometryState; anchor: GridCell
}) {
  const operation = dnd5ePluginSpellActivity(dnd5ePluginSpellDefinition(input.targeting.spellId))
    ?.outcomes.flatMap(outcome => outcome.operations).find(operation => operation.kind === 'launch-map-object')
  if (!operation) return undefined
  return planDnd5eMapObjectFlightAtAnchor({ map: input.map, geometry: input.geometry, anchorCell: input.anchor,
    angleDegrees: input.targeting.areaTargetAngleDegrees ?? 0,
    pitchDegrees: input.targeting.objectLaunchPitchDegrees,
    slotLevel: input.targeting.slotLevel, limits: operation.limits })
}
