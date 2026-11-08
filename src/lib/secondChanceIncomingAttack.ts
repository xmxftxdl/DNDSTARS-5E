import {createD20ChoiceRerollContribution,createD20RollConfirmationInterrupt,settleD20RollConfirmation} from './rollConfirmation'
import type {RollConfirmationInterruptResponse} from './combatInterruptProtocol'
import{resolveDnd5eAttackRollOutcome}from'../rulesets/dnd5e/attackResolution'

/** A narrow Host helper, intentionally separate from Lucky's additional-die policies.
 * All facts and principals below must come from the persisted Host snapshot/session;
 * neither incoming player commands nor labels are an authority source. */
export interface IncomingAttackReceipt {
 schemaVersion:1; id:string; transactionId:string; mapId:string; combatId:string
 rollerTokenId:string; rollerCharacterId?:string; targetTokenId:string; targetCharacterId:string
 rollerControllerMemberId:string; targetControllerMemberId:string
 dice:readonly number[]; mode:'normal'|'advantage'|'disadvantage'; modifier:number; armorClass:number
 criticalThreshold:number; phase:'hit-confirmation'|'damage-committed'|'cancelled'
 forceHit?:boolean;automaticCritical?:boolean
}
export interface SecondChanceHostSnapshot {
 featureId:string; featureLabel:string; ownerCharacterId:string; ownerName:string; ownerTokenId:string
 ownedFeatureIds:readonly string[]; canSeeRoller:boolean; reactionAvailable:boolean; reactionReserved:boolean
 resourceKey:string; resourceCurrent:number; resourceMaximum:number
}
export interface SecondChanceDieSelection {attackReceiptId:string; rollerTokenId:string; dieIndex:number}
export interface SecondChanceCommit {
 attackReceiptId:string; transactionId:string; featureId:string; ownerCharacterId:string
 replacedDieIndex:number; beforeDice:readonly number[]; afterDice:readonly number[]
 adoptedD20:number; total:number; hit:boolean; critical:boolean
 nextResourceCurrent:number; nextReactionAvailable:false; confirmation:RollConfirmationInterruptResponse
}
const die=(value:number)=>Number.isInteger(value)&&value>=1&&value<=20
function fail(reason:string):never{throw Error(`second-chance:${reason}`)}
function validateAttack(attack:IncomingAttackReceipt):void{
 if(attack.schemaVersion!==1||![attack.id,attack.transactionId,attack.mapId,attack.combatId,attack.rollerTokenId,attack.targetTokenId,attack.targetCharacterId,attack.rollerControllerMemberId,attack.targetControllerMemberId].every(value=>typeof value==='string'&&value.trim()))fail('invalid-attack-receipt')
 if(!['normal','advantage','disadvantage'].includes(attack.mode)||!Array.isArray(attack.dice)||attack.dice.length!==(attack.mode==='normal'?1:2)||!attack.dice.every(die)||!Number.isFinite(attack.modifier)||!Number.isFinite(attack.armorClass)||!Number.isInteger(attack.criticalThreshold)||attack.criticalThreshold<2||attack.criticalThreshold>20)fail('invalid-attack-roll')
}
export function incomingAttackOutcome(attack:IncomingAttackReceipt,dice:readonly number[]=attack.dice):{adoptedD20:number;total:number;hit:boolean;critical:boolean}{
 validateAttack(attack)
 if(dice.length!==attack.dice.length||!dice.every(die))fail('invalid-replacement-dice')
 const adoptedD20=attack.mode==='advantage'?Math.max(...dice):attack.mode==='disadvantage'?Math.min(...dice):dice[0]
 const total=adoptedD20+attack.modifier
 // Use the Host snapshotted critical threshold for the same attack.
 const outcome=resolveDnd5eAttackRollOutcome({roll:{d20:adoptedD20,total,naturalOne:adoptedD20===1,naturalTwenty:adoptedD20===20},targetArmorClass:attack.armorClass,criticalThreshold:attack.criticalThreshold,forceHit:attack.forceHit,automaticCritical:attack.automaticCritical})
 return {adoptedD20,total,...outcome}
}
export function secondChanceHostEligibility(attack:IncomingAttackReceipt,owner:SecondChanceHostSnapshot):{ok:true}|{ok:false;reason:string}{
 validateAttack(attack)
 if(attack.phase!=='hit-confirmation')return{ok:false,reason:'attack-not-awaiting-hit-confirmation'}
 if(attack.targetCharacterId!==owner.ownerCharacterId||attack.targetTokenId!==owner.ownerTokenId)return{ok:false,reason:'not-own-incoming-attack'}
 if(!owner.ownedFeatureIds.includes(owner.featureId))return{ok:false,reason:'feature-not-owned'}
 if(!incomingAttackOutcome(attack).hit)return{ok:false,reason:'attack-missed'}
 if(!owner.canSeeRoller)return{ok:false,reason:'attacker-not-visible'}
 if(!owner.reactionAvailable||owner.reactionReserved)return{ok:false,reason:'reaction-unavailable'}
 if(!owner.resourceKey.trim()||!Number.isSafeInteger(owner.resourceCurrent)||!Number.isSafeInteger(owner.resourceMaximum)||owner.resourceMaximum!==1||owner.resourceCurrent!==1)return{ok:false,reason:'resource-unavailable'}
 return{ok:true}
}
/** Called only on the authenticated attack roller's command. The reaction owner
 * authorizes use separately and cannot choose the attack roller's die. */
export function selectSecondChanceAttackDie(attack:IncomingAttackReceipt,authenticatedMemberId:string,dieIndex:number):SecondChanceDieSelection{
 validateAttack(attack)
 if(authenticatedMemberId!==attack.rollerControllerMemberId)fail('roller-selection-not-authorized')
 if(!Number.isInteger(dieIndex)||dieIndex<0||dieIndex>=attack.dice.length)fail('invalid-die-index')
 return{attackReceiptId:attack.id,rollerTokenId:attack.rollerTokenId,dieIndex}
}
/** Pure preparation for one atomic Host commit. It does not mutate map, character,
 * or the attack; the adapter must CAS all three plus this receipt together. */
export function prepareSecondChanceCommit(input:{attack:IncomingAttackReceipt;owner:SecondChanceHostSnapshot;authenticatedReactionMemberId:string;decision:'use'|'decline';selection?:SecondChanceDieSelection;hostRerollD20?:number;prior?:SecondChanceCommit;now?:number}):SecondChanceCommit|undefined{
 const{attack,owner}=input
 validateAttack(attack)
 if(input.authenticatedReactionMemberId!==attack.targetControllerMemberId)fail('reaction-not-authorized')
 if(input.prior){
  if(input.prior.attackReceiptId!==attack.id||input.prior.featureId!==owner.featureId||input.prior.ownerCharacterId!==owner.ownerCharacterId||input.prior.transactionId!==attack.transactionId)fail('prior-receipt-mismatch')
  return input.prior
 }
 if(input.decision==='decline')return undefined
 const eligible=secondChanceHostEligibility(attack,owner)
 if(!eligible.ok)fail(eligible.reason)
 const selection=input.selection
 if(!selection||selection.attackReceiptId!==attack.id||selection.rollerTokenId!==attack.rollerTokenId||!Number.isInteger(selection.dieIndex)||selection.dieIndex<0||selection.dieIndex>=attack.dice.length)fail('selection-receipt-mismatch')
 if(!die(input.hostRerollD20??0))fail('host-reroll-required')
 const now=input.now??Date.now()
 // Reuse the actual mainline confirmation ledger, replacing exactly the chosen
 // original die. Its internal result is a die replacement, not the adopted roll.
 const interrupt=createD20RollConfirmationInterrupt({mapId:attack.mapId,combatId:attack.combatId,rollId:`${attack.id}:second-chance:${selection.dieIndex}`,label:owner.featureLabel,originalValue:attack.dice[selection.dieIndex],rollerCharacterId:attack.rollerCharacterId,eligibleModifiers:[{characterId:owner.ownerCharacterId,featureId:owner.featureId,featureLabel:owner.featureLabel,modifierKind:'choice-reroll',rerollScope:'attack-against-self',additionalDice:1,selectionPolicy:'must-use-latest',resourceCosts:[{resourceKey:owner.resourceKey,amount:1}]}],now})
 const contribution=createD20ChoiceRerollContribution({interruptId:interrupt.id,characterId:owner.ownerCharacterId,characterName:owner.ownerName,featureId:owner.featureId,featureLabel:owner.featureLabel,decision:'use',now})
 interrupt.contributions=[contribution]
 interrupt.payload.rollOptions={contributionId:contribution.id,values:[attack.dice[selection.dieIndex],input.hostRerollD20!]}
 const confirmation=settleD20RollConfirmation(interrupt,contribution.id,now)
 if(confirmation.decision!=='continue'||confirmation.finalValue==null)fail('confirmation-not-settled')
 const afterDice=[...attack.dice];afterDice[selection.dieIndex]=confirmation.finalValue
 return{attackReceiptId:attack.id,transactionId:attack.transactionId,featureId:owner.featureId,ownerCharacterId:owner.ownerCharacterId,replacedDieIndex:selection.dieIndex,beforeDice:[...attack.dice],afterDice,...incomingAttackOutcome(attack,afterDice),nextResourceCurrent:owner.resourceCurrent-1,nextReactionAvailable:false,confirmation}
}
export type SecondChanceRecoveryEvent=
 |{kind:'short-rest'|'long-rest';receiptId:string;ownerCharacterId:string;completed:true}
 |{kind:'rolled-initiative';receiptId:string;ownerCharacterId:string;combatId:string;phase:'combat-start';hostDice:readonly number[];mode:'normal'|'advantage'|'disadvantage'}
/** The adapter accepts this event only from a persisted authoritative rest or
 * initiative transaction. Combat-start buttons and manual ordering are not events. */
export function recoverSecondChanceResource(state:{current:number;processedRecoveryReceiptIds:readonly string[]},ownerCharacterId:string,event:SecondChanceRecoveryEvent):{current:number;processedRecoveryReceiptIds:readonly string[]}{
 if(!event.receiptId?.trim()||event.ownerCharacterId!==ownerCharacterId)fail('invalid-recovery-owner')
 if(state.processedRecoveryReceiptIds.includes(event.receiptId))return state
 if(event.kind==='rolled-initiative'){
  if(event.phase!=='combat-start'||!event.combatId?.trim()||!['normal','advantage','disadvantage'].includes(event.mode)||!Array.isArray(event.hostDice)||event.hostDice.length!==(event.mode==='normal'?1:2)||!event.hostDice.every(die))fail('invalid-initiative-recovery')
 }else if(!['short-rest','long-rest'].includes(event.kind)||event.completed!==true)fail('rest-not-completed')
 return{current:1,processedRecoveryReceiptIds:[...state.processedRecoveryReceiptIds,event.receiptId]}
}

