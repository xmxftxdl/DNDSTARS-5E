import{captureDnd5ePluginSubclassEnvelopeRegistrationV1}from'../../rulesets/dnd5e/plugins/pluginContentCatalog'
import{secondChanceCanonicalControllerMemberId}from'../../../shared/second-chance-controller.mjs'
import{mastermindThoughtAuthorizedVersions}from'../../../shared/mastermind-thought-adjudication.mjs'
import type {Character} from '../../types/character'
import type {BattleMap} from '../../store/maps'
import type {SharedCombatState,SharedPlayerActionRequestQueueState,SharedPlayerActionState} from '../../lib/sharedCombatTypes'
import {loadSharedResource,requestSharedMastermindThoughtReading} from "../../composition/browserSharedRoomResources"
import {getRoomSession} from '../../lib/roomSession'
import {normalizeSharedCampaignTime} from '../../lib/campaignTime'
import {dnd5eExecutionEventKey} from '../../rulesets/dnd5e/activities/dnd5eActivityIdentity'
import {ensureDnd5eCoreSpellActivitiesRegisteredV1} from '../../rulesets/dnd5e/activities/dnd5eCoreSpellActivities'
import {prepareDnd5ePluginSpellCast,resolvePreparedDnd5ePluginSpellCast} from '../../rulesets/dnd5e/pluginSpellTransaction'
import {dnd5eCombatantSoulOfDeceitFeatureId} from "../../application/combat/dnd5eCombatRules"
import {dnd5ePluginFeatureDefinition} from '../../rulesets/dnd5e/plugins/pluginContentCatalog'
import {captureSoulOfDeceitReading,resolveSoulOfDeceitReading,withSoulOfDeceitReadingPermission,withSoulOfDeceitReadingPermissionAsync} from '../../rulesets/dnd5e/mastermindSoulOfDeceit'

type Operation='begin-native'|'begin'|'answer'|'project'|'list'|'issue-roll'|'raw'|'confirm'|'roll-request'|'read-result'|'read-results'
export interface MastermindThoughtGateway{
 loadResource<T>(name:string):Promise<T|null>
 request<T>(operation:Operation,input:unknown):Promise<T>
 session():{roomId:string;memberId:string;role:string}|null
}
const defaults:MastermindThoughtGateway={loadResource:loadSharedResource,request:requestSharedMastermindThoughtReading,session:getRoomSession}
type Revisioned<T>=T&{_sync?:{revision?:number}}
const names=['characters','maps','combat','map-geometry','campaign-time']as const
const ordered=(v:unknown):unknown=>Array.isArray(v)?v.map(ordered):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,n])=>[k,ordered(n)])):v
const same=(a:unknown,b:unknown)=>JSON.stringify(ordered(a))===JSON.stringify(ordered(b))
export interface MastermindThoughtPrompt{id:string;mapId:string;ownerCharacterId:string;ownerTokenId:string;phase:'waiting'|'answered';revision:number;canAnswer:boolean;choice?:'deny'|'allow-real-thoughts'|'present-false-thoughts';falseThoughts?:string}
export interface MastermindThoughtContestRequest{id:string;role:'owner'|'reader';tokenId:string;characterId:string;controllerMemberId:string;mode:'normal'|'advantage'|'disadvantage';count:number;sides:number;issuedAt:number;raw?:{memberId:string;sourceMode:'dm'|'player';at:number;values:number[]};confirmed?:{memberId:string;at:number;values:number[]}}
type ParentRow=MastermindThoughtPrompt&{origin?:'native';roomId:string;hostMemberId:string;parentTransactionId:string;readerTokenId:string;readerCharacterId:string;featureId:string;sourceDefinitionSignature:string;versions:Record<string,number>;originalAction:SharedPlayerActionState;issuedAt:number;rollRequests?:Partial<Record<'owner'|'reader',MastermindThoughtContestRequest>>;answer?:{choice:NonNullable<MastermindThoughtPrompt['choice']>;falseThoughts?:string;submittedByMemberId:string}}
export interface MastermindThoughtOriginal{readonly mastermindThoughtOriginal:unique symbol}
type Original={origin?:'native';action:SharedPlayerActionState;versions:Record<string,number>;session:{roomId:string;memberId:string};featureId:string;sourceSignature:string;sourceCurrent:()=>boolean;id:string}
const originals=new WeakMap<object,Original>()

async function canonical(actionId:string,g:MastermindThoughtGateway,now?:number,nativeAction?:SharedPlayerActionState){
 const session=g.session();if(!session||session.role!=='dm')throw Error('thought-reading:host-required')
 const rows=await Promise.all(names.map(name=>g.loadResource<Revisioned<object>>(name))),queue=await g.loadResource<SharedPlayerActionRequestQueueState>('player-action-requests')
 if(g.session()?.roomId!==session.roomId||g.session()?.memberId!==session.memberId||g.session()?.role!=='dm')throw Error('thought-reading:host-changed')
 const versions=Object.fromEntries(rows.map((row,i)=>{const n=row?._sync?.revision??(row==null?0:undefined);if(!Number.isSafeInteger(n)||n!<0)throw Error('thought-reading:version-required');return[names[i],n!]}))
 const characters=(rows[0]as Revisioned<{characters:Character[]}>|null)?.characters,maps=(rows[1]as Revisioned<{maps:BattleMap[]}>|null)?.maps,combat=rows[2]as Revisioned<SharedCombatState>|null,action=nativeAction??queue?.requests.find(row=>row.id===actionId),map=maps?.find(map=>map.id===action?.mapId),clock=normalizeSharedCampaignTime(rows[4])
 if(!characters||!map||!action||action.status!=='pending'||action.sourceMode!==(nativeAction?'dm':'player')||!action.roomMemberId||action.type!=='dnd5e-spell-cast'||action.dnd5eSpellCast?.spellId.split(':').at(-1)!=='detect-thoughts'||!action.actorTokenId||!action.dnd5eSpellCast.targetTokenId)throw Error('thought-reading:current-original-required')
 if(nativeAction&&(action.roomMemberId!==session.memberId||secondChanceCanonicalControllerMemberId(characters.find(c=>c.id===action.characterId),{roomId:session.roomId,hostMemberId:session.memberId})!==session.memberId))throw Error('thought-reading:canonical-native-Host-caster-required')
 ensureDnd5eCoreSpellActivitiesRegisteredV1()
 const prepared=prepareDnd5ePluginSpellCast({action,map,characters,now,worldMinute:clock.worldMinute,authorityRound:combat?.active===true?combat.round:undefined,initiativeOrder:combat?.active===true&&combat.mapId===map.id?combat.initiativeOrder:[],turnEconomy:combat?.active===true?combat.dnd5eTurnEconomyByToken?.[action.actorTokenId]:undefined,turnEconomyByToken:combat?.active===true?combat.dnd5eTurnEconomyByToken:undefined})
 if(!prepared.ok)throw Error('thought-reading:original-'+prepared.reason)
 return{session,versions,action,prepared:prepared.prepared,snapshot:Object.fromEntries(names.map((name,i)=>[name,rows[i]]))}
}

async function authorizedVersions(issued:Original,current:Awaited<ReturnType<typeof canonical>>,g:MastermindThoughtGateway,row?:ParentRow){
 const saved=row??(await g.loadResource<{parents:Record<string,ParentRow>}>('mastermind-thought-readings'))?.parents[issued.id]
 if(!saved||!same(saved.versions,issued.versions)||!same(saved.originalAction,issued.action))return undefined
 return mastermindThoughtAuthorizedVersions(saved,{...current.snapshot,'combat-interrupts':await g.loadResource('combat-interrupts')})
}

/** A consent fact cannot create a spell, source feature, or native parent. */
export async function prepareMastermindThoughtReadingOriginal(actionId:string,g:MastermindThoughtGateway=defaults):Promise<MastermindThoughtOriginal|undefined>{
 const current=await canonical(actionId,g),ownerId=current.action.dnd5eSpellCast!.targetTokenId!,readerId=current.action.actorTokenId!,owner=current.prepared.state.combatants[ownerId],featureId=owner&&dnd5eCombatantSoulOfDeceitFeatureId(owner)
 if(!featureId)return undefined
 const feature=dnd5ePluginFeatureDefinition(featureId)!,subclass=feature.sourceSubclassId!,capture=captureDnd5ePluginSubclassEnvelopeRegistrationV1(feature.ownerPluginId,subclass)
 if(!capture||capture()?.level!=='full')throw Error('thought-reading:current-native-source-required')
 const sourceSignature=JSON.stringify(ordered(feature)),id='mastermind-thought-reading:'+dnd5eExecutionEventKey(actionId),ownerCharacterId=current.prepared.characterIdByCombatantId[ownerId]
 if(!ownerCharacterId)throw Error('thought-reading:canonical-owner-required')
 await g.request('begin',{id,parentTransactionId:actionId,mapId:current.prepared.map.id,readerTokenId:readerId,ownerTokenId:ownerId,readerCharacterId:current.action.characterId,ownerCharacterId,featureId,sourceDefinitionSignature:sourceSignature,versions:current.versions})
 const token=Object.freeze({})as MastermindThoughtOriginal
 originals.set(token,{...current,id,featureId,sourceSignature,sourceCurrent:()=>capture()?.level==='full'})
 return token
}

/** Partial transport milestone: deny and real-consent use the actual prepared
 * spell transaction. A false-thought choice remains pending until the real
 * opposed-check prefix can be carried in this same original transaction. */
async function decision(token:MastermindThoughtOriginal,g:MastermindThoughtGateway){
 const issued=originals.get(token);if(!issued)throw Error('thought-reading:issued-original-required')
 const current=await canonical(issued.action.id,g,undefined,issued.origin==='native'?issued.action:undefined)
 if(current.session.roomId!==issued.session.roomId||current.session.memberId!==issued.session.memberId||!await authorizedVersions(issued,current,g)||!same(current.action,issued.action)||!issued.sourceCurrent()||JSON.stringify(ordered(dnd5ePluginFeatureDefinition(issued.featureId)))!==issued.sourceSignature)throw Error('thought-reading:original-or-source-changed')
 const journal=await g.loadResource<{parents:Record<string,ParentRow>}>('mastermind-thought-readings'),row=journal?.parents?.[issued.id]
 if(!row||row.roomId!==issued.session.roomId||row.hostMemberId!==issued.session.memberId||row.parentTransactionId!==issued.action.id||!same(row.versions,issued.versions)||!same(row.originalAction,issued.action)||row.featureId!==issued.featureId||row.sourceDefinitionSignature!==issued.sourceSignature)throw Error('thought-reading:authenticated-parent-required')
 if(row.phase==='waiting')return{kind:'pending-owner-choice' as const}
 if(row.phase!=='answered'||!row.answer)throw Error('thought-reading:owner-answer-required')
 if(row.answer.choice==='present-false-thoughts')return{kind:'pending-false-thought-contest' as const}
 const ownerId=current.action.dnd5eSpellCast!.targetTokenId!,readerId=current.action.actorTokenId!,reading=captureSoulOfDeceitReading(current.prepared.state,{parentId:current.action.id,ownerId,readerId,scopeCurrent:()=>{const session=g.session();return session?.roomId===issued.session.roomId&&session?.memberId===issued.session.memberId&&session?.role==='dm'}})
 if(!reading)throw Error('thought-reading:current-native-source-required')
 const policy=resolveSoulOfDeceitReading(reading,{parentId:current.action.id,choice:row.answer.choice})
 return{kind:'ready' as const,prepared:current.prepared,permission:policy.kind==='real-thoughts-permitted'?policy.permission:undefined,issued}
}
export async function resolveMastermindThoughtReadingOriginal(token:MastermindThoughtOriginal,rolls:Parameters<typeof resolvePreparedDnd5ePluginSpellCast>[0]['rolls'],g:MastermindThoughtGateway=defaults){const value=await decision(token,g);if(value.kind!=='ready')return value;const run=()=>resolvePreparedDnd5ePluginSpellCast({prepared:value.prepared,rolls});return{kind:'resolved' as const,native:value.permission?withSoulOfDeceitReadingPermission(value.permission,run):run()}}
/** The actual canonical resolver may remain unchanged across asynchronous dice
 * and followups. No permission is serialized or inferred from a payload flag. */
export async function withMastermindThoughtReadingOriginal<T>(token:MastermindThoughtOriginal,operation:(prepared:Parameters<typeof resolvePreparedDnd5ePluginSpellCast>[0]['prepared'])=>Promise<T>,g:MastermindThoughtGateway=defaults){const value=await decision(token,g);if(value.kind!=='ready')return value;const work=()=>operation(value.prepared),native=value.permission?await withSoulOfDeceitReadingPermissionAsync(value.permission,work):await work(),current=await canonical(value.issued.action.id,g,undefined,value.issued.origin==='native'?value.issued.action:undefined);if(!await authorizedVersions(value.issued,current,g)||!same(current.action,value.issued.action)||current.session.roomId!==value.issued.session.roomId||current.session.memberId!==value.issued.session.memberId||!value.issued.sourceCurrent())throw Error('thought-reading:original-or-source-changed');return{kind:'resolved' as const,native}}

export async function listMastermindThoughtPrompts(g:MastermindThoughtGateway=defaults){const result=await g.request<{ok:boolean;parents:MastermindThoughtPrompt[]}>('list',{});if(!result.ok||!Array.isArray(result.parents))throw Error('thought-reading:prompts-required');return result.parents}
export async function answerMastermindThoughtReading(id:string,choice:NonNullable<MastermindThoughtPrompt['choice']>,falseThoughts:string|undefined,g:MastermindThoughtGateway=defaults){const result=await g.request<{ok:boolean;parent:MastermindThoughtPrompt}>('project',{id});if(!result.ok||result.parent?.id!==id)throw Error('thought-reading:prompt-required');return g.request('answer',{id,expectedRecordRevision:result.parent.revision,choice,...(falseThoughts===undefined?{}:{falseThoughts})})}

/** Read-only Host view for the actual false-thought native prefix factory.
 * A JSON original never reaches this function's private issuer. */
export async function readMastermindThoughtAnsweredOriginal(token:MastermindThoughtOriginal,g:MastermindThoughtGateway=defaults){const issued=originals.get(token);if(!issued)throw Error('thought-reading:issued-original-required');const journal=await g.loadResource<{parents:Record<string,ParentRow>}>('mastermind-thought-readings'),row=journal?.parents?.[issued.id];if(!row||row.phase!=='answered'||!row.answer||!Number.isSafeInteger(row.issuedAt))throw Error('thought-reading:authenticated-owner-choice-required');const current=await canonical(issued.action.id,g,row.issuedAt,issued.origin==='native'?issued.action:undefined),versions=await authorizedVersions(issued,current,g,row);if(current.session.roomId!==issued.session.roomId||current.session.memberId!==issued.session.memberId||row.roomId!==issued.session.roomId||row.hostMemberId!==issued.session.memberId||row.parentTransactionId!==issued.action.id||!versions||!same(current.action,issued.action)||!same(row.versions,issued.versions)||!same(row.originalAction,issued.action)||!issued.sourceCurrent()||row.featureId!==issued.featureId||row.sourceDefinitionSignature!==issued.sourceSignature||JSON.stringify(ordered(dnd5ePluginFeatureDefinition(issued.featureId)))!==issued.sourceSignature)throw Error('thought-reading:original-or-source-changed');return{parentId:current.action.id,journalId:issued.id,prepared:current.prepared,originalAction:current.action,versions:{...versions},row,scopeCurrent:()=>{const session=g.session();return session?.roomId===issued.session.roomId&&session?.memberId===issued.session.memberId&&session?.role==='dm'&&issued.sourceCurrent()}}}

export async function readMastermindThoughtContestOriginal(token:MastermindThoughtOriginal,g:MastermindThoughtGateway=defaults){const view=await readMastermindThoughtAnsweredOriginal(token,g);if(view.row.answer?.choice!=='present-false-thoughts')throw Error('thought-reading:authenticated-false-choice-required');return view}

export async function waitMastermindThoughtOwnerAnswer(token:MastermindThoughtOriginal,g:MastermindThoughtGateway=defaults,timeoutMs=120000){
 const issued=originals.get(token);if(!issued)throw Error('thought-reading:issued-original-required')
 const end=Date.now()+timeoutMs
 for(;;){
  if(!issued.sourceCurrent()||g.session()?.roomId!==issued.session.roomId||g.session()?.memberId!==issued.session.memberId||g.session()?.role!=='dm')throw Error('thought-reading:original-or-source-changed')
  const reply=await g.request<{parent:MastermindThoughtPrompt}>('project',{id:issued.id})
  if(reply.parent.phase==='answered')return readMastermindThoughtAnsweredOriginal(token,g)
  if(reply.parent.phase!=='waiting')throw Error('thought-reading:owner-answer-required')
  if(Date.now()>=end)return undefined
  await new Promise(resolve=>setTimeout(resolve,200))
 }
}

/** Host intent is rebuilt from canonical resources; no queued player action
 * or serialized prepared object supplies native reading authority. */
export async function prepareMastermindThoughtNativeOriginal(intent:SharedPlayerActionState,g:MastermindThoughtGateway=defaults):Promise<MastermindThoughtOriginal|undefined>{
 const session=g.session();if(!session||session.role!=='dm'||intent.sourceMode!=='dm'||intent.type!=='dnd5e-spell-cast'||intent.dnd5eSpellCast?.spellId.split(':').at(-1)!=='detect-thoughts'||intent.dnd5eSpellCast.castingClassId!=='wizard'||intent.dnd5eSpellCast.slotLevel!==2)throw Error('thought-reading:native-Wizard-intent-required');
 const action={...intent,roomMemberId:session.memberId},current=await canonical(action.id,g,undefined,action),ownerId=action.dnd5eSpellCast!.targetTokenId!,owner=current.prepared.state.combatants[ownerId],featureId=owner&&dnd5eCombatantSoulOfDeceitFeatureId(owner);if(!featureId)return undefined;
 const feature=dnd5ePluginFeatureDefinition(featureId)!,subclass=feature.sourceSubclassId!,capture=captureDnd5ePluginSubclassEnvelopeRegistrationV1(feature.ownerPluginId,subclass);if(!capture||capture()?.level!=='full')throw Error('thought-reading:current-native-source-required');
 const id='mastermind-thought-reading:'+dnd5eExecutionEventKey(action.id),sourceSignature=JSON.stringify(ordered(feature)),ownerCharacterId=current.prepared.characterIdByCombatantId[ownerId];if(!ownerCharacterId)throw Error('thought-reading:canonical-owner-required');
 await g.request('begin-native',{id,parentTransactionId:action.id,mapId:action.mapId,readerTokenId:action.actorTokenId,ownerTokenId:ownerId,readerCharacterId:action.characterId,ownerCharacterId,featureId,sourceDefinitionSignature:sourceSignature,versions:current.versions});
 const journal=await g.loadResource<{parents:Record<string,ParentRow&{origin?:string}>}>('mastermind-thought-readings'),row=journal?.parents[id];if(!row||row.origin!=='native'||row.originalAction.sourceMode!=='dm'||row.originalAction.roomMemberId!==session.memberId||!same(row.versions,current.versions))throw Error('thought-reading:server-issued-native-original-required');
 const prepared=await canonical(action.id,g,row.issuedAt,row.originalAction),token=Object.freeze({})as MastermindThoughtOriginal;originals.set(token,{...prepared,origin:'native',id,featureId,sourceSignature,sourceCurrent:()=>capture()?.level==='full'});return token;
}

/** Read the original server-issued native action. No serialized prepared
 * snapshot or client-provided action can produce this private authority. */
export async function readMastermindThoughtNativeIssuedOriginal(token:MastermindThoughtOriginal,g:MastermindThoughtGateway=defaults){
 const issued=originals.get(token);if(!issued||issued.origin!=='native')throw Error('thought-reading:issued-native-original-required')
 const journal=await g.loadResource<{parents:Record<string,ParentRow>}>('mastermind-thought-readings'),row=journal?.parents[issued.id]
 if(!row||row.origin!=='native'||!['waiting','answered'].includes(row.phase)||row.hostMemberId!==issued.session.memberId||row.roomId!==issued.session.roomId||!same(row.originalAction,issued.action)||!same(row.versions,issued.versions))throw Error('thought-reading:current-native-parent-required')
 const current=await canonical(issued.action.id,g,row.issuedAt,issued.action)
 if(!await authorizedVersions(issued,current,g,row)||!issued.sourceCurrent()||JSON.stringify(ordered(dnd5ePluginFeatureDefinition(issued.featureId)))!==issued.sourceSignature||!same(current.action,issued.action))throw Error('thought-reading:original-or-source-changed')
 return{action:issued.action,prepared:current.prepared,row,versions:current.versions}
}

/** Fresh callers restore only the private server-issued native parent. The
 * original five versions remain fixed; only its genuine approved/resumed
 * control transition can supply the existing narrow combat-version proof. */
export async function restoreMastermindThoughtNativeOriginal(parentId:string,g:MastermindThoughtGateway=defaults):Promise<MastermindThoughtOriginal>{
 const session=g.session();if(!session||session.role!=='dm')throw Error('thought-reading:host-required')
 const journal=await g.loadResource<{parents:Record<string,ParentRow>}>('mastermind-thought-readings'),rows=Object.values(journal?.parents??{}).filter(row=>row.origin==='native'&&row.parentTransactionId===parentId&&row.roomId===session.roomId&&row.hostMemberId===session.memberId&&['waiting','answered'].includes(row.phase))
 if(rows.length!==1)throw Error('thought-reading:one-issued-native-parent-required')
 const row=rows[0]!,current=await canonical(parentId,g,row.issuedAt,row.originalAction),owner=current.prepared.state.combatants[row.ownerTokenId],featureId=owner&&dnd5eCombatantSoulOfDeceitFeatureId(owner)
 if(!featureId||featureId!==row.featureId)throw Error('thought-reading:current-native-source-required')
 const feature=dnd5ePluginFeatureDefinition(featureId)!,subclass=feature.sourceSubclassId!,capture=captureDnd5ePluginSubclassEnvelopeRegistrationV1(feature.ownerPluginId,subclass),sourceSignature=JSON.stringify(ordered(feature))
 if(!capture||capture()?.level!=='full'||sourceSignature!==row.sourceDefinitionSignature)throw Error('thought-reading:current-native-source-required')
 const issued:Original={origin:'native',action:row.originalAction,versions:{...row.versions},session:{roomId:session.roomId,memberId:session.memberId},id:row.id,featureId,sourceSignature,sourceCurrent:()=>capture()?.level==='full'}
 if(!await authorizedVersions(issued,current,g,row)||!same(current.action,row.originalAction))throw Error('thought-reading:original-or-source-changed')
 const token=Object.freeze({})as MastermindThoughtOriginal;originals.set(token,issued);await readMastermindThoughtNativeIssuedOriginal(token,g);return token
}
