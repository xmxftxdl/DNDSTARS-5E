import{registerDnd5eHostReceipt,registerDnd5eHostReceiptSlot,cloneDnd5eHostTransactionInput}from'../../rulesets/dnd5e/hostTransactionClone'
import{originalD20ReplaySourceKey,validateOriginalD20ReplayFacts,type OriginalD20ReplayFacts}from'../../rulesets/dnd5e/allyNaturalOneCheckpoint'
import{assertNativeWardLedgerDelta}from'./mastermindNativeWardLedgerScope'
import{getDnd5eSrdMonster}from'../../rulesets/dnd5e/monsters'
import{resolveDnd5eCoverAttackRedirectPrefix}from'../../rulesets/dnd5e/headlessCombatEngine'
import{createDnd5eParentEffectClock}from'../../rulesets/dnd5e/activeEffects'
import{resolveDnd5eHeadlessAction,dnd5eAttackAttemptWardRequirements,dnd5eHeadlessTurnKey,type Dnd5eSpellcastingSavingThrowRoll,type Dnd5eCombatEvent}from'../../rulesets/dnd5e/headlessCombatEngine'
import{resolveDnd5eSavingThrowInterrupts}from'./dnd5eRollInterruptPipeline'
import{mastermindExecutionParentId}from'../../../shared/mastermind-execution-id.mjs'
import{createDnd5eMapCombatSnapshot}from'../../rulesets/dnd5e/mapBridge'
import{normalizeSharedMapGeometry}from'../../lib/mapGeometry'
import {loadSharedResource,requestSharedMastermindMisdirection} from '../../lib/sharedApi'
import {getRoomSession} from '../../lib/roomSession'
import type {Character} from '../../types/character'
import type {BattleMap} from '../../store/maps'
import type {SharedCombatState} from '../../lib/sharedCombatTypes'
import {prepareDnd5eMonsterAttack,projectDnd5eMonsterAttackPreparation,refreshDnd5eMonsterAttackOccurrence,resolvePreparedDnd5eMonsterAttack,readDnd5eActualMonsterFacadeResult,type PreparedDnd5eMonsterAttack} from '../../rulesets/dnd5e/monsterAttackAction'
import {dnd5eCombatantCoverRedirectFeatureIds,dnd5eCoverAttackRedirectEligible,type Dnd5eCoverAttackRedirectUse} from '../../rulesets/dnd5e/headlessCombatEngine'
import {dnd5ePluginFeatureDefinition,captureDnd5ePluginSubclassEnvelopeRegistrationV1} from '../../rulesets/dnd5e/plugins/pluginContentCatalog'
import {dnd5eExecutionEventKey} from '../../rulesets/dnd5e/activities/dnd5eActivityIdentity'
import type {MastermindMisdirectionGateway} from './mastermindMisdirectionParent'
import {readDnd5eCompletedCombatBase,type settleDnd5eConcentrationChecks} from './settleDnd5eCombatResult'

type Gateway=Omit<MastermindMisdirectionGateway,'request'>&{request<T>(operation:'begin-native'|'project'|'list'|'answer',input:unknown):Promise<T>}
const defaultGateway:Gateway={session:getRoomSession,loadResource:loadSharedResource,request:requestSharedMastermindMisdirection}
type Revisioned<T>=T&{_sync?:{revision?:number}}
type MonsterStep={mode:'start'|'continue';parentActionId:string;occurrenceIndex:number}
type Descriptor={parentTransactionId:string;mapId:string;actorTokenId:string;targetTokenId:string;actionIndex:number;occurrence?:number;resourceKind?:'action'|'bonus-action'|'legendary-action';readiedAttack?:true;multiattackStep?:MonsterStep}
const names=['characters','maps','combat','map-geometry','campaign-time'] as const
const ordered=(value:unknown):unknown=>Array.isArray(value)?value.map(ordered):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,ordered(v)])):value
const same=(a:unknown,b:unknown)=>JSON.stringify(ordered(a))===JSON.stringify(ordered(b))
const plain=<T>(value:T):T=>JSON.parse(JSON.stringify(value))
function host(g:Gateway){const s=g.session();if(!s||s.role!=='dm')throw Error('mastermind-native-misdirection:host-required');return{roomId:s.roomId,memberId:s.memberId}}
function stillHost(g:Gateway,s:{roomId:string;memberId:string}){if(!same(host(g),s))throw Error('mastermind-native-misdirection:host-changed')}
async function canonical(input:Descriptor,g:Gateway){
 if(!input||typeof input!=='object'||Object.keys(input).some(k=>!['parentTransactionId','mapId','actorTokenId','targetTokenId','actionIndex','occurrence','resourceKind','readiedAttack','multiattackStep'].includes(k)))throw Error('mastermind-native-misdirection:closed-native-identity-required')
 if(input.readiedAttack!==undefined&&input.readiedAttack!==true||input.resourceKind!==undefined&&!['action','bonus-action','legendary-action'].includes(input.resourceKind))throw Error('mastermind-native-misdirection:actual-activation-required')
 const step=input.multiattackStep;if(step!==undefined&&(!step||typeof step!=='object'||Object.keys(step).length!==3||!['mode','parentActionId','occurrenceIndex'].every(key=>Object.hasOwn(step,key))||!['start','continue'].includes(step.mode)||!mastermindExecutionParentId(step.parentActionId)||!Number.isSafeInteger(step.occurrenceIndex)||step.occurrenceIndex<0||step.occurrenceIndex>=128||step.mode==='start'&&step.occurrenceIndex!==0||step.mode==='continue'&&step.occurrenceIndex<1||input.readiedAttack||input.resourceKind!==undefined&&input.resourceKind!=='action'))throw Error('mastermind-native-misdirection:actual-committed-step-required')
 const session=host(g),rows=await Promise.all(names.map(n=>g.loadResource<Revisioned<object>>(n)));stillHost(g,session)
 const versions=Object.fromEntries(rows.map((v,i)=>{const n=v?._sync?.revision??(v==null?0:undefined);if(!Number.isSafeInteger(n)||n!<0)throw Error('mastermind-native-misdirection:version-required');return[names[i],n!]}))
 const characters=(rows[0] as {characters?:Character[]}|null)?.characters,map=(rows[1] as {maps?:BattleMap[]}|null)?.maps?.find(m=>m.id===input.mapId),combat=rows[2] as SharedCombatState|null
 if(!characters||!map||!combat||combat.active!==true||combat.flowPause||combat.mapId!==map.id||!combat.combatId||!Number.isSafeInteger(input.actionIndex)||input.actionIndex<0||!mastermindExecutionParentId(input.parentTransactionId))throw Error('mastermind-native-misdirection:current-parent-required')
 if(!input.readiedAttack&&input.resourceKind!=='legendary-action'&&combat.initiativeOrder[combat.initiativeIndex]?.tokenId!==input.actorTokenId)throw Error('mastermind-native-misdirection:actual-activation-required')
 const geometry=normalizeSharedMapGeometry(rows[3]);if(rows[3]!=null&&!geometry)throw Error('mastermind-native-misdirection:canonical-geometry-required')
 const actual=prepareDnd5eMonsterAttack({geometry:geometry?.maps.find(m=>m.mapId===map.id)??null,combatId:combat.combatId,round:combat.round,map,characters,initiativeOrder:combat.initiativeOrder,currentInitiativeIndex:combat.initiativeIndex,
  actorTokenId:input.actorTokenId,targetTokenId:input.targetTokenId,actionIndex:input.actionIndex,resourceKind:input.resourceKind,readiedAttack:input.readiedAttack,
  multiattackContinuation:step?.mode==='continue'?{schemaVersion:1,parentActionId:step.parentActionId,occurrenceIndex:step.occurrenceIndex}:undefined,
  turnEconomy:combat.dnd5eTurnEconomyByToken?.[input.actorTokenId],turnEconomyByToken:combat.dnd5eTurnEconomyByToken})
 if(!actual.ok)throw Error('mastermind-native-misdirection:original-'+actual.reason)
 const actualActor=actual.prepared.state.combatants[input.actorTokenId];if(actualActor?.classState.monsterMultiattackContinuation&&!actualActor.turn.actionAvailable&&!input.readiedAttack&&actual.prepared.resourceKind==='action'&&step?.mode!=='continue')throw Error('mastermind-native-misdirection:actual-committed-continuation-required')
 if(actual.prepared.compositeRuntime)throw Error('mastermind-native-misdirection:single-native-original-required')
 if(step?.mode==='start'){if(actual.prepared.resourceKind!=='action'||actual.prepared.action.kind!=='multiattack'||actual.prepared.action.id!==step.parentActionId||actual.prepared.attacks.length<2)throw Error('mastermind-native-misdirection:actual-committed-starter-required')}else if(actual.prepared.attacks.length!==1)throw Error('mastermind-native-misdirection:single-native-original-required')
 const occurrence=input.occurrence??0;if(!Number.isSafeInteger(occurrence)||occurrence<0||!actual.prepared.attacks[occurrence]||step&&occurrence!==0)throw Error('mastermind-native-misdirection:actual-attack-occurrence-required')
 return{session,versions,prepared:actual.prepared,occurrence,sourceOccurrence:step?.occurrenceIndex??occurrence}
}
export interface MastermindNativeMonsterOriginal {readonly mastermindNativeMonsterOriginal:unique symbol}
type Issued={descriptor:Descriptor;prepared:PreparedDnd5eMonsterAttack;occurrence:number;session:{roomId:string;memberId:string};versions:Record<string,number>;id:string;featureId:string;sourceSignature:string;sourceCurrent:()=>boolean;nativeOriginal:{schemaVersion:1;family:'monster-attack';combatId:string;sourceId:string;statBlockId:string;occurrence:number}}
const originals=new WeakMap<object,Issued>()
const decisions=new WeakMap<object,{original:MastermindNativeMonsterOriginal;gateway:Gateway}>()
type Native=ReturnType<typeof resolvePreparedDnd5eMonsterAttack>
type NativeWardProof={root:Decision;bookRevision:number;rowSignature:string;rowId:string;events:Dnd5eCombatEvent[];state:PreparedDnd5eMonsterAttack['state'];signature:string}
const nativeWardModifierRows=new WeakMap<NativeWardProof,readonly string[]>()
const nativeWardDecisions=new WeakMap<object,NativeWardProof>()
const blockedNativeWardResults=new WeakMap<object,NativeWardProof>()
type BaseInput=Native['result']
type Base=Awaited<ReturnType<typeof settleDnd5eConcentrationChecks>>
const nativeResults=new WeakMap<object,{decision:Decision;result:Native;signature:string;input?:BaseInput;inputSignature?:string}>(),completedResults=new WeakMap<object,{native:object;base:Base}>()
function actualRedirectConsumed(decision:Decision,native:Native){
 if(!native.result.ok)return
 const use=decision.coverAttackRedirect,events=native.result.events.filter(e=>e.type==='cover-attack-redirected')
 if(use&&(events.length!==1||!events.some(e=>e.actorId===decision.prepared.actorToken.id&&e.featureId===use.featureId&&e.originalTargetId===use.originalTargetId&&e.finalTargetId===use.replacementTargetId)||native.result.state.combatants[use.originalTargetId]?.turn.reactionAvailable!==false))throw Error('mastermind-native-misdirection:actual-redirect-consumption-required')
 if(!use&&events.length)throw Error('mastermind-native-misdirection:unissued-redirect-forbidden')
}
/** Canonical resources are loaded before the concrete native preparation. The
 * input contains only identities and the original monster action selection;
 * no prepared JSON, combat snapshot, raw dice or caller candidate list enters. */
export async function prepareMastermindNativeMonsterOriginal(input:Descriptor,g:Gateway):Promise<MastermindNativeMonsterOriginal|undefined>{
 const current=await canonical(input,g),p=current.prepared,targetId=p.attacks[current.occurrence].targetToken.id,owner=p.state.combatants[targetId]
 if(!owner)return undefined
 const candidates=dnd5eCombatantCoverRedirectFeatureIds(owner).flatMap(featureId=>{const targets=Object.keys(p.state.combatants).filter(id=>dnd5eCoverAttackRedirectEligible(p.state,p.actorToken.id,targetId,id,featureId));return targets.length?[{featureId,targets}]:[]})
 if(!candidates.length)return undefined;if(candidates.length!==1)throw Error('mastermind-native-misdirection:ambiguous-source')
 const {featureId,targets}=candidates[0],feature=dnd5ePluginFeatureDefinition(featureId)!,source=feature.sourceSubclassId&&captureDnd5ePluginSubclassEnvelopeRegistrationV1(feature.ownerPluginId,feature.sourceSubclassId)
 if(!source||source()?.level!=='full')throw Error('mastermind-native-misdirection:current-full-source-required')
 const ownerCharacterId=p.characterIdByCombatantId[targetId];if(!ownerCharacterId)throw Error('mastermind-native-misdirection:canonical-owner-required')
 const sourceSignature=JSON.stringify(ordered(feature)),id='mastermind-misdirection:'+dnd5eExecutionEventKey(JSON.stringify([input.parentTransactionId,p.actorToken.id,current.sourceOccurrence,targetId])),nativeOriginal={schemaVersion:1 as const,family:'monster-attack' as const,combatId:p.state.combatId,sourceId:p.resourceAction.id,statBlockId:p.monster.id,occurrence:current.sourceOccurrence}
 await g.request('begin-native',{id,parentTransactionId:input.parentTransactionId,mapId:p.map.id,attackerTokenId:p.actorToken.id,ownerTokenId:targetId,ownerCharacterId,featureId,replacementTokenIds:targets,sourceDefinitionSignature:sourceSignature,versions:current.versions,nativeOriginal});stillHost(g,current.session)
 const cap=Object.freeze({}) as MastermindNativeMonsterOriginal;originals.set(cap,{...current,descriptor:plain(input),id,featureId,sourceSignature,sourceCurrent:()=>source()?.level==='full',nativeOriginal});return cap
}
type Decision={prepared:PreparedDnd5eMonsterAttack;previewPrepared:PreparedDnd5eMonsterAttack;occurrence:number;parentTransactionId:string;coverAttackRedirect?:Dnd5eCoverAttackRedirectUse}
async function readMastermindNativeMonsterPrimaryDecision(cap:MastermindNativeMonsterOriginal,g:Gateway):Promise<Decision|undefined>{
 const issued=originals.get(cap);if(!issued)throw Error('mastermind-native-misdirection:issued-original-required')
 const current=await canonical(issued.descriptor,g)
 if(!same(current.session,issued.session)||!same(current.versions,issued.versions)||!same(current.prepared,issued.prepared)||!issued.sourceCurrent()||JSON.stringify(ordered(dnd5ePluginFeatureDefinition(issued.featureId)))!==issued.sourceSignature)throw Error('mastermind-native-misdirection:original-or-source-changed')
 const journal=await g.loadResource<{parents:Record<string,{phase:string;versions:Record<string,number>;parentTransactionId:string;roomId:string;hostMemberId:string;nativeOriginal:unknown;featureId:string;sourceDefinitionSignature:string;replacementTokenIds:string[];answer?:{choice:string;submittedByMemberId:string};ownerMemberId:string}>}>('mastermind-misdirections');stillHost(g,issued.session)
 const row=journal?.parents?.[issued.id];if(!row||row.roomId!==issued.session.roomId||row.hostMemberId!==issued.session.memberId||row.parentTransactionId!==issued.descriptor.parentTransactionId||!same(row.versions,issued.versions)||!same(row.nativeOriginal,issued.nativeOriginal)||row.featureId!==issued.featureId||row.sourceDefinitionSignature!==issued.sourceSignature)throw Error('mastermind-native-misdirection:authenticated-parent-required')
 if(row.phase==='waiting')return undefined;if(row.phase!=='answered'||!row.answer||row.answer.submittedByMemberId!==row.ownerMemberId)throw Error('mastermind-native-misdirection:authenticated-owner-answer-required')
 let preview=current.prepared,use:Dnd5eCoverAttackRedirectUse|undefined
 if(row.answer.choice!=='decline'){
  const target=current.prepared.attacks[current.occurrence].targetToken.id,candidate=current.prepared.map.tokens.find(t=>t.id===row.answer!.choice)
  if(!candidate||!row.replacementTokenIds.includes(candidate.id)||!dnd5eCoverAttackRedirectEligible(current.prepared.state,current.prepared.actorToken.id,target,candidate.id,issued.featureId))throw Error('mastermind-native-misdirection:current-cover-required')
  const refresh=refreshDnd5eMonsterAttackOccurrence(current.prepared,current.prepared.state,current.occurrence,{featureId:issued.featureId,originalTargetId:target,replacementTargetId:candidate.id})
  if(!refresh.ok)throw Error('mastermind-native-misdirection:replacement-'+refresh.reason);preview=refresh.prepared;use=Object.freeze({featureId:issued.featureId,originalTargetId:target,replacementTargetId:candidate.id})
 }
 const result=Object.freeze({prepared:current.prepared,previewPrepared:preview,occurrence:current.occurrence,parentTransactionId:issued.descriptor.parentTransactionId,coverAttackRedirect:use});decisions.set(result,{original:cap,gateway:g});return result
}
type DirectOwnerRow={id:string;signature:string}
const directOwnerProofs=new WeakMap<object,{events:Dnd5eCombatEvent[];rows:DirectOwnerRow[]}>(),directOwnerSources=new WeakMap<object,Map<string,{current:()=>boolean;signature:string}>>()
/** Every successor follows a genuine prior owner answer and native reaction
 * prefix. Neither this DTO nor its private journal grants a world result. */
export async function readMastermindNativeMonsterDecision(cap:MastermindNativeMonsterOriginal,g:Gateway):Promise<Decision|undefined>{
 let current:Decision|undefined=await readMastermindNativeMonsterPrimaryDecision(cap,g);if(!current)return undefined;
 const issued=originals.get(cap)!;let previousId=issued.id;const rows:DirectOwnerRow[]=[],events:Dnd5eCombatEvent[]=[],owners=new Set<string>(),sources=directOwnerSources.get(cap)??new Map<string,{current:()=>boolean;signature:string}>();directOwnerSources.set(cap,sources)
 for(let depth=0;depth<64;depth++){
  const use:Dnd5eCoverAttackRedirectUse|undefined=current.coverAttackRedirect;if(!use)return current;
  const prefix=resolveDnd5eCoverAttackRedirectPrefix(current.prepared.state,current.prepared.actorToken.id,use);if(!prefix)throw Error('native-direct-owner:actual-prefix-required');
  // An ordinary replacement retains the existing issued decision. Only a real
  // eligible successor owner enters the additional native-parent protocol.
  const successor=prefix.state.combatants[use.replacementTargetId];
  if(!successor||!dnd5eCombatantCoverRedirectFeatureIds(successor).some(featureId=>Object.keys(prefix.state.combatants).some(id=>dnd5eCoverAttackRedirectEligible(prefix.state,current!.prepared.actorToken.id,use.replacementTargetId,id,featureId))))return current;
  const ownerId:string=use.replacementTargetId,fresh=await canonical(issued.descriptor,g);if(!same(fresh.session,issued.session)||!same(fresh.versions,issued.versions)||fresh.prepared.resourceAction.id!==issued.prepared.resourceAction.id||fresh.prepared.monster.id!==issued.prepared.monster.id)throw Error('native-direct-owner:same-original-required');
  const prepared:PreparedDnd5eMonsterAttack=projectDnd5eMonsterAttackPreparation(current.previewPrepared,prefix.state),owner:PreparedDnd5eMonsterAttack['state']['combatants'][string]=prepared.state.combatants[ownerId],features:{featureId:string;targets:string[]}[]=dnd5eCombatantCoverRedirectFeatureIds(owner).map(featureId=>({featureId,targets:Object.keys(prepared.state.combatants).filter(id=>dnd5eCoverAttackRedirectEligible(prepared.state,prepared.actorToken.id,ownerId,id,featureId))})).filter(row=>row.targets.length);
  if(!features.length)return current;
  if(current.prepared.attacks.length!==1||current.occurrence!==0||issued.descriptor.multiattackStep||features.length!==1||owners.has(ownerId)||dnd5eAttackAttemptWardRequirements(prepared.state,prepared.actorToken.id,ownerId).length)throw Error('native-direct-owner:single-unwarded-successor-required');
  owners.add(use.originalTargetId);owners.add(ownerId);const selected:{featureId:string;targets:string[]}=features[0],feature=dnd5ePluginFeatureDefinition(selected.featureId),capture=feature?.sourceSubclassId&&captureDnd5ePluginSubclassEnvelopeRegistrationV1(feature.ownerPluginId,feature.sourceSubclassId),ownerCharacterId=prepared.characterIdByCombatantId[ownerId];if(!feature||!capture||capture()?.level!=='full'||!ownerCharacterId)throw Error('native-direct-owner:actual-current-full-source-required');
  const id='mastermind-misdirection:'+dnd5eExecutionEventKey(JSON.stringify([issued.id,previousId,ownerId,'redirect-owner'])),sourceSignature=JSON.stringify(ordered(feature)),prior=sources.get(id);if(prior&&(!prior.current()||prior.signature!==sourceSignature))throw Error('native-direct-owner:original-source-changed');if(!prior)sources.set(id,{current:()=>capture()?.level==='full',signature:sourceSignature});
  const redirectOriginal={schemaVersion:1,rootParentId:issued.id,previousParentId:previousId};await g.request('begin-native',{id,parentTransactionId:issued.descriptor.parentTransactionId,mapId:prepared.map.id,attackerTokenId:prepared.actorToken.id,ownerTokenId:ownerId,ownerCharacterId,featureId:selected.featureId,replacementTokenIds:selected.targets,sourceDefinitionSignature:sourceSignature,versions:issued.versions,nativeOriginal:issued.nativeOriginal,redirectOriginal});
  const journal=await g.loadResource<{parents:Record<string,{id:string;phase:string;revision:number;ownerMemberId:string;answer?:{choice:string;submittedByMemberId:string};redirectOriginal:unknown;featureId:string;sourceDefinitionSignature:string;replacementTokenIds:string[];versions:Record<string,number>}>}>('mastermind-misdirections');stillHost(g,issued.session);const row=journal?.parents[id];if(!row||!same(row.redirectOriginal,redirectOriginal)||row.featureId!==selected.featureId||row.sourceDefinitionSignature!==sourceSignature||!same(row.replacementTokenIds,selected.targets)||!same(row.versions,issued.versions))throw Error('native-direct-owner:actual-protected-successor-required');if(row.phase==='waiting')return undefined;if(row.phase!=='answered'||row.revision!==2||row.answer?.submittedByMemberId!==row.ownerMemberId||!row.answer||row.answer.choice!=='decline'&&!selected.targets.includes(row.answer.choice))throw Error('native-direct-owner:actual-controller-answer-required');
  rows.push({id,signature:nativeWardSignature(row)});events.push(...prefix.events);let preview=prepared,nextUse:Dnd5eCoverAttackRedirectUse|undefined;if(row.answer.choice!=='decline'){nextUse={featureId:selected.featureId,originalTargetId:ownerId,replacementTargetId:row.answer.choice};const next=refreshDnd5eMonsterAttackOccurrence(prepared,prepared.state,0,nextUse);if(!next.ok)throw Error('native-direct-owner:actual-cover-'+next.reason);preview=next.prepared}
  current=Object.freeze({prepared,previewPrepared:preview,occurrence:0,parentTransactionId:issued.descriptor.parentTransactionId,coverAttackRedirect:nextUse});decisions.set(current,{original:cap,gateway:g});directOwnerProofs.set(current,{events:plain(events),rows:plain(rows)});previousId=id;
 }throw Error('native-direct-owner:bounded-acyclic-original-required')
}
function expectedExecution(decision:Decision){const binding=decisions.get(decision),issued=binding&&originals.get(binding.original);if(!issued)throw Error('mastermind-native-misdirection:issued-decision-required');const step=issued.descriptor.multiattackStep;return{rollCount:step?1:decision.prepared.attacks.length,settleAttackCount:step?.mode==='start'?1:undefined,multiattackContinuation:step?.mode==='continue'?{schemaVersion:1 as const,parentActionId:step.parentActionId,occurrenceIndex:step.occurrenceIndex}:undefined}}
/** The caller's physical rows are kept; only the actual owner-authorized target
 * use is attached to the selected original occurrence before native resolution. */
export async function resolveMastermindNativeMonsterDecision(decision:Decision,rolls:Parameters<typeof resolvePreparedDnd5eMonsterAttack>[0]['rolls']){
 const binding=decisions.get(decision);if(!binding)throw Error('mastermind-native-misdirection:issued-decision-required')
 const approved=await currentMastermindNativeMonsterDecisionForUse(decision)
 const current=approved??decision
 const execution=expectedExecution(decision);if(rolls.length!==execution.rollCount)throw Error('mastermind-native-misdirection:original-roll-count-required')
 const nativeRolls=rolls.map((roll,index)=>{if(roll.coverAttackRedirect)throw Error('mastermind-native-misdirection:caller-redirect-forbidden');return index===current.occurrence?{...roll,targetId:current.coverAttackRedirect?.replacementTargetId??current.prepared.attacks[index].targetToken.id,mode:current.previewPrepared.attackModes[index],coverAttackRedirect:current.coverAttackRedirect}:roll})
 const result=resolvePreparedDnd5eMonsterAttack({prepared:current.prepared,transactionId:current.parentTransactionId,rolls:nativeRolls,settleAttackCount:execution.settleAttackCount,multiattackContinuation:execution.multiattackContinuation});actualRedirectConsumed(current,result);if(result.result.ok&&result.application)registerNativeResult(decision,result);return result
}
/** A common concrete-facade caller may retain its ordinary resolver identity.
 * Only the actual facade's unchanged result for this issued source and this
 * exact owner-approved target use can acquire the same local completion proof. */
export async function bindMastermindNativeMonsterFacadeResult(decision:Decision,result:Native){
 await assertMastermindNativeMonsterDecisionCurrent(decision)
 const bound=nativeResults.get(result);if(bound){if(bound.decision!==decision||bound.signature!==JSON.stringify(ordered(result))||bound.input&&bound.inputSignature!==JSON.stringify(ordered(bound.input)))throw Error('mastermind-native-misdirection:unchanged-original-result-binding-required');return result}
 const execution=expectedExecution(decision),actual=readDnd5eActualMonsterFacadeResult(decision.prepared,result),row=actual.rolls[decision.occurrence]
 if(!result.result.ok||!result.application||actual.transactionId!==decision.parentTransactionId||actual.rolls.length!==execution.rollCount||actual.settleAttackCount!==execution.settleAttackCount||!same(actual.multiattackContinuation,execution.multiattackContinuation)||actual.rolls.some((roll,index)=>index!==decision.occurrence&&roll.coverAttackRedirect!==undefined)||!row||!same(row.coverAttackRedirect,decision.coverAttackRedirect)||(row.targetId??decision.prepared.attacks[decision.occurrence].targetToken.id)!==(decision.coverAttackRedirect?.replacementTargetId??decision.prepared.attacks[decision.occurrence].targetToken.id))throw Error('mastermind-native-misdirection:same-native-original-required')
 actualRedirectConsumed(decision,result)
 registerNativeResult(decision,result);return result
}
/** UI waiting owns no dice. Every ready answer is read through the same original
 * five-resource/native-source proof immediately before the physical producer. */
export async function collectMastermindNativeMonsterOriginal(input:Descriptor,g:Gateway=defaultGateway){
 // This is only an early no-source routing check. A real candidate still
 // enters every unchanged native-parent, source, geometry and version gate.
 if(!input||typeof input!=='object'||Object.keys(input).some(k=>!['parentTransactionId','mapId','actorTokenId','targetTokenId','actionIndex','occurrence','resourceKind','readiedAttack','multiattackStep'].includes(k)))throw Error('mastermind-native-misdirection:closed-native-identity-required')
 const session=host(g),[charactersDoc,mapsDoc,combat]=await Promise.all([g.loadResource<{characters:Character[]}>('characters'),g.loadResource<{maps:BattleMap[]}>('maps'),g.loadResource<SharedCombatState>('combat')]);stillHost(g,session)
 const map=mapsDoc?.maps.find(map=>map.id===input.mapId)
 if(map&&charactersDoc){
  const source=createDnd5eMapCombatSnapshot({combatId:combat?.combatId??'mastermind-source-only',round:combat?.round,map,characters:charactersDoc.characters,initiativeOrder:combat?.initiativeOrder??[]}),owner=source.state.combatants[input.targetTokenId]
  if(!owner||!dnd5eCombatantCoverRedirectFeatureIds(owner).length)return undefined
 }
 const cap=await prepareMastermindNativeMonsterOriginal(input,g);if(!cap)return undefined
 const end=Date.now()+600000
 for(;;){const ready=await readMastermindNativeMonsterDecision(cap,g);if(ready)return ready;if(Date.now()>=end)throw Error('mastermind-native-misdirection:owner-choice-pending');await new Promise<void>(resolve=>setTimeout(resolve,250))}
}
async function currentMastermindNativeMonsterDecisionForUse(value:object):Promise<Decision|undefined>{if(directOwnerProofs.has(value)){const binding=decisions.get(value);if(!binding)throw Error('native-direct-owner:actual-issued-required');const current=await readMastermindNativeMonsterDecision(binding.original,binding.gateway);if(!current||!same(current,value))throw Error('native-direct-owner:unchanged-issued-source-required');return current;}const retarget=nativeWardRetargetDecisions.get(value);if(retarget)return assertNativeWardRetarget(value as Decision,retarget);const ward=nativeWardDecisions.get(value);if(ward){await currentMastermindNativeMonsterDecisionForUse(ward.root);return(await readNativeWardProof(value as Decision,ward)).currentSnapshot}const binding=decisions.get(value);if(!binding)throw Error('mastermind-native-misdirection:issued-decision-required');const current=await readMastermindNativeMonsterDecision(binding.original,binding.gateway);if(!current||!same(current,value))throw Error('mastermind-native-misdirection:decision-changed');return undefined}
export async function assertMastermindNativeMonsterDecisionCurrent(value:object){await currentMastermindNativeMonsterDecisionForUse(value)}
export async function completeMastermindNativeMonsterBase(value:object,base:Base){if(blockedNativeWardResults.has(value))throw Error('native-ward-original:terminal-actor-outcome-required');const native=nativeResults.get(value);if(!native||native.signature!==JSON.stringify(ordered(value)))throw Error('mastermind-native-misdirection:actual-native-result-required');await assertMastermindNativeMonsterDecisionCurrent(native.decision);readDnd5eCompletedCombatBase(readMastermindNativeMonsterBaseInput(value),base);const cap=Object.freeze({});completedResults.set(cap,{native:value,base});return cap}
export async function readMastermindNativeMonsterCompleted(cap:object){
 const completed=completedResults.get(cap),native=completed&&nativeResults.get(completed.native);if(!completed||!native||native.signature!==JSON.stringify(ordered(completed.native)))throw Error('mastermind-native-misdirection:actual-completed-Base-required')
 await assertMastermindNativeMonsterDecisionCurrent(native.decision);readDnd5eCompletedCombatBase(readMastermindNativeMonsterBaseInput(completed.native),completed.base)
 const decision=decisions.get(native.decision)!,original=originals.get(decision.original)!,wardBountiful=await nativeWardBountifulPublication(native.result),ownerRows=await nativeWardSuccessorOwnerRows(native.decision);return{ownerRows,gateway:decision.gateway,session:original.session,versions:{...original.versions},id:original.id,parentTransactionId:original.descriptor.parentTransactionId,mapId:original.prepared.map.id,readGuards:await nativeWardResultReadGuards(native.result),wardBountiful,result:wardBountiful?nativeWardSavingSnapshot(completed.base.result):completed.base.result,application:wardBountiful?nativeWardSavingSnapshot(completed.base.application):completed.base.application}
}

type NativeWardRow={modifierKind?:'bane';modifierSourceSignature?:string;primaryRequestId?:string;retargetChoiceId?:string;previousRequestId?:string;id:string;parentId:string;parentTransactionId:string;mapId:string;roomId:string;hostMemberId:string;actorTokenId:string;wardTargetTokenId:string;wardEffectId:string;statBlockId:string;sourceId:string;occurrence:number;sourceParentSignature:string;wardEffectSignature:string;versions:Record<string,number>;mode:'normal'|'advantage'|'disadvantage';count:number;sides:20|4;phase:'issued'|'raw'|'confirmed';complete:boolean;raw?:{memberId:string;values:number[]};confirmed?:{memberId:string;values:number[]}}
type NativeWardBook={requests:Record<string,NativeWardRow>;_sync:{revision:number}}
const nativeWardOrdered=(value:unknown):unknown=>Array.isArray(value)?value.map(nativeWardOrdered):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([key,value])=>[key,nativeWardOrdered(value)])):value
const nativeWardSignature=(value:unknown)=>JSON.stringify(nativeWardOrdered(value))
async function nativeWardDigest(value:unknown){const bytes=new TextEncoder().encode(nativeWardSignature(value)),hash=await crypto.subtle.digest('SHA-256',bytes);return[...new Uint8Array(hash)].map(value=>value.toString(16).padStart(2,'0')).join('')}
async function nativeWardSource(decision:Decision){
 const binding=decisions.get(decision),issued=binding&&originals.get(binding.original);if(!binding||!issued)throw Error('native-ward-original:actual-native-decision-required');
 const approved=await currentMastermindNativeMonsterDecisionForUse(decision);
 const journal=await binding.gateway.loadResource<{parents:Record<string,{issuedAt:number}>}>('mastermind-misdirections'),parent=journal?.parents[issued.id],p=(approved??decision).previewPrepared,target=p.attacks[decision.occurrence].targetToken;
 if(!parent||!Number.isSafeInteger(parent.issuedAt)||parent.issuedAt<=0||p.actorToken.characterId!==undefined||p.actorToken.poolId!==issued.nativeOriginal.statBlockId)throw Error('native-ward-original:actual-NPC-parent-required');
 return{binding,issued,parent,p,target,requirements:dnd5eAttackAttemptWardRequirements(p.state,p.actorToken.id,target.id)}
}
async function readNativeWardRow(decision:Decision,requireComplete=true){
 const facts=await nativeWardSource(decision),needed=facts.requirements.filter(entry=>entry.receipt===undefined);if(needed.length!==1||facts.requirements.some(entry=>entry.receipt?.success===false))throw Error('native-ward-original:single-unsettled-Ward-required');
 const actor=facts.p.state.combatants[facts.p.actorToken.id];if(actor.classState.bardicInspirationDie||Object.values(actor.classState.concentrationEffectsBySource??{}).some(value=>value==='bless'))throw Error('native-ward-original:additional-saving-input-not-supported');
 const book=await facts.binding.gateway.loadResource<NativeWardBook>('mastermind-native-ward-originals'),rows=Object.values(book?.requests??{}).filter(row=>row.parentId===facts.issued.id&&row.modifierKind===undefined&&row.wardEffectId===needed[0].effect.id&&row.wardTargetTokenId===facts.target.id&&row.retargetChoiceId===nativeWardRetargetDecisions.get(decision)?.choiceId),row=rows[0];
 if(!book||!Number.isSafeInteger(book._sync?.revision)||rows.length!==1||!row||row.parentTransactionId!==facts.issued.descriptor.parentTransactionId||row.roomId!==facts.issued.session.roomId||row.hostMemberId!==facts.issued.session.memberId||row.mapId!==facts.p.map.id||row.actorTokenId!==facts.p.actorToken.id||row.wardTargetTokenId!==facts.target.id||row.wardEffectId!==needed[0].effect.id||row.wardEffectSignature!==await nativeWardStoredEffectSignature(facts,needed[0].effect,facts.target.id)||row.sourceParentSignature!==nativeWardSignature(facts.parent)||row.statBlockId!==facts.issued.nativeOriginal.statBlockId||row.sourceId!==facts.issued.nativeOriginal.sourceId||row.occurrence!==facts.issued.nativeOriginal.occurrence||!same(row.versions,facts.issued.versions)||row.previousRequestId!==(nativeWardRetargetDecisions.get(decision)?blockedNativeWardResults.get(nativeWardRetargetDecisions.get(decision)!.blocked)?.rowId:undefined)||row.mode!==needed[0].mode||row.count!==(needed[0].mode==='normal'?1:2)||row.sides!==20||requireComplete&&!row.complete||row.phase!=='confirmed'||row.raw?.memberId!==facts.issued.session.memberId||row.confirmed?.memberId!==facts.issued.session.memberId||row.raw.values.length!==row.count||row.confirmed.values.length!==row.count||[...row.raw.values,...row.confirmed.values].some(value=>!Number.isSafeInteger(value)||value<1||value>20))throw Error('native-ward-original:actual-completed-pool-required');
 return{...facts,decision,book,row,requirement:needed[0]}
}
async function readNativeWardProof(decision:Decision,proof:NativeWardProof){
 const facts=await readNativeWardRow(proof.root);assertNativeWardRawScope(proof,facts.book);await assertNativeWardBountifulProof(proof);const current=nativeWardBountifulDecisionSnapshot(decision);
 if(nativeWardSignature(facts.row)!==proof.rowSignature||nativeWardSignature({state:proof.state,events:proof.events})!==proof.signature||!same(current,{...proof.root,prepared:{...proof.root.prepared,state:proof.state},previewPrepared:{...proof.root.previewPrepared,state:proof.state}}))throw Error('native-ward-original:unchanged-issued-prefix-required');
 return{...facts,currentSnapshot:current===decision?undefined:current}
}
/** Only the protected physical pool is consumed. No caller Ward result, state,
 * saving array, DC or prepared DTO can authorize this concrete continuation. */
export async function settleMastermindNativeMonsterWard(decision:Decision){
 if(nativeWardDecisions.has(decision))throw Error('native-ward-original:unextended-native-required');
 const facts=await readNativeWardRow(decision),values=[...facts.row.confirmed!.values],actor=facts.p.state.combatants[facts.p.actorToken.id],no=()=>{throw Error('native-ward-original:additional-saving-input-not-supported')};
 const usedModifierRows:string[]=[];const saving=await resolveDnd5eSavingThrowInterrupts({state:facts.p.state,combatant:actor,targetName:actor.name,ability:facts.requirement.ward.ability,dc:facts.requirement.ward.dc,mode:facts.requirement.mode,label:facts.requirement.effect.label,rollD20Pair:async()=>[values[0]!,values[1]],rollD20:no,rollD4:async()=>{if(usedModifierRows.length)throw Error('native-ward-bane:single-actual-pool-required');const extra=await readNativeWardBaneRow(facts,true);usedModifierRows.push(extra.row.id);return extra.row.confirmed!.values[0]}});
 const saves:Dnd5eSpellcastingSavingThrowRoll[]=[{...saving,effectId:facts.requirement.effect.id,targetId:actor.id,disadvantageNegationChoice:undefined,optionalBonusDice:saving.optionalBonusDieUse?[saving.optionalBonusDieUse]:undefined}];
 const transaction={transactionId:'mastermind-native-ward:'+dnd5eExecutionEventKey(JSON.stringify([facts.issued.descriptor.parentTransactionId,facts.target.id,facts.requirement.effect.id])),now:facts.parent.issuedAt},clock=createDnd5eParentEffectClock({parentId:facts.issued.descriptor.parentTransactionId,sourceKey:'mastermind-native-ward:'+facts.issued.id,timestamp:facts.parent.issuedAt});
 const checked=clock.run(()=>resolveDnd5eHeadlessAction(facts.p.state,{type:'attack-ward-attempt',actorId:actor.id,targetId:facts.target.id,turnKey:dnd5eHeadlessTurnKey(facts.p.state,actor.id),saves},transaction));
 if(!checked.ok)throw Error('native-ward-original:actual-native-saving-required:'+checked.reason);
 const allowed=dnd5eAttackAttemptWardRequirements(checked.state,actor.id,facts.target.id).every(entry=>entry.receipt?.success===true);
 if(!allowed){const redirect=decision.coverAttackRedirect?resolveDnd5eCoverAttackRedirectPrefix(checked.state,actor.id,decision.coverAttackRedirect):{state:checked.state,events:[]};if(!redirect)throw Error('native-ward-original:actual-redirect-prefix-required');const blocked=Object.freeze({}),events=[...nativeWardInheritedEvents(decision),...checked.events,...redirect.events];blockedNativeWardResults.set(blocked,captureNativeWardProof(decision,facts,redirect.state,events,usedModifierRows));return{status:'blocked' as const,blocked}}
 const next:Decision=Object.freeze({...decision,prepared:{...decision.prepared,state:checked.state},previewPrepared:{...decision.previewPrepared,state:checked.state}});
 decisions.set(next,facts.binding);nativeWardDecisions.set(next,captureNativeWardProof(decision,facts,checked.state,[...nativeWardInheritedEvents(decision),...checked.events],usedModifierRows));return{status:'continue' as const,decision:next}
}
function registerNativeResult(decision:Decision,result:Native){const prior=nativeResults.get(result);if(prior){if(prior.decision!==decision||prior.result!==result||prior.signature!==JSON.stringify(ordered(result))||(prior.input?prior.inputSignature!==JSON.stringify(ordered(prior.input)):prior.inputSignature!==undefined))throw Error('mastermind-native-misdirection:unchanged-original-result-binding-required');return}const proof=nativeWardDecisions.get(decision),retarget=nearestNativeWardRetarget(decision),blocked=retarget&&blockedNativeWardResults.get(retarget.blocked),events=proof?.events??blocked?.events??directOwnerProofs.get(decision)?.events,input=events?{...result.result,events:[...events,...result.result.events]}:undefined;nativeResults.set(result,{decision,result,signature:JSON.stringify(ordered(result)),input,inputSignature:input?JSON.stringify(ordered(input)):undefined});if(retarget)nativeWardCostProofs.set(result,{blocked:retarget.blocked,choiceId:retarget.choiceId,revision:retarget.revision,signature:retarget.signature})}
export function readMastermindNativeMonsterBaseInput(value:object){const native=nativeResults.get(value);if(!native||native.signature!==JSON.stringify(ordered(value))||native.input&&native.inputSignature!==JSON.stringify(ordered(native.input)))throw Error('native-ward-original:unchanged-actual-native-required');const input=native.input??native.result.result;if(!input.ok)throw Error('native-ward-original:actual-successful-native-required');return input}
async function nativeWardReadGuards(decision:Decision):Promise<Record<string,number>>{const proof=nativeWardDecisions.get(decision);if(!proof)return{};const facts=await readNativeWardProof(decision,proof),actors=await facts.binding.gateway.loadResource<NativeWardOutcomeBook>('mastermind-native-ward-outcomes');assertNativeWardCompleteLineage(facts.issued.id,decision,facts.book,actors);return{'mastermind-native-ward-originals':facts.book._sync.revision,'mastermind-native-ward-outcomes':actors?._sync.revision??0}}

export interface MastermindNativeWardRollRequest{durableRollRequestId:string;rollerTokenId:string;mode:'normal'|'advantage'|'disadvantage';count:number;sides?:4;kind?:'bane';raw?:readonly number[];confirmed?:readonly number[]}
type NativeWardApi=<T>(operation:'register'|'request'|'raw'|'confirm'|'complete',input:unknown)=>Promise<T>
async function collectMastermindNativeMonsterWardOriginalPool(decision:Decision,api:NativeWardApi,run:(request:MastermindNativeWardRollRequest)=>Promise<readonly number[]>,afterOriginal?:()=>ReturnType<typeof settleMastermindNativeMonsterWard>){
 const facts=await nativeWardSource(decision),needed=facts.requirements.filter(entry=>entry.receipt===undefined);
 if(!needed.length)return{status:'continue' as const,decision};
 if(needed.length!==1||facts.requirements.some(entry=>entry.receipt?.success===false))throw Error('native-ward-original:single-unsettled-Ward-required');
 const registered=await api<{ok:boolean;request:{id:string;actorTokenId:string;wardTargetTokenId:string;wardEffectId:string;mode:'normal'|'advantage'|'disadvantage';count:number;sides:number;phase:string;complete:boolean;raw?:number[];confirmed?:number[]}}>('register',{parentId:facts.issued.id,wardEffectId:needed[0].effect.id,mode:needed[0].mode,...(nativeWardRetargetDecisions.get(decision)?{retargetChoiceId:nativeWardRetargetDecisions.get(decision)!.choiceId}:{})}),row=registered.request;
 if(!registered.ok||!row||!/^mm-native-ward-pool:[a-f0-9]{64}$/.test(row.id)||row.actorTokenId!==facts.p.actorToken.id||row.wardTargetTokenId!==facts.target.id||row.wardEffectId!==needed[0].effect.id||row.mode!==needed[0].mode||row.count!==(needed[0].mode==='normal'?1:2)||row.sides!==20)throw Error('native-ward-original:actual-registered-pool-required');
 if(!row.complete){const adopted=await run(Object.freeze({durableRollRequestId:row.id,rollerTokenId:row.actorTokenId,mode:row.mode,count:row.count,raw:row.raw?Object.freeze([...row.raw]):undefined,confirmed:row.confirmed?Object.freeze([...row.confirmed]):undefined})),reply=await api<{ok:boolean;request:{id:string;phase:string;raw?:number[];confirmed?:number[]}}>('request',{requestId:row.id});if(!reply.ok||reply.request?.id!==row.id||reply.request.phase!=='confirmed'||!reply.request.raw||!same(reply.request.confirmed,adopted))throw Error('native-ward-original:actual-physical-adoption-required')}
 await collectNativeWardBanePools(decision,api,run);if(!row.complete)await api('complete',{requestId:row.id});
 return afterOriginal?afterOriginal():settleMastermindNativeMonsterWard(decision)
}

type NativeWardOutcomeRow={id:string;parentId:string;requestId:string;parentTransactionId:string;roomId:string;hostMemberId:string;mapId:string;actorTokenId:string;wardTargetTokenId:string;sourceSignature:string;versions:Record<string,number>;retargetTokenIds:string[];phase:'waiting'|'answered';revision:number;answer?:{choice:'waste'|'retarget';targetTokenId?:string;memberId:string}}
type NativeWardOutcomeBook={choices:Record<string,NativeWardOutcomeRow>;_sync:{revision:number}}
const nativeWardCostProofs=new WeakMap<object,{blocked:object;choiceId:string;revision:number;signature:string}>()
async function actualNativeWardBlocked(cap:object){
 const proof=blockedNativeWardResults.get(cap);if(!proof)throw Error('native-ward-outcome:actual-failed-Ward-required');
 await assertMastermindNativeMonsterDecisionCurrent(proof.root);const facts=await readNativeWardRow(proof.root);
 assertNativeWardRawScope(proof,facts.book);await assertNativeWardBountifulProof(proof);if(nativeWardSignature(facts.row)!==proof.rowSignature||nativeWardSignature({state:proof.state,events:proof.events})!==proof.signature||!dnd5eAttackAttemptWardRequirements(proof.state,facts.p.actorToken.id,facts.target.id).some(entry=>entry.receipt?.success===false))throw Error('native-ward-outcome:unchanged-failed-Ward-required');
 return{proof,facts}
}
async function actualNativeWardOutcome(cap:object){
 const actual=await actualNativeWardBlocked(cap),book=await actual.facts.binding.gateway.loadResource<NativeWardOutcomeBook>('mastermind-native-ward-outcomes'),rows=Object.values(book?.choices??{}).filter(row=>row.requestId===actual.facts.row.id),row=rows[0];
 if(!book||!Number.isSafeInteger(book._sync?.revision)||rows.length!==1||!row||row.id!=='mm-native-ward-outcome:'+await nativeWardDigest({parentId:actual.facts.issued.id,requestId:actual.facts.row.id})||row.parentId!==actual.facts.issued.id||row.parentTransactionId!==actual.facts.issued.descriptor.parentTransactionId||row.mapId!==actual.facts.p.map.id||row.roomId!==actual.facts.issued.session.roomId||row.hostMemberId!==actual.facts.issued.session.memberId||row.actorTokenId!==actual.facts.p.actorToken.id||row.wardTargetTokenId!==actual.facts.target.id||row.sourceSignature!==await nativeWardDigest(actual.facts.row)||!same(row.versions,actual.facts.issued.versions))throw Error('native-ward-outcome:actual-authenticated-actor-choice-required');
 return{...actual,book,row}
}
/** No original D20 is invented. This invokes the concrete original monster
 * attack's existing failed-Ward cost path after the real Host's own NPC choice. */
export async function resolveMastermindNativeMonsterWardWaste(blocked:object){
 const actual=await actualNativeWardOutcome(blocked);if(actual.row.phase!=='answered'||actual.row.revision!==2||actual.row.answer?.choice!=='waste'||actual.row.answer.memberId!==actual.facts.issued.session.memberId)throw Error('native-ward-outcome:actual-Host-waste-required');
 const prepared={...actual.proof.root.prepared,state:actual.proof.state},native=resolvePreparedDnd5eMonsterAttack({prepared,transactionId:actual.facts.issued.descriptor.parentTransactionId,rolls:[],wasteBlockedByWard:{targetId:actual.facts.target.id}});
 if(!native.result.ok||!native.application)throw Error('native-ward-outcome:actual-original-waste-required:'+(native.result.ok?'application':native.result.reason)+':'+JSON.stringify({kind:prepared.action.kind,resource:prepared.resourceKind,count:prepared.attacks.length,composite:Boolean(prepared.compositeRuntime),readied:prepared.readiedAttack,randomRepeatRoll:prepared.randomRepeatRoll}));
 const source=readDnd5eActualMonsterFacadeResult(prepared,native);if(source.rolls.length||source.transactionId!==actual.facts.issued.descriptor.parentTransactionId||source.wasteBlockedByWard?.targetId!==actual.facts.target.id)throw Error('native-ward-outcome:same-original-cost-required');
 const input={...native.result,events:[...actual.proof.events,...native.result.events]};nativeResults.set(native,{decision:actual.proof.root,result:native,signature:JSON.stringify(ordered(native)),input,inputSignature:JSON.stringify(ordered(input))});nativeWardCostProofs.set(native,{blocked,choiceId:actual.row.id,revision:actual.book._sync.revision,signature:nativeWardSignature(actual.row)});return native
}
async function nativeWardResultReadGuards(native:Native):Promise<Record<string,number>>{const cost=nativeWardCostProofs.get(native);if(!cost){const fact=nativeResults.get(native);if(!fact)throw Error('native-ward-outcome:actual-native-required');return nativeWardReadGuards(fact.decision)}const actual=await actualNativeWardOutcome(cost.blocked);if(actual.book._sync.revision!==cost.revision||nativeWardSignature(actual.row)!==cost.signature)throw Error('native-ward-outcome:unchanged-real-actor-choice-required');const fact=nativeResults.get(native);if(!fact)throw Error('native-ward-chain:actual-native-result-required');assertNativeWardCompleteLineage(actual.facts.issued.id,fact.decision,actual.facts.book,actual.book,cost);return{'mastermind-native-ward-originals':actual.facts.book._sync.revision,'mastermind-native-ward-outcomes':actual.book._sync.revision}}

type NativeWardRetargetProof={blocked:object;choiceId:string;revision:number;signature:string;targetId:string;ownerSignature?:string;ownerId?:string}
const nativeWardRetargetDecisions=new WeakMap<object,NativeWardRetargetProof>()
async function nativeWardRetargetPrepared(blocked:object,targetId:string){
 const actual=await actualNativeWardBlocked(blocked),{issued,binding}=actual.facts;
 if(targetId===actual.facts.p.actorToken.id||targetId===actual.facts.target.id||!actual.facts.p.map.tokens.some(token=>token.id===targetId))throw Error('native-ward-outcome:actual-retarget-required');
 const current=await canonical({...issued.descriptor,targetTokenId:targetId},binding.gateway);if(!same(current.session,issued.session)||!same(current.versions,issued.versions)||current.prepared.resourceAction.id!==actual.facts.p.resourceAction.id||current.prepared.monster.id!==actual.facts.p.monster.id||current.prepared.resourceKind!=='action'||current.prepared.action.kind!=='weapon-attack'||current.prepared.attacks.length!==1||current.prepared.compositeRuntime||current.prepared.readiedAttack)throw Error('native-ward-outcome:same-single-original-required');
 const refreshed=refreshDnd5eMonsterAttackOccurrence(current.prepared,actual.proof.state,0);if(!refreshed.ok)throw Error('native-ward-outcome:canonical-retarget-'+refreshed.reason);
 const p=refreshed.prepared;if(dnd5eAttackAttemptWardRequirements(p.state,p.actorToken.id,targetId).some(entry=>entry.receipt?.success===false))throw Error('native-ward-outcome:already-failed-retarget-Ward');

 return{actual,prepared:p}
}
export async function readMastermindNativeMonsterWardRetargetOffers(blocked:object){
 const actual=await actualNativeWardBlocked(blocked),offers:string[]=[];
 for(const target of actual.facts.p.map.tokens){if(target.id===actual.facts.p.actorToken.id||target.id===actual.facts.target.id)continue;try{await nativeWardRetargetPrepared(blocked,target.id);offers.push(target.id)}catch(error){if(!(error instanceof Error)||!error.message.startsWith('mastermind-native-misdirection:original-')&&!error.message.startsWith('native-ward-outcome:'))throw error}}
 return offers
}
async function nativeWardRetargetValue(proof:NativeWardRetargetProof){
 const current=await actualNativeWardOutcome(proof.blocked),row=current.row;assertNativeWardActorScope(proof,current.book);if(row.id!==proof.choiceId||nativeWardSignature(row)!==proof.signature||row.phase!=='answered'||row.answer?.choice!=='retarget'||row.answer.memberId!==current.facts.issued.session.memberId||row.answer.targetTokenId!==proof.targetId)throw Error('native-ward-outcome:unchanged-real-retarget-required');
 const prepared=await nativeWardRetargetPrepared(proof.blocked,proof.targetId),p=prepared.prepared,owner=p.state.combatants[proof.targetId],features=dnd5eCombatantCoverRedirectFeatureIds(owner).map(featureId=>({featureId,targets:Object.keys(p.state.combatants).filter(id=>dnd5eCoverAttackRedirectEligible(p.state,p.actorToken.id,proof.targetId,id,featureId))})).filter(item=>item.targets.length);
 if(!features.length)return{prepared:p,previewPrepared:p,occurrence:0,parentTransactionId:current.facts.issued.descriptor.parentTransactionId,coverAttackRedirect:undefined} satisfies Decision;
 if(features.length!==1)throw Error('native-ward-owner:single-current-feature-required');
 const selected=features[0],feature=dnd5ePluginFeatureDefinition(selected.featureId),source=feature?.sourceSubclassId&&captureDnd5ePluginSubclassEnvelopeRegistrationV1(feature.ownerPluginId,feature.sourceSubclassId),ownerCharacterId=p.characterIdByCombatantId[proof.targetId];
 if(!feature||!source||source()?.level!=='full'||!ownerCharacterId)throw Error('native-ward-owner:current-full-acquired-source-required');
 const issued=current.facts.issued,id='mastermind-misdirection:'+dnd5eExecutionEventKey(JSON.stringify([issued.id,row.id,proof.targetId])),wardRetargetOriginal={schemaVersion:1,rootParentId:issued.id,requestId:current.facts.row.id,outcomeId:row.id};
 await current.facts.binding.gateway.request('begin-native',{id,parentTransactionId:issued.descriptor.parentTransactionId,mapId:p.map.id,attackerTokenId:p.actorToken.id,ownerTokenId:proof.targetId,ownerCharacterId,featureId:selected.featureId,replacementTokenIds:selected.targets,sourceDefinitionSignature:JSON.stringify(ordered(feature)),versions:issued.versions,nativeOriginal:issued.nativeOriginal,wardRetargetOriginal});
 const journal=await current.facts.binding.gateway.loadResource<{parents:Record<string,{id:string;phase:string;revision:number;answer?:{choice:string;submittedByMemberId:string};ownerMemberId:string;wardRetargetOriginal:unknown;featureId:string;sourceDefinitionSignature:string;replacementTokenIds:string[];versions:Record<string,number>}>}>('mastermind-misdirections'),child=journal?.parents[id];
 if(!child||child.id!==id||!same(child.wardRetargetOriginal,wardRetargetOriginal)||child.featureId!==selected.featureId||child.sourceDefinitionSignature!==JSON.stringify(ordered(feature))||!same(child.replacementTokenIds,selected.targets)||!same(child.versions,issued.versions))throw Error('native-ward-owner:actual-unchanged-child-required');
 if(child.phase==='waiting')return undefined;
 if(child.phase!=='answered'||child.revision!==2||!child.answer||child.answer.submittedByMemberId!==child.ownerMemberId||child.answer.choice!=='decline'&&!selected.targets.includes(child.answer.choice))throw Error('native-ward-owner:actual-controller-answer-required');
 const signature=nativeWardSignature(child);if(proof.ownerSignature&&proof.ownerSignature!==signature||proof.ownerId&&proof.ownerId!==id)throw Error('native-ward-owner:immutable-owner-answer-required');proof.ownerSignature=signature;proof.ownerId=id;
 let preview=p,use:Dnd5eCoverAttackRedirectUse|undefined;if(child.answer.choice!=='decline'){use={featureId:selected.featureId,originalTargetId:proof.targetId,replacementTargetId:child.answer.choice};const refreshed=refreshDnd5eMonsterAttackOccurrence(p,p.state,0,use);if(!refreshed.ok)throw Error('native-ward-owner:actual-cover-'+refreshed.reason);preview=refreshed.prepared}
 return{prepared:p,previewPrepared:preview,occurrence:0,parentTransactionId:issued.descriptor.parentTransactionId,coverAttackRedirect:use} satisfies Decision
}
async function assertNativeWardRetarget(value:Decision,proof:NativeWardRetargetProof){const current=await nativeWardRetargetValue(proof),snapshot=nativeWardBountifulDecisionSnapshot(value);if(!current||!same(current,snapshot))throw Error('native-ward-outcome:unchanged-issued-retarget-required');return snapshot===value?undefined:snapshot}
/** A concrete re-preparation derives geometry, target eligibility and roll mode
 * from the actual protected source and the real original Host actor answer. */
export async function resumeMastermindNativeMonsterWardRetarget(blocked:object){
 const actual=await actualNativeWardOutcome(blocked),row=actual.row;if(row.phase==='waiting')return undefined;
 if(row.phase!=='answered'||row.answer?.choice!=='retarget'||row.answer.memberId!==actual.facts.issued.session.memberId||!row.answer.targetTokenId||!row.retargetTokenIds.includes(row.answer.targetTokenId))throw Error('native-ward-outcome:actual-Host-retarget-required');
 const proof:NativeWardRetargetProof={blocked,choiceId:row.id,revision:actual.book._sync.revision,signature:nativeWardSignature(row),targetId:row.answer.targetTokenId};captureNativeWardActorScope(proof,actual.book);const current=await nativeWardRetargetValue(proof);if(!current)return undefined;const next=Object.freeze(current);
 await authorizeNativeWardRawSuccessor(actual,proof,current);decisions.set(next,actual.facts.binding);nativeWardRetargetDecisions.set(next,proof);return next
}

type NativeWardOutcomeApi=<T>(operation:'register'|'project'|'list'|'answer',input:unknown)=>Promise<T>
export async function prepareMastermindNativeMonsterWardOutcome(blocked:object,api:NativeWardOutcomeApi){
 const actual=await actualNativeWardBlocked(blocked),targets=await readMastermindNativeMonsterWardRetargetOffers(blocked);await authorizeNativeWardActorSuccessor(actual,targets);const registered=await api<{ok:boolean;choice:{id:string;phase:string}}>('register',{requestId:actual.facts.row.id,retargetTokenIds:targets});
 if(!registered.ok||!registered.choice?.id)throw Error('native-ward-outcome:actual-registered-NPC-choice-required');
 const current=await actualNativeWardOutcome(blocked);if(current.row.id!==registered.choice.id||!same(current.row.retargetTokenIds,targets))throw Error('native-ward-outcome:actual-canonical-offers-required');
 if(current.row.phase==='waiting')return undefined;
 if(current.row.answer?.choice==='waste')return{status:'wasted' as const,native:await resolveMastermindNativeMonsterWardWaste(blocked)};
 if(current.row.answer?.choice==='retarget'){const decision=await resumeMastermindNativeMonsterWardRetarget(blocked);if(!decision)return undefined;return{status:'retargeted' as const,decision}}
 throw Error('native-ward-outcome:actual-Host-answer-required')
}
export async function collectMastermindNativeMonsterWardOutcome(blocked:object,api:NativeWardOutcomeApi){const deadline=Date.now()+600000;while(Date.now()<deadline){const outcome=await prepareMastermindNativeMonsterWardOutcome(blocked,api);if(outcome)return outcome;await new Promise<void>(resolve=>setTimeout(resolve,250))}throw Error('native-ward-outcome:actual-Host-choice-pending')}

/** Restore only a real protected current ordinary core-NPC Ward parent. Neither
 * a serialized prepared input nor a caller-authored original action is accepted. */
export async function restoreMastermindNativeMonsterWardDecision(parentId:string,g:Gateway=defaultGateway){
 if(typeof parentId!=='string'||!parentId.startsWith('mastermind-misdirection:'))throw Error('native-ward-restore:original-id-required');
 const session=host(g),[journal,book,maps]=await Promise.all([g.loadResource<{parents:Record<string,{id:string;roomId:string;hostMemberId:string;mapId:string;parentTransactionId:string;attackerTokenId:string;ownerTokenId:string;ownerMemberId:string;phase:string;originalAction?:unknown;nativeOriginal?:Issued['nativeOriginal'];answer?:{choice:string;submittedByMemberId:string};versions:Record<string,number>}>}>('mastermind-misdirections'),g.loadResource<NativeWardBook>('mastermind-native-ward-originals'),g.loadResource<{maps:BattleMap[]}>('maps')]);stillHost(g,session);
 const parent=journal?.parents?.[parentId],native=parent?.nativeOriginal;if(!parent||parent.phase==='consumed')return undefined;
 if(parent.id!==parentId||parent.phase!=='answered'||parent.roomId!==session.roomId||parent.hostMemberId!==session.memberId||parent.originalAction!==undefined||!native||native.family!=='monster-attack'||native.occurrence!==0||parent.answer?.submittedByMemberId!==parent.ownerMemberId||parent.answer.choice==='decline')throw Error('native-ward-restore:protected-native-parent-required');
 const originals=Object.values(book?.requests??{}).filter(row=>row.parentId===parentId&&row.modifierKind===undefined),roots=originals.filter(row=>row.previousRequestId===undefined&&row.retargetChoiceId===undefined);if(roots.length!==1||originals.length>64||!book||!Number.isSafeInteger(book._sync?.revision))throw Error('native-ward-restore:protected-original-required');const original=roots[0];
 const actors=await g.loadResource<NativeWardOutcomeBook>('mastermind-native-ward-outcomes');stillHost(g,session);const visited=new Set<string>();let cursor:NativeWardRow|undefined=original;
 while(cursor){if(visited.has(cursor.id))throw Error('native-ward-restore:acyclic-protected-chain-required');visited.add(cursor.id);const children=originals.filter(row=>row.previousRequestId===cursor!.id);if(children.length>1)throw Error('native-ward-restore:single-protected-successor-required');const child=children[0];if(!child)break;const choice=actors?.choices?.[child.retargetChoiceId??''];if(!cursor.complete||cursor.phase!=='confirmed'||!choice||choice.parentId!==parentId||choice.requestId!==cursor.id||choice.roomId!==session.roomId||choice.hostMemberId!==session.memberId||choice.actorTokenId!==parent.attackerTokenId||choice.wardTargetTokenId!==cursor.wardTargetTokenId||choice.parentTransactionId!==parent.parentTransactionId||choice.mapId!==parent.mapId||choice.phase!=='answered'||choice.answer?.memberId!==session.memberId||choice.answer.choice!=='retarget'||choice.answer.targetTokenId!==child.wardTargetTokenId||choice.sourceSignature!==await nativeWardDigest(cursor)||!same(choice.versions,parent.versions)||child.parentTransactionId!==parent.parentTransactionId||child.roomId!==session.roomId||child.hostMemberId!==session.memberId||child.mapId!==parent.mapId||child.actorTokenId!==parent.attackerTokenId||child.statBlockId!==native.statBlockId||child.sourceId!==native.sourceId||child.occurrence!==native.occurrence||child.sourceParentSignature!==nativeWardSignature(parent)||!same(child.versions,parent.versions))throw Error('native-ward-restore:authenticated-retarget-chain-required');cursor=child}
 if(visited.size!==originals.length)throw Error('native-ward-restore:unreachable-protected-original-required');
 if(original.parentTransactionId!==parent.parentTransactionId||original.roomId!==session.roomId||original.hostMemberId!==session.memberId||original.mapId!==parent.mapId||original.actorTokenId!==parent.attackerTokenId||original.wardTargetTokenId!==parent.answer.choice||original.statBlockId!==native.statBlockId||original.sourceId!==native.sourceId||original.occurrence!==native.occurrence||original.sourceParentSignature!==nativeWardSignature(parent)||!same(original.versions,parent.versions))throw Error('native-ward-restore:unchanged-protected-original-required');
 const map=maps?.maps.find(map=>map.id===parent.mapId),actor=map?.tokens.find(token=>token.id===parent.attackerTokenId);if(!actor||actor.characterId!==undefined||actor.poolId!==native.statBlockId)throw Error('native-ward-restore:canonical-NPC-required');
 const monster=getDnd5eSrdMonster(native.statBlockId),indexes=monster?.actions.flatMap((action,index)=>action.id===native.sourceId&&action.kind==='weapon-attack'&&action.attack?.mode==='melee'?[index]:[])??[];
 if(indexes.length!==1)throw Error('native-ward-restore:actual-core-single-melee-source-required');
 const cap=await prepareMastermindNativeMonsterOriginal({parentTransactionId:parent.parentTransactionId,mapId:parent.mapId,actorTokenId:parent.attackerTokenId,targetTokenId:parent.ownerTokenId,actionIndex:indexes[0]},g);if(!cap)throw Error('native-ward-restore:actual-reissued-native-required');
 const actual=await readMastermindNativeMonsterDecision(cap,g);if(!actual||actual.prepared.attacks.length!==1||actual.prepared.readiedAttack||actual.prepared.compositeRuntime||actual.prepared.resourceKind!=='action'||actual.prepared.action.kind!=='weapon-attack')throw Error('native-ward-restore:actual-same-native-decision-required');return actual
}

type NativeWardLedgerScope={rows:Record<string,unknown>;revision:number;allowed:Map<string,Record<string,unknown>>;resumable:Set<string>}
const nativeWardRawScopes=new WeakMap<NativeWardProof,NativeWardLedgerScope>(),nativeWardActorScopes=new WeakMap<NativeWardRetargetProof,NativeWardLedgerScope>()
const nativeWardRowsSnapshot=(rows:Record<string,unknown>):Record<string,unknown>=>JSON.parse(nativeWardSignature(rows))
function captureNativeWardProof(root:Decision,facts:Awaited<ReturnType<typeof readNativeWardRow>>,state:NativeWardProof['state'],events:Dnd5eCombatEvent[],modifierRows:readonly string[]=[]):NativeWardProof{
 const proof={root,rowId:facts.row.id,bookRevision:facts.book._sync.revision,rowSignature:nativeWardSignature(facts.row),state,events,signature:nativeWardSignature({state,events})};nativeWardModifierRows.set(proof,Object.freeze([...modifierRows]));nativeWardRawScopes.set(proof,{rows:nativeWardRowsSnapshot(facts.book.requests),revision:facts.book._sync.revision,allowed:new Map(),resumable:new Set()});return proof
}
function assertNativeWardRawScope(proof:NativeWardProof,book:NativeWardBook){const scope=nativeWardRawScopes.get(proof);if(!scope)throw Error('native-ward-chain:actual-prefix-scope-required');assertNativeWardLedgerDelta(scope.rows,scope.revision,book,scope.allowed,'raw',scope.resumable)}
function nativeWardInheritedEvents(decision:Decision){const retarget=nativeWardRetargetDecisions.get(decision);return retarget?blockedNativeWardResults.get(retarget.blocked)?.events??[]:[]}
function nativeWardProofAncestors(proof:NativeWardProof){const out:NativeWardProof[]=[],seen=new Set<NativeWardProof>();for(let next:NativeWardProof|undefined=proof;next;){if(seen.has(next)||out.length>=64)throw Error('native-ward-chain:acyclic-issued-prefix-required');seen.add(next);out.push(next);const retarget=nativeWardRetargetDecisions.get(next.root);next=retarget?blockedNativeWardResults.get(retarget.blocked):nativeWardDecisions.get(next.root)}return out}
function nativeWardRetargetAncestors(decision:Decision){const out:NativeWardRetargetProof[]=[],seen=new Set<object>();let next:Decision|undefined=decision;while(next){if(seen.has(next)||seen.size>=128)throw Error('native-ward-chain:acyclic-issued-decision-required');seen.add(next);const retarget=nativeWardRetargetDecisions.get(next);if(retarget){out.push(retarget);next=blockedNativeWardResults.get(retarget.blocked)?.root}else next=nativeWardDecisions.get(next)?.root}return out}
async function authorizeNativeWardRawSuccessor(actual:Awaited<ReturnType<typeof actualNativeWardOutcome>>,retarget:NativeWardRetargetProof,decision:Decision){
 const needed=dnd5eAttackAttemptWardRequirements(decision.previewPrepared.state,decision.previewPrepared.actorToken.id,retarget.targetId).filter(entry=>entry.receipt===undefined);if(!needed.length)return;if(needed.length!==1)throw Error('native-ward-chain:single-next-Ward-required');const item=needed[0],issued=actual.facts.issued;
 const descriptor:Record<string,unknown>={parentId:issued.id,parentTransactionId:issued.descriptor.parentTransactionId,mapId:actual.facts.p.map.id,roomId:issued.session.roomId,hostMemberId:issued.session.memberId,actorTokenId:actual.facts.p.actorToken.id,wardTargetTokenId:retarget.targetId,wardEffectId:item.effect.id,statBlockId:issued.nativeOriginal.statBlockId,sourceId:issued.nativeOriginal.sourceId,occurrence:issued.nativeOriginal.occurrence,sourceParentSignature:nativeWardSignature(actual.facts.parent),wardEffectSignature:await nativeWardStoredEffectSignature(actual.facts,item.effect,retarget.targetId),versions:issued.versions,retargetChoiceId:actual.row.id,previousRequestId:actual.facts.row.id,mode:item.mode,count:item.mode==='normal'?1:2,sides:20};const id='mm-native-ward-pool:'+await nativeWardDigest(descriptor);descriptor.id=id;
 for(const proof of nativeWardProofAncestors(actual.proof)){const scope=nativeWardRawScopes.get(proof);if(!scope)throw Error('native-ward-chain:actual-prefix-scope-required');scope.allowed.set(id,descriptor);if(Object.hasOwn(scope.rows,id))scope.resumable.add(id)}
}
function captureNativeWardActorScope(proof:NativeWardRetargetProof,book:NativeWardOutcomeBook){nativeWardActorScopes.set(proof,{rows:nativeWardRowsSnapshot(book.choices),revision:book._sync.revision,allowed:new Map(),resumable:new Set()})}
function assertNativeWardActorScope(proof:NativeWardRetargetProof,book:NativeWardOutcomeBook){const scope=nativeWardActorScopes.get(proof);if(!scope)throw Error('native-ward-chain:actual-retarget-scope-required');assertNativeWardLedgerDelta(scope.rows,scope.revision,book,scope.allowed,'actor',scope.resumable)}
async function authorizeNativeWardActorSuccessor(actual:Awaited<ReturnType<typeof actualNativeWardBlocked>>,targets:string[]){
 const row=actual.facts.row,id='mm-native-ward-outcome:'+await nativeWardDigest({parentId:row.parentId,requestId:row.id}),descriptor:Record<string,unknown>={id,parentId:row.parentId,requestId:row.id,parentTransactionId:row.parentTransactionId,roomId:row.roomId,hostMemberId:row.hostMemberId,mapId:row.mapId,actorTokenId:row.actorTokenId,wardTargetTokenId:row.wardTargetTokenId,sourceSignature:await nativeWardDigest(row),versions:row.versions,retargetTokenIds:[...targets]};
 for(const retarget of nativeWardRetargetAncestors(actual.proof.root)){const scope=nativeWardActorScopes.get(retarget);if(!scope)throw Error('native-ward-chain:actual-retarget-scope-required');scope.allowed.set(id,descriptor);if(Object.hasOwn(scope.rows,id))scope.resumable.add(id)}
}
function nearestNativeWardRetarget(decision:Decision){return nativeWardRetargetAncestors(decision)[0]}
function nativeWardLineage(decision:Decision,cost?:{blocked:object;choiceId:string}){
 const rows=new Set<string>(),choices=new Set<string>(),seen=new Set<object>();function proof(value:NativeWardProof){rows.add(value.rowId);for(const id of nativeWardModifierRows.get(value)??[])rows.add(id);walk(value.root)}function walk(value:Decision){if(seen.has(value)||seen.size>=128)throw Error('native-ward-chain:acyclic-final-source-required');seen.add(value);const ward=nativeWardDecisions.get(value);if(ward){proof(ward);return}const retarget=nativeWardRetargetDecisions.get(value);if(retarget){choices.add(retarget.choiceId);const prior=blockedNativeWardResults.get(retarget.blocked);if(!prior)throw Error('native-ward-chain:actual-failed-prefix-required');proof(prior)}}
 walk(decision);if(cost){choices.add(cost.choiceId);const prior=blockedNativeWardResults.get(cost.blocked);if(!prior)throw Error('native-ward-chain:actual-terminal-prefix-required');rows.add(prior.rowId);for(const id of nativeWardModifierRows.get(prior)??[])rows.add(id);if(!seen.has(prior.root))walk(prior.root)}return{rows,choices}
}
function assertNativeWardCompleteLineage(parentId:string,decision:Decision,raw:NativeWardBook,actors:NativeWardOutcomeBook|null|undefined,cost?:{blocked:object;choiceId:string}){const lineage=nativeWardLineage(decision,cost);if(Object.values(raw.requests).some(row=>row.parentId===parentId&&!lineage.rows.has(row.id))||Object.values(actors?.choices??{}).some(row=>row.parentId===parentId&&!lineage.choices.has(row.id)))throw Error('native-ward-chain:unvisited-original-ledger-required')}

async function nativeWardBaneSignature(facts:Awaited<ReturnType<typeof readNativeWardRow>>){
 const g=facts.binding.gateway,[maps,characters]=await Promise.all([g.loadResource<Revisioned<{maps:BattleMap[]}>>('maps'),g.loadResource<Revisioned<{characters:Character[]}>>('characters')]);stillHost(g,facts.issued.session);if(maps?._sync?.revision!==facts.issued.versions.maps||characters?._sync?.revision!==facts.issued.versions.characters)throw Error('native-ward-bane:original-world-required');const map=maps.maps.find(m=>m.id===facts.p.map.id),actor=map?.tokens.find(t=>t.id===facts.p.actorToken.id),effects=actor?.dnd5eCombatState?.concentrationEffectsBySource;
 if(!map||!actor||!effects)throw Error('native-ward-bane:actual-concentration-source-required');const ids=Object.entries(effects).filter(([,spell])=>spell==='bane').map(([id])=>id),nativeIds=Object.entries(facts.p.state.combatants[actor.id].classState.concentrationEffectsBySource??{}).filter(([,spell])=>spell==='bane').map(([id])=>id);if(!ids.length||!same([...ids].sort(),nativeIds.sort()))throw Error('native-ward-bane:matching-native-source-required');const sources=ids.map(sourceId=>{const token=map.tokens.find(t=>t.id===sourceId),character=characters.characters.find(c=>c.id===token?.characterId),state=character?.dnd5eCombatState??token?.dnd5eCombatState;if(!token||!state||state.concentrationSpellId!=='bane'||!state.concentrationTargetIds?.includes(actor.id))throw Error('native-ward-bane:actual-live-caster-required');return{sourceId,token,character}});return nativeWardDigest({effects,sources})
}
function nativeWardBaneDescriptor(facts:Awaited<ReturnType<typeof readNativeWardRow>>,signature:string){const row=facts.row,descriptor:Record<string,unknown>={};for(const key of['parentId','parentTransactionId','mapId','roomId','hostMemberId','actorTokenId','wardTargetTokenId','wardEffectId','statBlockId','sourceId','occurrence','sourceParentSignature','wardEffectSignature','versions','retargetChoiceId','previousRequestId']as const)if(row[key]!==undefined)descriptor[key]=row[key];return{...descriptor,modifierKind:'bane',modifierSourceSignature:signature,primaryRequestId:row.id,mode:'normal',count:1,sides:4}}
const nativeWardAuthenticatedModifierPools=new WeakMap<Decision,{id:string;raw:readonly number[];confirmed:readonly number[]}>()
async function readNativeWardBaneRow(facts:Awaited<ReturnType<typeof readNativeWardRow>>,complete:boolean){const descriptor=nativeWardBaneDescriptor(facts,await nativeWardBaneSignature(facts)),id='mm-native-ward-pool:'+await nativeWardDigest(descriptor),loadedBook=await facts.binding.gateway.loadResource<NativeWardBook>('mastermind-native-ward-originals'),book=loadedBook?plain(loadedBook):undefined,row=book?.requests[id];if(!book||!row||row.id!==id||Object.entries(descriptor).some(([key,value])=>!Object.hasOwn(row,key)||!same(row[key as keyof NativeWardRow],value))||complete&&(!row.complete||row.phase!=='confirmed')||row.raw?.memberId!==facts.issued.session.memberId||row.confirmed?.memberId!==facts.issued.session.memberId||row.raw.values.length!==1||row.confirmed.values.length!==1||[...row.raw.values,...row.confirmed.values].some(v=>!Number.isSafeInteger(v)||v<1||v>4))throw Error('native-ward-bane:actual-immutable-completed-pool-required');const authenticated=nativeWardAuthenticatedModifierPools.get(facts.decision);if(!authenticated||authenticated.id!==id||!same(authenticated.raw,row.raw.values)||!same(authenticated.confirmed,row.confirmed.values))throw Error('native-ward-bane:authenticated-locked-pool-required');return{book,row,descriptor}}
async function collectNativeWardBanePools(decision:Decision,api:NativeWardApi,run:(request:MastermindNativeWardRollRequest)=>Promise<readonly number[]>){const facts=await readNativeWardRow(decision,false),actor=facts.p.state.combatants[facts.p.actorToken.id],values=[...facts.row.confirmed!.values],no=()=>{throw Error('native-ward-original:additional-saving-input-not-supported')};let calls=0;await resolveDnd5eSavingThrowInterrupts({state:facts.p.state,combatant:actor,targetName:actor.name,ability:facts.requirement.ward.ability,dc:facts.requirement.ward.dc,mode:facts.requirement.mode,label:facts.requirement.effect.label,rollD20Pair:async()=>[values[0]!,values[1]],rollD20:no,rollD4:async()=>{
 if(calls++)throw Error('native-ward-bane:single-actual-pool-required');const descriptor=nativeWardBaneDescriptor(facts,await nativeWardBaneSignature(facts)),id='mm-native-ward-pool:'+await nativeWardDigest(descriptor);for(const retarget of nativeWardRetargetAncestors(decision)){const first=blockedNativeWardResults.get(retarget.blocked);if(!first)throw Error('native-ward-bane:actual-prior-failed-cap-required');for(const proof of nativeWardProofAncestors(first)){const scope=nativeWardRawScopes.get(proof);if(!scope)throw Error('native-ward-bane:actual-prefix-required');scope.allowed.set(id,{...descriptor,id});if(Object.hasOwn(scope.rows,id))scope.resumable.add(id)}}
 const registered=await api<{ok:boolean;request:{id:string;kind:string;actorTokenId:string;count:number;sides:number;complete:boolean;raw?:number[];confirmed?:number[]}}>('register',{parentId:facts.issued.id,wardEffectId:facts.requirement.effect.id,mode:'normal',modifierKind:'bane',...(nativeWardRetargetDecisions.get(decision)?{retargetChoiceId:nativeWardRetargetDecisions.get(decision)!.choiceId}:{})}),row=registered.request;if(!registered.ok||row.id!==id||row.kind!=='bane'||row.actorTokenId!==actor.id||row.count!==1||row.sides!==4)throw Error('native-ward-bane:actual-registered-source-required');if(!row.complete){const adopted=await run(Object.freeze({durableRollRequestId:row.id,rollerTokenId:actor.id,mode:'normal' as const,count:1,sides:4 as const,kind:'bane' as const,raw:row.raw?Object.freeze([...row.raw]):undefined,confirmed:row.confirmed?Object.freeze([...row.confirmed]):undefined})),reply=await api<{ok:boolean;request:{id:string;phase:string;raw?:number[];confirmed?:number[]}}>('request',{requestId:row.id});if(!reply.ok||reply.request.id!==id||reply.request.phase!=='confirmed'||!reply.request.raw||!same(reply.request.confirmed,adopted))throw Error('native-ward-bane:actual-physical-adoption-required');await api('complete',{requestId:id})}const locked=await api<{ok:boolean;request:{id:string;phase:string;complete:boolean;raw?:number[];confirmed?:number[]}}>('request',{requestId:id}),lockedRow=locked.request;if(!locked.ok||lockedRow.id!==id||lockedRow.phase!=='confirmed'||!lockedRow.complete||lockedRow.raw?.length!==1||lockedRow.confirmed?.length!==1||[...lockedRow.raw,...lockedRow.confirmed].some(v=>!Number.isSafeInteger(v)||v<1||v>4))throw Error('native-ward-bane:authenticated-completed-pool-required');nativeWardAuthenticatedModifierPools.set(decision,Object.freeze({id,raw:Object.freeze([...lockedRow.raw]),confirmed:Object.freeze([...lockedRow.confirmed])}));return(await readNativeWardBaneRow(facts,true)).row.confirmed!.values[0]
 }})}

/** Stored Character effects may omit the target implied by their owning token.
 * Keep the complete stored hash and compare the complete Native effect after
 * only that existing token binding; an explicit foreign target is never fixed. */
async function nativeWardStoredEffectSignature(facts:Pick<Awaited<ReturnType<typeof nativeWardSource>>,'binding'|'issued'|'p'>,effect:unknown,targetId:string){
 const g=facts.binding.gateway,loaded=await Promise.all([g.loadResource<Revisioned<{maps:BattleMap[]}>>('maps'),g.loadResource<Revisioned<{characters:Character[]}>>('characters')]),maps=loaded[0]?plain(loaded[0]):undefined,characters=loaded[1]?plain(loaded[1]):undefined;stillHost(g,facts.issued.session);if(maps?._sync?.revision!==facts.issued.versions.maps||characters?._sync?.revision!==facts.issued.versions.characters)throw Error('native-ward-original:unchanged-stored-effect-world-required');const map=maps.maps.find(m=>m.id===facts.p.map.id),target=map?.tokens.find(t=>t.id===targetId),character=characters.characters.find(c=>c.id===target?.characterId),effects=[...(character?.dnd5eCombatState?.activeEffects??[]),...(target?.dnd5eCombatState?.activeEffects??[])],native=effect as{id?:string},stored=effects.find(e=>e.id===native.id);if(!target||!stored)throw Error('native-ward-original:actual-stored-effect-required');const raw=stored as unknown as Record<string,unknown>;if(raw.targetId!==undefined&&raw.targetId!==target.id)throw Error('native-ward-original:stored-effect-foreign-target');const bound=raw.targetId===undefined&&(effect as Record<string,unknown>).targetId===target.id?{...raw,targetId:target.id}:raw;if(!same(bound,effect))throw Error('native-ward-original:complete-stored-effect-matches-native-required');return nativeWardDigest(raw)
}

/** A saving input is data. Reject accessors before cloning, so validation and
 * the sole consumed snapshot cannot observe different values from a getter. */
function nativeWardSavingSnapshot<T>(value:T):T{
 const seen=new WeakSet<object>();function inspect(node:unknown):void{if(typeof node==='function')throw Error('native-ward-saving-original:plain-native-state-required');if(!node||typeof node!=='object'||seen.has(node))return;seen.add(node);const descriptors=Object.getOwnPropertyDescriptors(node);for(const key of Reflect.ownKeys(descriptors)){const descriptor=Reflect.get(descriptors,key)as PropertyDescriptor;if(descriptor.get||descriptor.set)throw Error('native-ward-saving-original:plain-native-state-required');inspect(descriptor.value)}if(node instanceof Map)for(const[key,entry]of Map.prototype.entries.call(node)){inspect(key);inspect(entry)}if(node instanceof Set)for(const entry of Set.prototype.values.call(node))inspect(entry)}inspect(value);return structuredClone(value)
}

type NativeWardSavingProbe={prepared:{state:Decision['previewPrepared']['state'];action:{id:string;type:'attack-ward-attempt';actorId:string;targetId:string;turnKey:string;saves:readonly Dnd5eSpellcastingSavingThrowRoll[]}};hostOriginalD20Replay?:OriginalD20ReplayFacts}
const nativeWardSavingOriginalSlot=Symbol('mastermind-native-ward-saving-original');registerDnd5eHostReceiptSlot(nativeWardSavingOriginalSlot)
type NativeWardSavingOriginalRow={source:NativeWardSavingProbe;signature:string;clock:number;ended:boolean;decision:Decision;poolId:string;gateway:Gateway;session:Parameters<typeof stillHost>[1];guardSignature:string}
const nativeWardSavingOriginals=new WeakMap<object,NativeWardSavingOriginalRow>()
/** Mechanical original issuer of this already authenticated Ward. It does not
 * issue a Bountiful family, owner decision, resource or publication capability. */
export async function prepareMastermindNativeWardSavingOriginal(decision:Decision){
 const facts=await readNativeWardRow(decision,false);if(facts.requirement.mode!=='normal'||Object.keys(facts.p.state.combatants[facts.p.actorToken.id].classState.concentrationEffectsBySource??{}).length)throw Error('native-ward-saving-original:bare-single-pool-only')
 const id='mastermind-native-ward:'+dnd5eExecutionEventKey(JSON.stringify([facts.issued.descriptor.parentTransactionId,facts.target.id,facts.requirement.effect.id])),source:NativeWardSavingProbe={prepared:{state:nativeWardSavingSnapshot(facts.p.state),action:{id,type:'attack-ward-attempt',actorId:facts.p.actorToken.id,targetId:facts.target.id,turnKey:dnd5eHeadlessTurnKey(facts.p.state,facts.p.actorToken.id),saves:[{effectId:facts.requirement.effect.id,targetId:facts.p.actorToken.id,d20:facts.row.confirmed!.values[0]}]}}},original=registerDnd5eHostReceipt(Object.freeze({}));
 nativeWardSavingOriginals.set(original,{source,signature:nativeWardSignature(source),clock:facts.parent.issuedAt,ended:false,decision,poolId:facts.row.id,gateway:facts.binding.gateway,session:facts.issued.session,guardSignature:nativeWardSignature({state:source.prepared.state,raw:facts.row.raw,confirmed:facts.row.confirmed})});return original
}
/** Only the issuer's live receipt is copied across a real Session clone. */
export function createMastermindNativeWardSavingProbe(original:object){const row=nativeWardSavingOriginals.get(original);if(!row||row.ended)throw Error('native-ward-saving-original:actual-private-original-required');stillHost(row.gateway,row.session);const source=cloneDnd5eHostTransactionInput(row.source);Object.defineProperty(source,nativeWardSavingOriginalSlot,{value:original});source.hostOriginalD20Replay={parentId:source.prepared.action.id,sourceKey:originalD20ReplaySourceKey(source.prepared.action.id,source.prepared.state,source.prepared.action,row.clock),effectTimestamp:row.clock,facts:[]};return source}
/** A canonical mechanical resolver; caller data cannot replace the concrete
 * source, action, protected die or clock associated with its private receipt. */
export function resolveMastermindNativeWardSavingProbe(input:NativeWardSavingProbe){const original=Object.getOwnPropertyDescriptor(input,nativeWardSavingOriginalSlot)?.value,row=original&&nativeWardSavingOriginals.get(original);if(!row||row.ended)throw Error('native-ward-saving-original:actual-private-original-required');stillHost(row.gateway,row.session);const{hostOriginalD20Replay,...candidate}=input;const source=nativeWardSavingSnapshot(candidate);if(nativeWardSignature(source)!==row.signature)throw Error('native-ward-saving-original:unchanged-actual-source-required');const replay=validateOriginalD20ReplayFacts(hostOriginalD20Replay,row.source.prepared.action.id,row.source.prepared.state,row.source.prepared.action);if(!replay||replay.effectTimestamp!==row.clock||replay.facts.length||replay.readyFrames?.length||replay.deferredD20Choices?.length||replay.afterOriginalFalls?.length||replay.equipmentD20)throw Error('native-ward-saving-original:exact-initial-clock-required');return resolveDnd5eHeadlessAction(source.prepared.state,row.source.prepared.action,{transactionId:row.source.prepared.action.id,now:row.clock})}
export function disposeMastermindNativeWardSavingOriginal(original:object){const row=nativeWardSavingOriginals.get(original);if(!row)throw Error('native-ward-saving-original:actual-private-original-required');row.ended=true}

/** A durable qualification must recheck this current original immediately before
 * any mint or publication; Native observation alone never supplies that right. */
export async function readMastermindNativeWardSavingOriginalCurrent(original:object){const row=nativeWardSavingOriginals.get(original);if(!row||row.ended)throw Error('native-ward-saving-original:actual-private-original-required');stillHost(row.gateway,row.session);const facts=await readNativeWardRow(row.decision,false);if(facts.row.id!==row.poolId||nativeWardSignature({state:facts.p.state,raw:facts.row.raw,confirmed:facts.row.confirmed})!==row.guardSignature)throw Error('native-ward-saving-original:current-protected-source-required');return Object.freeze({parentId:facts.issued.id,parentTransactionId:facts.issued.descriptor.parentTransactionId,poolId:row.poolId,inputSignature:row.signature,versions:Object.freeze({...facts.issued.versions})})}

type NativeWardBountifulRequest={actorId:string;kind:'saving-throw';originalRolls:readonly number[];dieIndex:number;options:readonly {ownerId:string;featureId:string}[]}
type NativeWardBountifulRow={id:string;parentId:string;requestId:string;parentTransactionId:string;mapId:string;combatId:string;roomId:string;hostMemberId:string;actorId:string;clock:number;versions:Record<string,number>;sourceSignature:string;featureSources:Record<string,string>;request:NativeWardBountifulRequest;controllers:Record<string,{characterId:string;memberId:string}>;revision:number;createdAt:number;decisions:readonly {ownerId:string;featureId:string;memberId:string;decision:'use'|'decline';at:number}[];rawReroll?:{memberId:string;values:readonly number[];at:number};confirmedReroll?:{memberId:string;rawValues:readonly number[];values:readonly number[];at:number};consumed?:{transactionId:string;authorityRevision:number}}
type NativeWardBountifulBook={schemaVersion:1;parents:Record<string,NativeWardBountifulRow>;_sync:{revision:number}}
export type MastermindNativeWardBountifulApi=<T>(operation:'register'|'project'|'list'|'answer'|'raw'|'confirm',input:unknown)=>Promise<T>
type NativeWardBountifulQualification={original:object;decision:Decision;pending:object;id:string;api:MastermindNativeWardBountifulApi;sources:readonly {featureId:string;signature:string;digest:string;current:()=>boolean}[];prior?:NativeWardBountifulRow}
const nativeWardBountifulQualifications=new WeakMap<object,NativeWardBountifulQualification>()
const nativeWardBountifulPhase=(row:NativeWardBountifulRow)=>{const used=row.decisions.find(choice=>choice.decision==='use');return !used&&row.decisions.length<row.request.options.length?'owner-choice' as const:!used?'declined' as const:!row.rawReroll?'roller' as const:!row.confirmedReroll?'host-confirmation' as const:'ready' as const}
const nativeWardBountifulStatic=(row:NativeWardBountifulRow)=>{const{revision,decisions,rawReroll,confirmedReroll,...base}=row;void revision;void decisions;void rawReroll;void confirmedReroll;return base}

async function readNativeWardBountifulQualification(qualification:object){
 const issued=nativeWardBountifulQualifications.get(qualification),original=issued&&nativeWardSavingOriginals.get(issued.original);if(!issued||!original||original.ended)throw Error('native-ward-bountiful:actual-private-qualification-required')
 if(issued.sources.some(source=>!source.current()||nativeWardSignature(dnd5ePluginFeatureDefinition(source.featureId))!==source.signature))throw Error('native-ward-bountiful:original-full-feature-source-required')
 await readMastermindNativeWardSavingOriginalCurrent(issued.original)
 const runtime=await import('../../rulesets/dnd5e/damageCommitSession'),frame=runtime.readDnd5eActualOriginalAllyBoundary(issued.pending),frameInput=frame.input as NativeWardSavingProbe
 if(frame.resolve!==resolveMastermindNativeWardSavingProbe||Object.getOwnPropertyDescriptor(frameInput,nativeWardSavingOriginalSlot)?.value!==issued.original||nativeWardSignature({...frameInput,hostOriginalD20Replay:undefined})!==original.signature||frame.effectTimestamp!==original.clock)throw Error('native-ward-bountiful:actual-canonical-saving-source-required')
 const facts=await readNativeWardRow(issued.decision,false),loaded=await original.gateway.loadResource<NativeWardBountifulBook>('mastermind-native-ward-bountifuls'),book=loaded?plain(loaded):undefined,row=book?.parents?.[issued.id],{complete,...immutableOriginal}=facts.row;void complete
 const signature=await nativeWardDigest({parent:facts.parent,original:immutableOriginal}),controllers:Record<string,{characterId:string;memberId:string}>={}
 for(const option of frame.request.options){const token=facts.p.map.tokens.find(t=>t.id===option.ownerId),character=facts.p.characters.find(c=>c.id===token?.characterId);if(!token||!character)throw Error('native-ward-bountiful:canonical-owner-required');controllers[option.ownerId]={characterId:character.id,memberId:character.roomMemberId??facts.issued.session.memberId}}
 if(!book||row?.consumed||book.schemaVersion!==1||!Number.isSafeInteger(book._sync?.revision)||!row||row.id!==issued.id||row.parentId!==facts.issued.id||row.requestId!==facts.row.id||row.parentTransactionId!==facts.row.parentTransactionId||row.mapId!==facts.p.map.id||row.combatId!==facts.p.state.combatId||row.roomId!==facts.issued.session.roomId||row.hostMemberId!==facts.issued.session.memberId||row.actorId!==facts.p.actorToken.id||row.clock!==facts.parent.issuedAt||!same(row.versions,facts.issued.versions)||row.sourceSignature!==signature||!same(row.featureSources,Object.fromEntries(issued.sources.map(source=>[source.featureId,source.digest])))||!same(row.request,frame.request)||frame.request.kind!=='saving-throw'||frame.request.nativeLucky||!same(frame.request.originalRolls,[1])||frame.request.dieIndex!==0||!same(row.controllers,controllers)||!Number.isSafeInteger(row.createdAt)||!Array.isArray(row.decisions)||row.decisions.length>frame.request.options.length)throw Error('native-ward-bountiful:matching-protected-source-required')
 const response=await issued.api<{ok:boolean;choice:{id:string;revision:number;phase:string;decisions:unknown;raw?:readonly number[];confirmed?:readonly number[]}}>('project',{id:row.id}),projection=response.choice
 if(!response.ok||!projection||projection.id!==row.id||projection.revision!==row.revision||projection.phase!==nativeWardBountifulPhase(row)||!same(projection.decisions,row.decisions)||!same(projection.raw,row.rawReroll?.values)||!same(projection.confirmed,row.confirmedReroll?.values))throw Error('native-ward-bountiful:authenticated-current-pool-required')
 let used=false
 for(let index=0;index<row.decisions.length;index++){const choice=row.decisions[index],option=frame.request.options[index];if(used||!option||choice.ownerId!==option.ownerId||choice.featureId!==option.featureId||choice.memberId!==controllers[option.ownerId].memberId||!['use','decline'].includes(choice.decision)||!Number.isSafeInteger(choice.at))throw Error('native-ward-bountiful:authenticated-ordered-decisions-required');used=choice.decision==='use'}
 const die=(value:readonly number[]|undefined)=>Array.isArray(value)&&value.length===1&&Number.isSafeInteger(value[0])&&value[0]>=1&&value[0]<=20
 if(row.rawReroll&&(!used||row.rawReroll.memberId!==facts.issued.session.memberId||!die(row.rawReroll.values)||!Number.isSafeInteger(row.rawReroll.at))||row.confirmedReroll&&(!row.rawReroll||row.confirmedReroll.memberId!==facts.issued.session.memberId||!same(row.confirmedReroll.rawValues,row.rawReroll.values)||!die(row.confirmedReroll.values)||!Number.isSafeInteger(row.confirmedReroll.at))||row.revision!==1+row.decisions.length+(row.rawReroll?1:0)+(row.confirmedReroll?1:0))throw Error('native-ward-bountiful:actual-locked-reroll-required')
 const prior=issued.prior
 if(prior&&(!same(nativeWardBountifulStatic(prior),nativeWardBountifulStatic(row))||row.revision<prior.revision||row.decisions.length<prior.decisions.length||!same(prior.decisions,row.decisions.slice(0,prior.decisions.length))||prior.rawReroll&&!same(prior.rawReroll,row.rawReroll)||prior.confirmedReroll&&!same(prior.confirmedReroll,row.confirmedReroll)))throw Error('native-ward-bountiful:protected-progress-immutable')
 issued.prior=plain(row);return{issued,original,facts,book,row,phase:nativeWardBountifulPhase(row)}
}

/** The source is produced here from the genuine current private Ward original.
 * Neither a caller request, serialized pending stage nor prepared DTO is input. */
export async function prepareMastermindNativeWardBountifulQualification(decision:Decision,api:MastermindNativeWardBountifulApi){
 const original=await prepareMastermindNativeWardSavingOriginal(decision)
 try{
  const runtime=await import('../../rulesets/dnd5e/damageCommitSession'),source=createMastermindNativeWardSavingProbe(original),session=runtime.createDnd5eOriginalD20Session(source,resolveMastermindNativeWardSavingProbe,source.prepared.action.actorId,'saving-throw')
  let pending:ReturnType<typeof session.run>;try{pending=session.run(source.prepared.state)}finally{session.cancel()}
  if(pending.status!=='pending-ally-natural-one'||pending.request.nativeLucky||pending.request.kind!=='saving-throw'||!same(pending.request.originalRolls,[1])||pending.request.dieIndex!==0)throw Error('native-ward-bountiful:actual-saving-natural-one-required')
  const catalog=await import('../../rulesets/dnd5e/plugins/pluginContentCatalog'),registry=await import('../../domain/content/contentDefinitionRegistry'),envelopes=await import('../../rulesets/dnd5e/activities/dnd5eUnifiedContentRegistry'),sources:{featureId:string;signature:string;digest:string;current:()=>boolean}[]=[]
  for(const option of pending.request.options){
   const feature=dnd5ePluginFeatureDefinition(option.featureId)
   if(!feature?.sourceFeatId||feature.declarativeAbility?.mechanic?.kind!=='ally-natural-one-reroll'||!catalog.dnd5ePluginFeatureCurrentEnvelopeFullV1(feature.id))throw Error('native-ward-bountiful:native-full-feat-source-required')
   const local=(id:string)=>id.startsWith(feature.ownerPluginId+':')?id.slice(feature.ownerPluginId.length+1):id,packageRecord=registry.listRegisteredContentDefinitionPackages().find(value=>value.packageId===feature.ownerPluginId),definitions=packageRecord?.definitions.filter(definition=>{const payload=definition.payload as{id?:unknown}|undefined;return definition.kind==='feat'&&typeof payload?.id==='string'&&local(payload.id)===local(feature.sourceFeatId!)})??[]
   if(definitions.length!==1)throw Error('native-ward-bountiful:actual-owned-feat-definition-required')
   const definition=definitions[0],capture=envelopes.captureDnd5eSourceEnvelopeAutomationV1(feature.ownerPluginId,definition.kind,definition.id)
   if(!capture||capture()?.level!=='full')throw Error('native-ward-bountiful:authored-current-full-source-required')
   sources.push({featureId:feature.id,signature:nativeWardSignature(feature),digest:await nativeWardDigest(feature),current:()=>capture()?.level==='full'&&catalog.dnd5ePluginFeatureCurrentEnvelopeFullV1(feature.id)})
  }
  const facts=await readNativeWardRow(decision,false),id='mm-native-ward-bountiful:'+await nativeWardDigest({parentId:facts.issued.id,requestId:facts.row.id}),response=await api<{ok:boolean;choice:{id:string}}>('register',{parentId:facts.issued.id,requestId:facts.row.id,request:pending.request,featureSources:Object.fromEntries(sources.map(source=>[source.featureId,source.digest]))})
  if(!response.ok||response.choice.id!==id)throw Error('native-ward-bountiful:authenticated-source-registration-required')
  const qualification=Object.freeze({});nativeWardBountifulQualifications.set(qualification,{original,decision,pending,id,api,sources});await readNativeWardBountifulQualification(qualification);return qualification
 }catch(error){disposeMastermindNativeWardSavingOriginal(original);throw error}
}

/** Read-only transport projection, never a setter for dice or a Native result. */
export async function readMastermindNativeWardBountifulQualification(qualification:object){const current=await readNativeWardBountifulQualification(qualification);return Object.freeze({id:current.row.id,parentId:current.row.parentId,requestId:current.row.requestId,revision:current.row.revision,bookRevision:current.book._sync.revision,phase:current.phase,rawRequestId:'mm-native-ward-bountiful-pool:'+await nativeWardDigest({id:current.row.id}),actorId:current.row.actorId,...(current.row.rawReroll?{raw:Object.freeze([...current.row.rawReroll.values])}:{}),...(current.row.confirmedReroll?{confirmed:Object.freeze([...current.row.confirmedReroll.values])}:{})})}
export function disposeMastermindNativeWardBountifulQualification(qualification:object){const row=nativeWardBountifulQualifications.get(qualification);if(!row)throw Error('native-ward-bountiful:actual-private-qualification-required');disposeMastermindNativeWardSavingOriginal(row.original);nativeWardBountifulQualifications.delete(qualification)}

type NativeWardBountifulResolved={qualification:object;checked:ReturnType<typeof resolveDnd5eHeadlessAction>;signature:string;choiceSignature:string}
const nativeWardBountifulResolved=new WeakMap<object,NativeWardBountifulResolved>()
/** Reconstruct the real saving operation only from this family's private
 * source and authenticated stored choice/raw/adoption. No result is input. */
export async function resolveMastermindNativeWardBountifulQualification(qualification:object){
 const current=await readNativeWardBountifulQualification(qualification)
 if(current.phase!=='ready'&&current.phase!=='declined')return{status:'pending' as const,request:await readMastermindNativeWardBountifulQualification(qualification)}
 const runtime=await import('../../rulesets/dnd5e/damageCommitSession'),source=createMastermindNativeWardSavingProbe(current.issued.original),session=runtime.createDnd5eAllyOriginalCollectionSession(source,resolveMastermindNativeWardSavingProbe)
 let checked:ReturnType<typeof resolveDnd5eHeadlessAction>
 try{
  const pending=session.run(source.prepared.state)
  if(pending.status!=='pending-ally-natural-one'||pending.occurrence!==0||!same(pending.request,current.row.request))throw Error('native-ward-bountiful:unchanged-actual-checkpoint-required')
  const used=current.row.decisions.find(choice=>choice.decision==='use'),decision=used&&current.row.confirmedReroll?{ownerId:used.ownerId,featureId:used.featureId,replacement:current.row.confirmedReroll.values[0]}:undefined,result=session.resumeAllyNaturalOne(source.prepared.state,pending.occurrence,pending.request,decision)
  if(result.status!=='resolved'||!result.result.ok)throw Error('native-ward-bountiful:actual-whole-saving-required')
  checked=result.result
 }finally{session.cancel()}
 const again=await readNativeWardBountifulQualification(qualification)
 if(!same(again.row,current.row))throw Error('native-ward-bountiful:unchanged-authenticated-choice-required')
 const continuation=Object.freeze({});nativeWardBountifulResolved.set(continuation,{qualification,checked,signature:nativeWardSignature(checked),choiceSignature:nativeWardSignature(again.row)});return{status:'resolved' as const,continuation}
}
/** Read-only mechanical evidence. This object is not a Monster result, Base
 * completion or world publication capability. */
export async function readMastermindNativeWardBountifulContinuation(continuation:object){
 const row=nativeWardBountifulResolved.get(continuation),checked=row&&nativeWardSavingSnapshot(row.checked);if(!row||!checked||row.signature!==nativeWardSignature(checked)||!checked.ok)throw Error('native-ward-bountiful:actual-unchanged-continuation-required')
 const current=await readNativeWardBountifulQualification(row.qualification)
 if(nativeWardSignature(current.row)!==row.choiceSignature)throw Error('native-ward-bountiful:unchanged-authenticated-choice-required')
 const used=current.row.decisions.find(choice=>choice.decision==='use'),requirements=dnd5eAttackAttemptWardRequirements(checked.state,current.facts.p.actorToken.id,current.facts.target.id)
 return Object.freeze({parentId:current.row.parentId,requestId:current.row.requestId,bookId:current.row.id,bookRevision:current.book._sync.revision,allowed:requirements.every(requirement=>requirement.receipt?.success===true),...(used?{ownerId:used.ownerId,reactionAvailable:checked.state.combatants[used.ownerId].turn.reactionAvailable}:{}),savingEvents:checked.events.filter(event=>event.type==='saving-throw-resolved').length})
}

const nativeWardBountifulProofs=new WeakMap<NativeWardProof,object>()
async function assertNativeWardBountifulProof(proof:NativeWardProof){const continuation=nativeWardBountifulProofs.get(proof);if(continuation)await readMastermindNativeWardBountifulContinuation(continuation)}
/** Only the actual reconstructed saving continuation can enter the original
 * attack. Completing an input row is not by itself a saving or cost proof. */
export async function settleMastermindNativeWardBountifulContinuation(continuation:object,api:NativeWardApi){
 const retained=nativeWardBountifulResolved.get(continuation)
 if(!retained)throw Error('native-ward-bountiful:actual-unchanged-continuation-required')
 await readMastermindNativeWardBountifulContinuation(continuation)
 const current=await readNativeWardBountifulQualification(retained.qualification),decision=current.issued.decision
 const used=current.row.decisions.find(choice=>choice.decision==='use')
 if(used?.ownerId===decision.coverAttackRedirect?.originalTargetId)throw Error('native-ward-bountiful:prior-redirect-reaction-order-not-supported')
 await api('complete',{requestId:current.row.requestId})
 const facts=await readNativeWardRow(decision),checked=nativeWardSavingSnapshot(retained.checked)
 if(!checked.ok||retained.signature!==nativeWardSignature(checked))throw Error('native-ward-bountiful:actual-unchanged-continuation-required')
 const allowed=dnd5eAttackAttemptWardRequirements(checked.state,facts.p.actorToken.id,facts.target.id).every(entry=>entry.receipt?.success===true)
 if(!allowed){
  const redirect=decision.coverAttackRedirect?resolveDnd5eCoverAttackRedirectPrefix(checked.state,facts.p.actorToken.id,decision.coverAttackRedirect):{state:checked.state,events:[]}
  if(!redirect)throw Error('native-ward-bountiful:actual-redirect-prefix-required')
  const blocked=Object.freeze({}),proof=captureNativeWardProof(decision,facts,redirect.state,[...nativeWardInheritedEvents(decision),...checked.events,...redirect.events])
  nativeWardBountifulProofs.set(proof,continuation);blockedNativeWardResults.set(blocked,proof);return{status:'blocked' as const,blocked}
 }
 const next:Decision=Object.freeze({...decision,prepared:{...decision.prepared,state:checked.state},previewPrepared:{...decision.previewPrepared,state:checked.state}}),proof=captureNativeWardProof(decision,facts,checked.state,[...nativeWardInheritedEvents(decision),...checked.events])
 nativeWardBountifulProofs.set(proof,continuation);decisions.set(next,facts.binding);nativeWardDecisions.set(next,proof);return{status:'continue' as const,decision:next}
}

async function nativeWardBountifulPublication(native:Native){
 const actual=nativeResults.get(native);if(!actual)throw Error('native-ward-bountiful:actual-final-native-required')
 const proofs:NativeWardProof[]=[],seen=new Set<NativeWardProof>(),cost=nativeWardCostProofs.get(native)
 const add=(proof:NativeWardProof|undefined)=>{if(proof)for(const ancestor of nativeWardProofAncestors(proof))if(!seen.has(ancestor)){seen.add(ancestor);proofs.push(ancestor)}}
 add(nativeWardDecisions.get(actual.decision));for(const ancestor of nativeWardRetargetAncestors(actual.decision))add(blockedNativeWardResults.get(ancestor.blocked));if(cost)add(blockedNativeWardResults.get(cost.blocked))
 const completed=[] as Awaited<ReturnType<typeof readNativeWardBountifulQualification>>[]
 for(const proof of proofs){const continuation=nativeWardBountifulProofs.get(proof);if(!continuation)continue;await assertNativeWardBountifulProof(proof);const retained=nativeWardBountifulResolved.get(continuation)!;completed.push(await readNativeWardBountifulQualification(retained.qualification))}
 const binding=decisions.get(actual.decision)!,original=originals.get(binding.original)!,loaded=await binding.gateway.loadResource<NativeWardBountifulBook>('mastermind-native-ward-bountifuls'),book=loaded?plain(loaded):undefined,rows=Object.values(book?.parents??{}).filter(row=>row.parentId===original.id)
 if(!rows.length&&!completed.length)return undefined
 if(!book||rows.length!==completed.length||new Set(completed.map(value=>value.row.id)).size!==rows.length||rows.some(row=>!completed.some(value=>same(value.row,row))))throw Error('native-ward-bountiful:complete-issued-saving-lineage-required')
 const snapshot={...native,result:nativeWardSavingSnapshot(native.result),application:nativeWardSavingSnapshot(native.application)};if(JSON.stringify(ordered(snapshot))!==actual.signature)throw Error('native-ward-bountiful:unchanged-native-data-required')
 return{book,ids:completed.map(value=>value.row.id)}
}

/** Only this family's issued proof selects snapshot consumption. A caller flag
 * cannot turn an ordinary or foreign decision into a Bountiful continuation. */
function nativeWardHasBountifulProof(decision:Decision){let next:Decision|undefined=decision;const seen=new Set<object>();while(next){if(seen.has(next)||seen.size>=128)throw Error('native-ward-bountiful:acyclic-native-source-required');seen.add(next);const proof=nativeWardDecisions.get(next);if(proof){if(nativeWardBountifulProofs.has(proof))return true;next=proof.root;continue}const retarget=nativeWardRetargetDecisions.get(next),blocked=retarget&&blockedNativeWardResults.get(retarget.blocked);if(!blocked)return false;if(nativeWardBountifulProofs.has(blocked))return true;next=blocked.root}return false}
function nativeWardBountifulDecisionSnapshot(decision:Decision){return nativeWardHasBountifulProof(decision)?nativeWardSavingSnapshot(decision):decision}


/** Original-pool completion is an input boundary, not a resolved Ward. Only this
 * private continuation can pause it for the actual Native ally checkpoint. */
export async function collectMastermindNativeMonsterWard(decision:Decision,originalApi:NativeWardApi,runOriginal:(request:MastermindNativeWardRollRequest)=>Promise<readonly number[]>,getBountiful?:()=>{api:MastermindNativeWardBountifulApi;runReplacement:(request:MastermindNativeWardRollRequest)=>Promise<readonly number[]>}){
 return collectMastermindNativeMonsterWardOriginalPool(decision,originalApi,runOriginal,async()=>{
  const facts=await readNativeWardRow(decision),actor=facts.p.state.combatants[facts.p.actorToken.id]
  if(facts.requirement.mode!=='normal'||!same(facts.row.confirmed?.values,[1])||actor.classState.bardicInspirationDie||Object.keys(actor.classState.concentrationEffectsBySource??{}).length)return settleMastermindNativeMonsterWard(decision)
  const original=await prepareMastermindNativeWardSavingOriginal(decision),runtime=await import('../../rulesets/dnd5e/damageCommitSession'),source=createMastermindNativeWardSavingProbe(original),probe=runtime.createDnd5eAllyOriginalCollectionSession(source,resolveMastermindNativeWardSavingProbe)
  let pending:ReturnType<typeof probe.run>;try{pending=probe.run(source.prepared.state)}finally{probe.cancel();disposeMastermindNativeWardSavingOriginal(original)}
  if(pending.status==='resolved')return settleMastermindNativeMonsterWard(decision)
  if(pending.status!=='pending-ally-natural-one'||pending.request.nativeLucky)throw Error('native-ward-bountiful:actual-ally-saving-checkpoint-required')
  const handlers=getBountiful?.();if(!handlers)throw Error('native-ward-bountiful:actual-owner-transport-required');const{api,runReplacement}=handlers,qualification=await prepareMastermindNativeWardBountifulQualification(decision,api)
  try{for(let attempt=0;attempt<2400;attempt++){
   const row=await readMastermindNativeWardBountifulQualification(qualification)
   if(row.phase==='owner-choice'){await new Promise<void>(resolve=>setTimeout(resolve,250));continue}
   if(row.phase==='roller'||row.phase==='host-confirmation'){
    const adopted=await runReplacement(Object.freeze({durableRollRequestId:row.rawRequestId,rollerTokenId:row.actorId,mode:'normal' as const,count:1,...(row.raw?{raw:row.raw}:{}),...(row.confirmed?{confirmed:row.confirmed}:{})})),locked=await readMastermindNativeWardBountifulQualification(qualification)
    if(locked.phase!=='ready'||!same(locked.confirmed,adopted))throw Error('native-ward-bountiful:actual-physical-adoption-required')
   }
   const retained=await resolveMastermindNativeWardBountifulQualification(qualification);if(retained.status!=='resolved')throw Error('native-ward-bountiful:actual-completed-saving-required');return settleMastermindNativeWardBountifulContinuation(retained.continuation,originalApi)
  }throw Error('native-ward-bountiful:canonical-owner-still-pending')}catch(error){disposeMastermindNativeWardBountifulQualification(qualification);throw error}
 })
}

async function nativeWardSuccessorOwnerRows(decision:Decision){
 const rows:{id:string;signature:string}[]=[...(directOwnerProofs.get(decision)?.rows??[])];for(const proof of nativeWardRetargetAncestors(decision)){await nativeWardRetargetValue(proof);if(proof.ownerId){if(!proof.ownerSignature)throw Error('native-ward-owner:answered-source-required');rows.push({id:proof.ownerId,signature:proof.ownerSignature})}}
 return rows
}

/** Rebuilds a genuine ordinary NPC original only at a still-waiting direct
 * successor. No previous physical attack pool can exist at this stage. */
const nativeDirectResumeOriginals=new WeakMap<object,{parentId:string;observedWaitingId:string}>()
export async function restoreMastermindNativeDirectOwnerOriginal(parentId:string,g:Gateway=defaultGateway){
 if(typeof parentId!=='string'||!parentId.startsWith('mastermind-misdirection:'))throw Error('native-direct-resume:original-id-required');
 const session=host(g),[journal,maps]=await Promise.all([g.loadResource<{parents:Record<string,{id:string;roomId:string;hostMemberId:string;mapId:string;parentTransactionId:string;attackerTokenId:string;ownerTokenId:string;ownerMemberId:string;phase:string;originalAction?:unknown;nativeOriginal?:Issued['nativeOriginal'];wardRetargetOriginal?:unknown;spellWindowOriginal?:unknown;opportunityOriginal?:unknown;redirectOriginal?:{schemaVersion:number;rootParentId:string;previousParentId:string};answer?:{choice:string;submittedByMemberId:string};versions:Record<string,number>}>}>('mastermind-misdirections'),g.loadResource<{maps:BattleMap[]}>('maps')]);stillHost(g,session);const root=journal?.parents[parentId],native=root?.nativeOriginal;if(!root||root.phase==='consumed')return undefined;
 if(root.id!==parentId||root.phase!=='answered'||root.roomId!==session.roomId||root.hostMemberId!==session.memberId||root.originalAction!==undefined||root.redirectOriginal!==undefined||root.wardRetargetOriginal!==undefined||root.spellWindowOriginal!==undefined||root.opportunityOriginal!==undefined||native?.family!=='monster-attack'||native.occurrence!==0||root.answer?.submittedByMemberId!==root.ownerMemberId||root.answer.choice==='decline')throw Error('native-direct-resume:protected-root-required');
 const children=Object.values(journal!.parents).filter(row=>row.redirectOriginal?.rootParentId===parentId);if(!children.length||children.length>63)throw Error('native-direct-resume:protected-successor-required');let previous=root;let observedWaitingId:string|undefined;const visited=new Set<string>();for(let depth=0;depth<64;depth++){const next=children.filter(row=>row.redirectOriginal!.previousParentId===previous.id);if(next.length!==1)throw Error('native-direct-resume:single-causal-successor-required');const row=next[0],id='mastermind-misdirection:'+dnd5eExecutionEventKey(JSON.stringify([root.id,previous.id,row.ownerTokenId,'redirect-owner']));if(visited.has(row.id)||row.id!==id||row.id===root.id||row.parentTransactionId!==root.parentTransactionId||row.mapId!==root.mapId||row.attackerTokenId!==root.attackerTokenId||row.roomId!==root.roomId||row.hostMemberId!==root.hostMemberId||!same(row.nativeOriginal,root.nativeOriginal)||!same(row.versions,root.versions)||previous.answer?.submittedByMemberId!==previous.ownerMemberId||previous.answer.choice!==row.ownerTokenId)throw Error('native-direct-resume:unchanged-causal-original-required');visited.add(row.id);if(row.phase==='waiting'){if(row.answer!==undefined||visited.size!==children.length)throw Error('native-direct-resume:unvisited-successor-required');observedWaitingId=row.id;break}if(row.phase!=='answered'||row.answer?.submittedByMemberId!==row.ownerMemberId||row.answer.choice==='decline')throw Error('native-direct-resume:still-waiting-owner-required');previous=row;if(depth===63)throw Error('native-direct-resume:bounded-original-required')}
 const map=maps?.maps.find(map=>map.id===root.mapId),actor=map?.tokens.find(token=>token.id===root.attackerTokenId);if(!actor||actor.characterId!==undefined||actor.poolId!==native.statBlockId)throw Error('native-direct-resume:actual-NPC-required');const monster=getDnd5eSrdMonster(native.statBlockId),indexes=monster?.actions.flatMap((action,index)=>action.id===native.sourceId&&action.kind==='weapon-attack'&&action.attack?[index]:[])??[];if(indexes.length!==1)throw Error('native-direct-resume:actual-core-source-required');
 const original=await prepareMastermindNativeMonsterOriginal({parentTransactionId:root.parentTransactionId,mapId:root.mapId,actorTokenId:root.attackerTokenId,targetTokenId:root.ownerTokenId,actionIndex:indexes[0]},g);if(!original)throw Error('native-direct-resume:actual-reissued-original-required');const primary=await readMastermindNativeMonsterPrimaryDecision(original,g);if(!primary||primary.prepared.attacks.length!==1||primary.prepared.readiedAttack||primary.prepared.compositeRuntime||primary.prepared.action.randomRepeat||primary.prepared.resourceKind!=='action')throw Error('native-direct-resume:single-original-required');if(!observedWaitingId)throw Error('native-direct-resume:still-waiting-owner-required');await readMastermindNativeMonsterDecision(original,g);nativeDirectResumeOriginals.set(original,{parentId,observedWaitingId});return{original,prepared:primary.prepared,parentTransactionId:root.parentTransactionId,parentId}
}
export async function collectMastermindNativeDirectOwnerOriginal(original:MastermindNativeMonsterOriginal,g:Gateway=defaultGateway){const end=Date.now()+600000;for(;;){const decision=await readMastermindNativeMonsterDecision(original,g);if(decision)return decision;if(Date.now()>=end)throw Error('native-direct-resume:owner-choice-pending');await new Promise<void>(resolve=>setTimeout(resolve,250))}}

/** Only an opaque original issued while a real protected child was waiting can
 * survive that child's authenticated answer. This never mints a late original. */
export async function readMastermindNativeDirectOwnerOriginal(original:MastermindNativeMonsterOriginal,parentId:string,g:Gateway=defaultGateway){
 const binding=nativeDirectResumeOriginals.get(original),issued=originals.get(original);if(!binding||!issued||binding.parentId!==parentId||issued.id!==parentId)throw Error('native-direct-resume:issued-pending-original-required');
 const session=host(g);stillHost(g,issued.session);const journal=await g.loadResource<{parents:Record<string,{phase:string;revision:number;ownerMemberId:string;answer?:{submittedByMemberId:string};redirectOriginal?:{rootParentId:string}}>}>('mastermind-misdirections');stillHost(g,session);const root=journal?.parents[parentId];if(!root||root.phase==='consumed')return undefined;const observed=journal?.parents[binding.observedWaitingId];if(!observed||observed.redirectOriginal?.rootParentId!==parentId||observed.phase==='waiting'&&(observed.revision!==1||observed.answer!==undefined)||observed.phase==='answered'&&(observed.revision!==2||observed.answer?.submittedByMemberId!==observed.ownerMemberId)||!['waiting','answered'].includes(observed.phase))throw Error('native-direct-resume:actual-pending-owner-transition-required');
 const primary=await readMastermindNativeMonsterPrimaryDecision(original,g);if(!primary)throw Error('native-direct-resume:actual-original-root-required');await readMastermindNativeMonsterDecision(original,g);return{original,prepared:primary.prepared,parentTransactionId:issued.descriptor.parentTransactionId,parentId}
}
