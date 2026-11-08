import{pactWeaponPendingSeparationInstance}from'./pactWeaponSeparation'
import{validPactWeaponAuthority}from'./pactWeaponSummonHost'

import type{BattleMap}from'../../store/maps'
import type{SharedRoomGatewayPort}from'../../ports/sharedRoomGateway'
import type{SharedCampaignTimeState}from'../../lib/campaignTime'
import{validateSharedCampaignTime}from'../../lib/campaignTime'
import type{SharedMapGeometryState}from'../../lib/mapGeometry'
import type{SharedCombatState}from'../../lib/sharedCombatTypes'
import{getRoomSession}from'../../lib/roomSession'
import{prepareDnd5eMapInventoryPickup}from'../../rulesets/dnd5e/mapInventoryPickup'
import{liveDnd5eMapInventoryBoundEffects}from'../../rulesets/dnd5e/mapInventoryBoundEffects'
import{dnd5eExecutionEventKey}from'../../rulesets/dnd5e/activities/dnd5eActivityIdentity'
import{validPactWeaponPhysicalIdentity}from'./pactWeaponPhysicalIdentity'
import type{RitualCharacter}from'./pactWeaponRitualHost'
import{reconcilePactHostClock}from'./pactWeaponClockSnapshot'
type Snapshot<T>=T&{_sync?:{revision?:number}}
type Gateway=Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'>
export type PactGroundPickupCommand={mapId:string;actorTokenId:string;objectTokenId:string;expectedReceiptId:string;expectedQuantity:number;transactionId:string}
const revision=(value:Snapshot<object>|null)=>{if(!value)return 0;const n=value._sync?.revision;if(!Number.isSafeInteger(n)||n!<0)throw Error('pact-pickup:revision-required');return n!}
/** Dedicated handoff for a genuinely issued Pact physical item. Formal character
 * time is reconciled BEFORE attaching a ground effect, then all resources and a
 * durable transport receipt publish together. The old UI-store cursor is unused. */
export async function commitPactWeaponGroundPickup(input:PactGroundPickupCommand,gateway:Gateway){
 const session=getRoomSession(),stamp=session&&{roomId:session.roomId,memberId:session.memberId},guard=()=>{const now=getRoomSession();if(!stamp||now?.role!=='dm'||now.roomId!==stamp.roomId||now.memberId!==stamp.memberId)throw Error('pact-pickup:host-room-required')};guard()
 if(Object.keys(input).some(key=>!['mapId','actorTokenId','objectTokenId','expectedReceiptId','expectedQuantity','transactionId'].includes(key))||!input.transactionId.trim()||input.transactionId.length>220)throw Error('pact-pickup:invalid-command')
 const transactionId='pact-pickup:'+dnd5eExecutionEventKey(input.transactionId),fingerprint=JSON.stringify(input)
 const[characters,maps,clock,geometry,combat]=await Promise.all([gateway.loadResource<Snapshot<{characters:RitualCharacter[]}>>('characters'),gateway.loadResource<Snapshot<{maps:BattleMap[]}>>('maps'),gateway.loadResource<Snapshot<SharedCampaignTimeState>>('campaign-time'),gateway.loadResource<Snapshot<SharedMapGeometryState>>('map-geometry'),gateway.loadResource<Snapshot<SharedCombatState>>('combat')]);guard()
 if(!characters||!maps||!clock||!validateSharedCampaignTime(clock))throw Error('pact-pickup:snapshot-unavailable')
 const prior=characters.characters.filter(owner=>owner.roomId===stamp!.roomId).flatMap(owner=>owner.dnd5ePactWeaponRitualAuthority?.receipts??[]).find(receipt=>receipt.transactionId===transactionId)
 if(prior){if(prior.kind!=='pact-ground-pickup'||prior.command!==fingerprint)throw Error('pact-pickup:transaction-conflict');return prior}
 const synced=reconcilePactHostClock({characters:characters.characters,maps:maps.maps,clock,geometry:geometry?.maps??[]}),map=synced.maps.find(row=>row.id===input.mapId),token=map?.tokens.find(row=>row.id===input.objectTokenId),entry=token?.dnd5eObjectState?.inventoryItem?.instance
 const issuers=characters.characters.filter(owner=>owner.roomId===stamp!.roomId&&(
  owner.dnd5ePactWeaponRitualAuthority?.facts.some(fact=>fact.instanceId===entry?.instanceId)||
  owner.dnd5ePactWeaponAuthority&&validPactWeaponAuthority(owner.dnd5ePactWeaponAuthority,owner.id)&&
  owner.dnd5ePactWeaponAuthority.state.binding?.inventoryInstanceId===entry?.instanceId&&
  owner.dnd5ePactWeaponAuthority.summons.some(receipt=>receipt.inventoryInstanceId===entry?.instanceId)))
 const sourceOwner=issuers.length===1?issuers[0]:undefined,doc=sourceOwner?(sourceOwner.dnd5ePactWeaponRitualAuthority??{schemaVersion:1 as const,ownerId:sourceOwner.id,roomId:stamp!.roomId,hostMemberId:stamp!.memberId,facts:[],sessions:[],receipts:[]}):undefined
 if(!map||!token||!entry||!validPactWeaponPhysicalIdentity(entry)||!sourceOwner||!doc||doc.receipts.length>=10000)throw Error('pact-pickup:issued-instance-required')
 if(pactWeaponPendingSeparationInstance(sourceOwner)===entry.instanceId)throw Error('pact-pickup:lifecycle-settlement-required')
 const effects=liveDnd5eMapInventoryBoundEffects(token.dnd5eObjectState?.inventoryItem?.boundEffects??[],map,synced.characters),records=(map as BattleMap&{dnd5ePactGroundEffectClocks?:{instanceId:string;tokenId:string;effectId:string;observedSecond:number;clockRevision:number;expired:boolean}[]}).dnd5ePactGroundEffectClocks??[]
 const second=clock.worldMinute*60+(clock.worldSecondRemainder??0)
 if(effects.some(effect=>effect.duration.type!=='permanent'&&!records.some(record=>!record.expired&&record.instanceId===entry.instanceId&&record.tokenId===token.id&&record.effectId===effect.id&&record.observedSecond===second&&record.clockRevision===revision(clock))))throw Error('pact-pickup:authoritative-clock-proof-required')
 const active=combat?.active===true,economy=active?combat.dnd5eTurnEconomyByToken?.[input.actorTokenId]:undefined
 if(active&&(!economy||combat.mapId!==map.id||combat.flowPause))throw Error('pact-pickup:combat-unavailable')
 const result=prepareDnd5eMapInventoryPickup({map,characters:synced.characters,geometry:geometry?.maps.find(scene=>scene.mapId===map.id),actorTokenId:input.actorTokenId,objectTokenId:input.objectTokenId,expectedReceiptId:input.expectedReceiptId,expectedQuantity:input.expectedQuantity,combatActive:active,combat:active?{currentTokenId:combat.initiativeOrder[combat.initiativeIndex]?.tokenId??'',turnEconomy:economy!}:undefined})
 if(!result.ok)throw Error('pact-pickup:'+result.reason)
 const receipt={transactionId,command:fingerprint,kind:'pact-ground-pickup',pactRevision:sourceOwner.dnd5ePactWeaponAuthority?.state.revision??0}
 const roster=result.characters.map(actor=>actor.id===sourceOwner.id?{...actor,dnd5ePactWeaponRitualAuthority:{...doc,receipts:[...doc.receipts,receipt]}}:actor)
 const writes=[{name:'characters',expectedRevision:revision(characters),data:{...characters,characters:roster}},{name:'maps',expectedRevision:revision(maps),data:{...maps,maps:synced.maps.map(row=>row.id===map.id?result.map:row)}},...(active&&result.turnEconomy?[{name:'combat',expectedRevision:revision(combat),data:{...combat,dnd5eTurnEconomyByToken:{...combat.dnd5eTurnEconomyByToken,[input.actorTokenId]:result.turnEconomy}}}]:[])]
 guard()
 try{await gateway.saveResourcesAtomically(writes,{transactionId,readRevisions:{'campaign-time':revision(clock),'map-geometry':revision(geometry),...(!active?{combat:revision(combat)}:{})},undoLabel:'拾取契约实物'});guard();return receipt}
 catch(error){guard();if(/failed to fetch|fetch failed|networkerror|state-transaction-(?:conflict|unavailable)/i.test(String(error))){const stored=await gateway.loadResource<{characters:RitualCharacter[]}>('characters');guard();const saved=stored?.characters.find(owner=>owner.id===sourceOwner.id)?.dnd5ePactWeaponRitualAuthority?.receipts.find(row=>row.transactionId===transactionId);if(JSON.stringify(saved)===JSON.stringify(receipt))return receipt}throw error}
}

