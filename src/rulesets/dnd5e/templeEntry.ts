import type {Dnd5eCombatant,Dnd5eHeadlessCombatState} from './headlessCombatEngine'
import {dnd5eTempleWardAt,dnd5eTempleWardCrossed} from './templeWardGeometry'
import {persistentAreaCreatureTypesAllowed} from './persistentAreaCreatureFilter'

export function dnd5eTempleEntryRequirements(state:Dnd5eHeadlessCombatState,actor:Dnd5eCombatant,to:{x:number;y:number},elevationFeet?:number,path?:readonly {x:number;y:number;elevationFeet:number}[],mode?:'teleport'|'forced',originMapId?:string){
 const scene=state.companionScene
 if(!scene||scene.map.id!==state.mapId||!scene.geometry)return []
 const from={...actor.position,elevationFeet:actor.elevationFeet??actor.groundElevationFeet??0}
 const destination={...to,elevationFeet:elevationFeet??from.elevationFeet}
 const route=path?.length?path:[from,destination]
 const types=actor.creatureType?[actor.creatureType,...(actor.creatureType.includes('亡灵')?['undead']:[])]:[]
 return (scene.geometry.structureLifetimes??[]).flatMap(record=>{
  if(!record.templeWard||!persistentAreaCreatureTypesAllowed({includedCreatureTypes:record.templeWard.hostileCreatureTypes},types))return []
  const geometry={...scene.geometry!,structureLifetimes:[record]}
  if(mode==='teleport'&&(!dnd5eTempleWardAt(geometry,destination,destination.elevationFeet,scene.worldMinute)||
   ((!originMapId||originMapId===scene.map.id)&&dnd5eTempleWardAt(geometry,from,from.elevationFeet,scene.worldMinute))))return []
  if(mode!=='teleport'&&!route.slice(1).some((end,index)=>{
   const start=route[index]
   return !dnd5eTempleWardAt(geometry,start,start.elevationFeet,scene.worldMinute)&&dnd5eTempleWardCrossed(geometry,start,end,scene.worldMinute)
  }))return []
  const effectId=`temple-entry:${scene.map.id}:${record.id}`
  return [{effectId,sourceActorId:record.casterId,ability:'cha' as const,dc:record.templeWard.saveDc,
   denied:actor.classState.activeEffects?.some(effect=>effect.definitionId==='temple-of-the-gods:entry-denied'&&effect.source.rulesId===effectId&&
    (effect.duration.type!=='rounds'||effect.duration.remainingRounds>0))===true}]
 })
}
