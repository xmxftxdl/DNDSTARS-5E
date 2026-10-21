import { getDnd5eSrdMonster } from './monsters'
import type { Dnd5eHeadlessCombatState } from './headlessCombatEngine'
import { dnd5eActivityActorSnapshotFromCombatantV1 } from './activities/dnd5eActivityCombatAuthority'
import { resolveDnd5eActivity, type Dnd5eActivityExecutionInput } from './activities/dnd5eActivityExecutor'
import { dnd5eSrdAuditedSpellActivityV1 } from './activities/dnd5eSrdAuditedSpellActivities'
import type { Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts'

/** Effect planning only. The enclosing monster spell transaction owns authorization,
 * spell uses, action economy, counterspells and the atomic commit. This is not a cast API.
 */
export function resolveDnd5eMonsterAuditedSpellEffects(input: {
  state: Dnd5eHeadlessCombatState
  actorId: string
  spellId: 'detect-magic' | 'confusion'
  targetIds: readonly string[]
  castLevel: number
  rolls: Dnd5eActivityExecutionInput['rolls']
  checkRollModes?: Dnd5eActivityExecutionInput['checkRollModes']
  areaPlacement?: Dnd5eActivityExecutionInput['areaPlacement']
  areaPlacementDistanceFeet?: number
  /** Internal effect phase: targets already failed the enclosing monster transaction's saves. */
  confusionSavesAlreadyResolved?: true
}) {
  const actor = input.state.combatants[input.actorId]
  const monster = actor?.statBlockId ? getDnd5eSrdMonster(actor.statBlockId) : undefined
  const listed = monster?.spellcasting?.spells?.find(spell => spell.id === input.spellId)
  const definition = dnd5eSrdAuditedSpellActivityV1(input.spellId)
  if (!actor || !listed || !definition || !Number.isInteger(input.castLevel) ||
      input.castLevel < listed.level || input.castLevel > 9 ||
      new Set(input.targetIds).size !== input.targetIds.length ||
      input.targetIds.some(id => !input.state.combatants[id]) ||
      (input.spellId === 'detect-magic' && (input.targetIds.length !== 1 || input.targetIds[0] !== actor.id))) return undefined
  // The monster transaction has already paid its costs. Never fabricate class slots.
  const activity: Dnd5eActivityDefinitionV1 = { ...definition, consumption: [] }
  if(input.confusionSavesAlreadyResolved){
    if(input.spellId!=='confusion')return undefined
    activity.target={kind:'creature',relation:'any',count:256,minimumCount:0,includeSelf:true}
    activity.checks=[]
    activity.scaling=[]
    activity.outcomes=[{id:'resolved-failed-saves',when:{kind:'always'},operations:[{id:'apply-concrete-effect',kind:'apply-effect',target:'target',effectId:'confusion'}]}]
  }
  const snapshot = dnd5eActivityActorSnapshotFromCombatantV1(actor)
  snapshot.spellSaveDc = monster!.spellcasting!.saveDc
  return {
    activity,
    resolution: resolveDnd5eActivity({
      activity, actor: snapshot,
      targets: input.targetIds.map(id => dnd5eActivityActorSnapshotFromCombatantV1(input.state.combatants[id])),
      castLevel: input.castLevel, rolls: input.rolls,
      checkRollModes: input.checkRollModes, areaPlacement: input.areaPlacement,
      areaPlacementDistanceFeet: input.areaPlacementDistanceFeet,
      distanceFeetByTargetId: input.spellId === 'detect-magic' ? { [actor.id]: 0 } : undefined,
    }),
  }
}
