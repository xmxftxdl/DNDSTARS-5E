import{captureDnd5ePluginSubclassEnvelopeRegistrationV1}from'./plugins/pluginContentCatalog'
import type {Character} from '../../types/character'
import {dnd5eRuntimePluginFeaturesAvailableForCharacter,dnd5eCharacterHasPluginFeature} from './pluginApi'
import {dnd5ePluginSubclassCurrentEnvelopeFullV1} from './plugins/pluginContentCatalog'
import {dnd5eCharacterKnownLanguagesV1} from './buildChoices'

export type MastermindComparison = 'int'|'wis'|'cha'|'class-levels'
export type MastermindObservationPurpose = 'mimicry'|'comparison'
export interface MastermindObservationWorld {
  roomId:string; hostMemberId:string
  actor:Character; targetIdentity:string
  clockRevision:number; worldMinute:number; worldSecondRemainder:number
  combatActive:boolean
}
export interface MastermindObservationHandle {readonly kind:'mastermind-observation'}
interface Record {
  purpose:MastermindObservationPurpose; roomId:string; hostMemberId:string; actorId:string; targetIdentity:string
  sourceSignature:string; sourceCurrent:()=>boolean; languageId?:string; selections?:readonly MastermindComparison[]
  startSecond:number; lastSecond:number; lastRevision:number; interrupted:boolean
  completed?:MastermindObservationCompletion
}
export type MastermindObservationCompletion = Readonly<{
  kind:'accurate-speech-and-accent';targetIdentity:string;languageId:string
}|{
  kind:'dm-relative-comparison';targetIdentity:string;selections:readonly MastermindComparison[]
}>
const records=new WeakMap<MastermindObservationHandle,Record>()
function source(actor:Character,purpose:MastermindObservationPurpose){const feature=dnd5eRuntimePluginFeaturesAvailableForCharacter(actor).find(feature=>{const mechanic=feature.declarativeAbility?.mechanic;return mechanic?.kind==='mastermind-observation'&&mechanic.purpose===purpose&&feature.automation==='full'&&!!feature.sourceClassId&&!!feature.sourceSubclassId&&dnd5ePluginSubclassCurrentEnvelopeFullV1(feature.sourceSubclassId)&&dnd5eCharacterHasPluginFeature(actor,feature.id)});if(!feature)throw Error('mastermind-observation:current-native-source-required');return feature}
function second(world:MastermindObservationWorld){if(!Number.isSafeInteger(world.worldMinute)||world.worldMinute<0||!Number.isSafeInteger(world.worldSecondRemainder)||world.worldSecondRemainder<0||world.worldSecondRemainder>59||!Number.isSafeInteger(world.clockRevision)||world.clockRevision<0||!world.roomId||!world.hostMemberId||!world.targetIdentity)throw Error('mastermind-observation:canonical-world-required');const value=world.worldMinute*60+world.worldSecondRemainder;if(!Number.isSafeInteger(value))throw Error('mastermind-observation:invalid-clock');return value}
/** Host coordinator primitive. The room transport must supply server-read world and authenticate the DM's continuous-observation adjudication; public intents may not call this directly. */
export function beginMastermindObservation(world:MastermindObservationWorld,input:{purpose:MastermindObservationPurpose;languageId?:string;selections?:readonly MastermindComparison[]}):MastermindObservationHandle{
  const current=source(world.actor,input.purpose),now=second(world)
  if(input.purpose==='comparison'&&world.combatActive)throw Error('mastermind-observation:outside-combat-required')
  if(input.purpose==='mimicry'&&(!input.languageId||!dnd5eCharacterKnownLanguagesV1(world.actor).includes(input.languageId)))throw Error('mastermind-observation:understood-language-required')
  if(input.purpose==='comparison'&&(!input.selections||input.selections.length!==2||new Set(input.selections).size!==2||input.selections.some(v=>!['int','wis','cha','class-levels'].includes(v))))throw Error('mastermind-observation:choose-exactly-two')
  const handle=Object.freeze({kind:'mastermind-observation' as const});records.set(handle,{purpose:input.purpose,roomId:world.roomId,hostMemberId:world.hostMemberId,actorId:world.actor.id,targetIdentity:world.targetIdentity,sourceSignature:JSON.stringify(current),sourceCurrent:(()=>{const id=current.sourceSubclassId!,capture=captureDnd5ePluginSubclassEnvelopeRegistrationV1(current.ownerPluginId,id);if(!capture)throw Error('mastermind-observation:current-native-source-required');return()=>capture()?.level==='full'})(),languageId:input.languageId,selections:input.selections?[...input.selections]:undefined,startSecond:now,lastSecond:now,lastRevision:world.clockRevision,interrupted:false});return handle
}
function read(handle:MastermindObservationHandle,world:MastermindObservationWorld){const row=records.get(handle);if(!row)throw Error('mastermind-observation:issued-handle-required');if(row.interrupted)throw Error('mastermind-observation:interrupted');if(row.roomId!==world.roomId||row.hostMemberId!==world.hostMemberId||row.actorId!==world.actor.id||row.targetIdentity!==world.targetIdentity||(!row.sourceCurrent()||JSON.stringify(source(world.actor,row.purpose))!==row.sourceSignature))throw Error('mastermind-observation:source-or-scope-changed');const now=second(world);if(now<row.lastSecond||world.clockRevision<row.lastRevision||(row.purpose==='comparison'&&world.combatActive)){row.interrupted=true;throw Error('mastermind-observation:interrupted')}if(row.purpose==='mimicry'&&!dnd5eCharacterKnownLanguagesV1(world.actor).includes(row.languageId!))throw Error('mastermind-observation:understood-language-required');return{row,now}}
/** Only a genuine DM hearing/observation adjudication counts the elapsed interval. A clock jump alone never completes it. */
export function confirmMastermindObservationInterval(handle:MastermindObservationHandle,world:MastermindObservationWorld,continued:boolean){const{row,now}=read(handle,world);if(!continued){row.interrupted=true;throw Error('mastermind-observation:interrupted')}row.lastSecond=now;row.lastRevision=world.clockRevision;return Math.max(0,60-(now-row.startSecond))}
export function finishMastermindObservation(handle:MastermindObservationHandle,world:MastermindObservationWorld):MastermindObservationCompletion{const{row,now}=read(handle,world);if(now!==row.lastSecond||world.clockRevision!==row.lastRevision||now-row.startSecond<60)throw Error('mastermind-observation:one-minute-not-confirmed');return row.completed??=Object.freeze(row.purpose==='mimicry'?{kind:'accurate-speech-and-accent',targetIdentity:row.targetIdentity,languageId:row.languageId!}:{kind:'dm-relative-comparison',targetIdentity:row.targetIdentity,selections:Object.freeze([...row.selections!])})}
/** No target statistics are inspected. Optional information remains an explicit DM disclosure. */
export function presentMastermindRelativeInformation(handle:MastermindObservationHandle,world:MastermindObservationWorld,answers:readonly {attribute:MastermindComparison;relative:'equal'|'higher'|'lower'}[],optionalInformation?:string){const completion=finishMastermindObservation(handle,world);if(completion.kind!=='dm-relative-comparison'||answers.length!==2||new Set(answers.map(a=>a.attribute)).size!==2||answers.some(a=>!completion.selections.includes(a.attribute)||!['equal','higher','lower'].includes(a.relative))||(optionalInformation!==undefined&&(typeof optionalInformation!=='string'||optionalInformation.length>4000)))throw Error('mastermind-observation:invalid-dm-disclosure');return{targetIdentity:completion.targetIdentity,comparisons:answers.map(a=>({...a})),...(optionalInformation?{optionalInformation}:{})}}

const canonical=(value:unknown):unknown=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)])):value
/** Current authored native source metadata; this is a reader, never a supplied feature-ID grant. */
export function captureMastermindObservationSource(actor:Character,purpose:MastermindObservationPurpose){
 const feature=source(actor,purpose),id=feature.sourceSubclassId!,native=captureDnd5ePluginSubclassEnvelopeRegistrationV1(feature.ownerPluginId,id)
 if(native?.()?.level!=='full')throw Error('mastermind-observation:current-native-source-required')
 return{signature:JSON.stringify(canonical(feature)),isCurrent:()=>native?.()?.level==='full'}
}
export function mastermindObservationSourceSignature(actor:Character,purpose:MastermindObservationPurpose):string{return captureMastermindObservationSource(actor,purpose).signature}
