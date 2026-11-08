import type{Dnd5eSpellWindowOriginalSessionClock}from'./spellWindowOriginalSessionClock'
import type{Dnd5eTempestuousBeforeSpellOriginalOperation,Dnd5eTempestuousLandingOriginalOperation}from'./damageCommitSession'
import{createDnd5ePreparedDamageCommitSession,createDnd5eNextOriginalD20Session,captureDnd5eTempestuousBeforeSpellOriginalOperation}from'./damageCommitSession'
import{resolvePreparedDnd5eSpellCast}from'./spellAction'
import{dnd5eAvailableTempestuousSpellFlight}from'./headlessCombatEngine'
import{captureTempestuousBeforeOriginalPreparation,restoreTempestuousBeforeOriginalPreparation,type TempestuousBeforePreparationIdentity,type TempestuousBeforeOriginalPreparationBook}from'./tempestuousBeforeOriginalPreparation'
import{restoreTempestuousBeforeAcceptedPreparation}from'./tempestuousBeforeAcceptedPreparation'
import{captureTempestuousBeforeSpellWindowPreview,issueTempestuousBeforePreparedOriginalReplay,tempestuousBeforeCollectorOriginalInput,withTempestuousBeforePreparedOriginalReplay}from'./tempestuousBeforePreparedOriginalReplay'
import type{Dnd5eDamageReactionFlowOptions}from'./damageReactionFlow'
import type{SharedRoomGatewayPort}from'../../ports/sharedRoomGateway'
type Source=Parameters<typeof resolvePreparedDnd5eSpellCast>[0]
/** First real owner pause, before this producer issues or invents any new roll.
 * A subsequent Heart/caster/native pause is returned as itself, never skipped. */
export async function prepareTempestuousBeforeCollectorPrefix(input:{originalNativeClock?:Dnd5eSpellWindowOriginalSessionClock;beginHostOriginal?:(operation:Dnd5eTempestuousBeforeSpellOriginalOperation)=>Promise<void>;landing?:{resolve:(operation:Dnd5eTempestuousLandingOriginalOperation)=>Promise<readonly number[]>};source:Source;authorityUnchanged:()=>boolean;choose:NonNullable<Dnd5eDamageReactionFlowOptions['chooseTempestuousBeforeSpell']>;gateway:Pick<SharedRoomGatewayPort,'publishEvent'>;load:(id:TempestuousBeforePreparationIdentity)=>Promise<TempestuousBeforeOriginalPreparationBook|undefined>}){
 const guard=()=>{if(!input.authorityUnchanged())throw Error('tempestuous-before-collector:authority-changed')};guard()
 const p=input.source.prepared;if(!dnd5eAvailableTempestuousSpellFlight(p.state,p.actorToken.id).length)return undefined
 const identity={parentId:p.action.id,mapId:p.map.id,combatId:p.state.combatId},required=async(id:TempestuousBeforePreparationIdentity)=>{const book=await input.load(id);guard();if(!book)throw Error('tempestuous-before-collector:private-source-required');return book}
 let book:TempestuousBeforeOriginalPreparationBook|undefined
 if(p.action.sourceMode==='dm'){
  const first=createDnd5ePreparedDamageCommitSession(input.source,resolvePreparedDnd5eSpellCast,()=>false,undefined,undefined,identity.parentId,true,true,false,false,input.originalNativeClock)
  try{const pending=first.run(p.state);if(pending.status!=='pending-tempestuous-before-spell')return undefined;const operation=captureDnd5eTempestuousBeforeSpellOriginalOperation(pending);if(!input.beginHostOriginal)throw Error('tempestuous-before-collector:actual-host-input-transport-required');await input.beginHostOriginal(operation);guard();book=await input.load(identity);guard();if(!book)book=await captureTempestuousBeforeOriginalPreparation(operation,input.gateway,required)}finally{first.cancel()}
 }else{
 book=await input.load(identity);guard()
 if(!book){const first=createDnd5ePreparedDamageCommitSession(input.source,resolvePreparedDnd5eSpellCast,()=>false,undefined,undefined,identity.parentId,true,true,false,false,input.originalNativeClock);try{const pending=first.run(p.state);if(pending.status!=='pending-tempestuous-before-spell')return undefined;const operation=captureDnd5eTempestuousBeforeSpellOriginalOperation(pending);book=await captureTempestuousBeforeOriginalPreparation(operation,input.gateway,required);guard()}finally{first.cancel()}}

 }
 const recovered=await restoreTempestuousBeforeOriginalPreparation(identity,required);guard()
 if(!Object.hasOwn(book,'ownerDecision')){await input.choose({frame:structuredClone(book.frame),state:structuredClone(recovered.source.prepared.state),eventId:book.frame.id});guard();await input.gateway.publishEvent('bountiful-native-raw-source-dm-to-host',{sourceKind:'tempestuous-before-preparation-v1',phase:'choice',...identity});guard()}
 const accepted=await restoreTempestuousBeforeAcceptedPreparation(identity,required,input.landing),token=await issueTempestuousBeforePreparedOriginalReplay(identity,required,input.landing);guard()
 const source=tempestuousBeforeCollectorOriginalInput(accepted.source,token)
 if(input.originalNativeClock){const next=captureTempestuousBeforeSpellWindowPreview(source,token,input.originalNativeClock);guard();return{source,book:await required(identity),token,next,presentationPrepared:accepted.continuationPrepared??source.prepared}}
 const session=createDnd5eNextOriginalD20Session(source,resolvePreparedDnd5eSpellCast)
 try{const next=withTempestuousBeforePreparedOriginalReplay(source,token,()=>session.run(source.prepared.state));guard();return{source,book:await required(identity),token,next,presentationPrepared:accepted.continuationPrepared??source.prepared}}finally{session.cancel()}
}
