import {wallSurfaceWorldPoint} from '../../shared/wall-surface-sections.mjs'
import {dnd5eTokenIntersectsPersistentAreaAt} from '../rulesets/dnd5e/persistentAreaGeometry'
import {subtractDnd5eWallSurfaceSection} from '../rulesets/dnd5e/wallSurfaceSections'
import {persistentAreaVolumeRayIntersections} from '../../shared/persistent-area-ray.mjs'
import {subtractPersistentAreaColumnBand,validPersistentAreaColumns} from '../../shared/persistent-area-columns.mjs'
import {mapGeometryDamagePathHalved} from './mapGeometry'
import {normalizeDnd5ePersistentAreaBlocking} from '../rulesets/dnd5e/persistentAreaTypes'
import {cellsForAoe} from './skillTargeting'
import {resolveDnd5eActivity} from '../rulesets/dnd5e/activities/dnd5eActivityExecutor'
import {resolveDnd5eActivityAreaMapSelectionV1,applyDnd5eActivityMapHandoffsV1} from '../rulesets/dnd5e/activities/dnd5eActivityMapInteraction'
import type {Dnd5eActivityDefinitionV1} from '../rulesets/dnd5e/activities/dnd5eActivityContracts'
import {expect,it} from 'vitest'
import {mapGeometryRangedWeaponAttackDisadvantage} from './mapGeometry'
import {migrateMapsState,type BattleMap,type Token,type Dnd5ePluginArea} from '../store/maps'
import {dnd5ePersistentAreaDifficultTerrainMultiplierAt} from '../rulesets/dnd5e/persistentAreaGeometry'
const token=(x:number,y:number,elevationFeet=0):Token=>({id:`${x}:${y}`,label:'Test',type:'enemy',size:1,color:'',emoji:'',x,y,elevationFeet})
const fixture=():BattleMap=>({id:'annulus',name:'Test',width:1000,height:1000,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[],dnd5ePluginAreas:[{
 id:'ring',pluginId:'test.ring',featureId:'wall',label:'Ring',color:'#fff',sourceCharacterId:'caster',sourceTokenId:'caster',slotLevel:3,sourceSpellSaveDc:15,createdRound:1,expiresAfterRound:101,
 anchorMode:'fixed',anchorCell:{col:4,row:4},cells:Array.from({length:25},(_,i)=>({col:2+i%5,row:2+Math.floor(i/5)})),
 circularGeometry:{radiusFeet:10,innerRadiusFeet:9},vertical:{mode:'volume',baseElevationFeet:0,heightFeet:20},movementCostMultiplier:2,blocking:{rangedWeaponAttackDisadvantage:'occupancy'},
} as Dnd5ePluginArea]})
it('preserves a hollow cylinder through migration and excludes its empty center from terrain',()=>{
 const map=migrateMapsState(JSON.parse(JSON.stringify({maps:[fixture()]}))).maps[0]
 expect(map.dnd5ePluginAreas![0].circularGeometry).toEqual({radiusFeet:10,innerRadiusFeet:9})
 const cost=(t:Token)=>dnd5ePersistentAreaDifficultTerrainMultiplierAt({map,token:t,position:t})
 expect(cost(token(225,225))).toBe(1)
 expect(cost(token(320,225))).toBe(2)
 expect(cost(token(320,225,25))).toBe(1)
 for(const inner of [-1,10,11,Infinity,'9']){
  const broken:any=fixture();broken.dnd5ePluginAreas[0].circularGeometry.innerRadiusFeet=inner
  expect(migrateMapsState({maps:[broken]}).maps[0].dnd5ePluginAreas??[]).toHaveLength(0)
 }
})
it('intersects thin ring walls exactly, respecting height, hole, clipping and boundary mode',()=>{
 const map=fixture(),ray=(from:Token,to:Token)=>mapGeometryRangedWeaponAttackDisadvantage({map,from,to})
 expect(ray(token(195,225),token(255,225))).toBe(false)
 expect(ray(token(25,225),token(425,225))).toBe(true)
 expect(ray(token(25,225,25),token(425,225,25))).toBe(false)
 expect(ray(token(25,330),token(425,330))).toBe(false)
 expect(ray(token(319,225),token(321,225))).toBe(true)
 map.dnd5ePluginAreas![0].blocking!.rangedWeaponAttackDisadvantage='boundary'
 expect(ray(token(319,225),token(321,225))).toBe(false)
 expect(ray(token(130,225),token(320,225))).toBe(true)
 map.dnd5ePluginAreas![0].cells=map.dnd5ePluginAreas![0].cells.filter(c=>c.row!==4)
 expect(ray(token(25,225),token(425,225))).toBe(false)
})

it('creates the annulus from an activity declaration and persists Host-derived inner radius',()=>{
 const map=fixture();map.dnd5ePluginAreas=[]
 const caster={...token(25,225),id:'caster'};map.tokens=[caster]
 const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'annular-wall',name:'Wall',automation:{schemaVersion:1,level:'full',supportedPhases:['targeting','effects','persistence'],manualPhases:[],limitations:[]},activation:{kind:'action'},
  target:{kind:'area',relation:'any',origin:'point',shape:'cylinder',radiusFeet:10,minimumRadiusFeet:2.5,wallThicknessFeet:1,heightFeet:20,placeRangeFeet:60},
  outcomes:[{id:'create',when:{kind:'always'},operations:[{id:'wall',kind:'create-persistent-area',label:'Wall',durationRounds:100,concentration:false,movementCostMultiplier:2,blocking:{rangedWeaponAttackDisadvantage:'occupancy'}}]}]}
 const selected=resolveDnd5eActivityAreaMapSelectionV1({activity,map,actorToken:caster,anchorCell:{col:4,row:4}})!
 expect(selected).toBeDefined()
 expect(selected.cells).not.toContainEqual({col:4,row:4})
 const result=resolveDnd5eActivity({activity,actor:{id:caster.id,controller:'player',level:5,proficiencyBonus:3,abilities:{str:10,dex:10,con:10,int:16,wis:10,cha:10},armorClass:10,conditions:[],currentHp:20,maxHp:20},targets:[],rolls:{},areaPlacement:selected.areaPlacement,areaPlacementDistanceFeet:20})
 expect(result.ok,JSON.stringify(result)).toBe(true);if(!result.ok)return
 const applied=applyDnd5eActivityMapHandoffsV1({map,activity,actorId:caster.id,packageId:'test.annulus',actionId:'cast',round:1,selection:{},areaSelection:selected,handoffs:{persistentAreas:result.proposals.filter(p=>p.kind==='create-persistent-area'),summons:[],movements:[],invocations:[]}})
 expect(applied.ok,JSON.stringify(applied)).toBe(true);if(!applied.ok)return
 expect(applied.map.dnd5ePluginAreas![0].circularGeometry).toEqual({radiusFeet:10,innerRadiusFeet:9})
 const center=token(225,225)
 expect(dnd5ePersistentAreaDifficultTerrainMultiplierAt({map:applied.map,token:center,position:center})).toBe(1)
 expect(mapGeometryRangedWeaponAttackDisadvantage({map:applied.map,from:token(25,225),to:token(425,225)})).toBe(true)
})

it('uses physical annular cells at different campaign grid scales',()=>{
 for(const feetPerCell of [5,10]){
  const cells=cellsForAoe({shape:'circle',origin:'point',radiusFeet:20,wallThicknessFeet:1},{col:0,row:0},{col:8,row:8},feetPerCell)
  expect(cells).not.toContainEqual({col:8,row:8})
  expect(cells).toContainEqual({col:8+20/feetPerCell,row:8})
  expect(cells).not.toContainEqual({col:8+20/feetPerCell+1,row:8})
 }
})

it('derives typed attenuation from the actual effect ray without granting occupants resistance',()=>{
 const map=fixture(),area=map.dnd5ePluginAreas![0]
 area.blocking={halvedDamageTypes:['fire']}
 const saved=migrateMapsState(JSON.parse(JSON.stringify({maps:[map]}))).maps[0]
 expect(saved.dnd5ePluginAreas![0].blocking?.halvedDamageTypes).toEqual(['fire'])
 const crosses=(from:{x:number;y:number},to:{x:number;y:number},damageType:'fire'|'cold'='fire',height=5)=>mapGeometryDamagePathHalved({map:saved,from,to,damageType,fromElevationFeet:height,toElevationFeet:height})
 expect(crosses({x:25,y:225},{x:425,y:225})).toBe(true)
 expect(crosses({x:195,y:225},{x:255,y:225})).toBe(false)
 expect(crosses({x:25,y:225},{x:425,y:225},'cold')).toBe(false)
 expect(crosses({x:25,y:225},{x:425,y:225},'fire',25)).toBe(false)
 expect(crosses({x:320,y:225},{x:320,y:225})).toBe(false)
 const wall=saved.dnd5ePluginAreas![0];delete wall.circularGeometry
 wall.rectGeometry={widthFeet:1,lengthFeet:30,gridAligned:false,direction:{dc:1,dr:0}}
 expect(crosses({x:225,y:25},{x:225,y:425})).toBe(true)
 expect(crosses({x:25,y:245},{x:425,y:245})).toBe(false)
 wall.cells=[]
 expect(crosses({x:225,y:25},{x:225,y:425})).toBe(false)
 for(const invalid of [[],['unknown'],true,'fire'])expect(normalizeDnd5ePersistentAreaBlocking({halvedDamageTypes:invalid})).toBeUndefined()
})

it('keeps upper and lower wall remnants after a middle band is removed and reloaded',()=>{
 const map=fixture(),source=map.dnd5ePluginAreas![0]
 source.blocking={halvedDamageTypes:['fire']}
 const cut=subtractPersistentAreaColumnBand(source,source.cells,5,10)!
 expect(source.vertical).toEqual({mode:'volume',baseElevationFeet:0,heightFeet:20})
 expect(cut.vertical?.mode==='volume'&&cut.vertical.columns).toHaveLength(source.cells.length*2)
 const restored=migrateMapsState(JSON.parse(JSON.stringify({maps:[{...map,dnd5ePluginAreas:[cut]}]}))).maps[0]
 expect(restored.dnd5ePluginAreas).toHaveLength(1)
 const ray=(z:number)=>mapGeometryDamagePathHalved({map:restored,from:{x:25,y:225},to:{x:425,y:225},fromElevationFeet:z,toElevationFeet:z,damageType:'fire'})
 expect(ray(2)).toBe(true);expect(ray(7)).toBe(false);expect(ray(12)).toBe(true)
 const repeated=subtractPersistentAreaColumnBand(cut,source.cells,5,10)!
 expect(repeated).toEqual(cut)
 const removed=subtractPersistentAreaColumnBand(cut,source.cells,0,20)!
 expect(removed.cells).toEqual([])
 expect(validPersistentAreaColumns([{col:0,row:0,baseElevationFeet:0,heightFeet:5},{col:0,row:0,baseElevationFeet:10,heightFeet:5}])).toBe(true)
 for(const base of [0,4,5])expect(validPersistentAreaColumns([{col:0,row:0,baseElevationFeet:0,heightFeet:5},{col:0,row:0,baseElevationFeet:base,heightFeet:5}])).toBe(false)
})

it('locates wall material intersections at exact XY and height, including removed middle bands',()=>{
 const map=fixture(),area=map.dnd5ePluginAreas![0]
 const cast={map,area,from:{x:25,y:225},to:{x:425,y:225},fromElevationFeet:7,toElevationFeet:7}
 const hits=persistentAreaVolumeRayIntersections(cast)
 expect(hits.map(hit=>hit.cell)).toEqual([{col:2,row:4},{col:6,row:4}])
 expect(hits[0].fromT).toBeCloseTo(.25);expect(hits[0].toT).toBeCloseTo(.275)
 expect(hits[1].fromT).toBeCloseTo(.725);expect(hits[1].toT).toBeCloseTo(.75)
 expect(persistentAreaVolumeRayIntersections({...cast,fromElevationFeet:20,toElevationFeet:20})).toEqual([])
 const cut=subtractPersistentAreaColumnBand(area,[{col:2,row:4}],5,10)!
 expect(persistentAreaVolumeRayIntersections({...cast,area:cut}).map(hit=>hit.cell)).toEqual([{col:6,row:4}])
 const rect={...area,circularGeometry:undefined,rectGeometry:{lengthFeet:30,widthFeet:1,gridAligned:false,direction:{dc:0,dr:1}}}
 const thin=persistentAreaVolumeRayIntersections({...cast,area:rect})
 expect(thin).toHaveLength(1);expect(thin[0].fromT).toBeCloseTo(.4875);expect(thin[0].toT).toBeCloseTo(.5125)
 expect(persistentAreaVolumeRayIntersections({...cast,area:rect,from:{x:240,y:25},to:{x:240,y:425}})).toEqual([])
 const slope=persistentAreaVolumeRayIntersections({...cast,fromElevationFeet:0,toElevationFeet:40})
 expect(slope.map(hit=>hit.cell)).toEqual([{col:2,row:4}])
 expect(slope[0].fromElevationFeet).toBeCloseTo(10)
})

it.each([2.5,5,10])('persists exact rotated surface holes and uses them for damage rays on %sft grids',feetPerCell=>{
 const map=fixture();map.feetPerCell=feetPerCell
 const area=map.dnd5ePluginAreas![0],angle=.63,d={dc:Math.cos(angle),dr:Math.sin(angle)}
 area.circularGeometry=undefined;area.rectGeometry={lengthFeet:30,widthFeet:1,gridAligned:false,direction:d}
 area.cells=Array.from({length:121},(_,i)=>({col:i%11,row:Math.floor(i/11)}))
 area.blocking={halvedDamageTypes:['fire']}
 area.wallSurfaceSections=subtractDnd5eWallSurfaceSection([{startFeet:0,endFeet:30,bottomFeet:0,topFeet:20}],{startFeet:10,endFeet:15,bottomFeet:5,topFeet:10})
 const restored=migrateMapsState(JSON.parse(JSON.stringify({maps:[map]}))).maps[0]
 expect(restored.dnd5ePluginAreas![0].wallSurfaceSections).toEqual(area.wallSurfaceSections)
 const ray=(along:number,z:number)=>{
  const scale=50/feetPerCell,x=225+(along-15)*d.dc*scale,y=225+(along-15)*d.dr*scale
  return mapGeometryDamagePathHalved({map:restored,from:{x:x-d.dr*10*scale,y:y+d.dc*10*scale},to:{x:x+d.dr*10*scale,y:y-d.dc*10*scale},fromElevationFeet:z,toElevationFeet:z,damageType:'fire'})
 }
 expect(ray(12,7)).toBe(false);expect(ray(12,2)).toBe(true);expect(ray(12,12)).toBe(true);expect(ray(18,7)).toBe(true)
})
it('clips ring surface sectors and rejects malformed saved patches',()=>{
 const map=fixture(),area=map.dnd5ePluginAreas![0],length=Math.PI*19
 area.blocking={halvedDamageTypes:['fire']}
 area.wallSurfaceSections=subtractDnd5eWallSurfaceSection([{startFeet:0,endFeet:length,bottomFeet:0,topFeet:20}],{startFeet:0,endFeet:5,bottomFeet:5,topFeet:10})
 const restored=migrateMapsState(JSON.parse(JSON.stringify({maps:[map]}))).maps[0]
 const ray=(y:number,z:number)=>mapGeometryDamagePathHalved({map:restored,from:{x:225,y:225},to:{x:425,y},fromElevationFeet:z,toElevationFeet:z,damageType:'fire'})
 expect(ray(225,7)).toBe(false);expect(ray(225,2)).toBe(true);expect(ray(425,7)).toBe(true)
 for(const sections of [[{startFeet:-1,endFeet:5,bottomFeet:0,topFeet:5}], [{startFeet:0,endFeet:length+1,bottomFeet:0,topFeet:5}], [area.wallSurfaceSections[0],area.wallSurfaceSections[0]]]){
  expect(migrateMapsState({maps:[{...map,dnd5ePluginAreas:[{...area,wallSurfaceSections:sections}]}]}).maps[0].dnd5ePluginAreas??[]).toEqual([])
 }
})

it('uses exact remaining wall material for creature footprints and difficult terrain',()=>{
 const map=fixture(),area=map.dnd5ePluginAreas![0]
 area.circularGeometry=undefined;area.rectGeometry={lengthFeet:30,widthFeet:1,gridAligned:false,direction:{dc:0,dr:1}}
 area.wallSurfaceSections=subtractDnd5eWallSurfaceSection([{startFeet:0,endFeet:30,bottomFeet:0,topFeet:20}],{startFeet:12.5,endFeet:17.5,bottomFeet:5,topFeet:10})
 const at=(x:number,y:number,z:number,size=1)=>({...token(x,y,z),size})
 const overlaps=(t:Token)=>dnd5eTokenIntersectsPersistentAreaAt(t,map,area,t)
 expect(overlaps(at(225,225,5))).toBe(false)
 expect(overlaps(at(225,225,0))).toBe(true)
 expect(overlaps(at(225,225,10))).toBe(true)
 expect(overlaps(at(225,225,5,2))).toBe(true)
 expect(overlaps(at(265,225,0))).toBe(false)
 const t=at(225,225,5)
 expect(dnd5ePersistentAreaDifficultTerrainMultiplierAt({map,token:t,position:t})).toBe(1)
 area.circularGeometry={radiusFeet:10,innerRadiusFeet:9};area.rectGeometry=undefined
 area.wallSurfaceSections=subtractDnd5eWallSurfaceSection([{startFeet:0,endFeet:Math.PI*19,bottomFeet:0,topFeet:20}],{startFeet:0,endFeet:10,bottomFeet:5,topFeet:10})
 const point=wallSurfaceWorldPoint(area,map,5)!
 expect(overlaps(at(point.x,point.y,5))).toBe(false)
 expect(overlaps(at(point.x,point.y,0))).toBe(true)
 expect(overlaps(at(225,225,0))).toBe(false)
})
