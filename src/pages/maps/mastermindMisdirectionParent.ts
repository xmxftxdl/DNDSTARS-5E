import{dnd5eSpellResolutionInitiativeOrder}from'./spellSettlementCoordinator'
import{captureDnd5ePluginSubclassEnvelopeRegistrationV1}from'../../rulesets/dnd5e/plugins/pluginContentCatalog'
import type {Character} from '../../types/character'
import type {BattleMap} from '../../store/maps'
import type {SharedCombatState,SharedPlayerActionRequestQueueState,SharedPlayerActionState} from '../../lib/sharedCombatTypes'
import {normalizeSharedMapGeometry} from '../../lib/mapGeometry'
import {normalizeSharedCampaignTime} from '../../lib/campaignTime'
import {loadSharedResource,requestSharedMastermindMisdirection} from "../../composition/browserSharedRoomResources"
import {getRoomSession} from '../../lib/roomSession'
import {dnd5eExecutionEventKey} from '../../rulesets/dnd5e/activities/dnd5eActivityIdentity'
import {dnd5ePluginFeatureDefinition} from '../../rulesets/dnd5e/plugins/pluginContentCatalog'
import {resolveDnd5eHeadlessAction,dnd5eHeadlessTurnKey,dnd5eAttackAttemptWardRequirements,resolveDnd5eCoverAttackRedirectPrefix,dnd5eCombatantCoverRedirectFeatureIds,dnd5eCoverAttackRedirectEligible,type Dnd5eCoverAttackRedirectUse} from "../../application/combat/dnd5eCombatRules"
import {prepareDnd5eEquipmentAttack,type PreparedDnd5eEquipmentAttack} from '../../rulesets/dnd5e/equipmentAttackAction'

type Operation='begin'|'answer'|'project'|'list'
export interface MastermindMisdirectionGateway{
 loadResource<T>(name:string):Promise<T|null>
 request<T>(operation:Operation,input:unknown):Promise<T>
 session():{roomId:string;memberId:string;role:string}|null
}
const defaultGateway:MastermindMisdirectionGateway={loadResource:loadSharedResource,request:requestSharedMastermindMisdirection,session:getRoomSession}
type Revisioned<T>=T&{_sync?:{revision?:number}}
const names=['characters','maps','combat','map-geometry','campaign-time']as const
const ordered=(v:unknown):unknown=>Array.isArray(v)?v.map(ordered):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,n])=>[k,ordered(n)])):v
const same=(a:unknown,b:unknown)=>JSON.stringify(ordered(a))===JSON.stringify(ordered(b))
export interface MastermindMisdirectionPrompt{id:string;mapId:string;ownerCharacterId:string;ownerTokenId:string;phase:'waiting'|'answered';revision:number;canAnswer:boolean;replacementTokenIds:string[];choice?:string}
type ParentRow=MastermindMisdirectionPrompt&{roomId:string;hostMemberId:string;parentTransactionId:string;attackerTokenId:string;featureId:string;sourceDefinitionSignature:string;versions:Record<string,number>;originalAction:SharedPlayerActionState;answer?:{choice:string;submittedByMemberId:string;submittedAt:number}}
export interface MastermindMisdirectionOriginal{readonly mastermindMisdirectionOriginal:unique symbol}
type Original={prepared:PreparedDnd5eEquipmentAttack;versions:Record<string,number>;session:{roomId:string;memberId:string};featureId:string;sourceSignature:string;sourceCurrent:()=>boolean;id:string;action:SharedPlayerActionState}
const originals=new WeakMap<object,Original>()
const decisions=new WeakMap<object,{original:MastermindMisdirectionOriginal;gateway:MastermindMisdirectionGateway}>()
function decision<T extends{prepared:PreparedDnd5eEquipmentAttack;coverAttackRedirect?:Dnd5eCoverAttackRedirectUse}>(value:T,original:MastermindMisdirectionOriginal,gateway:MastermindMisdirectionGateway):T{if(value.coverAttackRedirect)Object.freeze(value.coverAttackRedirect);decisions.set(value,{original,gateway});return Object.freeze(value)}

function host(g:MastermindMisdirectionGateway){const session=g.session();if(!session||session.role!=='dm')throw Error('mastermind-misdirection:host-required');return session}
async function canonical(actionId:string,g:MastermindMisdirectionGateway){
 const session=host(g),rows=await Promise.all(names.map(name=>g.loadResource<Revisioned<object>>(name))),queue=await g.loadResource<SharedPlayerActionRequestQueueState>('player-action-requests')
 if(g.session()?.roomId!==session.roomId||g.session()?.memberId!==session.memberId||g.session()?.role!=='dm')throw Error('mastermind-misdirection:host-changed')
 const versions=Object.fromEntries(rows.map((row,i)=>{const n=row?._sync?.revision??(row==null?0:undefined);if(!Number.isSafeInteger(n)||n!<0)throw Error('mastermind-misdirection:version-required');return[names[i],n!]}))
 const characters=(rows[0]as Revisioned<{characters:Character[]}>|null)?.characters,maps=(rows[1]as Revisioned<{maps:BattleMap[]}>|null)?.maps,combat=rows[2]as Revisioned<SharedCombatState>|null,action=queue?.requests.find(row=>row.id===actionId)
 const map=maps?.find(map=>map.id===action?.mapId)
 const scene=combat?.active===false&&action?.combatId===undefined
 if(!characters||!map||!combat||combat.flowPause||!action||action.sourceMode!=='player'||!action.roomMemberId||action.status!=='pending'||action.type!=='dnd5e-weapon-attack'||(!scene&&(combat.active!==true||!combat.combatId||combat.mapId!==map.id||action.combatId!==combat.combatId||action.round!==combat.round||action.initiativeIndex!==combat.initiativeIndex||combat.initiativeOrder[combat.initiativeIndex]?.tokenId!==action.actorTokenId)))throw Error('mastermind-misdirection:current-original-required')
 const initiativeOrder=scene?dnd5eSpellResolutionInitiativeOrder({combatActive:false,map,actorTokenId:action.actorTokenId??'',initiativeOrder:combat.initiativeOrder}):combat.initiativeOrder,turnEconomyByToken=scene?undefined:combat.dnd5eTurnEconomyByToken
 const economy=!scene&&action.actorTokenId?combat.dnd5eTurnEconomyByToken?.[action.actorTokenId]:undefined,clock=scene&&rows[4]==null?{worldMinute:0,worldSecondRemainder:0}:normalizeSharedCampaignTime(rows[4]),geometry=normalizeSharedMapGeometry(rows[3])
 if(rows[3]!=null&&!geometry)throw Error('mastermind-misdirection:canonical-geometry-required')
 const p=prepareDnd5eEquipmentAttack({action,map,characters,initiativeOrder,turnEconomy:economy,turnEconomyByToken,attacksUsed:economy?.attacksUsed??0,attackActionsAvailable:economy?.action.max,geometry:geometry?.maps.find(m=>m.mapId===map.id)??null,worldMinute:clock.worldMinute,worldSecondRemainder:clock.worldSecondRemainder??0})
 if(!p.ok)throw Error('mastermind-misdirection:original-'+p.reason)
 return{session,versions,action,prepared:p.prepared,prepareReplacement:(targetTokenId:string)=>prepareDnd5eEquipmentAttack({action:{...action,targetTokenId},map,characters,initiativeOrder,turnEconomy:economy,turnEconomyByToken,attacksUsed:economy?.attacksUsed??0,attackActionsAvailable:economy?.action.max,geometry:geometry?.maps.find(m=>m.mapId===map.id)??null,worldMinute:clock.worldMinute,worldSecondRemainder:clock.worldSecondRemainder??0})}
}

/** Only the actual queued original is prepared here; no caller-provided state,
 * feature ID, candidate list, raw die, or publication is accepted. */
export async function prepareMastermindMisdirectionOriginal(actionId:string,g:MastermindMisdirectionGateway=defaultGateway):Promise<MastermindMisdirectionOriginal|undefined>{
 const original=await canonical(actionId,g),p=original.prepared,target=p.state.combatants[p.targetToken.id]
 if(!target)return undefined
 const candidates=dnd5eCombatantCoverRedirectFeatureIds(target).flatMap(featureId=>{const replacements=Object.keys(p.state.combatants).filter(id=>dnd5eCoverAttackRedirectEligible(p.state,p.actorToken.id,p.targetToken.id,id,featureId));return replacements.length?[{featureId,replacements}]:[]})
 if(!candidates.length)return undefined
 // Native content may supply one such reaction. Ambiguity never silently picks
 // an arbitrary different feature or gives another owner's choice authority.
 if(candidates.length!==1)throw Error('mastermind-misdirection:ambiguous-native-source')
 const {featureId,replacements}=candidates[0],feature=dnd5ePluginFeatureDefinition(featureId)!,subclass=feature.sourceSubclassId!,capture=captureDnd5ePluginSubclassEnvelopeRegistrationV1(feature.ownerPluginId,subclass)
 if(!capture||capture()?.level!=='full')throw Error('mastermind-misdirection:current-native-source-required')
 const sourceSignature=JSON.stringify(ordered(feature)),id='mastermind-misdirection:'+dnd5eExecutionEventKey(actionId),ownerCharacterId=p.characterIdByCombatantId[p.targetToken.id]
 if(!ownerCharacterId)throw Error('mastermind-misdirection:canonical-owner-required')
 await g.request('begin',{id,parentTransactionId:actionId,mapId:p.map.id,attackerTokenId:p.actorToken.id,ownerTokenId:p.targetToken.id,ownerCharacterId,featureId,replacementTokenIds:replacements,sourceDefinitionSignature:sourceSignature,versions:original.versions})
 const token=Object.freeze({})as MastermindMisdirectionOriginal
 originals.set(token,{...original,session:original.session,featureId,sourceSignature,sourceCurrent:()=>capture()?.level==='full',id})
 return token
}

export async function readMastermindMisdirectionPreparedInput(token:MastermindMisdirectionOriginal,g:MastermindMisdirectionGateway=defaultGateway):Promise<{prepared:PreparedDnd5eEquipmentAttack;previewPrepared?:PreparedDnd5eEquipmentAttack;coverAttackRedirect?:Dnd5eCoverAttackRedirectUse}|undefined>{
 const issued=originals.get(token)
 if(!issued)throw Error('mastermind-misdirection:issued-original-required')
 const current=await canonical(issued.action.id,g)
 if(current.session.roomId!==issued.session.roomId||current.session.memberId!==issued.session.memberId||!same(current.versions,issued.versions)||!same(current.action,issued.action)||!issued.sourceCurrent()||JSON.stringify(ordered(dnd5ePluginFeatureDefinition(issued.featureId)))!==issued.sourceSignature)throw Error('mastermind-misdirection:original-or-source-changed')
 const journal=await g.loadResource<{parents:Record<string,ParentRow>}>('mastermind-misdirections'),row=journal?.parents?.[issued.id]
 if(!row||row.roomId!==issued.session.roomId||row.hostMemberId!==issued.session.memberId||row.parentTransactionId!==issued.action.id||!same(row.versions,issued.versions)||!same(row.originalAction,issued.action)||row.featureId!==issued.featureId||row.sourceDefinitionSignature!==issued.sourceSignature)throw Error('mastermind-misdirection:authenticated-parent-required')
 if(row.phase==='waiting')return undefined
 if(row.phase!=='answered'||!row.answer)throw Error('mastermind-misdirection:owner-answer-required')
 if(row.answer.choice==='decline')return decision({prepared:current.prepared},token,g)
 if(!row.replacementTokenIds.includes(row.answer.choice)||!dnd5eCoverAttackRedirectEligible(current.prepared.state,current.prepared.actorToken.id,current.prepared.targetToken.id,row.answer.choice,issued.featureId))throw Error('mastermind-misdirection:current-cover-required')
 const preview=current.prepareReplacement(row.answer.choice);if(!preview.ok)throw Error('mastermind-misdirection:redirected-target-'+preview.reason)
 // Preview and physical roll mode use the actual new target; final native
 // resolution retains the original target and the authenticated reaction use.
 return decision({prepared:{...preview.prepared,action:current.prepared.action,targetToken:current.prepared.targetToken},previewPrepared:preview.prepared,coverAttackRedirect:{featureId:issued.featureId,originalTargetId:current.prepared.targetToken.id,replacementTargetId:row.answer.choice}},token,g)
}

export async function listMastermindMisdirectionPrompts(g:MastermindMisdirectionGateway=defaultGateway){const result=await g.request<{ok:boolean;parents:MastermindMisdirectionPrompt[]}>('list',{});if(!result.ok||!Array.isArray(result.parents))throw Error('mastermind-misdirection:prompts-required');return result.parents}
export async function answerMastermindMisdirection(id:string,choice:string,g:MastermindMisdirectionGateway=defaultGateway){const result=await g.request<{ok:boolean;parent:MastermindMisdirectionPrompt}>('project',{id});if(!result.ok||!result.parent||result.parent.id!==id)throw Error('mastermind-misdirection:prompt-required');return g.request('answer',{id,choice,expectedRecordRevision:result.parent.revision})}

/** Waiting never rolls or publishes the attack. Every ready answer is re-read
 * through the original native issuer and the unchanged canonical world. */
export async function collectMastermindMisdirectionOriginal(actionId:string,g:MastermindMisdirectionGateway=defaultGateway){
 const cap=await prepareMastermindMisdirectionOriginal(actionId,g);if(!cap)return undefined;
 const deadline=Date.now()+600000;
 while(Date.now()<deadline){const ready=await readMastermindMisdirectionPreparedInput(cap,g);if(ready)return ready;await new Promise<void>(resolve=>setTimeout(resolve,500))}
 throw Error('mastermind-misdirection:owner-choice-pending')
}

export async function assertMastermindMisdirectionDecisionCurrent(value:object){const bound=decisions.get(value);if(!bound)throw Error('mastermind-misdirection:issued-decision-required');if(!await readMastermindMisdirectionPreparedInput(bound.original,bound.gateway))throw Error('mastermind-misdirection:owner-answer-required')}

/** Adds constraints only: it never advances an original version to accommodate
 * a reaction phase. Such progression requires its own same-parent proof. */
export async function prepareMastermindMisdirectionAck(value:object,action:SharedPlayerActionState){const bound=decisions.get(value);if(!bound)throw Error('mastermind-misdirection:issued-decision-required');const original=originals.get(bound.original);if(!original||!same(original.action,action))throw Error('mastermind-misdirection:same-original-required');await assertMastermindMisdirectionDecisionCurrent(value);const queue=await bound.gateway.loadResource<Revisioned<SharedPlayerActionRequestQueueState>>('player-action-requests');if(!queue||!Number.isSafeInteger(queue._sync?.revision)||queue._sync!.revision!<0||!queue.requests.some(row=>same(row,original.action)))throw Error('mastermind-misdirection:same-queued-original-required');return Object.freeze({roomId:original.session.roomId,expectedRevisions:Object.freeze({...original.versions,'player-action-requests':queue._sync!.revision!})})}

/** The actual Ward collector is replayed against this issued decision's native
 * new-target snapshot. Only its exact blocked result can supply a prefix. */
export async function settleMastermindMisdirectionBlockedWard(value:{prepared:PreparedDnd5eEquipmentAttack;previewPrepared?:PreparedDnd5eEquipmentAttack;coverAttackRedirect?:Dnd5eCoverAttackRedirectUse},ward:{allowed:boolean;attempted:boolean;state:PreparedDnd5eEquipmentAttack['state'];events:import("../../application/combat/dnd5eCombatRules").Dnd5eCombatEvent[];saves:import("../../application/combat/dnd5eCombatRules").Dnd5eSpellcastingSavingThrowRoll[]}){
 const bound=decisions.get(value);if(!bound)throw Error('mastermind-misdirection:issued-decision-required');
 const actual=await readMastermindMisdirectionPreparedInput(bound.original,bound.gateway);
 if(!actual?.coverAttackRedirect||!actual.previewPrepared||ward.allowed)throw Error('mastermind-misdirection:blocked-redirect-required');
 const p=actual.previewPrepared,replayed=resolveDnd5eHeadlessAction(p.state,{type:'attack-ward-attempt',actorId:p.actorToken.id,targetId:p.targetToken.id,turnKey:dnd5eHeadlessTurnKey(p.state,p.actorToken.id),saves:ward.saves});
 if(!replayed.ok||!same(replayed.state,ward.state)||!same(replayed.events,ward.events)||dnd5eAttackAttemptWardRequirements(replayed.state,p.actorToken.id,p.targetToken.id).every(entry=>entry.receipt?.success===true))throw Error('mastermind-misdirection:actual-blocked-ward-required');
 const prefix=resolveDnd5eCoverAttackRedirectPrefix(ward.state,p.actorToken.id,actual.coverAttackRedirect);
 if(!prefix)throw Error('mastermind-misdirection:current-reaction-required');
 return{state:prefix.state,events:[...ward.events,...prefix.events]};
}
