import type{Character}from'../../types/character'
import type{BattleMap,Token}from'../../store/maps'
import type{MapGeometryState}from'../../lib/mapGeometry'
import{mapGeometryTokenElevation}from'../../lib/mapGeometry'
import{tokenFootprintDistanceCells}from'../../lib/gridCombat'
import{dnd5eMapTokenDistanceFeet,dnd5eTokenToPointDistanceFeet}from'./verticalCombatGeometry'
import{dnd5eCharacterClassLevel}from'./classLevels'
import{normalizePactWeaponState,transitionPactWeapon,type PactWeaponState}from'./pactWeaponBinding.mjs'
import type{PactInventoryOperation}from'./pactWeaponInventoryTransaction'

export type PactSeparationTrace={instanceId:string;rows:{worldSecond:number;confirmedOwnerDeath?:true;versions:Record<string,number>;geometry?:MapGeometryState;map:BattleMap;owner:Token|null;location:Token|null;locationKind:'owner'|'carrier'|'ground'|'unknown'}[]}
/** Replay only private, server-observed spatial facts. Operations are later
 * applied to the current physical document by the real Host CAS planner. */
export function replayPactSeparation(state:PactWeaponState,trace:PactSeparationTrace|undefined,hasBladePact:boolean,worldSecond:number){
 const inventoryOperations:PactInventoryOperation[]=[]
 if(trace?.instanceId!==state.binding?.inventoryInstanceId||!trace||state.ritual)return{ok:true as const,state,inventoryOperations}
 for(const fact of trace.rows){
  if(fact.worldSecond<(state.lastHostSecond??0)||fact.worldSecond>worldSecond)continue
  const distance=fact.locationKind==='owner'?0:!fact.owner||!fact.location?undefined:fact.locationKind==='ground'
   ?dnd5eTokenToPointDistanceFeet({geometry:fact.geometry,token:fact.owner,pointElevationFeet:mapGeometryTokenElevation(fact.geometry,fact.location),horizontalDistanceFeet:tokenFootprintDistanceCells(fact.owner,{...fact.location,creatureSize:'微型'},fact.map)*Math.max(1,fact.map.feetPerCell??5)})
   :dnd5eMapTokenDistanceFeet({map:fact.map,geometry:fact.geometry,left:fact.owner,right:fact.location})
  const observed=transitionPactWeapon(state,{ownerId:state.ownerId,expectedRevision:state.revision,kind:'advance'},
   {ownerId:state.ownerId,hasBladePact,ownerDead:fact.confirmedOwnerDeath===true,worldSecond:fact.worldSecond,bindingLocations:state.binding&&distance!=null?[{inventoryInstanceId:state.binding.inventoryInstanceId,distanceFromOwnerFeet:distance}]:[]})
  if(!observed.ok)return observed
  state=observed.state;inventoryOperations.push(...observed.inventoryOperations)
 }
 return{ok:true as const,state,inventoryOperations}
}
/** Synchronous mechanical gates cannot publish a lifecycle CAS. An already
 * proved expired physical weapon must wait for the Host lifecycle publication. */
export function pactWeaponPendingSeparationInstance(owner:Partial<Character>):string|undefined{
 const authority=(owner as {dnd5ePactWeaponAuthority?:{schemaVersion:number;state:PactWeaponState;lifecycleTrace?:PactSeparationTrace}}).dnd5ePactWeaponAuthority
 const state=authority?.schemaVersion===1?normalizePactWeaponState(authority.state):undefined
 if(typeof owner.charClass!=='string'||typeof owner.level!=='number'||!state||state.ownerId!==owner.id||!state.binding||!authority?.lifecycleTrace||!Array.isArray(authority.lifecycleTrace.rows)||
   dnd5eCharacterClassLevel(owner as Character,'warlock')<3||!owner.dnd5eClassChoices?.classes?.warlock?.selections?.['pact-boon']?.includes('blade'))return undefined
 const worldSecond=Math.max(state.lastHostSecond??0,...authority.lifecycleTrace.rows.map(row=>row.worldSecond))
 const result=replayPactSeparation(state,authority.lifecycleTrace,true,worldSecond)
 return result.ok&&(!result.state.binding||state.binding.status==='present'&&result.state.binding.status==='dismissed')?state.binding.inventoryInstanceId:undefined
}
