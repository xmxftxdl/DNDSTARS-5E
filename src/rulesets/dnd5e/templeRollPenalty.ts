import type {MapGeometryState} from '../../lib/mapGeometry'
import type {Dnd5eCombatant} from './headlessCombatEngine'
import {createDnd5eMechanicalEffect} from './activeEffects'
import {persistentAreaCreatureTypesAllowed} from './persistentAreaCreatureFilter'
import {dnd5eTempleWardAt} from './templeWardGeometry'

const prefix='persistent-area-occupant:temple:'
/** Transient spatial projection: never save an indoor penalty on a character. */
export function projectDnd5eTempleRollPenalties(geometry:MapGeometryState|null|undefined,combatants:readonly Dnd5eCombatant[],worldMinute?:number):void {
 for(const target of combatants){
  const effects=(target.classState.activeEffects??[]).filter(effect=>!effect.source.rulesId?.startsWith(prefix))
  const types=target.creatureType?[target.creatureType,...(target.creatureType.includes('亡灵')?['undead']:[])]:[]
  const temple=geometry?.structureLifetimes?.filter(record=>record.templeWard&&
   persistentAreaCreatureTypesAllowed({includedCreatureTypes:record.templeWard.hostileCreatureTypes},types)&&
   dnd5eTempleWardAt({...geometry,structureLifetimes:[record]},target.position,target.elevationFeet??target.groundElevationFeet??0,worldMinute)
  ).sort((a,b)=>a.id.localeCompare(b.id))[0]
  if(!temple&&effects.length===(target.classState.activeEffects?.length??0))continue
  if(temple){
   const id=prefix+target.id
   effects.push(createDnd5eMechanicalEffect({id,definitionId:'temple-of-the-gods:hostile-rolls',label:'神庙·敌对生物',targetId:target.id,
    source:{kind:'system',actorId:temple.casterId,rulesId:id,magical:true},appliedAt:temple.createdWorldMinute,
    duration:{type:'permanent'},modifiers:{rollDiceModifiers:[{count:1,sides:4,direction:'subtract',appliesTo:['attack','ability-check','saving-throw']}]}}))
  }
  target.classState.activeEffects=effects.length?effects:undefined
 }
}
