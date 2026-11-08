import {captureBountifulOriginalRawIssuer,bountifulOriginalRollIssuerMode} from './bountifulOriginalRawIssuer'
import type {AllyNaturalOneKind} from './allyNaturalOneCheckpoint'
const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value)
export interface BountifulSpellTargetRaw extends ReturnType<typeof captureBountifulOriginalRawIssuer>{actorId:string;kind:'saving-throw';values:readonly number[]}
/** Private Host source metadata. Public spell actions do not acquire these
 * fields; each consumer still validates the concrete issuer and raw lineage. */
export type BountifulSpellOriginalInput=Parameters<typeof import('./spellAction').resolvePreparedDnd5eSpellCast>[0]&Partial<ReturnType<typeof captureBountifulOriginalRawIssuer>>&{
 hostOriginalRollActorId?:string;hostOriginalRollKind?:'attack'|'saving-throw'
 hostOriginalSpellSavingThrows?:readonly BountifulSpellTargetRaw[]
 hostOriginalD20Replay?:import('./allyNaturalOneCheckpoint').OriginalD20ReplayFacts
}
export function captureBountifulSpellTargetRaw(input:Parameters<typeof captureBountifulOriginalRawIssuer>[0]&{actorId:string}):BountifulSpellTargetRaw{
 if(!input.actorId.trim()||input.actorId!==input.actorId.trim())throw Error('bountiful-spell-raw:actual-actor-required')
 return {...captureBountifulOriginalRawIssuer(input),actorId:input.actorId,kind:'saving-throw',values:[...input.raw]}
}
/** A target-specific record is part of the Host's concrete frozen spell input;
 * a copied global capture from another target never authenticates this roll. */
export function bountifulOriginalRawForActor(source:unknown,actorId:string,kind:AllyNaturalOneKind,raw:readonly number[]){
 if(!record(source)||!record(source.prepared)||!record(source.prepared.map)||!record(source.prepared.action)||typeof source.prepared.map.id!=='string'||typeof source.prepared.action.id!=='string')throw Error('bountiful-spell-raw:actual-parent-required')
 const book=source.hostOriginalSpellSavingThrows
 let candidate:Record<string,unknown>=source
 if(kind==='saving-throw'&&book!==undefined){
  if(!Array.isArray(book))throw Error('bountiful-spell-raw:invalid-target-book')
  const matches=book.filter(row=>record(row)&&row.actorId===actorId)
  if(matches.length!==1||!record(matches[0]))throw Error('bountiful-spell-raw:exact-target-capture-required')
  candidate=matches[0]
  if(Object.keys(candidate).some(key=>!['actorId','kind','values','hostOriginalRollIssuerMode','hostOriginalRollId','hostOriginalDiceCursor'].includes(key))||candidate.kind!==kind||JSON.stringify(candidate.values)!==JSON.stringify(raw))throw Error('bountiful-spell-raw:changed-target-raw')
 }else if(source.hostOriginalRollActorId!==actorId||source.hostOriginalRollKind!==kind)throw Error('bountiful-spell-raw:foreign-original-roller')
 const rollId=candidate.hostOriginalRollId,cursor=candidate.hostOriginalDiceCursor
 if(typeof rollId!=='string'||typeof cursor!=='number')throw Error('bountiful-spell-raw:actual-capture-required')
 return captureBountifulOriginalRawIssuer({mapId:source.prepared.map.id,parentId:source.prepared.action.id,mode:bountifulOriginalRollIssuerMode(candidate),rollId,cursor,raw})
}
