import type {SharedRoomGatewayPort,SharedResourceTransactionWrite,SharedResourceWriteOptions} from '../ports/sharedRoomGateway'
import type {BattleMap} from '../store/maps'
import type {Character} from '../types/character'
import type {SharedMapGeometryState} from '../lib/mapGeometry'
import {prepareDnd5eStructureObjectBoundaryCleanup} from '../rulesets/dnd5e/structureObjectBoundary'

type Versioned={_sync?:{revision?:number}}
type Maps=Versioned&{maps:BattleMap[]}
type Roster=Versioned&{characters:Character[]}
type Geometry=Versioned&SharedMapGeometryState
type Options=SharedResourceWriteOptions&{transactionId?:string}
const watched=new Set(['maps','characters','map-geometry'])

/** Final map positions and disappearing possessions must be published in one transaction. */
export function withStructureObjectBoundary(gateway:SharedRoomGatewayPort):SharedRoomGatewayPort {
 const prepare=async(writes:readonly SharedResourceTransactionWrite[],options?:Options)=>{
  if(!writes.some(write=>watched.has(write.name)))return null
  const [storedMaps,storedRoster,storedGeometry]=await Promise.all([
   gateway.loadResource<Maps>('maps'),gateway.loadResource<Roster>('characters'),gateway.loadResource<Geometry>('map-geometry')])
  const maps=(writes.find(write=>write.name==='maps')?.data as Maps|undefined)??storedMaps
  const roster=(writes.find(write=>write.name==='characters')?.data as Roster|undefined)??storedRoster
  const geometry=(writes.find(write=>write.name==='map-geometry')?.data as Geometry|undefined)??storedGeometry
  // Learning/preparing spells does not move possessions. Keep ordinary character
  // edits on the role-checked save path instead of promoting them to a DM transaction.
  if(writes.every(write=>write.name==='characters')&&roster&&storedRoster&&
    roster.characters.length===storedRoster.characters.length&&
    roster.characters.every(character=>{
      const previous=storedRoster.characters.find(candidate=>candidate.id===character.id)
      return previous&&JSON.stringify(character.dnd5eInventory)===JSON.stringify(previous.dnd5eInventory)
    }))return null
  const bound=(maps?.maps??[]).some(map=>map.tokens.some(token=>token.dnd5eObjectState?.structureBinding||
   token.dnd5eObjectState?.inventoryItem?.instance?.structureBinding||token.dnd5eCarriedObjects?.some(item=>
    item.objectState.structureBinding||item.objectState.inventoryItem?.instance?.structureBinding)))||
   (roster?.characters??[]).some(character=>{
    const inventory=character.dnd5eInventory
    return [...inventory?.entries??[],...inventory?.releasedObjects??[],...inventory?.spellMaterialEscrows?.flatMap(record=>record.entries)??[]]
     .some(entry=>entry.structureBinding)
   })
  if(!bound)return null
  if(!maps||!geometry)throw Error('structure-object-snapshot-missing')
  const result=prepareDnd5eStructureObjectBoundaryCleanup({maps:maps.maps,characters:roster?.characters??[],geometry})
  const next=[...writes],readRevisions={...options?.readRevisions}
  const sources:Record<string,Versioned|null>={maps:storedMaps,characters:storedRoster,'map-geometry':storedGeometry}
  for(const [name,source] of Object.entries(sources))if(!next.some(write=>write.name===name))readRevisions[name]??=source?._sync?.revision??0
  const replace=(name:string,data:unknown)=>{
   const index=next.findIndex(write=>write.name===name)
   const expectedRevision=(index<0?undefined:next[index].expectedRevision)??readRevisions[name]??sources[name]?._sync?.revision??0
   if(readRevisions[name]!=null&&readRevisions[name]!==expectedRevision)throw Error('structure-object-revision-conflict')
   delete readRevisions[name]
   const write={name,data,expectedRevision}
   if(index<0)next.push(write);else next[index]=write
  }
  if(result.maps.some((map,index)=>map!==maps.maps[index]))replace('maps',{...maps,maps:result.maps})
  if(roster&&result.characters.some((character,index)=>character!==roster.characters[index]))replace('characters',{...roster,characters:result.characters})
  return {writes:next,options:{...options,readRevisions}}
 }
 const commit=async(writes:readonly SharedResourceTransactionWrite[],options?:Options)=>{
  const prepared=await prepare(writes,options)
  return gateway.saveResourcesAtomically(prepared?.writes??writes,prepared?.options??options)
 }
 return {...gateway,saveResourcesAtomically:commit,
  saveResource:async(name,data,options)=>{
   if(!watched.has(name))return gateway.saveResource(name,data,options)
   const prepared=await prepare([{name,data,expectedRevision:gateway.getRevisionWatermark(name)}],options)
   if(!prepared)return gateway.saveResource(name,data,options)
   await gateway.saveResourcesAtomically(prepared.writes,prepared.options)
  },
  saveResourceWithResult:async(name,data,options)=>{
   if(!watched.has(name))return gateway.saveResourceWithResult(name,data,options)
   const prepared=await prepare([{name,data,expectedRevision:gateway.getRevisionWatermark(name)}],options)
   if(!prepared)return gateway.saveResourceWithResult(name,data,options)
   const result=await gateway.saveResourcesAtomically(prepared.writes,prepared.options)
   return {status:'saved',revision:result.revisions[name]}
  },
 }
}
