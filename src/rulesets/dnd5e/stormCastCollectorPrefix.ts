import type{Dnd5eStormCastOriginalOperation}from'./damageCommitSession'
import type{restoreTempestuousBeforeAcceptedPreparation}from'./tempestuousBeforeAcceptedPreparation'
import{withTempestuousBeforePreparedOriginalReplay}from'./tempestuousBeforePreparedOriginalReplay'
import type{TempestuousBeforeOriginalPreparationLoader}from'./tempestuousBeforeOriginalPreparation'
import {createDnd5eNextOriginalD20Session,captureDnd5eStormCastOriginalOperation,readDnd5eStormCastOriginalOperation} from './damageCommitSession'
import {resolvePreparedDnd5eSpellCast} from './spellAction'
import {captureStormCastOriginalPreparation,restoreStormCastOriginalPreparation,type StormCastPreparationIdentity,type StormCastOriginalPreparationBook} from './stormCastOriginalPreparation'
import {issueStormCastPreparedOriginalReplay,stormCastPreparedOriginalChoice} from './stormCastPreparedOriginalReplay'
import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import type {Dnd5eDamageReactionFlowOptions} from './damageReactionFlow'
type Source=Parameters<typeof resolvePreparedDnd5eSpellCast>[0]
type Choose=NonNullable<Dnd5eDamageReactionFlowOptions['chooseStormCast']>
/** Produces a protected owner prefix from an actual missing-original native
 * pause. No next physical roll or fake d20 is supplied by this producer. */
export async function prepareStormCastCollectorPrefix(input:{beginHostOriginal?:(operation:Dnd5eStormCastOriginalOperation)=>Promise<void>;landing?:Parameters<typeof restoreTempestuousBeforeAcceptedPreparation>[2];source:Source;authorityUnchanged:()=>boolean;choose:Choose;gateway:Pick<SharedRoomGatewayPort,'publishEvent'>;load:(identity:StormCastPreparationIdentity)=>Promise<StormCastOriginalPreparationBook|undefined>;tempestuousBeforeReplay?:object;loadTempestuousBeforePreparation?:TempestuousBeforeOriginalPreparationLoader}){
 const guard=()=>{if(!input.authorityUnchanged())throw Error('storm-cast-collector:authority-changed')}
 guard()
 const source=input.source,p=source.prepared,identity={parentId:p.action.id,mapId:p.map.id,combatId:p.state.combatId}
 const firstSource=source
 const first=createDnd5eNextOriginalD20Session(firstSource,resolvePreparedDnd5eSpellCast)
 let initial:ReturnType<typeof first.run>
 try{initial=input.tempestuousBeforeReplay?withTempestuousBeforePreparedOriginalReplay(firstSource,input.tempestuousBeforeReplay,()=>first.run(firstSource.prepared.state)):first.run(firstSource.prepared.state)}finally{first.cancel()}
 if(initial.status!=='pending-storm-cast')return undefined
 const actual=captureDnd5eStormCastOriginalOperation(initial)
  if(p.action.sourceMode==='dm'){if(!input.beginHostOriginal)throw Error('storm-cast-collector:actual-host-input-transport-required');await input.beginHostOriginal(actual);guard()}
 let book=await input.load(identity);guard()
 let recovered=book?await restoreStormCastOriginalPreparation(identity,async id=>{const current=await input.load(id);guard();if(!current)throw Error('storm-cast-collector:private-source-required');return current},input.loadTempestuousBeforePreparation,input.landing):undefined
 const required=async(id:StormCastPreparationIdentity)=>{const current=await input.load(id);guard();if(!current)throw Error('storm-cast-collector:private-source-required');return current}
 if(!book)book=await captureStormCastOriginalPreparation(actual,input.gateway,required,input.tempestuousBeforeReplay)
 recovered??=await restoreStormCastOriginalPreparation(identity,required,input.loadTempestuousBeforePreparation,input.landing);guard()
 if(!Object.hasOwn(book,'ownerDecision')){
  const choice=await input.choose({frame:structuredClone(book.frame),state:readDnd5eStormCastOriginalOperation(recovered.operation).snapshot,eventId:book.frame.id});guard()
  await input.gateway.publishEvent('bountiful-native-raw-source-dm-to-host',{sourceKind:'storm-cast-preparation-v1',phase:'choice',...identity});guard()
  const token=await issueStormCastPreparedOriginalReplay(identity,required,input.loadTempestuousBeforePreparation,input.landing),accepted=stormCastPreparedOriginalChoice(recovered.operation,token)
  if(JSON.stringify(accepted)!==JSON.stringify(choice))throw Error('storm-cast-collector:protected-owner-decision-mismatch')
 }
 const token=await issueStormCastPreparedOriginalReplay(identity,required,input.loadTempestuousBeforePreparation,input.landing),choice=stormCastPreparedOriginalChoice(recovered.operation,token)
 const session=createDnd5eNextOriginalD20Session(recovered.source,resolvePreparedDnd5eSpellCast)
 try{
  const before=recovered.tempestuousBeforeReplay,invoke=<T>(run:()=>T)=>before?withTempestuousBeforePreparedOriginalReplay(recovered.source,before,run):run();const pending=invoke(()=>session.run(recovered.source.prepared.state))
  if(pending.status!=='pending-storm-cast')throw Error('storm-cast-collector:actual-restored-prefix-required')
  const next=invoke(()=>session.resumeStormCast(recovered.source.prepared.state,pending.frame,choice));guard()
  return{source:recovered.source,book:await required(identity),token,next}
 }finally{session.cancel()}
}
