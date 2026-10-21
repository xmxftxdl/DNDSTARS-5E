import { resolveDnd5eHeadlessAction, type Dnd5eAction, type Dnd5eActionResult, type Dnd5eHeadlessCombatState } from './headlessCombatEngine'
import { withDnd5eDeathSaveCheckpoint, type Dnd5eDeathSaveCheckpoint } from './deathSaveCheckpoint'

type DeathSaveAction = Extract<Dnd5eAction, {type:'death-save'|'death-save-turn'}>
type SessionResult =
  | {status:'pending';checkpoint:Dnd5eDeathSaveCheckpoint}
  | {status:'resolved';result:Dnd5eActionResult}
  | {status:'rejected';reason:'stale-state'|'stale-checkpoint'|'session-ended'|'invalid-replacement'}
class PendingDeathSave extends Error {}

/** Host transaction foundation. Registered Activity selection and room UI must
 * be connected before any imported death-save replacement can be certified.
 * The trusted resolver must independently validate ownership, costs and effects.
 */
export function createDnd5eDeathSaveSession<Selection>(
  source:Dnd5eHeadlessCombatState,
  action:DeathSaveAction,
  shouldPause:(checkpoint:Dnd5eDeathSaveCheckpoint,snapshot:Dnd5eHeadlessCombatState)=>boolean,
  resolveReplacement:(snapshot:Dnd5eHeadlessCombatState,selection:Selection)=>Dnd5eActionResult,
) {
  const baseline=structuredClone(source), command=structuredClone(action), signature=JSON.stringify(baseline)
  let ended=false
  let pending:{checkpoint:Dnd5eDeathSaveCheckpoint;snapshot:Dnd5eHeadlessCombatState}|undefined
  let decision:{kind:'decline'}|{kind:'replace';selection:Selection}|undefined
  const run=(current:Dnd5eHeadlessCombatState):SessionResult=>{
    if(ended)return {status:'rejected',reason:'session-ended'}
    if(JSON.stringify(current)!==signature){ended=true;return {status:'rejected',reason:'stale-state'}}
    try{
      const result=withDnd5eDeathSaveCheckpoint((checkpoint,snapshot)=>{
        if(decision?.kind==='decline')return
        if(decision?.kind==='replace'){
          if(!pending||JSON.stringify(checkpoint)!==JSON.stringify(pending.checkpoint))throw Error('changed death-save checkpoint')
          const resolved=resolveReplacement(structuredClone(snapshot),structuredClone(decision.selection))
          // The replacement cannot move to another turn or another combat.
          if(resolved.state.combatId!==snapshot.combatId||resolved.state.round!==snapshot.round||
            resolved.state.initiativeIndex!==snapshot.initiativeIndex||!resolved.state.combatants[checkpoint.actorId])throw Error('invalid death-save replacement')
          return resolved.ok?resolved:{...resolved,state:structuredClone(baseline),events:[]}
        }
        const authority=structuredClone(snapshot)
        if(shouldPause({...checkpoint},snapshot)){
          pending={checkpoint:{...checkpoint},snapshot:authority}
          throw new PendingDeathSave()
        }
      },()=>resolveDnd5eHeadlessAction(baseline,command))
      ended=true
      return {status:'resolved',result}
    }catch(error){
      if(error instanceof PendingDeathSave && pending)return {status:'pending',checkpoint:{...pending.checkpoint}}
      ended=true
      return {status:'rejected',reason:'invalid-replacement'}
    }
  }
  const choose=(current:Dnd5eHeadlessCombatState,checkpoint:Dnd5eDeathSaveCheckpoint,next:NonNullable<typeof decision>):SessionResult=>{
    if(ended)return {status:'rejected',reason:'session-ended'}
    if(!pending||JSON.stringify(checkpoint)!==JSON.stringify(pending.checkpoint))return {status:'rejected',reason:'stale-checkpoint'}
    decision=next
    return run(current)
  }
  return {run,cancel:()=>{ended=true;pending=undefined;decision=undefined},decline:(current:Dnd5eHeadlessCombatState,checkpoint:Dnd5eDeathSaveCheckpoint)=>choose(current,checkpoint,{kind:'decline'}),
    accept:(current:Dnd5eHeadlessCombatState,checkpoint:Dnd5eDeathSaveCheckpoint,selection:Selection)=>choose(current,checkpoint,{kind:'replace',selection:structuredClone(selection)})}
}
