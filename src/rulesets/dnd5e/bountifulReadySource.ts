import {bountifulConfirmedReplayFacts} from './bountifulConfirmedReplay'
import {validateBountifulOriginalParents} from '../../../shared/bountiful-luck-state.mjs'
import {assertBountifulSpellCounterattackAppend} from './bountifulSpellCounterattackSource'
import type {BountifulSpellOriginalInput} from './bountifulSpellTargetRaw'
import {readBountifulSpellOriginalReadyFrame,inspectBountifulSpellOriginalReadyFrame,type BountifulReadyParentData} from './bountifulOriginalReadyFrame'
import {bountifulOriginalRawForActor} from './bountifulSpellTargetRaw'
import {originalD20ReplaySourceKey,type OriginalD20ReplayFacts} from './allyNaturalOneCheckpoint'
import {assertBountifulAfterDiceSource,assertBountifulSpellPostSaveRows} from './bountifulLuckAfterDice'
import {validateBountifulReadyParents} from '../../../shared/bountiful-ready-parents.mjs'
import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import type {SharedPlayerActionState,SharedCombatState} from '../../lib/sharedCombatTypes'
type Source=BountifulSpellOriginalInput
type Gateway=Pick<SharedRoomGatewayPort,'loadResource'>
const same=(left:unknown,right:unknown)=>JSON.stringify(left)===JSON.stringify(right)

/** Rebuild only actual private ready-frame facts. Previously rolled target
 * faces/captures are immutable; a new target is a real prepared native target.
 * No source state or caller-supplied generic ledger becomes authoritative. */
export async function attachBountifulReadySource<T extends Source>(input:{action:SharedPlayerActionState;source:T;allowLateDice?:boolean},gateway:Gateway){
 const combat=await gateway.loadResource<SharedCombatState&{bountifulReadyParents?:Record<string,BountifulReadyParentData>}>('combat')
 const records=Object.values(combat?.bountifulReadyParents??{}).filter(row=>row.parentId===input.action.id&&!row.consumed).sort((a,b)=>(a.request.ordinal??-1)-(b.request.ordinal??-1))
 if(!records.length)return input.source
 if(!validateBountifulReadyParents(combat?.bountifulReadyParents))throw Error('bountiful-ready-source:invalid-private-frames')
 const frames:NonNullable<OriginalD20ReplayFacts['readyFrames']>[number][]=[]
 for(const record of records){
  const frame=await readBountifulSpellOriginalReadyFrame({mapId:input.action.mapId,id:record.id},gateway),facts=await inspectBountifulSpellOriginalReadyFrame(frame,gateway)
  if(!same(facts.parent,input.action)||!same(facts.source.prepared,input.source.prepared))throw Error('bountiful-ready-source:changed-native-prepared-parent')
  bountifulOriginalRawForActor(input.source,facts.request.actorId,facts.request.kind,facts.request.originalRolls)
  assertBountifulSpellCounterattackAppend(facts.source.savingThrowCounterattacks,input.source)
  const comparable=(source:Source)=>({...source,hostOriginalD20Replay:undefined,targetSavingThrows:undefined,hostOriginalSpellSavingThrows:undefined,savingThrowCounterattacks:undefined})
  if(input.allowLateDice)assertBountifulAfterDiceSource('spell',comparable(facts.source),comparable(input.source))
  else if(!same(comparable(facts.source),comparable(input.source)))throw Error('bountiful-ready-source:changed-original-input')
  const before=facts.source.targetSavingThrows,after=input.source.targetSavingThrows
  if(before){
   if(!after||after.length<before.length)throw Error('bountiful-ready-source:append-only-target-rows-required')
   assertBountifulSpellPostSaveRows(before,after.slice(0,before.length))
   for(const row of after.slice(before.length)){
    if(!input.source.prepared.targetSavingThrows?.some(target=>target.targetToken.id===row.targetId)||before.some(prior=>prior.targetId===row.targetId)||Object.keys(row).some(key=>!['targetId','d20','d20Second','disadvantageNegation'].includes(key)))throw Error('bountiful-ready-source:actual-new-target-raw-required')
    if(row.d20===0){if(Object.keys(row).some(key=>!['targetId','d20'].includes(key))||!input.source.savingThrowCounterattacks?.some(use=>use.targetId===row.targetId))throw Error('bountiful-ready-source:counterattack-zero-required')}else bountifulOriginalRawForActor(input.source,row.targetId,'saving-throw',row.d20Second===undefined?[row.d20]:[row.d20,row.d20Second])
   }
  }
  const prior=facts.source.hostOriginalSpellSavingThrows,next=input.source.hostOriginalSpellSavingThrows
  if(prior!==undefined&&(!Array.isArray(prior)||!Array.isArray(next)||next.length<prior.length||!same(prior,next.slice(0,prior.length))))throw Error('bountiful-ready-source:append-only-raw-captures-required')
  frames.push({frameId:record.id,request:facts.request,choices:structuredClone(record.postReadyD20??[])})
 }
 const binding:OriginalD20ReplayFacts={parentId:input.action.id,sourceKey:originalD20ReplaySourceKey(input.action.id,input.source.prepared.state,input.action),facts:[],readyFrames:frames}
 const supplied=input.source.hostOriginalD20Replay
 if(supplied!==undefined){
  const naturalRows=Object.values(combat?.bountifulOriginalParents??{}).filter(row=>row.identity.parentId===input.action.id).sort((a,b)=>a.identity.occurrence-b.identity.occurrence)
  const natural=naturalRows.length&&validateBountifulOriginalParents(combat?.bountifulOriginalParents)?bountifulConfirmedReplayFacts({parentId:input.action.id,source:input.source,receipts:naturalRows}):undefined
  const withoutFrames=(value:OriginalD20ReplayFacts)=>{const {readyFrames:_ready,...rest}=value;void _ready;return rest}
  if(!supplied||!Array.isArray(supplied.readyFrames)||!same(withoutFrames(supplied),withoutFrames(binding))&&(!natural||!same(withoutFrames(supplied),withoutFrames(natural))))throw Error('bountiful-ready-source:foreign-replay-ledger')
  for(const row of supplied.readyFrames){
   const current=frames.find(frame=>frame.frameId===row.frameId)
   if(!current||!same(current.request,row.request)||row.choices.length>current.choices.length||!same(row.choices,current.choices.slice(0,row.choices.length)))throw Error('bountiful-ready-source:foreign-ready-facts')
  }
 }
 return {...input.source,hostOriginalD20Replay:binding}
}
