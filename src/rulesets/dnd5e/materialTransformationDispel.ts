import {cellToPixel,type GridCell} from '../../lib/gridCombat'
import {planeHeight} from '../../lib/heightPlane'
import {mapGeometryPointInPolygon,type MapGeometryState} from '../../lib/mapGeometry'
import type {Token} from '../../store/maps'
import {createDnd5eMechanicalEffect} from './activeEffects'
import {dnd5eDispelMagicEffectsOnTarget,previewDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange,resolveDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange} from './headlessCombatEngine'
import {refreshDnd5eMapSpatialRelations,planDnd5eMapResultApplication} from './mapBridge'
import {prepareDnd5eSpellCast,resolvePreparedDnd5eSpellCast} from './spellAction'
import {removePersistentAreaByDm} from './persistentAreaRemoval'
import {restoreMaterialVolumeTransformation} from './materialVolumeTransformation'

/** Host-only adapter: no original geometry or restoration receipt is taken from the action. */
export function prepareDnd5eMaterialTransformationDispel(input:Parameters<typeof prepareDnd5eSpellCast>[0]&{
 areaId:string;targetCell:GridCell;geometry:MapGeometryState;targetElevationFeet:number
}){
 const area=input.map.dnd5ePluginAreas?.find(a=>a.id===input.areaId),payload=input.action.dnd5eSpellCast
 const fail=()=>({ok:false as const,reason:'invalid-material-dispel-target'})
 if(!area?.materialTransformation||!area.permanent||payload?.spellId!=='dispel-magic'||
  input.geometry.mapId!==input.map.id||!Number.isInteger(area.slotLevel)||area.slotLevel!<1||area.slotLevel!>9||
  !Number.isSafeInteger(input.targetCell?.col)||!Number.isSafeInteger(input.targetCell?.row)||!Number.isFinite(input.targetElevationFeet)||
  !restoreMaterialVolumeTransformation(input.geometry,area.materialTransformation))return fail()
 const point=cellToPixel(input.targetCell,input.map)
 // Target the actual transformed fragment, not an unconverted remainder in its bounding box.
 if(!area.materialTransformation.replacements.some(r=>r.fragments.some(f=>{
  const base=f.materialLayer?planeHeight(f.materialLayer.basePlane,point):f.baseHeightFeet
  return f.materialMagic==='magical'&&input.targetElevationFeet>=base&&
   input.targetElevationFeet<=base+(f.materialLayer?.depthFeet??f.heightFeet)&&mapGeometryPointInPolygon(point,f.points)
 })))return fail()
 const proxyId=`material-dispel:${input.action.id}`
 if(input.map.tokens.some(t=>t.id===proxyId))return fail()
 const effect=createDnd5eMechanicalEffect({id:proxyId,definitionId:proxyId,label:area.label,targetId:proxyId,
  source:{kind:'spell',rulesId:area.featureId,actorId:area.sourceTokenId,spellLevel:area.slotLevel},duration:{type:'permanent'},modifiers:{}})
 const proxy:Token={id:proxyId,label:area.label,type:'enemy',...point,size:1,color:'',emoji:'',hp:1,maxHp:1,
  elevationFeet:input.targetElevationFeet,dnd5eCombatState:{activeEffects:[effect]}}
 const prepared=prepareDnd5eSpellCast({...input,dispelEffectTargetId:proxyId,
  map:{...input.map,tokens:[...input.map.tokens,proxy]},
  initiativeOrder:[...input.initiativeOrder,{tokenId:proxyId,label:proxy.label,color:'',emoji:'',roll:-100}],
  action:{...input.action,targetTokenId:proxyId,targetTokenIds:[proxyId],targetElevationFeet:input.targetElevationFeet,
   dnd5eSpellCast:{...payload,targetTokenId:proxyId,targetTokenIds:[proxyId],targetElevationFeet:input.targetElevationFeet}}})
 if(!prepared.ok)return prepared
 const effects=dnd5eDispelMagicEffectsOnTarget(prepared.prepared.state,proxyId)
 if(effects.length!==1||effects[0].spellLevel!==area.slotLevel)return fail()
 return {ok:true as const,prepared:prepared.prepared,areaId:area.id,proxyId,effectId:effects[0].effectId,geometry:structuredClone(input.geometry)}
}

export function resolvePreparedDnd5eMaterialTransformationDispel(input:{
 preparation:Extract<ReturnType<typeof prepareDnd5eMaterialTransformationDispel>,{ok:true}>;
 rolls:Omit<Parameters<typeof resolvePreparedDnd5eSpellCast>[0],'prepared'>;
 geometry:MapGeometryState
}){
 const p=input.preparation
 if(JSON.stringify(input.geometry)!==JSON.stringify(p.geometry))return {ok:false as const,reason:'material-dispel-geometry-changed'}
 const resolution=resolvePreparedDnd5eSpellCast({...input.rolls,airborneFallDamageRollsByCombatantId:undefined,prepared:p.prepared})
 if(!resolution.result.ok||!resolution.application)return {ok:true as const,resolution,geometry:undefined}
 const application=resolution.application
 application.map={...application.map,tokens:application.map.tokens.filter(t=>t.id!==p.proxyId)}
 application.changedTokenIds=application.changedTokenIds.filter(id=>id!==p.proxyId)
 let geometry:MapGeometryState|undefined
 if(resolution.result.events.some(e=>e.type==='spell-dispelled'&&e.targetId===p.proxyId&&e.effectId===p.effectId&&e.success)){
  const removed=removePersistentAreaByDm({map:application.map,characters:application.characters,areaId:p.areaId,geometry:p.geometry})
  if(!removed?.geometry)return {ok:false as const,reason:'material-dispel-restoration-conflict'}
  geometry=removed.geometry;application.map=removed.map
  application.characters=removed.characters?[...removed.characters]:application.characters
  application.changedTokenIds=[...new Set([...application.changedTokenIds,...removed.map.tokens.map(t=>t.id)])]
  application.changedCharacterIds=[...new Set([...application.changedCharacterIds,...application.characters.map(c=>c.id)])]
  resolution.result.events=[...resolution.result.events,...removed.events??[]]
 }
 delete resolution.result.state.combatants[p.proxyId]
 resolution.result.state.initiativeOrder=resolution.result.state.initiativeOrder.filter(id=>id!==p.proxyId)
 if(geometry){
  const before=structuredClone(resolution.result.state)
  refreshDnd5eMapSpatialRelations(before,{...p.prepared.map,tokens:p.prepared.map.tokens.filter(t=>t.id!==p.proxyId)},undefined,{geometry:p.geometry})
  const provisional=structuredClone(resolution.result.state)
  refreshDnd5eMapSpatialRelations(provisional,application.map,undefined,{geometry})
  const falls=previewDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange(before,provisional)
  const landing=resolveDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange(before,provisional,input.rolls.airborneFallDamageRollsByCombatantId)
  if(!landing.ok)return {ok:true as const,geometry:undefined,resolution:{...resolution,application:undefined,
   result:{ok:false as const,state:p.prepared.state,events:[],reason:landing.reason},airborneFalls:falls}}
  const events=[...resolution.result.events,...landing.events]
  const landed=planDnd5eMapResultApplication({state:landing.state,map:application.map,characters:application.characters,
   baselineCharacters:p.prepared.characters,characterIdByCombatantId:p.prepared.characterIdByCombatantId,geometry,events})
  landed.changedTokenIds=[...new Set([...application.changedTokenIds,...landed.changedTokenIds])]
  landed.changedCharacterIds=[...new Set([...application.changedCharacterIds,...landed.changedCharacterIds])]
  resolution.application=landed;resolution.result={ok:true,state:landing.state,events}
  resolution.airborneFalls=falls
 }
 return {ok:true as const,resolution,geometry}
}
