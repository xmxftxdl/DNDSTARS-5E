import type{Character}from'../types/character'
import type{InitiativeEntry}from'../components/map/InitiativeTracker'
import{registeredDnd5ePluginFeatures,dnd5eCharacterHasPluginFeature,dnd5ePluginFeatureCurrentEnvelopeFullV1}from'../rulesets/dnd5e/plugins/pluginContentCatalog'
import{dnd5eDeclarativeResourceKey}from'../rulesets/dnd5e/plugins/pluginDeclarativeCompiler'
import{updateClassResource}from'../lib/classResources'
export interface InitiativeRollReceipt{id:string;combatId:string;phase:'combat-start'|'live-join'}
type RolledEntry=InitiativeEntry&{initiativeRollReceipt?:InitiativeRollReceipt}
export type SecondChanceRecoveryCharacter=Character&{dnd5eInitiativeResourceRecoveryReceipts?:Record<string,{combatId:string;rollReceiptId:string}>}
/** Only the confirmed combat-start transaction calls this reducer. The receipt
 * is minted by the actual initiative dice builder, before any rank edits. */
export function recoverSecondChanceOnConfirmedInitiative(character:SecondChanceRecoveryCharacter,currentCombatId:string,entry:RolledEntry):SecondChanceRecoveryCharacter{
 const receipt=entry.initiativeRollReceipt,calculation=entry.initiativeCalculation
 if(!receipt||receipt.phase!=='combat-start'||receipt.combatId!==currentCombatId||!receipt.id||!calculation||entry.turnKind==='thief-reflexes')return character
 const dice=calculation.rolls,mode=calculation.mode
 if(!['normal','advantage','disadvantage'].includes(mode)||dice.length!==(mode==='normal'?1:2)||dice.some(die=>!Number.isInteger(die)||die<1||die>20)||calculation.d20!==(mode==='advantage'?Math.max(...dice):mode==='disadvantage'?Math.min(...dice):dice[0]))throw Error('second-chance:invalid-initiative-roll-receipt')
 let next=character
 for(const feature of registeredDnd5ePluginFeatures()){
  const ability=feature.declarativeAbility
  if(!dnd5ePluginFeatureCurrentEnvelopeFullV1(feature.id)||feature.automation!=='full'||ability?.automation!=='full'||ability?.mechanic?.kind!=='incoming-hit-attack-die-reroll'||!dnd5eCharacterHasPluginFeature(next,feature.id)||ability.cost?.resources?.length!==1)continue
  const previous=next.dnd5eInitiativeResourceRecoveryReceipts?.[feature.id]
  if(previous?.combatId===currentCombatId&&previous.rollReceiptId===receipt.id)continue
  const cost=ability.cost.resources[0],key=dnd5eDeclarativeResourceKey(feature.ownerPluginId,cost)
  if(cost.scope==='core'||cost.amount!==1||next.classResources?.[key]?.max!==1)continue
  const recovered=updateClassResource(next,key,resource=>resource.max)
  if(!recovered)continue
  next={...recovered,dnd5eInitiativeResourceRecoveryReceipts:{...next.dnd5eInitiativeResourceRecoveryReceipts,[feature.id]:{combatId:currentCombatId,rollReceiptId:receipt.id}}}
 }
 return next
}
