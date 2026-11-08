import{captureDnd5ePluginSubclassEnvelopeRegistrationV1}from'../../rulesets/dnd5e/plugins/pluginContentCatalog'
import{secondChanceCanonicalControllerMemberId}from'../../../shared/second-chance-controller.mjs'
import type {Character} from '../../types/character'
import type {BattleMap} from '../../store/maps'
import type {SharedCombatState,SharedPlayerActionState,SharedPlayerActionRequestQueueState} from '../../lib/sharedCombatTypes'
import type {MastermindThoughtGateway,MastermindThoughtContestRequest,MastermindThoughtPrompt} from './mastermindThoughtReadingParent'
import {prepareDnd5ePluginFeatureAction,resolvePreparedDnd5ePluginFeatureAction} from '../../rulesets/dnd5e/pluginFeatureAction'
import {dnd5eAbilityCheckRollMode,dnd5eCombatantSoulOfDeceitFeatureId} from '../../rulesets/dnd5e/headlessCombatEngine'
import {dnd5ePluginFeatureDefinition} from '../../rulesets/dnd5e/plugins/pluginContentCatalog'
import {captureSoulOfDeceitReading,resolveSoulOfDeceitReading,withSoulOfDeceitReadingPermissionAsync} from '../../rulesets/dnd5e/mastermindSoulOfDeceit'
import {dnd5eExecutionEventKey} from '../../rulesets/dnd5e/activities/dnd5eActivityIdentity'
import {normalizeSharedCampaignTime} from '../../lib/campaignTime'
import {readDnd5eCompletedCombatBase,type settleDnd5eConcentrationChecks} from './settleDnd5eCombatResult'
import {createDnd5eParentEffectClock} from '../../rulesets/dnd5e/activeEffects'
import {mastermindThoughtAuthorizedVersions} from '../../../shared/mastermind-thought-adjudication.mjs'
import {cloneDnd5eHostTransactionInput,registerDnd5eHostReceipt,registerDnd5eHostReceiptSlot} from '../../rulesets/dnd5e/hostTransactionClone'
import {readMastermindThoughtDiceRequest,lockMastermindThoughtRawBeforeConfirmation,type MastermindThoughtPhysicalPorts} from './mastermindThoughtDiceTransport'

const names=['characters','maps','combat','map-geometry','campaign-time'] as const
const ordered=(v:unknown):unknown=>Array.isArray(v)?v.map(ordered):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,n])=>[k,ordered(n)])):v
const sig=(v:unknown)=>JSON.stringify(ordered(v)),same=(a:unknown,b:unknown)=>sig(a)===sig(b)
type Revisioned<T>=T&{_sync?:{revision?:number}}
type Row=MastermindThoughtPrompt&{origin?:'native';roomId:string;hostMemberId:string;parentTransactionId:string;readerTokenId:string;readerCharacterId:string;featureId:string;sourceDefinitionSignature:string;versions:Record<string,number>;originalAction:SharedPlayerActionState;issuedAt:number;rollRequests?:Partial<Record<'owner'|'reader',MastermindThoughtContestRequest>>;answer?:{choice:NonNullable<MastermindThoughtPrompt['choice']>;falseThoughts?:string;submittedByMemberId:string}}
type Native=Awaited<ReturnType<typeof resolvePreparedDnd5ePluginFeatureAction>>
export interface MastermindThoughtContinuationOriginal{readonly mastermindContinuationOriginal:unique symbol}
type Binding={native?:true;action:SharedPlayerActionState;versions:Record<string,number>;roomId:string;hostMemberId:string;id:string;featureId:string;sourceSignature:string;continuationSignature:string;sourceCurrent:()=>boolean}
const originals=new WeakMap<object,Binding>(),resolved=new WeakMap<object,{original:MastermindThoughtContinuationOriginal;native:Native;signature:string;kind:'false-thoughts'|'blocked'|'real-consent'}>()

const completedBases=new WeakMap<object,{input:object;completed:Awaited<ReturnType<typeof settleDnd5eConcentrationChecks>>}>()

/** Only these real source-granted native controls enter this lane. A spell name
 * or player-provided prepared object never selects it. */
async function canonical(actionId:string,g:MastermindThoughtGateway,native=false){
 const session=g.session();if(!session||session.role!=='dm')throw Error('thought-continuation:host-required')
 const rows=await Promise.all(names.map(name=>g.loadResource<Revisioned<object>>(name))),queue=await g.loadResource<SharedPlayerActionRequestQueueState>('player-action-requests')
 if(g.session()?.roomId!==session.roomId||g.session()?.memberId!==session.memberId||g.session()?.role!=='dm')throw Error('thought-continuation:host-changed')
 const versions=Object.fromEntries(rows.map((row,i)=>{const n=row?._sync?.revision??(row==null?0:undefined);if(!Number.isSafeInteger(n)||n!<0)throw Error('thought-continuation:version-required');return[names[i],n!]}))
 const journal=native?await g.loadResource<{parents:Record<string,Row>}>('mastermind-thought-readings'):undefined,issued=native?Object.values(journal?.parents??{}).filter(row=>row.origin==='native'&&row.parentTransactionId===actionId&&row.originalAction.type==='dnd5e-plugin-action'):[]
 if(native&&(issued.length!==1||issued[0].roomId!==session.roomId||issued[0].hostMemberId!==session.memberId||queue?.requests.some(row=>row.id===actionId)))throw Error('thought-continuation:issued-native-original-required')
 const issuedRow=issued[0],action=native?issuedRow?.originalAction:queue?.requests.find(row=>row.id===actionId),characters=(rows[0] as {characters:Character[]}|null)?.characters,map=(rows[1] as {maps:BattleMap[]}|null)?.maps.find(map=>map.id===action?.mapId),combat=rows[2] as SharedCombatState|null
 const kind=['surface','probe'].find(kind=>action?.dnd5ePluginAction?.featureId==='srd-5.1:effect-control.spell:detect-thoughts:'+kind)
 if(!kind||!characters||!map||!action||action.type!=='dnd5e-plugin-action'||action.status!=='pending'||action.sourceMode!==(native?'dm':'player')||!action.roomMemberId||!action.actorTokenId||!action.targetTokenId)throw Error('thought-continuation:current-source-granted-original-required')
 if(native){const reader=characters.find(c=>c.id===action.characterId);if(!reader||action.roomMemberId!==session.memberId||secondChanceCanonicalControllerMemberId(reader,{roomId:session.roomId,hostMemberId:session.memberId})!==session.memberId)throw Error('thought-continuation:canonical-native-controller-required')}
 const clock=normalizeSharedCampaignTime(rows[4]),prepared=prepareDnd5ePluginFeatureAction({action,map,characters,worldMinute:clock.worldMinute,worldSecondRemainder:clock.worldSecondRemainder,initiativeOrder:combat?.active===true&&combat.mapId===map.id?combat.initiativeOrder:[],turnEconomy:combat?.active===true?combat.dnd5eTurnEconomyByToken?.[action.actorTokenId]:undefined,roomRequiredPlugins:[]})
 if(!prepared.ok)throw Error('thought-continuation:original-'+prepared.reason)
 const p=prepared.prepared,reader=p.actor,payload=action.dnd5ePluginAction?.payload,effectId=payload&&typeof payload==='object'&&!Array.isArray(payload)?payload.activeEffectId:undefined,effect=reader.dnd5eCombatState?.activeEffects?.find(effect=>effect.id===effectId)
 if(p.feature.action?.id!=='spell:detect-thoughts:'+kind||p.headlessAction.actionId!=='spell:detect-thoughts:'+kind)throw Error('thought-continuation:exact-granted-activity-required')
 if(!effect||effect.source.kind!=='spell'||effect.source.actorId!==action.actorTokenId||effect.source.characterId!==reader.id||effect.source.pluginId!=='srd-5.1'||effect.source.rulesId?.split(':').at(-1)!=='detect-thoughts'||effect.source.magical!==true||effect.duration.type!=='concentration'||effect.duration.sourceActorId!==action.actorTokenId||!effect.grantedActivities?.includes('spell:detect-thoughts:'+kind)||reader.concentrating!==true)throw Error('thought-continuation:current-caster-controller-effect-required')
 return{session,versions,action,prepared:p,kind,issuedRow,continuationSignature:sig({effect,feature:p.feature}),snapshot:Object.fromEntries(names.map((name,i)=>[name,rows[i]]))}
}
export async function prepareMastermindThoughtContinuationOriginal(actionId:string,g:MastermindThoughtGateway){
 const c=await canonical(actionId,g),owner=c.prepared.state.combatants[c.action.targetTokenId!],featureId=owner&&dnd5eCombatantSoulOfDeceitFeatureId(owner)
 if(!featureId)return undefined
 const feature=dnd5ePluginFeatureDefinition(featureId)!,subclass=feature.sourceSubclassId!,source=captureDnd5ePluginSubclassEnvelopeRegistrationV1(feature.ownerPluginId,subclass)
 if(!source||source()?.level!=='full')throw Error('thought-continuation:current-native-source-required')
 const ownerCharacterId=c.prepared.characterIdByCombatantId[owner.id];if(!ownerCharacterId)throw Error('thought-continuation:canonical-owner-required')
 const id='mastermind-thought-reading:'+dnd5eExecutionEventKey(actionId),sourceSignature=sig(feature)
 await g.request('begin',{id,parentTransactionId:actionId,mapId:c.prepared.map.id,readerTokenId:c.action.actorTokenId,ownerTokenId:owner.id,readerCharacterId:c.action.characterId,ownerCharacterId,featureId,sourceDefinitionSignature:sourceSignature,versions:c.versions})
 const token=Object.freeze({}) as MastermindThoughtContinuationOriginal
 originals.set(token,{action:c.action,versions:c.versions,roomId:c.session.roomId,hostMemberId:c.session.memberId,id,featureId,sourceSignature,continuationSignature:c.continuationSignature,sourceCurrent:()=>source()?.level==='full'})
 return token
}
async function current(original:MastermindThoughtContinuationOriginal,g:MastermindThoughtGateway){
 const b=originals.get(original);if(!b)throw Error('thought-continuation:issued-original-required')
 const journal=await g.loadResource<{parents:Record<string,Row>}>('mastermind-thought-readings'),row=journal?.parents[b.id]
 if(!row||!Number.isSafeInteger(row.issuedAt))throw Error('thought-continuation:authenticated-parent-required')
 const c=await canonical(b.action.id,g,b.native===true),versions=mastermindThoughtAuthorizedVersions(row,{...c.snapshot,'combat-interrupts':await g.loadResource('combat-interrupts')})
 if(c.session.roomId!==b.roomId||c.session.memberId!==b.hostMemberId||row.roomId!==b.roomId||row.hostMemberId!==b.hostMemberId||row.parentTransactionId!==b.action.id||row.featureId!==b.featureId||row.sourceDefinitionSignature!==b.sourceSignature||!same(row.originalAction,b.action)||!same(c.action,b.action)||!versions||!same(row.versions,b.versions)||c.continuationSignature!==b.continuationSignature||!b.sourceCurrent()||sig(dnd5ePluginFeatureDefinition(b.featureId))!==b.sourceSignature)throw Error('thought-continuation:original-or-source-changed')
 return{...c,versions,parentId:b.action.id,journalId:b.id,originalAction:b.action,row,scopeCurrent:()=>g.session()?.roomId===b.roomId&&g.session()?.memberId===b.hostMemberId&&g.session()?.role==='dm'&&b.sourceCurrent()}
}
export async function issueMastermindThoughtContinuationContest(original:MastermindThoughtContinuationOriginal,g:MastermindThoughtGateway){
 const view=await current(original,g);if(view.row.phase!=='answered'||view.row.answer?.choice!=='present-false-thoughts')throw Error('thought-continuation:authenticated-false-answer-required')
 for(const[role,tokenId,ability,skill]of[['owner',view.row.ownerTokenId,'cha','deception'],['reader',view.row.readerTokenId,'wis','insight']] as const){const mode=dnd5eAbilityCheckRollMode(view.prepared.state.combatants[tokenId],{ability,skill,state:view.prepared.state});await g.request('issue-roll',{id:view.journalId,role,mode})}
 return(await current(original,g)).row.rollRequests!
}
export async function resolveMastermindThoughtContinuation(original:MastermindThoughtContinuationOriginal,input:Omit<Parameters<typeof resolvePreparedDnd5ePluginFeatureAction>[0],'prepared'>,g:MastermindThoughtGateway){
 const view=await current(original,g);if(view.row.phase!=='answered'||!view.row.answer)throw Error('thought-continuation:authenticated-answer-required')
 const choice=view.row.answer.choice,reading=captureSoulOfDeceitReading(view.prepared.state,{parentId:view.parentId,ownerId:view.row.ownerTokenId,readerId:view.row.readerTokenId,scopeCurrent:view.scopeCurrent})
 if(!reading)throw Error('thought-continuation:current-native-source-required')
 const checks:Partial<Record<'owner'|'reader',{d20:number;d20Second?:number}>>={}
 if(choice==='present-false-thoughts')for(const role of ['owner','reader'] as const){const r=view.row.rollRequests?.[role],tokenId=role==='owner'?view.row.ownerTokenId:view.row.readerTokenId,ability=role==='owner'?'cha':'wis',skill=role==='owner'?'deception':'insight',mode=dnd5eAbilityCheckRollMode(view.prepared.state.combatants[tokenId],{ability,skill,state:view.prepared.state}),count=mode==='normal'?1:2;if(!r||r.mode!==mode||r.count!==count||r.id!==view.journalId+':'+role||r.tokenId!==tokenId||r.characterId!==view.prepared.characterIdByCombatantId[tokenId]||!r.raw||!r.confirmed||r.raw.memberId!==r.controllerMemberId||r.raw.sourceMode!==(r.controllerMemberId===view.row.hostMemberId?'dm':'player')||r.confirmed.memberId!==view.row.hostMemberId||![r.raw.values,r.confirmed.values].every(values=>values.length===count&&values.every(n=>Number.isInteger(n)&&n>=1&&n<=20)))throw Error('thought-continuation:authenticated-two-pools-required');checks[role]={d20:r.confirmed.values[0],...(count===2?{d20Second:r.confirmed.values[1]}:{})}}
 const policy=resolveSoulOfDeceitReading(reading,{parentId:view.parentId,choice,...(choice==='present-false-thoughts'?{ownerCheck:checks.owner,readerCheck:checks.reader}:{})}),permission='permission'in policy?policy.permission:undefined
 view.prepared.state=policy.state
 const clock=createDnd5eParentEffectClock({parentId:view.parentId,sourceKey:view.continuationSignature,timestamp:view.row.issuedAt})
 const nativeInput:Parameters<typeof resolvePreparedDnd5ePluginFeatureAction>[0]={...input,prepared:view.prepared,resolveDamageBoundary:async(state,resolve)=>input.resolveDamageBoundary?input.resolveDamageBoundary(state,next=>clock.run(()=>resolve(next))):clock.run(()=>resolve(state)),...(input.resolveMaterialDamageBoundary?{resolveMaterialDamageBoundary:async(state,resolve,succeeded)=>input.resolveMaterialDamageBoundary!(state,next=>clock.run(()=>resolve(next)),succeeded)}:{})}
 const work=()=>resolvePreparedDnd5ePluginFeatureAction(nativeInput,{now:view.row.issuedAt}),native=permission?await withSoulOfDeceitReadingPermissionAsync(permission,work):await work()
 await current(original,g)
 if(!native.result.ok)throw Error('thought-continuation:native-resolution-failed:'+native.result.reason)
 if(!native.application)throw Error('thought-continuation:native-application-required')
 // The real opposed checks have already produced policy.state. Their private
 // dice and totals stay in the authenticated journal, outside public Page log
 // events, matching the initial-reading production lane.
 const token=Object.freeze({}),kind=policy.kind==='real-thoughts-permitted'?'real-consent':policy.kind==='false-thoughts-permitted'?'false-thoughts':'blocked'
 resolved.set(token,{original,native,signature:sig(native),kind})
 return token
}
export const isMastermindThoughtContinuationResolution=(value:object)=>resolved.has(value)
export async function readMastermindThoughtContinuationResolved(value:object,g:MastermindThoughtGateway){
 const bound=resolved.get(value);if(!bound||sig(bound.native)!==bound.signature)throw Error('thought-continuation:actual-native-result-required')
 const base=completedBases.get(value);if(base)readDnd5eCompletedCombatBase(base.input,base.completed)
 const view=await current(bound.original,g),focus=bound.native.result.state.combatants[view.row.ownerTokenId]?.classState.activeEffects?.some(effect=>effect.tags?.includes('detect-thoughts-focus')&&effect.source.actorId===view.row.readerTokenId),read=bound.native.result.events.some(event=>(event.type==='active-effect-applied'||event.type==='active-effect-refreshed')&&event.targetId===view.row.ownerTokenId&&event.effectId.includes('detect-thoughts'))
 return{...view,native:base?cloneDnd5eHostTransactionInput(bound.native):bound.native,kind:focus&&read?bound.kind:'blocked' as const}
}
/** Only the actual Base completion of this exact native result can advance it.
 * Keep its real brand pair private and return a detached UI projection. */
export async function completeMastermindThoughtContinuationBase(value:object,completed:Awaited<ReturnType<typeof settleDnd5eConcentrationChecks>>,g:MastermindThoughtGateway){
 const view=await readMastermindThoughtContinuationResolved(value,g),old=resolved.get(value)!
 if(completedBases.has(value))throw Error('thought-continuation:original-native-base-required')
 readDnd5eCompletedCombatBase(view.native.result,completed)
 const native=cloneDnd5eHostTransactionInput({...view.native,result:completed.result,application:completed.application}),token=Object.freeze({})
 resolved.set(token,{...old,native,signature:sig(native)});completedBases.set(token,{input:view.native.result,completed});return token
}

/** A continued reading waits on its new protected decision. Initial spell
 * permission is never used to answer a later surface or probe request. */
export async function waitMastermindThoughtContinuationAnswer(original:MastermindThoughtContinuationOriginal,g:MastermindThoughtGateway,timeoutMs=120000){
 const end=Date.now()+timeoutMs
 for(;;){const view=await current(original,g);if(view.row.phase==='answered'&&view.row.answer)return view;if(view.row.phase!=='waiting')throw Error('thought-continuation:current-owner-answer-required');if(Date.now()>=end)return undefined;await new Promise(resolve=>setTimeout(resolve,200))}
}
export async function collectMastermindThoughtContinuationPhysical(original:MastermindThoughtContinuationOriginal,g:MastermindThoughtGateway,ui:MastermindThoughtPhysicalPorts){
 const issued=await issueMastermindThoughtContinuationContest(original,g),api:Parameters<typeof readMastermindThoughtDiceRequest>[1]=(operation,input)=>g.request(operation,input)
 for(const role of ['owner','reader']as const){
  await current(original,g);const requestId=issued[role]?.id;if(!requestId)throw Error('thought-continuation:issued-contest-required')
  let row=await readMastermindThoughtDiceRequest(requestId,api);if(!row)throw Error('thought-continuation:issued-contest-required');if(row.confirmedValues)continue
  if(!row.rawValues){const raw=await ui.rollOriginalWithoutConfirmation(row);await lockMastermindThoughtRawBeforeConfirmation({requestId:row.id,rollerTokenId:row.rollerTokenId,sides:row.sides,values:raw},api);row=await readMastermindThoughtDiceRequest(requestId,api)}
  if(!row?.rawValues)throw Error('thought-continuation:authenticated-physical-pool-required');await ui.confirmStored(row,row.rawValues)
  const confirmed=await readMastermindThoughtDiceRequest(requestId,api);if(!confirmed?.confirmedValues)throw Error('thought-continuation:independent-DM-confirmation-required')
 }
 await current(original,g)
}
const productionSlot=Symbol('mastermind-thought-continuation');registerDnd5eHostReceiptSlot(productionSlot)
const nativeResolutions=new WeakMap<object,object>()
const productionPrepared=new WeakMap<object,{original:MastermindThoughtContinuationOriginal;signature:string;receipt:object}>()
export async function readMastermindThoughtContinuationDmContext(original:MastermindThoughtContinuationOriginal,prepared:Parameters<typeof resolvePreparedDnd5ePluginFeatureAction>[0]['prepared'],g:MastermindThoughtGateway){
 const bound=productionPrepared.get(prepared);if(!bound||bound.original!==original||bound.signature!==sig(prepared)||Object.getOwnPropertyDescriptor(prepared,productionSlot)?.value!==bound.receipt)throw Error('thought-continuation:actual-issued-prepared-required')
 const view=await current(original,g);if(view.row.phase!=='answered'||!view.row.answer)throw Error('thought-continuation:current-owner-answer-required')
 return{choice:view.row.answer.choice}
}
/** The Page receives this factory's real native prepared object. Its callback
 * result is not evidence; only the actual native resolver issues publication. */
export async function withMastermindThoughtContinuationProduction<T>(original:MastermindThoughtContinuationOriginal,g:MastermindThoughtGateway,operation:(prepared:Parameters<typeof resolvePreparedDnd5ePluginFeatureAction>[0]['prepared'],resolve:typeof resolvePreparedDnd5ePluginFeatureAction)=>Promise<T>){
 const view=await current(original,g);if(view.row.phase!=='answered'||!view.row.answer)throw Error('thought-continuation:current-owner-answer-required')
 const prepared=view.prepared,receipt=registerDnd5eHostReceipt(Object.freeze({}));Object.defineProperty(prepared,productionSlot,{value:receipt,configurable:true});const expected=sig(prepared);productionPrepared.set(prepared,{original,signature:expected,receipt})
 const resolve:typeof resolvePreparedDnd5ePluginFeatureAction=async input=>{
  if(Object.getOwnPropertyDescriptor(input.prepared,productionSlot)?.value!==receipt||sig(input.prepared)!==expected||!view.scopeCurrent())throw Error('thought-continuation:same-issued-prepared-required')
  const{prepared:ignored,...nativeInput}=input;void ignored
  const resolution=await resolveMastermindThoughtContinuation(original,nativeInput,g),actual=await readMastermindThoughtContinuationResolved(resolution,g)
  nativeResolutions.set(actual.native,resolution);return actual.native
 }
 try{return await operation(prepared,resolve)}finally{productionPrepared.delete(prepared);delete(prepared as unknown as Record<symbol,unknown>)[productionSlot]}
}
export function readMastermindThoughtContinuationNativeResolution(native:object){const token=nativeResolutions.get(native);if(!token)throw Error('thought-continuation:actual-issued-native-result-required');return token}

export interface MastermindThoughtNativeContinuationIntent{id:string;mapId:string;readerTokenId:string;ownerTokenId:string;kind:'surface'|'probe';activeEffectId:string}
function nativeOwnerSource(prepared:Parameters<typeof resolvePreparedDnd5ePluginFeatureAction>[0]['prepared'],ownerTokenId:string){
 const owner=prepared.state.combatants[ownerTokenId],featureId=owner&&dnd5eCombatantSoulOfDeceitFeatureId(owner)
 if(!featureId)throw Error('thought-continuation:current-native-owner-required')
 const feature=dnd5ePluginFeatureDefinition(featureId)!,subclass=feature.sourceSubclassId!,source=captureDnd5ePluginSubclassEnvelopeRegistrationV1(feature.ownerPluginId,subclass)
 if(!source||source()?.level!=='full')throw Error('thought-continuation:current-native-source-required')
 return{featureId,sourceSignature:sig(feature),sourceCurrent:()=>source()?.level==='full'}
}
async function bindNativeContinuation(actionId:string,g:MastermindThoughtGateway){
 const c=await canonical(actionId,g,true),row=c.issuedRow,owner=nativeOwnerSource(c.prepared,c.action.targetTokenId!)
 if(!row||!['waiting','answered'].includes(row.phase)||row.originalAction.sourceMode!=='dm'||row.featureId!==owner.featureId||row.sourceDefinitionSignature!==owner.sourceSignature)throw Error('thought-continuation:current-issued-native-source-required')
 const token=Object.freeze({})as MastermindThoughtContinuationOriginal
 originals.set(token,{native:true,action:cloneDnd5eHostTransactionInput(c.action),versions:{...row.versions},roomId:c.session.roomId,hostMemberId:c.session.memberId,id:row.id,...owner,continuationSignature:c.continuationSignature})
 await current(token,g);return token
}
/** The local object is only a request. The existing server issuer rebuilds the
 * actual Host action from the canonical current controller/effect and owns it. */
export async function prepareMastermindThoughtNativeContinuationOriginal(input:MastermindThoughtNativeContinuationIntent,g:MastermindThoughtGateway){
 const session=g.session();if(session?.role!=='dm'||!['surface','probe'].includes(input.kind))throw Error('thought-continuation:host-required')
 const rows=await Promise.all(names.map(name=>g.loadResource<Revisioned<object>>(name))),characters=(rows[0]as {characters:Character[]}|null)?.characters,map=(rows[1]as {maps:BattleMap[]}|null)?.maps.find(m=>m.id===input.mapId),combat=rows[2]as SharedCombatState|null,readerToken=map?.tokens.find(t=>t.id===input.readerTokenId),ownerToken=map?.tokens.find(t=>t.id===input.ownerTokenId),reader=characters?.find(c=>c.id===readerToken?.characterId)
 if(!characters||!map||!reader||!ownerToken?.characterId||readerToken?.id===ownerToken.id||secondChanceCanonicalControllerMemberId(reader,{roomId:session.roomId,hostMemberId:session.memberId})!==session.memberId)throw Error('thought-continuation:canonical-native-controller-required')
 const intent:SharedPlayerActionState={id:input.id,mapId:input.mapId,type:'dnd5e-plugin-action',status:'pending',sourceMode:'dm',roomMemberId:session.memberId,characterId:reader.id,actorTokenId:input.readerTokenId,targetTokenId:input.ownerTokenId,dnd5ePluginAction:{featureId:'srd-5.1:effect-control.spell:detect-thoughts:'+input.kind,payload:{activeEffectId:input.activeEffectId}},round:combat?.round??1,initiativeIndex:combat?.initiativeIndex??0,...(combat?.active===true?{combatId:combat.combatId}:{}),seq:0,updatedAt:Date.now()},clock=normalizeSharedCampaignTime(rows[4]),preflight=prepareDnd5ePluginFeatureAction({action:intent,map,characters,worldMinute:clock.worldMinute,worldSecondRemainder:clock.worldSecondRemainder,initiativeOrder:combat?.active===true&&combat.mapId===map.id?combat.initiativeOrder:[],turnEconomy:combat?.active===true?combat.dnd5eTurnEconomyByToken?.[input.readerTokenId]:undefined,roomRequiredPlugins:[]})
 if(!preflight.ok)throw Error('thought-continuation:original-'+preflight.reason)
 const source=nativeOwnerSource(preflight.prepared,input.ownerTokenId),versions=Object.fromEntries(rows.map((row,i)=>{const revision=row?._sync?.revision??(row==null?0:undefined);if(!Number.isSafeInteger(revision)||revision!<0)throw Error('thought-continuation:version-required');return[names[i],revision!]}))
 await g.request('begin-native',{id:'mastermind-thought-reading:'+dnd5eExecutionEventKey(input.id),parentTransactionId:input.id,mapId:input.mapId,readerTokenId:input.readerTokenId,ownerTokenId:input.ownerTokenId,readerCharacterId:reader.id,ownerCharacterId:ownerToken.characterId,featureId:source.featureId,sourceDefinitionSignature:source.sourceSignature,versions,continuationKind:input.kind,activeEffectId:input.activeEffectId})
 return bindNativeContinuation(input.id,g)
}
export const restoreMastermindThoughtNativeContinuationOriginal=bindNativeContinuation
export async function readMastermindThoughtNativeContinuationIssuedOriginal(original:MastermindThoughtContinuationOriginal,g:MastermindThoughtGateway){
 if(originals.get(original)?.native!==true)throw Error('thought-continuation:issued-native-original-required')
 const view=await current(original,g);if(view.row.origin!=='native'||view.originalAction.sourceMode!=='dm'||view.originalAction.type!=='dnd5e-plugin-action')throw Error('thought-continuation:issued-native-original-required');return view
}
export async function readMastermindThoughtNativeContinuationCompleted(value:object,g:MastermindThoughtGateway){
 const resolution=resolved.get(value);if(!resolution||!completedBases.has(value)||originals.get(resolution.original)?.native!==true)throw Error('thought-continuation:actual-native-base-required')
 const view=await readMastermindThoughtContinuationResolved(value,g);if(view.row.origin!=='native'||view.originalAction.type!=='dnd5e-plugin-action'||view.originalAction.sourceMode!=='dm')throw Error('thought-continuation:issued-native-original-required');return view
}
