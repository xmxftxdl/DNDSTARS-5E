import type{Dnd5eHeadlessCombatState,Dnd5eCombatEvent}from'./headlessCombatEngine'
import type{Dnd5ePreparedSpellAttackWindow}from'./spellAction'
import{readDnd5eActiveParentEffectClock}from'./activeEffects'
const ordered=(value:unknown):unknown=>Array.isArray(value)?value.map(ordered):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([key,next])=>[key,ordered(next)])):value
const signature=(value:unknown)=>JSON.stringify(ordered(value))
type Retarget={parentId:string;spellId:string;actorId:string;failedTargetId:string;originalTargetId:string;attackIndex:number;clock:number;prefix:string;current:()=>void}
const originals=new WeakMap<object,Retarget>()
const consumedNativeStates=new WeakMap<object,readonly object[]>()
/** Pure mechanical issuer, not an actor answer or Room permission. The sole
 * supported destination is this occurrence's already prepared original target.
 * A new creature or another Ward needs its own true Native continuation. */
export async function prepareDnd5eSpellWardOriginalTargetRetarget(frame:Dnd5ePreparedSpellAttackWindow){
 const spell=await import('./spellAction'),engine=await import('./headlessCombatEngine'),view=spell.readCapturedDnd5ePreparedSpellAttackWindow(frame)
 if(view.stage!=='ward-result'||view.wardAllowed!==false||!view.wardTargetId||view.raw||view.originalTargetId===view.wardTargetId)throw Error('spell-ward-retarget:actual-failed-redirected-window-required')
 const actor=view.state.combatants[view.prepared.actorToken.id],target=view.state.combatants[view.originalTargetId],initialActor=view.prepared.state.combatants[actor?.id],initialTarget=view.prepared.state.combatants[view.originalTargetId]
 if(!actor||!target||!initialActor||!initialTarget||target.currentHp<=0||target.conditions.includes('dead')||signature([actor.position,actor.elevationFeet,target.position,target.elevationFeet])!==signature([initialActor.position,initialActor.elevationFeet,initialTarget.position,initialTarget.elevationFeet])||engine.dnd5eCannotAttackSource(actor,target.id)||engine.dnd5eAttackAttemptWardRequirements(view.state,actor.id,target.id).length)throw Error('spell-ward-retarget:unchanged-unwarded-original-target-required')
 const prefix=signature([view.state,view.events]),cap=Object.freeze({})
 originals.set(cap,{parentId:view.parentId,spellId:view.prepared.spell.id,actorId:actor.id,failedTargetId:view.wardTargetId,originalTargetId:view.originalTargetId,attackIndex:view.attackIndex,clock:view.now,prefix,current:()=>{const next=spell.readCapturedDnd5ePreparedSpellAttackWindow(frame);if(signature([next.state,next.events])!==prefix)throw Error('spell-ward-retarget:unchanged-failed-frame-required')}})
 return cap
}
type Scope={values:readonly object[];used:Set<object>;failure?:Error}
let active:Scope|undefined
export function withDnd5eSpellWardOriginalTargetRetarget<T>(values:readonly object[],run:()=>T):T{
 values=[...values];if(run.constructor.name==='AsyncFunction'||new Set(values).size!==values.length)throw Error('spell-ward-retarget:unique-sync-scope-required')
 const keys=new Set<string>();for(const cap of values){const row=originals.get(cap);if(!row)throw Error('spell-ward-retarget:actual-failed-original-required');row.current();const key=signature([row.parentId,row.attackIndex]);if(keys.has(key))throw Error('spell-ward-retarget:unique-native-window-required');keys.add(key)}
 const previous=active,scope:Scope={values,used:new Set()};active=scope
 try{const result=run();if(result&&typeof result==='object'&&'then'in result&&typeof result.then==='function')throw Error('spell-ward-retarget:sync-scope-required');if(scope.failure)throw scope.failure;if(scope.used.size!==values.length)throw Error('spell-ward-retarget:unvisited-original-required');return result}finally{active=previous}
}
/** Internal actual failed-Ward seam. It neither substitutes a state/result nor
 * reads caller target data. The original supplied redirect/saving still runs. */
export function applyDnd5eSpellWardOriginalTargetRetarget(input:{state:Dnd5eHeadlessCombatState;events:Dnd5eCombatEvent[];parentId:string|undefined;spellId:string;actorId:string;failedTargetId:string;originalTargetId:string;attackIndex:number}):string|undefined{
 const scope=active;if(!scope)return
 const cap=scope.values.find(value=>{const row=originals.get(value)!;return row.parentId===input.parentId&&row.attackIndex===input.attackIndex});if(!cap)return
 const row=originals.get(cap)!,clock=readDnd5eActiveParentEffectClock();row.current()
 if(scope.used.has(cap)||!clock||clock.parentId!==row.parentId||clock.timestamp!==row.clock||input.spellId!==row.spellId||input.actorId!==row.actorId||input.failedTargetId!==row.failedTargetId||input.originalTargetId!==row.originalTargetId||signature([input.state,input.events])!==row.prefix){const error=Error('spell-ward-retarget:exact-current-failed-prefix-required');scope.failure=error;throw error}
 scope.used.add(cap);consumedNativeStates.set(input.state,Object.freeze([...(consumedNativeStates.get(input.state)??[]),cap]));return row.originalTargetId
}
/** Only a mechanical consumption witness. A Room consumer must still check
 * the unchanged actual concrete facade and its authenticated parent choice. */
export function readDnd5eSpellWardOriginalTargetRetargetState(state:object){const caps=consumedNativeStates.get(state);if(!caps?.length)throw Error('spell-ward-retarget:actual-native-consumption-required');for(const cap of caps){const row=originals.get(cap);if(!row)throw Error('spell-ward-retarget:actual-failed-original-required');row.current()}return Object.freeze([...caps])}

/** Read only the private original frame's continued identity/signature. It
 * issues no cap, copied state, completion or Room/world authorization. */
export function assertDnd5eSpellWardOriginalTargetRetargetCurrent(cap:object){const row=originals.get(cap);if(!row)throw Error('spell-ward-retarget:actual-failed-original-required');row.current()}
