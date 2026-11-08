import { dnd5eCombatantsShareInteractionPlane, type Dnd5eHeadlessCombatState } from './headlessCombatEngine'
import { dnd5eCombatantPairKey } from './headlessCombatPrimitives'
import { dnd5ePluginSpellDefinition } from './pluginApi'
import { getDnd5eSrdCombatSpell } from './spells'
import { dnd5eSpellSchoolIdFromLabel } from './subclassSpellcasting'
import { dnd5eCombatantSensoryDeceptionObservation } from './sensoryDeceptionObservations'
import { dnd5eSensoryDeceptionPresence } from './sensoryDeceptionPresence'
import { validSceneSensoryDeceptionSurvey } from '../../lib/sceneSensoryDeceptionSurvey'
import { dnd5eActivePlanarPhase } from './activeEffects'

export interface Dnd5eSensoryDeceptionReceipt {
  sourceActivityId: string
  round: number
  present: boolean
  mapId?: string
}

function school(rulesId: string): string | undefined {
  // Preserve qualified plugin identity; never strip a package to match an unrelated spell.
  const plugin = dnd5ePluginSpellDefinition(rulesId)
  if (plugin?.school) return plugin.school
  const core = getDnd5eSrdCombatSpell(rulesId.replace(/^spell:/, ''))
  return core?.school ? dnd5eSpellSchoolIdFromLabel(core.school) : undefined
}

/** Only called by an authorized Activity transaction; unknown scene coverage refuses the query. */
export function recordDnd5eSensoryDeceptionReport(state: Dnd5eHeadlessCombatState,
  actorId: string, sourceActivityId: string, rangeFeet: number): boolean {
  const actor = state.combatants[actorId]
  if (!actor || rangeFeet !== 30 || !sourceActivityId) return false
  const observations = Object.values(state.combatants).map(target =>
    dnd5eCombatantSensoryDeceptionObservation({ target,
      distanceFeet: actor.id === target.id ? 0 : state.distanceFeetByCombatantPair?.[dnd5eCombatantPairKey(actor.id,target.id)],
      samePlane: dnd5eCombatantsShareInteractionPlane(actor,target), spellSchool: school }))
  const scene = state.companionScene
  const scale = scene ? (scene.map.feetPerCell ?? 5) / scene.map.gridSize : NaN
  const surveys = scene && scene.map.id === state.mapId && dnd5eActivePlanarPhase(actor.classState.activeEffects).plane !== 'ethereal'
    ? (scene.interactionScenes ?? []).filter(s => s.mapId === state.mapId)
      .map(s => s.sensoryDeceptionSurvey).filter(validSceneSensoryDeceptionSurvey) : []
  const validScale = scale != null && Number.isFinite(scale) && scale > 0
  const covered = validScale && surveys.some(survey => Math.hypot(
    (actor.position.x-survey.centerX)*scale, (actor.position.y-survey.centerY)*scale,
    (actor.elevationFeet ?? 0)-survey.elevationFeet) + 30 <= survey.radiusFeet)
  const surveyedObservations = []
  if(validScale) for(const survey of surveys) for(const point of survey.presences) {
    const dx=Math.abs((survey.centerX-actor.position.x)*scale+point.eastFeet)
    const dy=Math.abs((survey.centerY-actor.position.y)*scale-point.northFeet)
    const dz=Math.abs(point.elevationFeet-(actor.elevationFeet ?? 0))
    const half=point.halfExtentsFeet
    const distance=half ? Math.hypot(Math.max(0,dx-half.east),Math.max(0,dy-half.north),Math.max(0,dz-half.height))
      : Math.max(0,Math.hypot(dx,dy,dz)-(point.radiusFeet ?? 0))
    surveyedObservations.push({distanceFeet:distance,samePlane:true,sensoryDeceivingMagic:true})
  }
  // A survey is an explicit DM declaration of all deceptive phenomena, including
  // mapped and off-map ones. Mere map loading or unresolved magic never proves absence.
  // Live positive evidence always wins; a complete authoritative survey resolves
  // otherwise unknown classification instead of guessing from a spell's name.
  const live = dnd5eSensoryDeceptionPresence({conditions:actor.conditions,observations,sceneComplete:false})
  const report = live.status==='blocked' || live.status==='resolved' ? live
    : dnd5eSensoryDeceptionPresence({conditions:actor.conditions,observations:surveyedObservations,sceneComplete:covered})
  if (report.status !== 'resolved') return false
  actor.classState.sensoryDeceptionReports = {...actor.classState.sensoryDeceptionReports,
    [sourceActivityId]: {sourceActivityId,round:state.round,present:report.present,mapId:state.mapId}}
  return true
}
