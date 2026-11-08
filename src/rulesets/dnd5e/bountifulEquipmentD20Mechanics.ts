import {appendRollLedgerEntry,createCombatTransaction,rerollLedgerDie} from '../../lib/combatTransaction'
import {normalizeDnd5eInventory} from './items'
import {dnd5eAttackRollRerollCandidates} from './inventoryHeadlessEffects'
import {commitDnd5eAttackRollRerollEffect,type Dnd5eCommitAttackRollRerollCommandV1} from './inventoryHeadlessEffectAuthority'
import type {PreparedDnd5eEquipmentAttack} from './equipmentAttackAction'
import type {OriginalD20Ready} from './allyNaturalOneCheckpoint'

export interface BountifulEquipmentD20Selection{
 parentId:string;readyOrdinal:number;dieIndex:number;originalValue:number;replacement:number
 instanceId:string;effectId:string;resourceId:string
}
/** Pure mechanical verification for the concrete equipment continuation. This
 * is not an issuer, receipt, or authorization endpoint. The Host driver must
 * bind the real owner choice and confirmed original-roller result separately.
 * In particular no caller-supplied RollLedger is accepted as authority here.
 * Rebuild a single real equipment reroll and reuse its existing cost checker;
 * publication still belongs to the original parent CAS. */
export function resolveBountifulEquipmentD20Selection(input:{prepared:PreparedDnd5eEquipmentAttack;ready:OriginalD20Ready;selection:BountifulEquipmentD20Selection}){
 const {prepared,ready,selection}=input
 if(selection.parentId!==prepared.action.id||selection.readyOrdinal!==ready.ordinal||ready.actorId!==prepared.actorToken.id||ready.kind!=='attack'||!Number.isInteger(selection.dieIndex)||selection.dieIndex<0||selection.dieIndex>=ready.values.length||ready.finalizedDice.includes(selection.dieIndex)||ready.values[selection.dieIndex]!==selection.originalValue||!Number.isInteger(selection.replacement)||selection.replacement<1||selection.replacement>20)throw Error('bountiful-equipment:changed-original-die')
 if(!ready.rollMode||ready.values.length!==(ready.rollMode==='normal'?1:2)||prepared.characterIdByCombatantId[ready.actorId]!==prepared.actor.id||!prepared.characters.some(row=>row.id===prepared.actor.id&&JSON.stringify(row)===JSON.stringify(prepared.actor)))throw Error('bountiful-equipment:actual-source-required')
 const candidate=dnd5eAttackRollRerollCandidates(prepared.actor,prepared.profile.weaponId).find(row=>row.instanceId===selection.instanceId&&row.effectId===selection.effectId&&row.effect.resourceId===selection.resourceId)
 if(!candidate)throw Error('bountiful-equipment:current-item-unavailable')
 const entryId=selection.parentId+':attack-roll',commandId=selection.parentId+':bountiful-equipment:'+selection.readyOrdinal+':'+selection.dieIndex
 const transaction=rerollLedgerDie(appendRollLedgerEntry(createCombatTransaction({id:selection.parentId,mapId:prepared.map.id,combatId:prepared.state.combatId,actorId:prepared.actor.id,actionId:selection.parentId,actionKind:'weapon-attack',now:1}),{id:entryId,kind:'attack',label:prepared.profile.weaponName,dice:{sides:20,values:[...ready.values]},modifier:prepared.profile.attackModifier,visibility:'public',sourceId:prepared.actor.id,targetId:prepared.targetToken.id,createdAt:1}),{entryId,dieIndex:selection.dieIndex,replacementValue:selection.replacement,sourceId:candidate.instanceId,sourceLabel:candidate.itemName,spentResource:{characterId:prepared.actor.id,instanceId:candidate.instanceId,resourceId:candidate.effect.resourceId,amount:1},now:1})
 const command:Dnd5eCommitAttackRollRerollCommandV1={schemaVersion:1,commandId,transactionId:selection.parentId,actorId:prepared.actor.id,instanceId:candidate.instanceId,effectId:candidate.effectId,resourceId:candidate.effect.resourceId,rollLedgerEntryId:entryId,rerollIndex:0,expectedInventoryRevision:normalizeDnd5eInventory(prepared.actor).revision??0}
 const commit=commitDnd5eAttackRollRerollEffect({character:prepared.actor,transaction,command,weaponId:prepared.profile.weaponId})
 if(!commit.ok||commit.deduplicated)throw Error('bountiful-equipment:real-item-cost-required')
 const values=[...ready.values];values[selection.dieIndex]=selection.replacement
 return {values,command,transaction:commit.transaction,character:commit.character}
}
