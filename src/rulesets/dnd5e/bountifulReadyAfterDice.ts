import {saveBountifulPhase} from './bountifulPhaseCommit'
import type {BountifulSpellOriginalInput} from './bountifulSpellTargetRaw'
import {inspectBountifulSpellOriginalReadyFrame,readBountifulSpellOriginalReadyFrame,type BountifulReadyParentData} from './bountifulOriginalReadyFrame'
import {readBountifulReadyGenericReplay} from './bountifulReadyGenericReplay'
import {assertBountifulAfterDiceSource,encodeBountifulAfterDiceSource} from './bountifulLuckAfterDice'
import {createDnd5ePreparedDamageCommitSession} from './damageCommitSession'
import {resolvePreparedDnd5eSpellCast} from './spellAction'
import {validateBountifulReadyParents} from '../../../shared/bountiful-ready-parents.mjs'
import type {SharedCombatState,SharedPlayerActionState} from '../../lib/sharedCombatTypes'
import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
type Source=BountifulSpellOriginalInput
type Gateway=Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'>
type Combat=SharedCombatState&{bountifulReadyParents?:Record<string,BountifulReadyParentData>;_sync?:{revision?:number}}
const same=(left:unknown,right:unknown)=>JSON.stringify(left)===JSON.stringify(right)

/** Concrete native late dice only. Unsupported late mechanics fail in the real
 * facade before metadata is journaled; no HP, fee or ACK is published here. */
export async function recordBountifulReadyAfterDice(input:{action:SharedPlayerActionState;frameId:string;source:Source;rollCursor:number;authorityUnchanged:()=>boolean},gateway:Gateway){
 const frame=await readBountifulSpellOriginalReadyFrame({mapId:input.action.mapId,id:input.frameId},gateway),facts=await inspectBountifulSpellOriginalReadyFrame(frame,gateway),current=await readBountifulReadyGenericReplay({mapId:input.action.mapId,frameId:input.frameId},gateway)
 if(!same(facts.parent,input.action)||!input.authorityUnchanged()||!Number.isSafeInteger(input.rollCursor)||input.rollCursor<0||input.rollCursor>100000)throw Error('bountiful-ready-after-dice:actual-parent-required')
 const {hostOriginalD20Replay:oldReplay,...original}=current.source,{hostOriginalD20Replay:nextReplay,...next}=input.source
 if(nextReplay!==undefined&&!same(nextReplay,oldReplay)&&!same(nextReplay,current.binding))throw Error('bountiful-ready-after-dice:foreign-replay')
 assertBountifulAfterDiceSource('spell',original,next)
 const source={...input.source,hostOriginalD20Replay:current.binding},session=createDnd5ePreparedDamageCommitSession(source,resolvePreparedDnd5eSpellCast,()=>false)
 let stage:ReturnType<typeof session.run>;try{stage=session.run(source.prepared.state)}finally{session.cancel()}
 if(stage.status==='rejected'||stage.status==='pending-ally-natural-one'||stage.status==='resolved'&&(!stage.result.result.ok||!stage.result.application))throw Error('bountiful-ready-after-dice:real-continuation-rejected')
 const combat=await gateway.loadResource<Combat>('combat'),saved=combat?.bountifulReadyParents?.[input.frameId]
 if(!combat||!saved||saved.consumed||!validateBountifulReadyParents(combat.bountifulReadyParents))throw Error('bountiful-ready-after-dice:private-frame-required')
 const continuation={source:encodeBountifulAfterDiceSource(input.source),rollCursor:input.rollCursor}
 if(saved.continuation&&same(saved.continuation,continuation))return
 if(saved.continuation&&input.rollCursor<saved.continuation.rollCursor)throw Error('bountiful-ready-after-dice:cursor-regression')
 await inspectBountifulSpellOriginalReadyFrame(frame,gateway)
 const parents={...combat.bountifulReadyParents,[saved.id]:{...saved,continuation}}
 if(!validateBountifulReadyParents(parents)||!input.authorityUnchanged())throw Error('bountiful-ready-after-dice:changed-native-parent')
 const {combat:_combat,...readRevisions}=facts.versions;void _combat
 const result=await saveBountifulPhase(gateway,[{name:'combat',expectedRevision:combat._sync?.revision??0,data:{...combat,bountifulReadyParents:parents}}],{transactionId:'bountiful-ready-after-dice:'+saved.id,readRevisions})
 if(result.status!=='committed')throw Error('bountiful-ready-after-dice:not-committed')
}
