import { dnd5eHeadlessTurnKey, type Dnd5eHeadlessCombatState, type Dnd5eActionResult } from './headlessCombatEngine'
import { dnd5eDeathSaveTurnAvailable } from './deathSaveTurn'
import { withDnd5eDeathSaveActivityAuthority } from './deathSaveCheckpoint'
import { getRegisteredDnd5eActivity, listRegisteredDnd5eActivityPackages } from './activities/dnd5eActivityRegistry'
import { createDnd5eDeathSaveSession } from './deathSaveSession'
import type { Dnd5eDeathSaveCheckpoint } from './deathSaveCheckpoint'
import { resolveRegisteredDnd5eActivityInCombatV1, type Dnd5eRegisteredActivityCombatAuthorityInputV1 } from './activities/dnd5eActivityCombatAuthority'
import type { Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts'
import { dnd5eCombatantEntitledToActivityV1 } from './activities/dnd5eActivityEntitlements'

export interface Dnd5eDeathSaveActivityCandidate {
  packageId:string
  packageVersion:string
  activity:Dnd5eActivityDefinitionV1
}

/** Host discovery only; costs, choices, targets and dice are rechecked at commit. */
export function listDnd5eDeathSaveActivityCandidates(state:Dnd5eHeadlessCombatState,actorId:string):Dnd5eDeathSaveActivityCandidate[] {
  const actor=state.combatants[actorId]
  if(!state.active || !actor || state.initiativeOrder[state.initiativeIndex]!==actorId ||
    actor.currentHp!==0 || actor.deathSaves.dead || actor.deathSaves.stable)return []
  const turnKey=dnd5eHeadlessTurnKey(state,actorId)
  if(actor.classState.turnStartResolvedTurnKey===turnKey && !dnd5eDeathSaveTurnAvailable(actor.classState.deathSaveTurn,turnKey))return []
  return listRegisteredDnd5eActivityPackages().flatMap(pack=>pack.activities
    .filter(activity=>dnd5eDeathSaveActivitySupported(activity) &&
      dnd5eCombatantEntitledToActivityV1({packageId:pack.packageId,activity,combatant:actor}))
    .map(activity=>({packageId:pack.packageId,packageVersion:pack.packageVersion,activity:structuredClone(activity)})))
}

export type Dnd5eDeathSaveActivitySelection = Pick<Dnd5eRegisteredActivityCombatAuthorityInputV1,
  'command'|'combatRevision'|'authoritativeRolls'|'checkRollModes'|'confirmedBy'>

export function createDnd5eRegisteredDeathSaveSession(
  state:Dnd5eHeadlessCombatState,action:Parameters<typeof createDnd5eDeathSaveSession>[1],
  shouldPause:(checkpoint:Dnd5eDeathSaveCheckpoint,snapshot:Dnd5eHeadlessCombatState,candidates:readonly Dnd5eDeathSaveActivityCandidate[])=>boolean = (_checkpoint,_snapshot,candidates)=>candidates.length>0,
) {
  const signature=JSON.stringify(listRegisteredDnd5eActivityPackages())
  return createDnd5eDeathSaveSession<Dnd5eDeathSaveActivitySelection>(state,action,(checkpoint,snapshot)=>
    shouldPause(checkpoint,snapshot,listDnd5eDeathSaveActivityCandidates(snapshot,checkpoint.actorId)),(snapshot,selection)=>{
    if(JSON.stringify(listRegisteredDnd5eActivityPackages())!==signature)return {ok:false,state:snapshot,events:[],reason:'invalid-plugin-action'}
    return resolveDnd5eDeathSaveActivity(snapshot,selection)
  })
}

/** Closed in-state recovery profile; inventory, movement and summons need their
 * own atomic adapters and are intentionally not discarded by this resolver. */
export function dnd5eDeathSaveActivitySupported(activity:Dnd5eActivityDefinitionV1):boolean {
  const effectKeys=new Set(['schemaVersion','id','name','disposition','duration','stacking','conditions','modifiers'])
  return activity.activation.kind==='free' && activity.invocation?.kind==='triggered' &&
    activity.invocation.event==='before-death-save' && activity.invocation.confirmation==='actor-choice' &&
    ['feature','feat','subclass-ability'].includes(activity.legacySource?.kind??'') && !activity.authorityBinding &&
    (activity.consumption??[]).every(cost=>cost.kind==='resource') &&
    activity.outcomes.some(outcome=>outcome.when.kind==='always' && outcome.operations.some(operation=>operation.kind==='healing'&&operation.target==='actor')) &&
    activity.outcomes.every(outcome=>outcome.operations.every(operation=>
      operation.kind==='healing'&&operation.target==='actor' ||
      operation.kind==='remove-standard-condition'&&operation.target==='actor'&&operation.condition==='prone' ||
      operation.kind==='damage' || operation.kind==='apply-effect')) &&
    (activity.effects??[]).every(effect=>Object.keys(effect).every(key=>effectKeys.has(key)) && !(effect.modifiers?.length))
}

/** Called only inside the live death-save session, with Host-owned dice and
 * revision. A forged trigger context cannot create this scoped permission. */
export function resolveDnd5eDeathSaveActivity(
  state:Dnd5eHeadlessCombatState,selection:Dnd5eDeathSaveActivitySelection,expectedDefinitionSignature?:string,
):Dnd5eActionResult {
  const fail=():Dnd5eActionResult=>({ok:false,state:structuredClone(state),events:[],reason:'invalid-plugin-action'})
  const {command}=selection
  const activity=getRegisteredDnd5eActivity(command.packageId,command.activityId)
  if(!activity || !dnd5eDeathSaveActivitySupported(activity) ||
    (expectedDefinitionSignature!=null&&JSON.stringify(activity)!==expectedDefinitionSignature))return fail()
  try {
    const result=withDnd5eDeathSaveActivityAuthority({actorId:command.actorId,packageId:command.packageId,activityId:command.activityId},()=>
      resolveRegisteredDnd5eActivityInCombatV1({...selection,state,triggerContext:{
        event:'before-death-save',eventId:`death-save:${state.combatId}:${state.round}:${state.initiativeIndex}:${command.actorId}`,
        eligibleActorIds:[command.actorId],eligibleTargetIds:Object.keys(state.combatants),
        source:{kind:'combat',id:'death-save'},
      }}))
    return result.phase==='commit' ? result.result : fail()
  }catch{return fail()}
}
