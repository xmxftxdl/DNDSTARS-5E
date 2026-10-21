import {reconcileDnd5ePluginAreas,expireDnd5ePluginAreasAtWorldMinute} from './pluginAreas'
import {expect,it} from 'vitest'
import {migrateMapsState,type BattleMap,type Dnd5ePluginArea} from '../../store/maps'
import {freezeDnd5eWaterWallSection,freezeDnd5eWaterWallBand,freezeDnd5eWaterWallsFromEvents,freezeDnd5eWaterWallsFromSpellArea} from './waterWallFreezing'
import {getDnd5eSrdCombatSpell} from './spells'
import type {SkillAoeTargeting} from '../../lib/skillTargeting'
import {resolvePersistentAreaEntityAttackByDm,removePersistentAreaByDm} from './persistentAreaRemoval'
import {mapGeometryDamagePathHalved} from '../../lib/mapGeometry'
const fixture=():BattleMap=>({id:'annulus',name:'Test',width:1000,height:1000,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[],dnd5ePluginAreas:[{
 id:'ring',pluginId:'test.ring',featureId:'wall',label:'Ring',color:'#fff',sourceCharacterId:'caster',sourceTokenId:'caster',slotLevel:3,sourceSpellSaveDc:15,createdRound:1,expiresAfterRound:101,
 anchorMode:'fixed',anchorCell:{col:4,row:4},cells:Array.from({length:25},(_,i)=>({col:2+i%5,row:2+Math.floor(i/5)})),
 circularGeometry:{radiusFeet:10,innerRadiusFeet:9},vertical:{mode:'volume',baseElevationFeet:0,heightFeet:20},movementCostMultiplier:2,blocking:{rangedWeaponAttackDisadvantage:'occupancy'},
} as Dnd5ePluginArea]})

it.each([[345,315],[315,345]])('does not create overlapping tail ice or extra HP for cold paths %j',(...xs)=>{
 const map=fixture(),area=map.dnd5ePluginAreas![0]
 area.circularGeometry=undefined
 area.rectGeometry={lengthFeet:28,widthFeet:1,gridAligned:false,direction:{dc:1,dr:0}}
 area.vertical={mode:'volume',baseElevationFeet:0,heightFeet:13}
 area.cells=Array.from({length:7},(_,col)=>({col:col+1,row:4}))
 area.blocking={freezesOnColdSpell:true}
 let current=map
 for(const x of xs)current=freezeDnd5eWaterWallsFromEvents({map:current,round:1,events:[{
  type:'cold-spell-path-resolved',actorId:'caster',targetId:'target',from:{x,y:25},to:{x,y:425},fromElevationFeet:12,toElevationFeet:12,
 }]})
 const ice=current.dnd5ePluginAreas!.filter(a=>a.entityProfile)
 expect(ice).toHaveLength(1)
 expect(ice[0].entityCurrentHitPoints).toBe(15)
 expect(ice[0].wallSurfaceSections).toEqual([{startFeet:20,endFeet:28,bottomFeet:5,topFeet:13}])
})

it.each([2.5,5,10])('freezes only the exposed height band of an empty ring on a %s-foot grid',feetPerCell=>{
 const map=fixture(),area=map.dnd5ePluginAreas![0]
 map.feetPerCell=feetPerCell
 area.cells=Array.from({length:81},(_,i)=>({col:i%9,row:Math.floor(i/9)}))
 area.blocking={freezesOnColdSpell:true}
 const event={type:'cold-spell-volume-resolved' as const,actorId:'cold-caster',cells:area.cells,bottomFeet:5,topFeet:10}
 const frozen=freezeDnd5eWaterWallsFromEvents({map,round:1,events:[event]})
 const ice=frozen.dnd5ePluginAreas!.filter(a=>a.entityProfile)
 expect(ice).toHaveLength(11)
 const sections=ice.flatMap(a=>a.wallSurfaceSections!)
 expect(sections.every(p=>p.bottomFeet===5&&p.topFeet===10)).toBe(true)
 expect(sections.reduce((sum,p)=>sum+p.endFeet-p.startFeet,0)).toBeCloseTo(Math.PI*19)
 const saved=migrateMapsState(JSON.parse(JSON.stringify({maps:[frozen]}))).maps[0]
 expect(freezeDnd5eWaterWallsFromEvents({map:saved,round:1,events:[event]})).toBe(saved)
 expect(freezeDnd5eWaterWallsFromEvents({map,round:1,events:[{...event,bottomFeet:20,topFeet:25}]})).toBe(map)
 expect(freezeDnd5eWaterWallsFromEvents({map,round:1,events:[{...event,cells:[]}]})).toBe(map)
})

it.each(['line','circle','rect'] as const)('uses the selected cold %s template and vertical extent, not target damage',shape=>{
 const map=fixture(),wall=map.dnd5ePluginAreas![0]
 wall.circularGeometry=undefined
 wall.rectGeometry={lengthFeet:10,widthFeet:1,gridAligned:false,direction:{dc:0,dr:1}}
 wall.cells=[{col:4,row:3},{col:4,row:4},{col:4,row:5}]
 wall.blocking={freezesOnColdSpell:true}
 const area:SkillAoeTargeting=shape==='line'?{shape,origin:'self',lengthFeet:40,widthFeet:5}:
  shape==='circle'?{shape,origin:'point',radiusFeet:2.5}:{shape,origin:'point',widthFeet:5,heightFeet:5,volumeHeightFeet:5}
 const request={map,spell:getDnd5eSrdCombatSpell('cone-of-cold')!,cells:[{col:4,row:4}],elevationFeet:10,actorId:'caster',round:1,
  exposure:{area,origin:{x:shape==='line'?25:225,y:225},originElevationFeet:shape==='rect'?7.5:10,
   aim:{x:425,y:225},aimElevationFeet:10,sourceHeightFeet:5}}
 const result=freezeDnd5eWaterWallsFromSpellArea(request)
 const ice=result.dnd5ePluginAreas!.filter(a=>a.entityProfile)
 expect(ice).toHaveLength(4)
 expect(ice.flatMap(a=>a.wallSurfaceSections!).every(p=>p.bottomFeet>=5&&p.topFeet<=15)).toBe(true)
 expect(freezeDnd5eWaterWallsFromSpellArea({...request,damageType:'fire'})).toBe(map)
 expect(freezeDnd5eWaterWallsFromSpellArea({...request,exposure:{...request.exposure,cells:[]}})).toBe(map)
})

it('freezes a selected band into independent AC5 HP15 ice, without refilling destroyed water',()=>{
 const map=fixture();map.dnd5ePluginAreas![0].blocking={halvedDamageTypes:['fire']}
 map.dnd5ePluginAreas![0].concentrationId='water'
 map.tokens=[{id:'caster',label:'Caster',type:'enemy',x:25,y:25,size:1,color:'',emoji:'',dnd5eCombatState:{concentrationSpellId:'water'}}]
 const input={map,areaId:'ring',sectionId:'section',cells:[{col:6,row:4}],bottom:5,top:10}
 const frozen=freezeDnd5eWaterWallBand(input)!
 expect(frozen.dnd5ePluginAreas).toHaveLength(2)
 expect(freezeDnd5eWaterWallBand({...input,map:frozen})).toBe(frozen)
 const restored=migrateMapsState(JSON.parse(JSON.stringify({maps:[frozen]}))).maps[0]
 const id='ring:frozen:section',ice=restored.dnd5ePluginAreas!.find(a=>a.id===id)!
 expect(ice.entityProfile).toMatchObject({armorClass:5,hitPoints:15})
 const missed=resolvePersistentAreaEntityAttackByDm({map:restored,characters:[],areaId:id,attackTotal:4,damage:15})!
 expect(missed.outcome).toBe('miss')
 const damaged=resolvePersistentAreaEntityAttackByDm({map:restored,characters:[],areaId:id,attackTotal:5,damage:14})!
 expect(damaged.hitPointsAfter).toBe(1)
 const destroyed=resolvePersistentAreaEntityAttackByDm({map:damaged.map,characters:[],areaId:id,attackTotal:5,damage:1})!
 expect(destroyed.outcome).toBe('destroyed');expect(destroyed.concentrationEnded).toBe(false)
 expect(destroyed.map.tokens[0].dnd5eCombatState?.concentrationSpellId).toBe('water')
 expect(destroyed.map.dnd5ePluginAreas!.map(a=>a.id)).toEqual(['ring'])
 const saved=migrateMapsState(JSON.parse(JSON.stringify({maps:[destroyed.map]}))).maps[0]
 const ray=(z:number)=>mapGeometryDamagePathHalved({map:saved,from:{x:225,y:225},to:{x:425,y:225},fromElevationFeet:z,toElevationFeet:z,damageType:'fire'})
 expect(ray(2)).toBe(true);expect(ray(7)).toBe(false);expect(ray(12)).toBe(true)
 const second=freezeDnd5eWaterWallBand({...input,map:saved,sectionId:'second'})!
 expect(second).toBe(saved)
 expect(removePersistentAreaByDm({map:restored,characters:[],areaId:'ring'})!.map.dnd5ePluginAreas).toEqual([])
 expect(map.dnd5ePluginAreas).toHaveLength(1)
})

it('retains a fully frozen cast through reload and removes dependents in the same lifetime pass',()=>{
 const map=fixture(),area=map.dnd5ePluginAreas![0]
 area.cells=[{col:6,row:4}];area.vertical={mode:'volume',baseElevationFeet:0,heightFeet:5}
 area.expiresAfterRound=2;area.createdWorldMinute=0;area.expiresAtWorldMinute=10
 const frozen=freezeDnd5eWaterWallBand({map,areaId:area.id,sectionId:'all',cells:area.cells,bottom:0,top:5})!
 const saved=migrateMapsState(JSON.parse(JSON.stringify({maps:[frozen]}))).maps[0]
 expect(saved.dnd5ePluginAreas).toHaveLength(2)
 expect(saved.dnd5ePluginAreas![0]).toMatchObject({geometryDepleted:true,cells:[]})
 const child=saved.dnd5ePluginAreas![1];child.expiresAfterRound=100;child.expiresAtWorldMinute=undefined
 expect(reconcileDnd5ePluginAreas(saved.dnd5ePluginAreas,[],2)).toHaveLength(2)
 expect(reconcileDnd5ePluginAreas(saved.dnd5ePluginAreas,[],3)).toEqual([])
 expect(expireDnd5ePluginAreasAtWorldMinute(saved,9).dnd5ePluginAreas).toHaveLength(2)
 expect(expireDnd5ePluginAreasAtWorldMinute(saved,10).dnd5ePluginAreas).toEqual([])
 const destroyed=resolvePersistentAreaEntityAttackByDm({map:saved,characters:[],areaId:child.id,attackTotal:5,damage:15})!
 const after=migrateMapsState(JSON.parse(JSON.stringify({maps:[destroyed.map]}))).maps[0]
 expect(after.dnd5ePluginAreas).toHaveLength(1)
 expect(after.dnd5ePluginAreas![0].cells).toEqual([])
 expect(freezeDnd5eWaterWallBand({map:after,areaId:area.id,sectionId:'again',cells:area.cells,bottom:0,top:5})).toBe(after)
 const invalid={...saved,dnd5ePluginAreas:[{...area,geometryDepleted:true}]}
 expect(migrateMapsState({maps:[invalid]}).maps[0].dnd5ePluginAreas??[]).toEqual([])
 const cyclic=[{...area,id:'a',linkedParentAreaId:'b'},{...area,id:'b',linkedParentAreaId:'a'}]
 expect(reconcileDnd5ePluginAreas(cyclic,[],1)).toEqual([])
})

it('freezes only an exact surface patch and retains its gap after entity destruction',()=>{
 const map=fixture(),area=map.dnd5ePluginAreas![0]
 area.blocking={halvedDamageTypes:['fire']}
 const input={map,areaId:'ring',sectionId:'exact',section:{startFeet:0,endFeet:5,bottomFeet:5,topFeet:10}}
 const frozen=freezeDnd5eWaterWallSection(input)!
 const saved=migrateMapsState(JSON.parse(JSON.stringify({maps:[frozen]}))).maps[0]
 expect(saved.dnd5ePluginAreas).toHaveLength(2)
 expect(saved.dnd5ePluginAreas![1].wallSurfaceSections).toEqual([input.section])
 const destroyed=resolvePersistentAreaEntityAttackByDm({map:saved,characters:[],areaId:'ring:frozen:exact',attackTotal:5,damage:15})!
 const ray=(y:number,z:number)=>mapGeometryDamagePathHalved({map:destroyed.map,from:{x:225,y:225},to:{x:425,y},fromElevationFeet:z,toElevationFeet:z,damageType:'fire'})
 expect(ray(225,7)).toBe(false);expect(ray(225,2)).toBe(true);expect(ray(425,7)).toBe(true)
 expect(freezeDnd5eWaterWallSection({...input,map:destroyed.map,sectionId:'again'})).toBe(destroyed.map)
})
