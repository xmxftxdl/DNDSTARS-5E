import{readBountifulDeathLocalPublication}from'./bountifulLuckNormalAck'
import {readPreparedDnd5eRestCharacterPublication,type PreparedDnd5ePluginFeatureAction} from './pluginFeatureAction'
import {readBountifulEquipmentLocalPublication,readBountifulSpellLocalPublication,readBountifulActivityLocalPublication} from './bountifulLuckNormalAck'
import type {Character} from '../../types/character'
import {getRoomSession} from '../../lib/roomSession'
import type {SharedPlayerActionState} from '../../lib/sharedCombatTypes'
import {readBountifulOpportunityMovePrefixContext} from './opportunityMovePrefixContext'
import {prepareDnd5ePlayerMove} from './playerMoveAction'

declare const publicationScope:unique symbol
export type Dnd5eOpportunityCharacterPublicationScope={readonly [publicationScope]:true}
type Scope={monsterZero?:true;roomId:string;memberId:string;mapId:string;parentId:string;actionSignature:string;beforeCharacters:readonly Character[]}
const issued=new WeakMap<object,Scope>()
/** A publication deferral only. The true queued-move context and real native
 * preparer are required; this grants no damage, dice, or server write authority. */
export function beginDnd5eOpportunityCharacterPublication(context:object):Dnd5eOpportunityCharacterPublicationScope|undefined{
 const original=readBountifulOpportunityMovePrefixContext(context),input=original.input,session=getRoomSession()
 const move=prepareDnd5ePlayerMove({action:input.action,map:input.map,characters:input.characters,initiativeOrder:input.initiativeOrder,turnEconomy:input.moverEconomy})
 if(session?.role!=='dm'||!session.roomId||!session.memberId)throw Error('opportunity-publication:actual-original-move-required')
 if(!move.ok)return undefined
 const scope=Object.freeze({}) as Dnd5eOpportunityCharacterPublicationScope
 issued.set(scope,{roomId:session.roomId,memberId:session.memberId,mapId:input.map.id,parentId:input.action.id,actionSignature:JSON.stringify(input.action),beforeCharacters:structuredClone(input.characters)})
 return scope
}
/** Equipment uses its own real native issuer; a move context or JSON payload
 * cannot create this deferral. This grants no dice or world-result authority. */
export function beginDnd5eBountifulEquipmentCharacterPublication(capability:object):Dnd5eOpportunityCharacterPublicationScope{
 const original=readBountifulEquipmentLocalPublication(capability),session=getRoomSession()
 if(session?.role!=='dm'||!session.roomId||!session.memberId)throw Error('opportunity-publication:actual-equipment-required')
 const scope=Object.freeze({}) as Dnd5eOpportunityCharacterPublicationScope
 issued.set(scope,{roomId:session.roomId,memberId:session.memberId,mapId:original.action.mapId,parentId:original.action.id,actionSignature:JSON.stringify(original.action),beforeCharacters:structuredClone(original.beforeCharacters)})
 return scope
}
export function beginDnd5eBountifulSpellCharacterPublication(capability:object):Dnd5eOpportunityCharacterPublicationScope{
 const original=readBountifulSpellLocalPublication(capability),session=getRoomSession()
 if(session?.role!=='dm'||!session.roomId||!session.memberId)throw Error('opportunity-publication:actual-spell-required')
 const scope=Object.freeze({}) as Dnd5eOpportunityCharacterPublicationScope
 issued.set(scope,{roomId:session.roomId,memberId:session.memberId,mapId:original.action.mapId,parentId:original.action.id,actionSignature:JSON.stringify(original.action),beforeCharacters:structuredClone(original.beforeCharacters)})
 return scope
}
/** Deferral only for an actual completed Activity local projection. */
export function beginDnd5eBountifulActivityCharacterPublication(capability:object):Dnd5eOpportunityCharacterPublicationScope{const original=readBountifulActivityLocalPublication(capability),session=getRoomSession();if(session?.role!=='dm'||!session.roomId||!session.memberId)throw Error('opportunity-publication:actual-activity-required');const scope=Object.freeze({})as Dnd5eOpportunityCharacterPublicationScope;issued.set(scope,{roomId:session.roomId,memberId:session.memberId,mapId:original.action.mapId,parentId:original.action.id,actionSignature:JSON.stringify(original.action),beforeCharacters:structuredClone(original.beforeCharacters)});return scope}
export function readDnd5eOpportunityCharacterPublication(scope:Dnd5eOpportunityCharacterPublicationScope){
 const record=issued.get(scope),session=getRoomSession()
 if(!record||session?.role!=='dm'||record.roomId!==session.roomId||record.memberId!==session.memberId)throw Error('opportunity-publication:exact-current-host-scope-required')
 return structuredClone(record)
}
export function closeDnd5eOpportunityCharacterPublication(scope:Dnd5eOpportunityCharacterPublicationScope,action:SharedPlayerActionState){
 const record=readDnd5eOpportunityCharacterPublication(scope)
 if(record.monsterZero||record.parentId!==action.id||record.mapId!==action.mapId||record.actionSignature!==JSON.stringify(action))throw Error('opportunity-publication:exact-original-completion-required')
 issued.delete(scope)
}

/** Defers local autosave for an actual native rest Activity. No dice, result or server-write authority is granted. */
export function beginDnd5eRestActivityCharacterPublication(prepared:PreparedDnd5ePluginFeatureAction):Dnd5eOpportunityCharacterPublicationScope{
 const original=readPreparedDnd5eRestCharacterPublication(prepared),session=getRoomSession();if(session?.role!=='dm'||!session.roomId||!session.memberId)throw Error('rest-publication:actual-host-required');const scope=Object.freeze({}) as Dnd5eOpportunityCharacterPublicationScope;issued.set(scope,{roomId:session.roomId,memberId:session.memberId,mapId:original.action.mapId,parentId:original.action.id,actionSignature:JSON.stringify(original.action),beforeCharacters:original.beforeCharacters});return scope
}

async function monsterZeroPublicationIdentity(operation:object){const[{readDnd5eMonsterDamageZeroOriginalOperation},{readDnd5eMonsterDamageZeroOriginalContext}]=await Promise.all([import('./damageZeroMonsterOriginalOperation'),import('./monsterDamageZeroOriginalContext')]),native=readDnd5eMonsterDamageZeroOriginalOperation(operation as Parameters<typeof readDnd5eMonsterDamageZeroOriginalOperation>[0]),context=readDnd5eMonsterDamageZeroOriginalContext(native.source);if(!context||context.parentId!==native.parentId||native.frame.parentId!==native.parentId)throw Error('monster-zero-publication:actual-outer-operation-required');return{native,signature:JSON.stringify([context.command,native.frame.id,native.effectTimestamp])}}
/** Defers only local autosave for this actual Native zero phase. It grants
 * neither physical dice nor owner choice nor a world result. Lazy native reads
 * avoid introducing a store→Session initialization cycle. */
export async function beginDnd5eMonsterZeroCharacterPublication(operation:object):Promise<Dnd5eOpportunityCharacterPublicationScope>{const{native,signature}=await monsterZeroPublicationIdentity(operation),session=getRoomSession();if(session?.role!=='dm'||!session.roomId||!session.memberId)throw Error('monster-zero-publication:actual-host-required');const scope=Object.freeze({})as Dnd5eOpportunityCharacterPublicationScope;issued.set(scope,{monsterZero:true,roomId:session.roomId,memberId:session.memberId,mapId:native.source.prepared.map.id,parentId:native.parentId,actionSignature:signature,beforeCharacters:structuredClone(native.source.prepared.characters)});return scope}
export async function readDnd5eMonsterZeroCharacterPublication(scope:Dnd5eOpportunityCharacterPublicationScope,operation:object){const record=readDnd5eOpportunityCharacterPublication(scope),{native,signature}=await monsterZeroPublicationIdentity(operation);if(!record.monsterZero||record.parentId!==native.parentId||record.mapId!==native.source.prepared.map.id||record.actionSignature!==signature)throw Error('monster-zero-publication:exact-operation-completion-required');return record}
export async function closeDnd5eMonsterZeroCharacterPublication(scope:Dnd5eOpportunityCharacterPublicationScope,operation:object){await readDnd5eMonsterZeroCharacterPublication(scope,operation);issued.delete(scope)}

/** Exact native death result scope. This postpones autosave, never authority. */
export function beginDnd5eBountifulDeathCharacterPublication(capability:object):Dnd5eOpportunityCharacterPublicationScope{const original=readBountifulDeathLocalPublication(capability),session=getRoomSession();if(session?.role!=='dm'||!session.roomId||!session.memberId)throw Error('opportunity-publication:actual-death-required');const scope=Object.freeze({})as Dnd5eOpportunityCharacterPublicationScope;issued.set(scope,{roomId:session.roomId,memberId:session.memberId,mapId:original.action.mapId,parentId:original.action.id,actionSignature:JSON.stringify(original.action),beforeCharacters:structuredClone(original.beforeCharacters)});return scope}
