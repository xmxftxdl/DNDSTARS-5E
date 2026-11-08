import {encodeSecondChanceParentWire} from '../../lib/secondChanceParentWire'

import {captureBountifulOriginalRawIssuer} from './bountifulOriginalRawIssuer'
import {bountifulOpportunityMoveDiceRoute} from './bountifulHostOperation'
import {cloneDnd5eHostTransactionInput} from './hostTransactionClone'
import {persistBountifulOriginalParent} from './bountifulLuckPersistentHost'
import {driveBountifulOriginalParent,readBountifulOriginalOpportunityMoveInput} from './bountifulLuckPersistentRoomDriver'
import {recordBountifulOriginalAfterDice} from './bountifulLuckNormalAck'
import {issueBountifulOpportunityMoveRawSource,resolvePreparedDnd5eOpportunityPlayerMove,readIssuedDnd5eOpportunityPlayerMove,type PreparedDnd5eOpportunityPlayerMove} from './opportunityMoveAction'
import {dnd5eCoreInspirationChoiceRerollOption} from '../../lib/d20InterruptPolicy'
import {dnd5eD20ChoiceRerollFeaturesForCharacter} from './pluginApi'
import {createDnd5eOriginalD20Session} from './damageCommitSession'
import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
type Source=Parameters<typeof resolvePreparedDnd5eOpportunityPlayerMove>[0]&ReturnType<typeof captureBountifulOriginalRawIssuer>
type Rolls=Source['opportunity']
/** Closed representation defaults emitted by the actual Page collector. This
 * changes no original fact: an existing own key always retains strict checks,
 * and a real late choice remains present for the unchanged source guard. */
function collectedOpportunitySource(original:Rolls,collected:Rolls):Rolls{
 const keys=['disadvantageNegationChoice','areaAttackAdvantageReaction','d20','d20Second','halflingLuckyD20','halflingLuckyD20Second','blessRoll','baneRoll','bardicInspirationRoll','cuttingWords','cuttingWordsDamage','strokeOfLuck','postD20Adjustment','shieldSpellReaction','shieldSpellcastingSavingThrows','uncannyDodge','tranquilitySave','damageRolls','savageAttacksRoll','wholeWeaponDamageReroll','classDamageRolls','inventoryEffectRolls','hurlThroughHellDamageRolls','standAgainstTide'] as const satisfies readonly(keyof Rolls)[]
 const booleans=['strokeOfLuck','shieldSpellReaction','uncannyDodge'] as const satisfies readonly(keyof Rolls)[]
 const arrays=['classDamageRolls','inventoryEffectRolls'] as const satisfies readonly(keyof Rolls)[]
 for(const key of Reflect.ownKeys(collected))if(typeof key!=='string'||!Object.hasOwn(original,key)&&!keys.some(known=>known===key))throw Error('bountiful-after-dice:changed-opportunity-original')
 const next={...original,...collected}
 for(const key of keys){
  if(Object.hasOwn(original,key))continue
  const value=collected[key]
  if(value===undefined||booleans.some(known=>known===key)&&value===false||arrays.some(known=>known===key)&&Array.isArray(value)&&value.length===0||key==='shieldSpellcastingSavingThrows'&&value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===0)Reflect.deleteProperty(next,key)
 }
 return next
}

type Gateway=Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'|'publishEvent'>
const collectedOriginals=new WeakMap<object,()=>{action:Source['prepared']['action'];authorityUnchanged:()=>boolean}>()
export function readBountifulOpportunityCollectedOriginal(boundary:object){
 const read=collectedOriginals.get(boundary)
 if(!read)throw Error('bountiful-opportunity-flow:actual-collected-original-required')
 return read()
}
type UI=Parameters<typeof driveBountifulOriginalParent>[2]&{confirmSelfReroll?:(input:{parentId:string;sourceOccurrence:number;dieIndex:number;rawRollId:string;originalValue:number;rollMode:'normal'|'advantage'|'disadvantage';actorTokenId:string;characterId:string})=>Promise<number>}
/** Binds the real collect-OA callback to its actual moving player's parent.
 * No caller can replace prepared state, command, raw values or another roller. */
export function createBountifulOpportunityMoveRawBoundary(input:{prepared:PreparedDnd5eOpportunityPlayerMove;rawCursor:number;issuerMode:'dm'|'player';authorityUnchanged:()=>boolean;deferMovement?:boolean;initial?:Omit<Rolls,'d20'|'d20Second'|'damageRolls'|'halflingLuckyD20'|'halflingLuckyD20Second'>},gateway:Gateway,ui:UI){
 const initial=cloneDnd5eHostTransactionInput({...input.prepared.originalChoices,...input.initial})
 for(const key of ['tranquilitySave','areaAttackAdvantageReaction','disadvantageNegationChoice'] as const){if(input.initial?.[key]!==undefined&&JSON.stringify(input.initial[key])!==JSON.stringify(input.prepared.originalChoices?.[key]))throw Error('bountiful-opportunity-flow:changed-pre-original-choice')}
 const guard=()=>{if(!input.authorityUnchanged())throw Error('bountiful-opportunity-flow:stale-authority')}
 const parentId=input.prepared.action.id,actorId=input.prepared.opportunity.actorToken.id,rollMode=input.prepared.rawMode
 let rawId:string|undefined,source:Source|undefined,raw:readonly number[]|undefined,retained:readonly number[]|undefined,preview:Source['prepared']['state']|undefined,route:ReturnType<typeof bountifulOpportunityMoveDiceRoute>
 const drive=()=>driveBountifulOriginalParent({mapId:input.prepared.map.id,parentId},gateway,ui)
 const boundary={
  getDiceRoute(){return route},
  /** No supplied raw or state is accepted. Only the current protected original
   * and the concrete Host re-preparer can resume completed late attack dice. */
  async resumeOriginal(){
   guard();const actual=readIssuedDnd5eOpportunityPlayerMove(input.prepared)
   const loaded=await readBountifulOriginalOpportunityMoveInput({mapId:actual.map.id,parentId},gateway)
   if(JSON.stringify(encodeSecondChanceParentWire(loaded.source.prepared))!==JSON.stringify(encodeSecondChanceParentWire(actual))||typeof loaded.source.hostOriginalRollId!=='string'||typeof loaded.source.hostOriginalDiceCursor!=='number'||loaded.source.hostOriginalDiceCursor!==input.rawCursor||loaded.source.hostOriginalRollIssuerMode!==input.issuerMode)throw Error('bountiful-opportunity-flow:actual-completed-original-required')
   const values=loaded.source.opportunity.d20Second===undefined?[loaded.source.opportunity.d20]:[loaded.source.opportunity.d20,loaded.source.opportunity.d20Second]
   rawId=loaded.source.hostOriginalRollId;raw=[...values]
   source={...cloneDnd5eHostTransactionInput(loaded.source),...captureBountifulOriginalRawIssuer({mapId:actual.map.id,parentId,mode:input.issuerMode,rollId:rawId,cursor:loaded.source.hostOriginalDiceCursor,raw:values})}
   const ready=await drive();guard();retained=[...ready.request.values];preview=cloneDnd5eHostTransactionInput(ready.snapshot)
   return cloneDnd5eHostTransactionInput(source.opportunity)
  },
  hasCapturedOriginal(){return source!==undefined},
  async beforeOriginalRequest(requestId:string,count:1|2){
   guard()
   if(count!==(rollMode==='normal'?1:2)||rawId!==undefined&&rawId!==requestId)throw Error('bountiful-opportunity-flow:actual-request-required')
   await issueBountifulOpportunityMoveRawSource(input.prepared,{rawRollId:requestId,rawCursor:input.rawCursor,issuerMode:input.issuerMode},gateway)
   guard();rawId=requestId;route=bountifulOpportunityMoveDiceRoute(input.prepared,requestId)
  },
  async afterOriginalConfirmed(values:readonly number[],requestId:string):Promise<readonly [number,number|undefined]|undefined>{
   guard()
   if(requestId!==rawId||values.length!==(rollMode==='normal'?1:2)||values.some(face=>!Number.isInteger(face)||face<1||face>20)||raw&&JSON.stringify(raw)!==JSON.stringify(values))throw Error('bountiful-opportunity-flow:changed-original')
   raw=[...values]
   const candidate:Source=source??{prepared:cloneDnd5eHostTransactionInput(input.prepared),transactionId:parentId,...(input.deferMovement?{stage:'opportunity' as const}:{}),opportunity:{...initial,d20:values[0]!,...(values.length===2?{d20Second:values[1]}:{}),damageRolls:[]},...captureBountifulOriginalRawIssuer({mapId:input.prepared.map.id,parentId,mode:input.issuerMode,rollId:requestId,cursor:input.rawCursor,raw:values})}
   if(!source){
    const previewSession=createDnd5eOriginalD20Session(candidate,resolvePreparedDnd5eOpportunityPlayerMove,actorId,'attack')
    try{const checkpoint=previewSession.run(candidate.prepared.state);if(checkpoint.status!=='pending-ally-natural-one'||checkpoint.request.nativeLucky)return undefined}finally{previewSession.cancel()}
    guard();source=candidate
   }
   await persistBountifulOriginalParent({parentId,source,resolve:resolvePreparedDnd5eOpportunityPlayerMove,actorId,kind:'attack'},gateway)
   let ready=await drive()
   const characterId=input.prepared.characterIdByCombatantId[actorId],character=input.prepared.characters.find(row=>row.id===characterId)
   if(character)for(let dieIndex=0;dieIndex<ready.request.values.length;dieIndex++){
    if(ready.request.finalizedDice.includes(dieIndex))continue
    const originalValue=ready.request.values[dieIndex]!,hasChoice=!!dnd5eCoreInspirationChoiceRerollOption(character,actorId,rollMode)||dnd5eD20ChoiceRerollFeaturesForCharacter(character,'attack','self-roll',originalValue,{rollMode,attackAbility:ready.request.attackAbility}).some(row=>row.feature.automation==='full'&&row.feature.declarativeAbility?.automation==='full')
    if(!hasChoice)continue
    if(!ui.confirmSelfReroll)throw Error('bountiful-opportunity-flow:actual-generic-ui-required')
    const selected=await ui.confirmSelfReroll({parentId,sourceOccurrence:0,dieIndex,rawRollId:requestId,originalValue,rollMode,actorTokenId:actorId,characterId:character.id})
    const after=await drive();if(after.request.values[dieIndex]!==selected)throw Error('bountiful-opportunity-flow:actual-generic-journal-required');ready=after
   }
   guard();retained=[...ready.request.values];preview=cloneDnd5eHostTransactionInput(ready.snapshot)
   return [retained[0]!,retained[1]]
  },
  readRetained(){guard();if(!source||!retained)throw Error('bountiful-opportunity-flow:actual-ready-original-required');return [retained[0]!,retained[1]] as const},
  readPreview(){return preview&&cloneDnd5eHostTransactionInput(preview)},
  readOriginal(){if(!source)throw Error('bountiful-opportunity-flow:original-not-confirmed');return cloneDnd5eHostTransactionInput(source)},
  async recordMovement(movement:NonNullable<Source['movement']>,rollCursor:number){
   guard()
   if(!source||!raw||!retained||source.stage!=='opportunity'&&(source.movement===undefined||JSON.stringify(encodeSecondChanceParentWire(source.movement))!==JSON.stringify(encodeSecondChanceParentWire(movement))))throw Error('bountiful-opportunity-flow:actual-opportunity-prefix-required')
   if(Object.keys(movement).some(key=>key==='prepared'||key==='transactionId'))throw Error('bountiful-opportunity-flow:changed-movement-parent')
   const finalSource={...source,stage:undefined,movement:cloneDnd5eHostTransactionInput(movement)}
   await recordBountifulOriginalAfterDice({action:input.prepared.action,source:finalSource,resolve:resolvePreparedDnd5eOpportunityPlayerMove,authorityUnchanged:input.authorityUnchanged,rollCursor},gateway)
   source=finalSource
   return cloneDnd5eHostTransactionInput(finalSource)
  },
  async recordFinalRolls(rolls:Rolls,rollCursor:number){
   guard()
   if(!source||!raw||!retained||rolls.halflingLuckyD20!==undefined||rolls.halflingLuckyD20Second!==undefined||!rolls.postD20Adjustment&&(rolls.d20!==retained[0]||rolls.d20Second!==retained[1]))throw Error('bountiful-opportunity-flow:actual-retained-original-required')
   const finalSource={...source,opportunity:{...collectedOpportunitySource(source.opportunity,rolls),d20:raw[0]!,...(raw.length===2?{d20Second:raw[1]}:{d20Second:undefined})}}
   await recordBountifulOriginalAfterDice({action:input.prepared.action,source:finalSource,resolve:resolvePreparedDnd5eOpportunityPlayerMove,authorityUnchanged:input.authorityUnchanged,rollCursor},gateway)
   source=finalSource
   return finalSource
  },
 }
 const result={...boundary,async resumeAfterDice(){
  const loaded=await readBountifulOriginalOpportunityMoveInput({mapId:input.prepared.map.id,parentId},gateway)
  if(!loaded.hasAfterDice)throw Error('bountiful-opportunity-flow:actual-completed-original-required')
  return boundary.resumeOriginal()
 }}
 collectedOriginals.set(result,()=>{
  guard();readIssuedDnd5eOpportunityPlayerMove(input.prepared)
  if(!source||!raw||!retained)throw Error('bountiful-opportunity-flow:actual-confirmed-original-required')
  return {action:input.prepared.action,authorityUnchanged:input.authorityUnchanged}
 })
 return result
}
