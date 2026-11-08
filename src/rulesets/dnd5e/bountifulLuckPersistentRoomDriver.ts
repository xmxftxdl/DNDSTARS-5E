import{readDnd5ePluginSpellSavingCompoundQualification}from'./pluginSpellSavingOriginalOperation'
import{readDnd5ePluginSpellCompoundAnsweredQualification}from'./pluginSpellCompoundQualification'
import{readDnd5ePluginSpellCompoundPrimaryPendingQualification,type Dnd5ePluginSpellCompoundPrimaryPendingQualification}from'./pluginSpellCompoundPrimaryPendingQualification'
import{resumeBountifulPluginSpellCompoundPrimaryOriginalParent,readBountifulPluginSpellCompoundPrimaryPendingCurrent}from'./bountifulPluginSpellCompoundPrimaryReplay'
import{readDnd5ePluginSpellSavingOriginalQualifiedSource}from'./pluginSpellSavingOriginalOperation'
import{encodeSecondChanceParentWire}from'../../lib/secondChanceParentWire'
import{captureSecondChancePreparedHostFacts}from'../../pages/maps/secondChancePreparedHostFacts'
import{resumeBountifulPluginSpellSavingOriginalParent}from'./bountifulPluginSpellSavingOriginalReplay'
import{readBountifulPluginSpellSavingPendingCurrent}from'./bountifulPluginSpellSavingOriginalPending'
import{readDnd5ePluginSpellSavingOriginalQualification,type Dnd5ePluginSpellSavingOriginalQualification}from'./pluginSpellSavingOriginalOperation'
import{readBountifulActivityPendingOwnLuckyCurrent}from'./bountifulActivityOriginalPending'
import{resolvePreparedDnd5eSpellCast}from'./spellAction'
import{resumeSpellcastingOriginalOwnParent,readSpellcastingOriginalPendingOwn}from'./spellcastingOriginalPendingOwn'
import{readBountifulPluginSpellAbilityPendingOwnLuckyCurrent}from'./bountifulPluginSpellAbilityOriginalPending';
import{readDnd5eSpellcastingBountifulOriginalQualification,type Dnd5eSpellcastingBountifulOriginalQualification}from'./spellcastingBountifulOriginalBoundary'
import{readBountifulPluginSpellAbilityOriginalQualification,type BountifulPluginSpellAbilityOriginalQualification}from'./bountifulPluginSpellAbilityOriginalBoundary'
import{readBountifulPluginSpellAbilityOriginalContinuation,assertBountifulPluginSpellAbilityOriginalContinuationCurrent,type BountifulPluginSpellAbilityOriginalContinuation,type BountifulPluginSpellAbilityOriginalContinuationGateway}from'./bountifulPluginSpellAbilityOriginalContinuation'
import{resumeBountifulPluginSpellAbilityOriginalParent}from'./bountifulPluginSpellAbilityOriginalReplay'
import{resolvePreparedDnd5ePluginSpellCast}from'./pluginSpellTransaction'
import{readBountifulActivityOriginalContinuation,assertBountifulActivityOriginalContinuationCurrent,type BountifulActivityOriginalContinuation,type BountifulActivityOriginalContinuationGateway}from'./bountifulActivityOriginalContinuation'
import{readBountifulActivityOriginalQualification,type BountifulActivityOriginalQualification}from'./bountifulActivityOriginalQualification'
import{resolveBountifulPreparedActivityOriginal}from'./bountifulActivityOriginalPort'
import{resumeBountifulActivityOriginalParent}from'./bountifulLuckPersistedReplay'
import{loadTempestuousBeforeReplayForOriginal}from'./tempestuousBeforeOriginalPort'
import{restoreBountifulSpellDamageZeroPendingRaw}from'./bountifulSpellDamageZeroPendingRaw'
import{restoreBountifulDamageZeroPendingRaw}from'./bountifulDamageZeroPendingRaw'
import{StormCastOriginalPrefixPending,loadStormCastReplayForPendingException,type StormCastBountifulOriginalPort}from'./stormCastBountifulOriginalPort'
import{readBountifulSequenceOriginalTarget}from'./bountifulOpportunitySequencePostNativeReplay'
import{withBountifulOpportunitySequencePostNativeReplay}from'./bountifulOpportunitySequencePostNativeReplay'
import{resolveDnd5eOpportunityMoveSequenceOriginal}from'./opportunityMoveSequence'
import {resolvePreparedDnd5eOpportunityPlayerMove} from './opportunityMoveAction'
import {saveBountifulPhase} from './bountifulPhaseCommit'
import {assertBountifulOriginalSceneScope} from './bountifulOriginalSceneScope'
import {bountifulOriginalScopeMatches} from '../../../shared/bountiful-original-scope.mjs'
import {bountifulNativeOriginalRawIssuer} from './bountifulOriginalRawIssuer'
import type {BountifulSpellOriginalInput} from './bountifulSpellTargetRaw'
import {bountifulOriginalRawForActor} from './bountifulSpellTargetRaw'
import {readBountifulReadyGenericReplay} from './bountifulReadyGenericReplay'
import type {BountifulReadyParentData} from './bountifulOriginalReadyFrame'
import {bountifulOriginalRollIssuerMode,captureBountifulOriginalRawIssuer} from './bountifulOriginalRawIssuer'
import {resolvePreparedDnd5eEquipmentAttack} from './equipmentAttackAction'
import {bountifulPreparedController,bountifulPreparedOriginalRoller} from './bountifulPreparedController'
import type {SharedRoomGatewayPort} from '../../../src/ports/sharedRoomGateway'
import type {Character} from '../../../src/types/character'
import type {BattleMap} from '../../../src/store/maps'
import type {Dnd5eActionResult,Dnd5eHeadlessCombatState} from '../../../src/rulesets/dnd5e/headlessCombatEngine'
import type {Dnd5eMapResultPlan} from '../../../src/rulesets/dnd5e/mapBridge'
import {getRoomSession} from '../../../src/lib/roomSession'
import {decodeSecondChanceParentWire} from '../../../src/lib/secondChanceParentWire'
import {restoreSecondChancePreparedHostFactsAsync} from '../../../src/pages/maps/secondChancePreparedHostFacts'
import {actualBountifulResolvers,bountifulOriginalParentReceiptId,processBountifulOriginalResponse} from './bountifulLuckPersistentHost'
import {resumeBountifulOriginalParent} from './bountifulLuckPersistedReplay'
import {createBountifulOriginalDieReceipt,bountifulOriginalDiePhase,type BountifulOriginalDieReceipt,type BountifulOriginalDieCommand} from './bountifulLuckReceipt'
import {validateBountifulOriginalParents} from '../../../shared/bountiful-luck-state.mjs'

type Revisioned<T>=T&{_sync?:{revision?:number}}
interface Combat{mapId?:string;combatId?:string;round?:number;initiativeIndex?:number;dnd5eTurnEconomyByToken?:unknown;bountifulOriginalParents?:Record<string,BountifulOriginalDieReceipt>}
interface QueueRow{id:string;status:string;type:string;[key:string]:unknown;bountifulLuck?:{parentId:string;occurrence:number;command:BountifulOriginalDieCommand}}
type Gateway=Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'>&Partial<Pick<SharedRoomGatewayPort,'publishEvent'>>&StormCastBountifulOriginalPort&Partial<Pick<SharedRoomGatewayPort,'loadBountifulPluginSpellSavingOriginalSource'|'loadBountifulPluginSpellCompoundPrimarySource'>>
interface OriginalInput{prepared:{state:Dnd5eHeadlessCombatState;map:BattleMap;characters:readonly Character[];characterIdByCombatantId:Record<string,string>};[key:string]:unknown}
const revision=(value:Revisioned<object>|null)=>value?._sync?.revision??0
const requireHost=()=>{const session=getRoomSession();if(!session||session.role!=='dm')throw Error('bountiful-driver:host-required');return session}
type ActivityLaterOriginalYield={parentId:string;mapId:string;previousOccurrence:number;roomId:string;hostMemberId:string;qualification:BountifulActivityOriginalQualification;source:Parameters<typeof readBountifulActivityOriginalQualification>[1]}
const activityLaterOriginalYields=new WeakMap<object,ActivityLaterOriginalYield>()
/** A control-only handoff from this exact authenticated Native replay. It is
 * neither a receipt nor a raw/source/result grant. An ended issuer, another
 * parent, a copied Error or JSON cannot resume this local collector callback. */
export function hasBountifulActivityLaterOriginalYield(value:unknown,expected:{parentId:string;mapId:string;previousOccurrence:number}):value is Error&{readonly occurrence:number}{
 const row=value&&typeof value==='object'?activityLaterOriginalYields.get(value):undefined,host=getRoomSession();if(!row||host?.role!=='dm'||row.roomId!==host.roomId||row.hostMemberId!==host.memberId||row.parentId!==expected.parentId||row.mapId!==expected.mapId||row.previousOccurrence!==expected.previousOccurrence)return false
 try{readBountifulActivityOriginalQualification(row.qualification,row.source);return true}catch{return false}
}
export class BountifulOriginalParentPending extends Error{readonly parentId:string;readonly occurrence:number;constructor(parentId:string,occurrence:number){super('bountiful-original-parent-pending');this.parentId=parentId;this.occurrence=occurrence}}
interface SpellcastingNativeLuckyPendingFacts{parentId:string;occurrence:number;actorId:string;effectTimestamp:number;rollId:string;originalValues:readonly number[]}
const spellcastingNativeLuckyPending=new WeakMap<BountifulOriginalParentPending,{signature:string;read:()=>SpellcastingNativeLuckyPendingFacts}>()
/** Read-only presentation wait. Only the actual current caster driver can issue
 * this witness; it never authorizes dice, replay, or publication. */
export function readSpellcastingNativeLuckyChoicePending(value:unknown):SpellcastingNativeLuckyPendingFacts|undefined{
 if(!(value instanceof BountifulOriginalParentPending))return undefined
 const entry=spellcastingNativeLuckyPending.get(value)
 if(!entry||entry.signature!==JSON.stringify([value.parentId,value.occurrence,value.message]))return undefined
 return entry.read()
}
async function load(input:{mapId:string;parentId:string},gateway:Gateway){
 const host=requireHost(),[combat,queue,characters,maps,geometry]=await Promise.all([gateway.loadResource<Revisioned<Combat>>('combat'),gateway.loadResource<Revisioned<{requests:QueueRow[]}>>('player-action-requests'),gateway.loadResource<Revisioned<object>>('characters'),gateway.loadResource<Revisioned<object>>('maps'),gateway.loadResource<Revisioned<object>>('map-geometry')])
 const current=requireHost();if(current.roomId!==host.roomId||current.memberId!==host.memberId)throw Error('bountiful-driver:host-changed')
 const receipts=Object.values(combat?.bountifulOriginalParents??{}).filter(row=>row.identity.parentId===input.parentId).sort((a,b)=>a.identity.occurrence-b.identity.occurrence),first=receipts[0]
 if(!combat||!queue||!first||!validateBountifulOriginalParents(combat.bountifulOriginalParents)||first.identity.roomId!==host.roomId||first.identity.hostMemberId!==host.memberId||first.identity.mapId!==input.mapId||!bountifulOriginalScopeMatches(combat,first.identity)||JSON.stringify(combat.dnd5eTurnEconomyByToken??{})!==first.identity.reactionEconomySignature||!queue.requests.some(row=>row.id===input.parentId&&JSON.stringify(row)===JSON.stringify(first.originalRoomAction)))throw Error('bountiful-driver:stale-original-parent')
 await assertBountifulOriginalSceneScope(combat,first.identity,gateway)
 const actual:Record<string,number>={characters:revision(characters),maps:revision(maps),'map-geometry':revision(geometry),...(first.identity.sceneScope?{'campaign-time':first.identity.sceneScope.campaignTimeRevision}:{})}
 if(Object.entries(first.identity.revisions).some(([name,value])=>actual[name]!==value))throw Error('bountiful-driver:stale-original-resources')
 return {combat,queue,first,receipts}
}
export async function readBountifulOriginalSource(receipt:BountifulOriginalDieReceipt,options?:{includeContinuation?:boolean}){
 if(!Object.hasOwn(actualBountifulResolvers,receipt.originalAdapterId))throw Error('bountiful-driver:unknown-actual-facade')
 const value=await restoreSecondChancePreparedHostFactsAsync(decodeSecondChanceParentWire(options?.includeContinuation?receipt.continuation?.source??receipt.originalParent:receipt.originalParent)) as OriginalInput
 if(!value?.prepared?.state?.combatants||value.prepared.state.combatId!==receipt.identity.combatId||value.prepared.map?.id!==receipt.identity.mapId||!Array.isArray(value.prepared.characters)||!value.prepared.characterIdByCombatantId)throw Error('bountiful-driver:invalid-frozen-original')
 // The identifier chooses one exact actual facade. The facade still validates
 // its own concrete command shape; no serialized function is accepted.
 const resolve=actualBountifulResolvers[receipt.originalAdapterId as keyof typeof actualBountifulResolvers] as (input:OriginalInput)=>{result:Dnd5eActionResult;application?:Dnd5eMapResultPlan}
 return {source:value,resolve}
}
async function refresh(input:{mapId:string;parentId:string},gateway:Gateway){
 let context=await load(input,gateway)
 for(const row of context.queue.requests.filter(row=>row.status==='pending'&&row.type==='dnd5e-bountiful-luck'&&row.bountifulLuck?.parentId===input.parentId)){
  try{await processBountifulOriginalResponse({mapId:input.mapId,requestId:row.id},gateway)}catch(error){
   if(!(error instanceof Error)||!/^bountiful-parent:(?:owner-choice-not-authorized|original-roller-required|host-confirmation-required|wrong-original-parent|invalid-response-shape|foreign-host)$/.test(error.message))throw error
  }
 }
 context=await load(input,gateway);return context
}
/** Each raw die is a real occurrence in the same saved parent. A missing owner
 * response remains pending; explicit decline advances to the next eligible owner. */

/** Shape narrowing only. The opaque replay's issuer remains the authority. */
function hasSequenceReplayAction<T extends{prepared:object}>(source:T):source is T&{prepared:{action:{id:string}}}{
 const prepared=source.prepared
 return 'action'in prepared&&!!prepared.action&&typeof prepared.action==='object'&&'id'in prepared.action&&typeof prepared.action.id==='string'
}

export async function driveBountifulOriginalParent(input:{nativeLuckyChoiceVersion?:1;mapId:string;parentId:string;originalScope?:{actorId:string;kind:'saving-throw'|'attack'};opportunitySequencePostNativeReplay?:object;activityOriginalQualification?:BountifulActivityOriginalQualification;activityOriginalPendingQualification?:BountifulActivityOriginalQualification;activityOriginalContinuation?:BountifulActivityOriginalContinuation;pluginSpellAbilityOriginalQualification?:BountifulPluginSpellAbilityOriginalQualification;pluginSpellSavingOriginalQualification?:Dnd5ePluginSpellSavingOriginalQualification;pluginSpellCompoundPrimaryOriginalQualification?:Dnd5ePluginSpellCompoundPrimaryPendingQualification;pluginSpellAbilityOriginalContinuation?:BountifulPluginSpellAbilityOriginalContinuation;spellcastingOriginalQualification?:Dnd5eSpellcastingBountifulOriginalQualification},gateway:Gateway&Partial<BountifulActivityOriginalContinuationGateway>&Partial<BountifulPluginSpellAbilityOriginalContinuationGateway>,ui:{nativeLuckyChoiceVersion?:1;showChoice:(receipt:BountifulOriginalDieReceipt)=>Promise<void>;requestRoll:(receipt:BountifulOriginalDieReceipt,refresh:()=>Promise<BountifulOriginalDieReceipt>)=>Promise<void>}){
 const savingGateway=()=>{const load=gateway.loadBountifulPluginSpellSavingOriginalSource;if(!load)throw Error('plugin-spell-saving-replay:private-book-loader-required');return{...gateway,loadBountifulPluginSpellSavingOriginalSource:load}}
 const pluginGateway=()=>{if(!gateway.loadBountifulPluginSpellAbilityOriginalSource)throw Error('plugin-spell-ability-continuation:private-book-loader-required');return gateway as BountifulPluginSpellAbilityOriginalContinuationGateway}
 const withPluginSource=(original:Awaited<ReturnType<typeof readBountifulOriginalSource>>,first:BountifulOriginalDieReceipt)=>input.pluginSpellAbilityOriginalContinuation?{...original,source:readBountifulPluginSpellAbilityOriginalContinuation(input.pluginSpellAbilityOriginalContinuation,undefined,first,input.pluginSpellAbilityOriginalQualification).source as unknown as OriginalInput}:original
 if(input.pluginSpellAbilityOriginalContinuation!==undefined){const current=readBountifulPluginSpellAbilityOriginalContinuation(input.pluginSpellAbilityOriginalContinuation);await assertBountifulPluginSpellAbilityOriginalContinuationCurrent(input.pluginSpellAbilityOriginalContinuation,pluginGateway(),current.source)}
 const activityGateway=()=>{if(!gateway.loadBountifulActivityOriginalSource)throw Error('activity-continuation:private-book-loader-required');return gateway as BountifulActivityOriginalContinuationGateway}
 const withActivitySource=(original:Awaited<ReturnType<typeof readBountifulOriginalSource>>,first:BountifulOriginalDieReceipt)=>input.activityOriginalContinuation?{...original,source:readBountifulActivityOriginalContinuation(input.activityOriginalContinuation,undefined,first,input.activityOriginalQualification).source as OriginalInput}:original
 if(input.activityOriginalContinuation!==undefined){const current=readBountifulActivityOriginalContinuation(input.activityOriginalContinuation);await assertBountifulActivityOriginalContinuationCurrent(input.activityOriginalContinuation,activityGateway(),current.source)}
 const initial=await load(input,gateway);if(initial.first.rawIssuer?.rollId.startsWith('spellcasting-original-saving:')||input.spellcastingOriginalQualification!==undefined){const original=await readBountifulOriginalSource(initial.first,{includeContinuation:true});if(initial.first.originalAdapterId!=='spell'||original.resolve!==actualBountifulResolvers.spell||!input.spellcastingOriginalQualification||input.originalScope!==undefined||input.opportunitySequencePostNativeReplay!==undefined||input.activityOriginalQualification!==undefined||input.pluginSpellAbilityOriginalQualification!==undefined||input.activityOriginalContinuation!==undefined||input.pluginSpellAbilityOriginalContinuation!==undefined)throw Error('bountiful-driver:actual-caster-original-required');const caster=readDnd5eSpellcastingBountifulOriginalQualification(input.spellcastingOriginalQualification,original.source as unknown as Parameters<typeof readDnd5eSpellcastingBountifulOriginalQualification>[1]);if(JSON.stringify(caster.request)!==JSON.stringify(initial.first.request)||JSON.stringify(caster.rawIssuer)!==JSON.stringify(initial.first.rawIssuer)||caster.effectTimestamp!==initial.first.identity.effectTimestamp)throw Error('bountiful-driver:exact-caster-original-required')}if(initial.first.rawIssuer?.rollId.startsWith('bountiful-plugin-spell-ability-original:')||input.pluginSpellAbilityOriginalQualification!==undefined){const original=withPluginSource(await readBountifulOriginalSource(initial.first,{includeContinuation:true}),initial.first);if(initial.first.originalAdapterId!=='plugin-spell'||(original.resolve as unknown)!==resolvePreparedDnd5ePluginSpellCast||!input.pluginSpellAbilityOriginalQualification||input.originalScope!==undefined||input.opportunitySequencePostNativeReplay!==undefined||input.activityOriginalQualification!==undefined)throw Error('bountiful-driver:actual-plugin-spell-ability-original-required');readBountifulPluginSpellAbilityOriginalQualification(input.pluginSpellAbilityOriginalQualification,original.source as unknown as Parameters<typeof readBountifulPluginSpellAbilityOriginalQualification>[1])}if(initial.first.originalAdapterId==='plugin-feature'||input.activityOriginalQualification!==undefined){const original=withActivitySource(await readBountifulOriginalSource(initial.first,{includeContinuation:true}),initial.first);if(initial.first.originalAdapterId!=='plugin-feature'||(original.resolve as unknown)!==resolveBountifulPreparedActivityOriginal||!input.activityOriginalQualification||input.originalScope!==undefined||input.opportunitySequencePostNativeReplay!==undefined)throw Error('bountiful-driver:actual-activity-original-required');readBountifulActivityOriginalQualification(input.activityOriginalQualification,original.source as unknown as Parameters<typeof readBountifulActivityOriginalQualification>[1])}
 if(input.pluginSpellCompoundPrimaryOriginalQualification){const original=await readBountifulOriginalSource(initial.first,{includeContinuation:true}),proof=readDnd5ePluginSpellCompoundPrimaryPendingQualification(input.pluginSpellCompoundPrimaryOriginalQualification,original.source as unknown as Parameters<typeof readDnd5ePluginSpellCompoundPrimaryPendingQualification>[1]);if(initial.first.originalAdapterId!=='plugin-spell'||(original.resolve as unknown)!==resolvePreparedDnd5ePluginSpellCast||input.pluginSpellSavingOriginalQualification!==undefined||input.originalScope!==undefined||input.opportunitySequencePostNativeReplay!==undefined||input.activityOriginalQualification!==undefined||input.pluginSpellAbilityOriginalQualification!==undefined||input.spellcastingOriginalQualification!==undefined||proof.effectTimestamp!==initial.first.identity.effectTimestamp||JSON.stringify(proof.request)!==JSON.stringify(initial.first.request)||JSON.stringify(proof.rawIssuer)!==JSON.stringify(initial.first.rawIssuer))throw Error('bountiful-driver:exact-compound-primary-original-required')}
 if(!input.pluginSpellCompoundPrimaryOriginalQualification&&(initial.first.rawIssuer?.rollId.startsWith('bountiful-plugin-spell-saving-original:')||input.pluginSpellSavingOriginalQualification!==undefined)){const original=await readBountifulOriginalSource(initial.first,{includeContinuation:true});if(initial.first.originalAdapterId!=='plugin-spell'||(original.resolve as unknown)!==resolvePreparedDnd5ePluginSpellCast||!input.pluginSpellSavingOriginalQualification||input.originalScope!==undefined||input.opportunitySequencePostNativeReplay!==undefined||input.activityOriginalQualification!==undefined||input.pluginSpellAbilityOriginalQualification!==undefined||input.spellcastingOriginalQualification!==undefined)throw Error('bountiful-driver:actual-plugin-spell-saving-original-required');const proof=readDnd5ePluginSpellSavingOriginalQualification(input.pluginSpellSavingOriginalQualification,readDnd5ePluginSpellSavingOriginalQualifiedSource(input.pluginSpellSavingOriginalQualification,original.source as unknown as Parameters<typeof readDnd5ePluginSpellSavingOriginalQualification>[1],initial.first));const compound=readDnd5ePluginSpellSavingCompoundQualification(input.pluginSpellSavingOriginalQualification),answered=compound&&readDnd5ePluginSpellCompoundAnsweredQualification(compound);if(proof.effectTimestamp!==initial.first.identity.effectTimestamp||!answered&&(JSON.stringify(proof.request)!==JSON.stringify(initial.first.request)||JSON.stringify(proof.rawIssuer)!==JSON.stringify(initial.first.rawIssuer)))throw Error('bountiful-driver:exact-plugin-spell-saving-original-required')}
 if(input.opportunitySequencePostNativeReplay!==undefined){const first=await load(input,gateway),original=await readBountifulOriginalSource(first.first,{includeContinuation:true}),resolverIdentity:unknown=original.resolve;if(resolverIdentity!==resolveDnd5eOpportunityMoveSequenceOriginal||!hasSequenceReplayAction(original.source))throw Error('bountiful-driver:actual-sequence-post-native-replay-required');withBountifulOpportunitySequencePostNativeReplay(original.source,input.opportunitySequencePostNativeReplay)}
 for(let count=0;count<128;count++){
  const context=await refresh(input,gateway),original=withPluginSource(withActivitySource(await readBountifulOriginalSource(context.first,{includeContinuation:true}),context.first),context.first)
  if(input.pluginSpellCompoundPrimaryOriginalQualification)original.source=readDnd5ePluginSpellCompoundPrimaryPendingQualification(input.pluginSpellCompoundPrimaryOriginalQualification,original.source as unknown as Parameters<typeof readDnd5ePluginSpellCompoundPrimaryPendingQualification>[1]).source as unknown as typeof original.source
  if(context.first.rawIssuer?.rollId.startsWith('bountiful-plugin-spell-saving-original:')&&input.pluginSpellSavingOriginalQualification)original.source=readDnd5ePluginSpellSavingOriginalQualifiedSource(input.pluginSpellSavingOriginalQualification,original.source as unknown as Parameters<typeof readDnd5ePluginSpellSavingOriginalQualifiedSource>[1],context.first) as unknown as typeof original.source
  const concentrationTarget=context.first.originalAdapterId==='opportunity-move-sequence'&&input.opportunitySequencePostNativeReplay!==undefined&&hasSequenceReplayAction(original.source)?readBountifulSequenceOriginalTarget(original.source,input.opportunitySequencePostNativeReplay):undefined
  if(input.originalScope){
   if(input.originalScope.kind==='attack'){
    const book=original.source.hostOriginalOpportunityRolls
    if(context.first.originalAdapterId!=='opportunity-move-sequence'||!Array.isArray(book))throw Error('bountiful-driver:actual-opportunity-scope-required')
    const rows=book.filter(row=>row?.actorId===input.originalScope!.actorId)
    if(rows.length!==1||!Array.isArray(rows[0].values))throw Error('bountiful-driver:actual-opportunity-raw-required')
    bountifulNativeOriginalRawIssuer(original.source,{actorId:input.originalScope.actorId,kind:'attack',originalRolls:rows[0].values})
   }else if(context.first.originalAdapterId==='opportunity-move-sequence'){
    if(!concentrationTarget||concentrationTarget.actorId!==input.originalScope.actorId)throw Error('bountiful-driver:actual-CON-original-scope-required')
   }else{
   if(context.first.originalAdapterId!=='spell'||!Array.isArray(original.source.hostOriginalSpellSavingThrows))throw Error('bountiful-driver:actual-target-scope-required')
   const saved=original.source.targetSavingThrows
   const row=Array.isArray(saved)?saved.find(row=>row?.targetId===input.originalScope!.actorId):undefined
   if(!row||typeof row.d20!=='number')throw Error('bountiful-driver:actual-target-raw-required')
   bountifulOriginalRawForActor(original.source,input.originalScope.actorId,'saving-throw',row.d20Second===undefined?[row.d20]:[row.d20,row.d20Second])
   }
  }
  const tempestuousBeforePreparedReplay=await loadTempestuousBeforeReplayForOriginal(original.source,original.resolve,gateway)
  let stage:ReturnType<typeof resumeBountifulOriginalParent<OriginalInput,ReturnType<typeof original.resolve>>>
  if(context.first.originalAdapterId==='plugin-feature'){if(!input.activityOriginalQualification||(original.resolve as unknown)!==resolveBountifulPreparedActivityOriginal)throw Error('bountiful-driver:actual-activity-original-required');stage=await resumeBountifulActivityOriginalParent({source:original.source as unknown as Parameters<typeof resolveBountifulPreparedActivityOriginal>[0],resolve:resolveBountifulPreparedActivityOriginal,parentId:input.parentId,actorId:context.first.originalCheckpoint?.actorId??context.first.request.actorId,kind:context.first.originalCheckpoint?.kind??context.first.request.kind,receipts:context.receipts,activityOriginalQualification:input.activityOriginalQualification,activityOriginalContinuation:input.activityOriginalContinuation,activityOriginalPendingQualification:input.activityOriginalPendingQualification})}
  else if(context.first.rawIssuer?.rollId.startsWith('bountiful-plugin-spell-ability-original:')){if(!input.pluginSpellAbilityOriginalQualification||(original.resolve as unknown)!==resolvePreparedDnd5ePluginSpellCast)throw Error('bountiful-driver:actual-plugin-spell-ability-original-required');stage=resumeBountifulPluginSpellAbilityOriginalParent({source:original.source as unknown as Parameters<typeof resolvePreparedDnd5ePluginSpellCast>[0],resolve:resolvePreparedDnd5ePluginSpellCast,parentId:input.parentId,actorId:context.first.originalCheckpoint?.actorId??context.first.request.actorId,kind:context.first.originalCheckpoint?.kind??context.first.request.kind,receipts:context.receipts,pluginSpellAbilityOriginalQualification:input.pluginSpellAbilityOriginalQualification,pluginSpellAbilityOriginalContinuation:input.pluginSpellAbilityOriginalContinuation})}
     else if(input.pluginSpellCompoundPrimaryOriginalQualification){if((original.resolve as unknown)!==resolvePreparedDnd5ePluginSpellCast)throw Error('bountiful-driver:actual-compound-primary-original-required');stage=resumeBountifulPluginSpellCompoundPrimaryOriginalParent({source:original.source as unknown as Parameters<typeof resumeBountifulPluginSpellCompoundPrimaryOriginalParent>[0]['source'],receipts:context.receipts,qualification:input.pluginSpellCompoundPrimaryOriginalQualification})}
     else if(context.first.rawIssuer?.rollId.startsWith('bountiful-plugin-spell-saving-original:')){if(!input.pluginSpellSavingOriginalQualification||(original.resolve as unknown)!==resolvePreparedDnd5ePluginSpellCast)throw Error('bountiful-driver:actual-plugin-spell-saving-original-required');stage=resumeBountifulPluginSpellSavingOriginalParent({source:original.source as unknown as Parameters<typeof resolvePreparedDnd5ePluginSpellCast>[0],resolve:resolvePreparedDnd5ePluginSpellCast,parentId:input.parentId,actorId:readDnd5ePluginSpellSavingOriginalQualification(input.pluginSpellSavingOriginalQualification,original.source as unknown as Parameters<typeof readDnd5ePluginSpellSavingOriginalQualification>[1]).request.actorId,kind:'saving-throw',receipts:context.receipts,pluginSpellSavingOriginalQualification:input.pluginSpellSavingOriginalQualification})}
     else if(context.first.rawIssuer?.rollId.startsWith('spellcasting-original-saving:')&&context.first.request.nativeLucky!==true){if(!input.spellcastingOriginalQualification||(original.resolve as unknown)!==resolvePreparedDnd5eSpellCast)throw Error('bountiful-driver:actual-caster-original-required');const cast={source:original.source as unknown as Parameters<typeof resolvePreparedDnd5eSpellCast>[0],resolve:resolvePreparedDnd5eSpellCast,parentId:input.parentId,actorId:context.first.request.actorId,kind:'saving-throw'as const,receipts:context.receipts,qualification:input.spellcastingOriginalQualification,...(tempestuousBeforePreparedReplay?{tempestuousBeforePreparedReplay}:{})};try{stage=resumeSpellcastingOriginalOwnParent(cast)}catch(error){if(!(error instanceof StormCastOriginalPrefixPending))throw error;const proof=await loadStormCastReplayForPendingException(error,gateway);stage=resumeSpellcastingOriginalOwnParent({...cast,stormCastPreparedReplay:proof})}}
else try{stage=resumeBountifulOriginalParent({...original,...(tempestuousBeforePreparedReplay?{tempestuousBeforePreparedReplay}:{}),...(input.opportunitySequencePostNativeReplay!==undefined?{opportunitySequencePostNativeReplay:input.opportunitySequencePostNativeReplay}:{}),parentId:input.parentId,actorId:input.originalScope?.actorId??context.first.originalCheckpoint?.actorId??context.first.request.actorId,kind:input.originalScope?.kind??context.first.originalCheckpoint?.kind??context.first.request.kind,receipts:context.receipts})}catch(error){if(!(error instanceof StormCastOriginalPrefixPending))throw error;const proof=await loadStormCastReplayForPendingException(error,gateway);stage=resumeBountifulOriginalParent({...original,stormCastPreparedReplay:proof,...(input.opportunitySequencePostNativeReplay!==undefined?{opportunitySequencePostNativeReplay:input.opportunitySequencePostNativeReplay}:{}),parentId:input.parentId,actorId:input.originalScope?.actorId??context.first.originalCheckpoint?.actorId??context.first.request.actorId,kind:input.originalScope?.kind??context.first.originalCheckpoint?.kind??context.first.request.kind,receipts:context.receipts})}
  if(stage.status==='original-d20-ready')return {...stage,source:original.source,resolve:original.resolve,receipts:context.receipts}
  if(stage.status==='pending-record'){
       const casterOwn=context.first.rawIssuer?.rollId.startsWith('spellcasting-original-saving:')?input.spellcastingOriginalQualification?readSpellcastingOriginalPendingOwn(stage,original.source as unknown as Parameters<typeof readSpellcastingOriginalPendingOwn>[1],input.spellcastingOriginalQualification,context.receipts):undefined:undefined
    if(context.first.rawIssuer?.rollId.startsWith('spellcasting-original-saving:')&&!casterOwn)throw Error('caster-original:later-native-phase-not-issued')
   const primaryPending=input.pluginSpellCompoundPrimaryOriginalQualification?await readBountifulPluginSpellCompoundPrimaryPendingCurrent(stage,original.source as unknown as Parameters<typeof readBountifulPluginSpellCompoundPrimaryPendingCurrent>[1],input.pluginSpellCompoundPrimaryOriginalQualification,context.receipts,{loadBountifulPluginSpellCompoundPrimarySource:identity=>{const load=gateway.loadBountifulPluginSpellCompoundPrimarySource;if(!load)throw Error('ice-knife-primary-replay:private-book-loader-required');return load(identity)}}):undefined
   const savingPending=context.first.rawIssuer?.rollId.startsWith('bountiful-plugin-spell-saving-original:')&&input.pluginSpellSavingOriginalQualification?await readBountifulPluginSpellSavingPendingCurrent(stage,original.source as unknown as Parameters<typeof readBountifulPluginSpellSavingPendingCurrent>[1],input.pluginSpellSavingOriginalQualification,context.receipts,savingGateway()):undefined
   if(context.first.rawIssuer?.rollId.startsWith('bountiful-plugin-spell-saving-original:')&&!savingPending&&!primaryPending)throw Error('plugin-spell-saving-replay:later-original-receipt-not-issued')
   const pluginOwn=context.first.rawIssuer?.rollId.startsWith('bountiful-plugin-spell-ability-original:')?stage.request.nativeLucky&&input.pluginSpellAbilityOriginalQualification?await readBountifulPluginSpellAbilityPendingOwnLuckyCurrent(stage,original.source as unknown as Parameters<typeof readBountifulPluginSpellAbilityPendingOwnLuckyCurrent>[1],input.pluginSpellAbilityOriginalQualification,context.receipts,pluginGateway()):undefined:undefined
   if(context.first.rawIssuer?.rollId.startsWith('bountiful-plugin-spell-ability-original:')&&!pluginOwn)throw Error('plugin-spell-ability-replay:later-original-receipt-not-issued')
   const activityOwn=context.first.rawIssuer?.rollId.startsWith('bountiful-activity-original:')?stage.request.nativeLucky&&input.activityOriginalQualification?await readBountifulActivityPendingOwnLuckyCurrent(stage,original.source as Parameters<typeof readBountifulActivityPendingOwnLuckyCurrent>[1],input.activityOriginalQualification,context.receipts,activityGateway()):undefined:undefined
   if(context.first.rawIssuer?.rollId.startsWith('bountiful-activity-original:')&&!activityOwn){if(stage.request.nativeLucky||stage.request.kind!=='ability-check')throw Error('activity-replay:later-original-receipt-not-issued');const handoff=Object.freeze(Object.assign(Error('activity-original:actual-next-original-required'),{occurrence:stage.occurrence}));activityLaterOriginalYields.set(handoff,{parentId:input.parentId,mapId:input.mapId,previousOccurrence:context.receipts[context.receipts.length-1].identity.occurrence,roomId:context.first.identity.roomId,hostMemberId:context.first.identity.hostMemberId,qualification:input.activityOriginalQualification!,source:original.source as Parameters<typeof readBountifulActivityOriginalQualification>[1]});throw handoff}
   const controllers=Object.fromEntries(stage.request.options.map(option=>[option.ownerId,bountifulPreparedController(original.source.prepared,option.ownerId,context.first.identity.hostMemberId)]))
   const rollerController=bountifulPreparedOriginalRoller(original.source.prepared,stage.request.actorId,context.first.identity.hostMemberId)
   if(stage.request.kind==='saving-throw'&&context.first.originalAdapterId==='opportunity-move-sequence'&&(!concentrationTarget||concentrationTarget.actorId!==stage.request.actorId||JSON.stringify(concentrationTarget.raw)!==JSON.stringify(stage.request.originalRolls)))throw Error('bountiful-driver:exact-actual-CON-original-required')
   const damageZeroRaw=stage.request.kind==='saving-throw'&&Object.hasOwn(original.source,'hostDamageZeroSavingThrows')?(original.resolve as unknown)===actualBountifulResolvers.spell?restoreBountifulSpellDamageZeroPendingRaw({source:original.source as Parameters<typeof actualBountifulResolvers.spell>[0],resolve:original.resolve,receipts:context.receipts,pending:stage}):restoreBountifulDamageZeroPendingRaw({source:original.source as Parameters<typeof resolvePreparedDnd5eEquipmentAttack>[0],resolve:original.resolve,receipts:context.receipts,pending:stage}):undefined
    const receipt=createBountifulOriginalDieReceipt({...((stage.request.nativeLucky&&(primaryPending||savingPending||pluginOwn||activityOwn||input.nativeLuckyChoiceVersion===1||ui.nativeLuckyChoiceVersion===1))?{nativeLuckyChoiceVersion:1 as const}:{}),rawIssuer:(casterOwn?context.first.rawIssuer:undefined)??primaryPending?.rawIssuer??savingPending?.rawIssuer??pluginOwn?.rawIssuer??activityOwn?.rawIssuer??damageZeroRaw??(stage.request.kind==='saving-throw'?concentrationTarget?.rawIssuer??bountifulNativeOriginalRawIssuer(original.source,stage.request):bountifulNativeOriginalRawIssuer(original.source,stage.request)),identity:{...context.first.identity,occurrence:stage.occurrence,roller:rollerController},originalCheckpoint:context.first.originalCheckpoint,originalAdapterId:context.first.originalAdapterId,originalRoomAction:context.first.originalRoomAction,originalParent:savingPending?encodeSecondChanceParentWire(captureSecondChancePreparedHostFacts(original.source)):context.first.originalParent,request:stage.request,controllers})
   const id=bountifulOriginalParentReceiptId(input.parentId,stage.occurrence),next={...context.combat,bountifulOriginalParents:{...context.combat.bountifulOriginalParents,[id]:receipt}}
   if(!validateBountifulOriginalParents(next.bountifulOriginalParents))throw Error('bountiful-driver:invalid-next-original-record')
   await gateway.publishEvent?.('bountiful-original-mint-dm-to-host',{id,receipt})
   await saveBountifulPhase(gateway,[{name:'combat',expectedRevision:revision(context.combat),data:next}],{transactionId:'bountiful-original-next:'+id,readRevisions:{...receipt.identity.revisions,'player-action-requests':revision(context.queue)}})
   continue
  }
  const receipt=stage.receipt,phase=bountifulOriginalDiePhase(receipt)
  try{
   if(phase==='owner-choice')await ui.showChoice(receipt)
   else if(phase==='roller'||phase==='host-confirmation')await ui.requestRoll(receipt,async()=>{const fresh=await refresh(input,gateway);const value=fresh.receipts.find(row=>row.identity.occurrence===receipt.identity.occurrence);if(!value)throw Error('bountiful-driver:original-die-lost');return value})
  }catch{
    // A restored presentation may fail to finish after its authenticated answer
    // has already advanced the actual parent. Only a live opaque sequence may
    // recover from that persisted progress; unchanged parents remain pending.
    if(input.opportunitySequencePostNativeReplay!==undefined){const after=await refresh(input,gateway),fresh=after.receipts.find(row=>row.identity.occurrence===receipt.identity.occurrence);if(fresh&&JSON.stringify(fresh)!==JSON.stringify(receipt))continue}
    throw new BountifulOriginalParentPending(input.parentId,receipt.identity.occurrence)
   }
  const after=await refresh(input,gateway),fresh=after.receipts.find(row=>row.identity.occurrence===receipt.identity.occurrence)
  if(!fresh||JSON.stringify(fresh)===JSON.stringify(receipt)){
    const pending=new BountifulOriginalParentPending(input.parentId,receipt.identity.occurrence)
    if(fresh&&phase==='native-lucky-choice'&&receipt.request.nativeLucky===true&&receipt.nativeLuckyChoiceVersion===1&&!receipt.nativeLuckyDecision&&context.first.originalAdapterId==='spell'&&context.first.rawIssuer?.rollId.startsWith('spellcasting-original-saving:')&&input.spellcastingOriginalQualification){
     const qualification=input.spellcastingOriginalQualification,host=requireHost(),source=original.source as unknown as Parameters<typeof readDnd5eSpellcastingBountifulOriginalQualification>[1]
     const read=()=>{const current=requireHost();if(current.roomId!==host.roomId||current.memberId!==host.memberId)throw Error('caster-original-wait:host-changed');const actual=readDnd5eSpellcastingBountifulOriginalQualification(qualification,source);if(actual.effectTimestamp!==receipt.identity.effectTimestamp||actual.rawIssuer.rollId!==context.first.rawIssuer?.rollId||actual.request.actorId!==receipt.request.actorId)throw Error('caster-original-wait:exact-native-source-required');return{parentId:input.parentId,occurrence:receipt.identity.occurrence,actorId:receipt.request.actorId,effectTimestamp:actual.effectTimestamp,rollId:actual.rawIssuer.rollId,originalValues:[...actual.caster.values]}}
     read();spellcastingNativeLuckyPending.set(pending,{signature:JSON.stringify([pending.parentId,pending.occurrence,pending.message]),read})
    }
    throw pending
   }
 }
 throw Error('bountiful-driver:original-occurrence-limit')
}

/** The ordinary skill UI may resume directly from this saved prepared input.
 * It must not ask the original roller for a fresh d20 after a Host refresh. */
export async function readBountifulOriginalAbilityInput(input:{mapId:string;parentId:string},gateway:Gateway):Promise<Parameters<typeof import('../../../src/rulesets/dnd5e/abilityCheckAction').resolvePreparedDnd5eAbilityCheck>[0]&{hostOriginalDiceCursor?:number;hostOriginalRollIssuerMode?:'dm'|'player';hostOriginalRollId?:string;hostBountifulRollCursor?:number;hostBountifulPostDiceComplete?:true}|undefined>{
 const combat=await gateway.loadResource<Combat>('combat'),first=combat?.bountifulOriginalParents?.[bountifulOriginalParentReceiptId(input.parentId,0)]
 if(!first)return undefined
 if(first.originalAdapterId!=='ability-check')throw Error('bountiful-driver:wrong-ability-parent')
 await load(input,gateway)
 const original=await readBountifulOriginalSource(first,{includeContinuation:true})
 // This exact facade issued the private wire after reaching the real checkpoint.
 // Its private source remains pinned to the same room action and revisions.
 return {...original.source,...(first.rawIssuer?{hostOriginalRollIssuerMode:first.rawIssuer.mode,hostOriginalRollId:first.rawIssuer.rollId}:{}),...(first.continuation?{hostBountifulPostDiceComplete:true as const}:{}),hostBountifulRollCursor:first.continuation?.rollCursor??original.source.hostOriginalDiceCursor} as Parameters<typeof import('../../../src/rulesets/dnd5e/abilityCheckAction').resolvePreparedDnd5eAbilityCheck>[0]&{hostOriginalDiceCursor?:number;hostOriginalRollIssuerMode?:'dm'|'player';hostOriginalRollId?:string;hostBountifulRollCursor?:number;hostBountifulPostDiceComplete?:true}
}

/** Restore the saved native spell loop before requesting any new raw dice.
 * Only this exact concrete facade issued the private original-parent wire. */
export async function readBountifulOriginalSpellInput(input:{mapId:string;parentId:string},gateway:Gateway){
 const combat=await gateway.loadResource<Combat>('combat'),first=combat?.bountifulOriginalParents?.[bountifulOriginalParentReceiptId(input.parentId,0)]
 if(!first)return undefined
 if(first.originalAdapterId!=='spell')throw Error('bountiful-driver:wrong-spell-parent')
 const context=await load(input,gateway),original=await readBountifulOriginalSource(context.first,{includeContinuation:true})
 const rollCursor=context.first.continuation?.rollCursor??original.source.hostOriginalDiceCursor
 if(typeof rollCursor!=='number'||!Number.isSafeInteger(rollCursor)||rollCursor<0||rollCursor>100000||context.first.originalCheckpoint?.kind!=='saving-throw')throw Error('bountiful-driver:saved-spell-cursor-required')
 return {source:original.source as Parameters<typeof import('../../../src/rulesets/dnd5e/spellAction').resolvePreparedDnd5eSpellCast>[0],actorId:context.first.originalCheckpoint.actorId,rollCursor}
}

/** Concrete pre-original equipment restoration. The existing driver rechecks
 * the Host, pending original action, map/combat/turn, resources and geometry;
 * no arbitrary caller state or generalized prepared-state setter is accepted. */
export async function readBountifulOriginalEquipmentInput(input:{mapId:string;parentId:string},gateway:Gateway){
 const combat=await gateway.loadResource<Combat>('combat'),first=combat?.bountifulOriginalParents?.[bountifulOriginalParentReceiptId(input.parentId,0)]
 if(!first)return undefined
 if(first.originalAdapterId!=='equipment'||first.consumed)throw Error('bountiful-driver:wrong-pending-equipment-parent')
 const context=await load(input,gateway),original=await readBountifulOriginalSource(context.first)
 const resolver:unknown=original.resolve
 if(resolver!==resolvePreparedDnd5eEquipmentAttack)throw Error('bountiful-driver:actual-equipment-facade-required')
 // The exact private adapter restores this concrete facade's own Host input.
 const source=original.source as Parameters<typeof resolvePreparedDnd5eEquipmentAttack>[0]&{hostOriginalRollId?:unknown;hostOriginalDiceCursor?:unknown;hostOriginalRollIssuerMode?:unknown}
 if(typeof source.hostOriginalRollId!=='string'||typeof source.hostOriginalDiceCursor!=='number'||!Number.isSafeInteger(source.hostOriginalDiceCursor)||source.hostOriginalDiceCursor<1)throw Error('bountiful-driver:equipment-raw-lineage-required')
 const hostOriginalRollIssuerMode=bountifulOriginalRollIssuerMode(source)
 captureBountifulOriginalRawIssuer({mapId:input.mapId,parentId:input.parentId,mode:hostOriginalRollIssuerMode,rollId:source.hostOriginalRollId,cursor:source.hostOriginalDiceCursor,raw:source.d20Second==null?[source.d20]:[source.d20,source.d20Second]})
 if(first.postOriginalCursor&&(first.postOriginalCursor.rawRollId!==source.hostOriginalRollId||first.postOriginalCursor.cursor<source.hostOriginalDiceCursor))throw Error('bountiful-driver:foreign-equipment-cursor')
 return {...source,hostOriginalRollIssuerMode,hostOriginalRollId:source.hostOriginalRollId,hostOriginalDiceCursor:source.hostOriginalDiceCursor,hostBountifulRollCursor:first.postOriginalCursor?.cursor??source.hostOriginalDiceCursor}
}

/** The current Host restores the exact original raw boundary from its private
 * concrete spell parent. Caller payloads never supply replacement state. */
export async function readBountifulSpellOriginalRaw(input:{mapId:string;parentId:string},gateway:Gateway){
 const combat=await gateway.loadResource<Combat&{bountifulReadyParents?:Record<string,BountifulReadyParentData>}>('combat'),first=combat?.bountifulOriginalParents?.[bountifulOriginalParentReceiptId(input.parentId,0)]
 type Source=BountifulSpellOriginalInput
 let source:Source,actorId:string,kind:'attack'|'saving-throw',latestCursor:number
 if(first){
  if(first.consumed||first.originalAdapterId!=='spell')throw Error('bountiful-driver:live-spell-original-required')
  const context=await load(input,gateway),original=await readBountifulOriginalSource(context.first,{includeContinuation:true})
  source=original.source as Source
  const scope=first.originalCheckpoint??first.request
  if(scope.kind!=='attack'&&scope.kind!=='saving-throw')throw Error('bountiful-driver:actual-spell-roller-required')
  actorId=scope.actorId;kind=scope.kind;latestCursor=first.continuation?.rollCursor??0
 }else{
  const ready=Object.values(combat?.bountifulReadyParents??{}).filter(row=>row.parentId===input.parentId).sort((a,b)=>(a.request.ordinal??-1)-(b.request.ordinal??-1)).at(-1)
  if(!ready)return undefined
  if(ready.consumed||ready.request.kind!=='attack'&&ready.request.kind!=='saving-throw')throw Error('bountiful-driver:live-spell-ready-required')
  source=(await readBountifulReadyGenericReplay({mapId:input.mapId,frameId:ready.id},gateway)).source
  actorId=ready.request.actorId;kind=ready.request.kind;latestCursor=ready.continuation?.rollCursor??0
 }
 const row=kind==='saving-throw'?source.targetSavingThrows?.find(row=>row.targetId===actorId):undefined
 if(kind==='attack'&&actorId!==source.prepared.actorToken.id||kind==='saving-throw'&&actorId!==source.prepared.targetToken.id&&!source.prepared.targetSavingThrows?.some(row=>row.targetToken.id===actorId))throw Error('bountiful-driver:actual-prepared-roller-required')
 const d20=kind==='attack'?source.d20:row?.d20??source.savingThrowD20,second=kind==='attack'?source.d20Second:row?.d20Second??source.savingThrowD20Second
 if(d20===undefined||d20<1)throw Error('bountiful-driver:saved-original-raw-required')
 const raw=second===undefined?[d20]:[d20,second],metadata=bountifulOriginalRawForActor(source,actorId,kind,raw)
 latestCursor=Math.max(latestCursor,metadata.hostOriginalDiceCursor)
 if(source.hostOriginalSpellSavingThrows!==undefined){
  for(const row of source.targetSavingThrows??[]){if(row.d20>0)latestCursor=Math.max(latestCursor,bountifulOriginalRawForActor(source,row.targetId,'saving-throw',row.d20Second===undefined?[row.d20]:[row.d20,row.d20Second]).hostOriginalDiceCursor)}
  const globalActor=source.hostOriginalRollActorId,globalRow=source.targetSavingThrows?.find(row=>row.targetId===globalActor)
  if(typeof globalActor!=='string'||!globalRow)throw Error('bountiful-driver:actual-global-capture-required')
  const global=bountifulOriginalRawForActor(source,globalActor,'saving-throw',globalRow.d20Second===undefined?[globalRow.d20]:[globalRow.d20,globalRow.d20Second])
  if(source.hostOriginalRollId!==global.hostOriginalRollId||source.hostOriginalDiceCursor!==global.hostOriginalDiceCursor||source.hostOriginalRollKind!=='saving-throw')throw Error('bountiful-driver:changed-global-capture')
  return {source:{...source,...global,hostOriginalRollActorId:globalActor,hostOriginalRollKind:'saving-throw' as const},actorId,kind,rollCursor:latestCursor,rawDice:raw}
 }
 return {source:{...source,...metadata,hostOriginalRollActorId:actorId,hostOriginalRollKind:kind},actorId,kind,rollCursor:latestCursor,rawDice:raw}
}

/** Restore only the protected actual moving-player/opportunity composition.
 * The caller receives the original raw, never a fresh issuer or new baseline. */
export async function readBountifulOriginalOpportunityMoveInput(input:{mapId:string;parentId:string},gateway:Gateway){
 const context=await load(input,gateway)
 if(context.first.originalAdapterId!=='opportunity-move'||context.first.consumed||context.first.originalCheckpoint?.kind!=='attack')throw Error('bountiful-driver:wrong-opportunity-move-parent')
 const original=await readBountifulOriginalSource(context.first,{includeContinuation:true}),resolver:unknown=original.resolve
 if(resolver!==resolvePreparedDnd5eOpportunityPlayerMove)throw Error('bountiful-driver:actual-opportunity-move-facade-required')
 // Existing protected-source decoder plus the exact real resolver select this
 // concrete DTO; no external prepared object or replacement state is accepted.
 const source=original.source as Parameters<typeof resolvePreparedDnd5eOpportunityPlayerMove>[0]&{hostOriginalRollId?:string;hostOriginalDiceCursor?:number;hostOriginalRollIssuerMode?:'dm'|'player'}
 const prepared=source.prepared,actorId=prepared.opportunity?.actorToken.id
 if(!actorId||actorId!==context.first.originalCheckpoint.actorId||actorId===prepared.action.actorTokenId||JSON.stringify(prepared.action)!==JSON.stringify(context.first.originalRoomAction)||typeof source.hostOriginalRollId!=='string'||typeof source.hostOriginalDiceCursor!=='number')throw Error('bountiful-driver:opportunity-move-raw-lineage-required')
 const raw=source.opportunity.d20Second===undefined?[source.opportunity.d20]:[source.opportunity.d20,source.opportunity.d20Second]
 if(JSON.stringify(raw)!==JSON.stringify(context.first.request.originalRolls))throw Error('bountiful-driver:changed-opportunity-original')
 captureBountifulOriginalRawIssuer({mapId:input.mapId,parentId:input.parentId,mode:bountifulOriginalRollIssuerMode(source),rollId:source.hostOriginalRollId,cursor:source.hostOriginalDiceCursor,raw})
 return {source,hasAfterDice:!!context.first.continuation,rollCursor:context.first.continuation?.rollCursor??source.hostOriginalDiceCursor}
}

/** Restores only the actual private eligible current-turn death original. No
 * new roll, owner answer, world result, or replacement authority is issued. */
export async function readBountifulOriginalDeathSavingTurnInput(input:{mapId:string;parentId:string},gateway:Gateway){
 const combat=await gateway.loadResource<Combat>('combat'),first=combat?.bountifulOriginalParents?.[bountifulOriginalParentReceiptId(input.parentId,0)]
 if(!first)return undefined
 if(first.originalAdapterId!=='death-save'||first.consumed)throw Error('bountiful-driver:wrong-pending-death-parent')
 const context=await load(input,gateway),original=await readBountifulOriginalSource(context.first,{includeContinuation:true}),{resolvePreparedDnd5eDeathSavingTurn}=await import('./deathSaveTurnAction')
 if(original.resolve!==resolvePreparedDnd5eDeathSavingTurn)throw Error('bountiful-driver:actual-death-facade-required')
 const source=original.source as Parameters<typeof resolvePreparedDnd5eDeathSavingTurn>[0]&{hostOriginalRollId?:unknown;hostOriginalDiceCursor?:unknown;hostOriginalRollIssuerMode?:unknown}
 if(typeof source.hostOriginalRollId!=='string'||typeof source.hostOriginalDiceCursor!=='number'||!Number.isSafeInteger(source.hostOriginalDiceCursor)||source.hostOriginalDiceCursor<1||!['dm','player'].includes(String(source.hostOriginalRollIssuerMode)))throw Error('bountiful-driver:death-raw-lineage-required')
 return{source,rollCursor:context.first.continuation?.rollCursor??source.hostOriginalDiceCursor,postDiceComplete:!!context.first.continuation}
}
