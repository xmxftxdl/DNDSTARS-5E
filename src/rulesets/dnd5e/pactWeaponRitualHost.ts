import{pactWeaponPendingSeparationInstance}from'./pactWeaponSeparation'
import type{SharedMapGeometryState}from'../../lib/mapGeometry'
import{reconcilePactHostClock}from'./pactWeaponClockSnapshot'
import type {Character} from '../../types/character'
import type {BattleMap} from '../../store/maps'
import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import type {SharedCampaignTimeState} from '../../lib/campaignTime'
import {validateSharedCampaignTime} from '../../lib/campaignTime'
import {getRoomSession} from '../../lib/roomSession'
import {normalizeDnd5eInventory} from '../../rulesets/dnd5e/items'
import {dnd5eClassDefinitionForCharacter} from '../../rulesets/dnd5e/classes'
import {dnd5eConditionIncapacitated} from '../../rulesets/dnd5e/conditions'
import {dnd5eConditionsFromActiveEffects,normalizeDnd5eActiveEffects} from '../../rulesets/dnd5e/activeEffects'
import {reconcileDnd5eInventoryEffectBindings} from '../../rulesets/dnd5e/inventoryEffectBindings'
import {emptyPactWeaponState,transitionPactWeapon} from './pactWeaponBinding.mjs'
import {validPactWeaponAuthority,type PactAuthorityCharacter} from './pactWeaponSummonHost'
import {establishPactWeaponPhysicalIdentity} from './pactWeaponPhysicalIdentity'
import {planPactWeaponInventoryTransaction} from './pactWeaponInventoryTransaction'
import type {Dnd5eInventoryEntry} from '../../types/inventory'
const pactRitualItemSha=async(entry:Dnd5eInventoryEntry)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(entry.item))))].map(value=>value.toString(16).padStart(2,'0')).join('')
const held=(characters:readonly Character[],ownerId:string,instanceId:string)=>{const matches=characters.flatMap(actor=>normalizeDnd5eInventory(actor).entries.filter(entry=>entry.instanceId===instanceId).map(entry=>({actor,entry})));if(matches.length!==1)return false;const{actor,entry}=matches[0],slot=entry.equippedSlot;return actor.id===ownerId&&entry.quantity===1&&!entry.containerInstanceId&&!entry.condition?.destroyed&&(slot==='mainWeapon'||slot==='offHand')&&actor.equipment?.[slot]?.id===entry.item.equipment?.id}

type Revisioned<T>=T&{_sync?:{revision?:number}}
type Gateway=Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'>
export type RitualSession={id:string;kind:'binding'|'release';instanceId:string;itemSha?:string;startedSecond:number;observedCharacterRevision:number;phase:'active'|'interrupted'|'completed';interruptedReason?:string}
type Receipt={transactionId:string;command:string;pactRevision:number;kind:string;ritualId?:string}
export type RitualAuthority={schemaVersion:1;ownerId:string;roomId:string;hostMemberId:string;facts:{instanceId:string;itemSha:string;sentient:boolean;confirmedByMemberId:string}[];sessions:RitualSession[];receipts:Receipt[]}
export type RitualCharacter=PactAuthorityCharacter&{dnd5ePactWeaponRitualAuthority?:RitualAuthority}
type Common={mapId:string;ownerCharacterId:string;expectedPactRevision:number;transactionId:string}
export type PactRitualCommand=Common&({kind:'attest-item';inventoryInstanceId:string;sentient:boolean}|{kind:'start-binding';inventoryInstanceId:string}|{kind:'start-release'}|{kind:'complete'})
const revision=(value:Revisioned<object>|null,name:string)=>{const n=value?._sync?.revision??(value===null?0:undefined);if(!Number.isSafeInteger(n)||n!<0)throw Error('pact-ritual:revision-required:'+name);return n!}
const validDoc=(value:RitualAuthority,owner:string,room:string)=>value.schemaVersion===1&&value.ownerId===owner&&value.roomId===room&&typeof value.hostMemberId==='string'&&Array.isArray(value.sessions)&&Array.isArray(value.facts)&&Array.isArray(value.receipts)&&value.sessions.length<=10000&&value.receipts.length<=10000&&new Set(value.sessions.map(row=>row.id)).size===value.sessions.length&&new Set(value.receipts.map(row=>row.transactionId)).size===value.receipts.length&&value.sessions.every(row=>typeof row.id==='string'&&['binding','release'].includes(row.kind)&&['active','interrupted','completed'].includes(row.phase)&&Number.isSafeInteger(row.startedSecond)&&row.startedSecond>=0&&Number.isSafeInteger(row.observedCharacterRevision)&&row.observedCharacterRevision>=0)&&value.facts.every(row=>typeof row.instanceId==='string'&&/^[a-f0-9]{64}$/.test(row.itemSha)&&typeof row.sentient==='boolean'&&typeof row.confirmedByMemberId==='string')

/** Explicit authenticated DM adjudication fills the product's missing sentient
 * metadata; it is tied to the exact physical instance AND reviewed item SHA.
 * Player commands cannot supply time, uninterrupted, ownership or Host facts.
 * This is a non-spell special ritual: no concentration or per-round cast cost. */
export async function commitPactWeaponRitual(command:PactRitualCommand,gateway:Gateway):Promise<Receipt>{
 const initial=getRoomSession(),session=initial?{roomId:initial.roomId,memberId:initial.memberId,role:initial.role}:null
 const guard=()=>{const now=getRoomSession();if(!session||session.role!=='dm'||now?.roomId!==session.roomId||now.memberId!==session.memberId||now.role!=='dm')throw Error('pact-ritual:host-room-required')};guard()
 const fields=['mapId','ownerCharacterId','expectedPactRevision','transactionId','kind',...(command.kind==='attest-item'?['inventoryInstanceId','sentient']:command.kind==='start-binding'?['inventoryInstanceId']:[])]
 if(Object.keys(command).some(key=>!fields.includes(key))||!['attest-item','start-binding','start-release','complete'].includes(command.kind)||!Number.isSafeInteger(command.expectedPactRevision)||command.expectedPactRevision<0||!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,159}$/.test(command.transactionId)||(command.kind==='attest-item'&&typeof command.sentient!=='boolean'))throw Error('pact-ritual:invalid-command')
 const[loadedCharacters,loadedMaps,clock,combat,geometry]=await Promise.all([gateway.loadResource<Revisioned<{characters:RitualCharacter[]}>>('characters'),gateway.loadResource<Revisioned<{maps:BattleMap[]}>>('maps'),gateway.loadResource<Revisioned<SharedCampaignTimeState>>('campaign-time'),gateway.loadResource<Revisioned<{active?:boolean}>>('combat'),gateway.loadResource<Revisioned<SharedMapGeometryState>>('map-geometry')]);guard()
 if(!loadedCharacters||!loadedMaps||!clock||!validateSharedCampaignTime(clock))throw Error('pact-ritual:snapshot-unavailable')
 const synchronized=reconcilePactHostClock({characters:loadedCharacters.characters,maps:loadedMaps.maps,clock,geometry:geometry?.maps??[]})
 const characters={...loadedCharacters,characters:loadedCharacters.characters.map((actor,index)=>({...actor,...synchronized.characters[index]}))},maps={...loadedMaps,maps:synchronized.maps}
 const owners=characters.characters.filter(row=>row.id===command.ownerCharacterId),map=maps.maps.find(row=>row.id===command.mapId)
 if(owners.length!==1||!map||map.tokens.filter(token=>token.characterId===command.ownerCharacterId).length!==1)throw Error('pact-ritual:owner-unavailable')
 const owner=owners[0],authority=owner.dnd5ePactWeaponAuthority,doc=owner.dnd5ePactWeaponRitualAuthority??{schemaVersion:1,ownerId:owner.id,roomId:session!.roomId,hostMemberId:session!.memberId,facts:[],sessions:[],receipts:[]}
 if(owner.roomId!==session!.roomId)throw Error('pact-ritual:owner-room-mismatch')
 if(!validDoc(doc,owner.id,session!.roomId)||authority&&!validPactWeaponAuthority(authority,owner.id))throw Error('pact-ritual:invalid-authority')
 const fingerprint=JSON.stringify(command),prior=doc.receipts.find(row=>row.transactionId===command.transactionId)
 if(prior){if(prior.command!==fingerprint)throw Error('pact-ritual:transaction-id-conflict');return prior}
 if(command.kind!=='attest-item'&&pactWeaponPendingSeparationInstance(owner))throw Error('pact-ritual:lifecycle-settlement-required')
 if(doc.receipts.length>=10000||doc.sessions.length>=10000)throw Error('pact-ritual:receipt-capacity-reached')
 const state=authority?.state??emptyPactWeaponState(owner.id),worldSecond=clock.worldMinute*60+(clock.worldSecondRemainder??0)
 if(state.revision!==command.expectedPactRevision)throw Error('pact-ritual:stale-pact-revision')
 const level=owner.dnd5eClassLevels?.warlock??(dnd5eClassDefinitionForCharacter(owner)?.id==='warlock'?owner.level:0)
 if(level<3||!owner.dnd5eClassChoices?.classes?.warlock?.selections?.['pact-boon']?.includes('blade'))throw Error('pact-ritual:blade-pact-required')
 if(owner.currentHp<=0||dnd5eConditionIncapacitated({conditions:[...(owner.conditions??[]),...dnd5eConditionsFromActiveEffects(normalizeDnd5eActiveEffects(owner.dnd5eCombatState?.activeEffects))]}))throw Error('pact-ritual:owner-incapacitated')
 if(state.lastHostSecond!=null&&worldSecond<state.lastHostSecond)throw Error('pact-ritual:clock-regressed')
 let roster:Character[]=structuredClone(characters.characters),nextState=structuredClone(state),nextMap=map,inventory=authority?.inventory??{schemaVersion:1 as const,ownerId:owner.id,revision:0,stowed:[],receipts:[]},nextDoc=structuredClone(doc),ritualId:string|undefined
 const entries=()=>normalizeDnd5eInventory(roster.find(row=>row.id===owner.id)!).entries
 const uniqueCarried=(id:string)=>characters.characters.flatMap(actor=>normalizeDnd5eInventory(actor).entries).filter(entry=>entry.instanceId===id).length===1&&!maps.maps.some(scene=>scene.tokens.some(token=>token.dnd5eObjectState?.inventoryItem?.instance?.instanceId===id||token.dnd5eObjectState?.inventoryItem?.contents?.some(entry=>entry.instanceId===id)||token.dnd5eCarriedObjects?.some(held=>held.objectState.inventoryItem?.instance?.instanceId===id||held.objectState.inventoryItem?.contents?.some(entry=>entry.instanceId===id))))&&!characters.characters.some(actor=>actor.dnd5ePactWeaponAuthority?.inventory.stowed.some(entry=>entry.instanceId===id))
 if(command.kind==='attest-item'){
  if(state.ritual)throw Error('pact-ritual:ritual-already-active')
  const entry=entries().find(row=>row.instanceId===command.inventoryInstanceId)
  if(!entry||!uniqueCarried(entry.instanceId)||!entry.item.magicItem||entry.item.equipment?.dnd5e?.kind!=='weapon'||entry.item.magicItem.rarity==='artifact')throw Error('pact-ritual:nonmagic-or-artifact')
  const identity=establishPactWeaponPhysicalIdentity(roster,owner.id,entry.instanceId);if(!identity.ok)throw Error('pact-ritual:'+identity.reason);roster=reconcileDnd5eInventoryEffectBindings(identity.characters)
  const itemSha=await pactRitualItemSha(entries().find(row=>row.instanceId===entry.instanceId)!)
  nextDoc.facts=[...nextDoc.facts.filter(row=>row.instanceId!==entry.instanceId),{instanceId:entry.instanceId,itemSha,sentient:command.sentient,confirmedByMemberId:session!.memberId}]
 }else{
  const active=state.ritual&&doc.sessions.find(row=>row.id===state.ritual!.ritualId)
  if(command.kind==='complete'&&(!active||active.phase!=='active'||active.observedCharacterRevision!==revision(characters,'characters')))throw Error('pact-ritual:interrupted-or-unobserved')
  if(command.kind!=='complete'&&state.ritual)throw Error('pact-ritual:ritual-already-active')
  const instanceId=command.kind==='start-binding'?command.inventoryInstanceId:command.kind==='start-release'?state.binding?.inventoryInstanceId:active?.instanceId
  const entry=entries().find(row=>row.instanceId===instanceId),entrySha=entry?await pactRitualItemSha(entry):undefined,fact=entry&&doc.facts.find(row=>row.instanceId===instanceId&&row.itemSha===entrySha)
  const binding=command.kind==='start-binding'||command.kind==='complete'&&active?.kind==='binding'
  if(binding&&(!entry||!uniqueCarried(entry.instanceId)||!entry.item.magicItem||entry.item.magicItem.rarity==='artifact'||fact?.sentient!==false||!held(roster,owner.id,instanceId!)))throw Error('pact-ritual:holding-or-reviewed-nonsentient-fact-required')
  if(binding&&characters.characters.some(actor=>actor.id!==owner.id&&actor.dnd5ePactWeaponAuthority?.state.binding?.inventoryInstanceId===instanceId))throw Error('pact-ritual:bound-to-other-owner')
  ritualId=command.kind==='complete'?active!.id:crypto.randomUUID()
  const transition=transitionPactWeapon(state,{ownerId:owner.id,expectedRevision:command.expectedPactRevision,kind:command.kind==='start-binding'?'start-binding-ritual':command.kind==='start-release'?'start-release-ritual':'complete-ritual',inventoryInstanceId:instanceId},{ownerId:owner.id,hasBladePact:true,worldSecond,ritualId,inventory:entry?[{inventoryInstanceId:entry.instanceId,weaponBaseId:(entry.item.equipment!.baseEquipmentId??entry.item.equipment!.id).replace(/^dnd5e-/,''),isWeapon:true,isMagical:!!entry.item.magicItem,isArtifact:entry.item.magicItem?.rarity==='artifact',isSentient:fact?.sentient,heldByActorId:owner.id}]:[],ritualContinuity:active?[{ritualId:active.id,uninterrupted:true}]:[]})
  if(!transition.ok)throw Error('pact-ritual:'+transition.reason)
  const plan=planPactWeaponInventoryTransaction({hostClock:{worldSecond,revision:revision(clock,'campaign-time')},document:inventory,expectedRevision:inventory.revision,expectedInventoryRevisions:Object.fromEntries(roster.map(actor=>[actor.id,normalizeDnd5eInventory(actor).revision!])),transactionId:'ritual:'+command.transactionId,characters:roster,map,operations:transition.inventoryOperations})
  if(!plan.ok)throw Error('pact-ritual:'+plan.reason)
  roster=plan.characters;nextMap=plan.map;inventory=plan.document;nextState=transition.state
  if(command.kind==='complete')nextDoc.sessions=nextDoc.sessions.map(row=>row.id===ritualId?{...row,phase:'completed'}:row)
  else nextDoc.sessions.push({id:ritualId,kind:command.kind==='start-binding'?'binding':'release',instanceId:instanceId!,...(fact?{itemSha:fact.itemSha}:{}),startedSecond:worldSecond,observedCharacterRevision:revision(characters,'characters')+1,phase:'active'})
 }
 const receipt:Receipt={transactionId:command.transactionId,command:fingerprint,pactRevision:nextState.revision,kind:command.kind,...(ritualId?{ritualId}:{})};nextDoc.receipts.push(receipt)
 roster=roster.map(actor=>actor.id===owner.id?{...actor,dnd5ePactWeaponAuthority:{schemaVersion:1,state:nextState,inventory,summons:authority?.summons??[],...(authority?.lifecycle?{lifecycle:authority.lifecycle}:{})},dnd5ePactWeaponRitualAuthority:nextDoc}:actor)
 guard()
 try{await gateway.saveResourcesAtomically([{name:'characters',expectedRevision:revision(characters,'characters'),data:{...characters,characters:roster}},{name:'maps',expectedRevision:revision(maps,'maps'),data:{...maps,maps:maps.maps.map(row=>row.id===map.id?nextMap:row)}}],{transactionId:'pact-ritual:'+command.transactionId,readRevisions:{'campaign-time':revision(clock,'campaign-time'),combat:revision(combat,'combat'),'map-geometry':revision(geometry,'map-geometry')},undoLabel:'契约武器一小时仪式'});guard();return receipt}
 catch(error){guard();if(/failed to fetch|fetch failed|networkerror|state-transaction-(?:conflict|unavailable)/i.test(String(error))){const saved=await gateway.loadResource<{characters:RitualCharacter[]}>('characters');guard();const recovered=saved?.characters.find(row=>row.id===owner.id)?.dnd5ePactWeaponRitualAuthority;if(recovered&&validDoc(recovered,owner.id,session!.roomId)&&JSON.stringify(recovered.receipts.find(row=>row.transactionId===command.transactionId))===JSON.stringify(receipt))return receipt}throw error}
}
