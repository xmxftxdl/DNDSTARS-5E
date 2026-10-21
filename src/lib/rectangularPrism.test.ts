import {expect,it} from 'vitest'
import {rectangularPrism,rectangularPrismRayInterval,rectangularPrismOverlapsBox} from '../../shared/rectangular-prism.mjs'
import {rectangularLightOrigin,rectangularLightCandidateOrigins} from './rectangularLightOrigin'
import {persistentAreaBlocksRay} from '../../shared/persistent-area-ray.mjs'
import {dnd5eTokenIntersectsPersistentAreaAt} from '../rulesets/dnd5e/persistentAreaGeometry'
import {normalizeDnd5ePersistentRectGeometry} from '../rulesets/dnd5e/persistentAreaRectGeometry'
import {createEmptyMapGeometry,mapGeometryCanSeeToken} from './mapGeometry'
import {projectMapsForPlayer} from '../../scripts/shared-server-core.mjs'
import {migrateMapsState,type BattleMap,type Dnd5ePluginArea,type Token} from '../store/maps'
import {resolveDnd5eActivityAreaMapSelectionV1,applyDnd5eActivityMapHandoffsV1} from '../rulesets/dnd5e/activities/dnd5eActivityMapInteraction'
import type {Dnd5eActivityDefinitionV1} from '../rulesets/dnd5e/activities/dnd5eActivityContracts'
import {automationCapabilityFromLegacyStatus} from '../domain/automation/automationCapability'
const map:BattleMap={id:'tilt',name:'Tilt',width:2000,height:2000,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,tokens:[],showGrid:true}
const area:Dnd5ePluginArea={id:'wall',pluginId:'local.tilt',featureId:'wall',sourceTokenId:'caster',sourceCharacterId:'caster',label:'Wall',color:'#fff',createdRound:1,expiresAfterRound:100,
 anchorCell:{col:10,row:10},cells:Array.from({length:13},(_,x)=>Array.from({length:13},(_,y)=>({col:4+x,row:4+y}))).flat(),
 rectGeometry:{lengthFeet:60,widthFeet:5,gridAligned:false,direction:{dc:1,dr:0},pitchDegrees:90},vertical:{mode:'volume',baseElevationFeet:45,heightFeet:10},blocking:{vision:true}}
it.each([[0,0,0],[45,30,60],[120,-45,37],[0,90,90]])('retains orthonormal axes at yaw/pitch/roll %s/%s/%s',(yaw,pitchDegrees,rollDegrees)=>{
 const angle=yaw*Math.PI/180,tilted={...area,rectGeometry:{...area.rectGeometry!,pitchDegrees,rollDegrees,direction:{dc:Math.cos(angle),dr:Math.sin(angle)}}}
 const prism=rectangularPrism(map,tilted)!
 const values=[20,1,3],world=prism.world(values)
 prism.local(world).forEach((n,i)=>expect(n).toBeCloseTo(values[i],9))
 const nearest=rectangularLightOrigin(map,tilted,prism.world([100,8,15]))!
 prism.local(nearest).forEach((n,i)=>expect(n).toBeCloseTo([30,2.5,5][i],9))
 const candidates=rectangularLightCandidateOrigins(map,tilted,world)
 expect(candidates.length).toBeGreaterThan(0)
 for(const point of candidates)prism.local(point).forEach((n,i)=>expect(Math.abs(n)).toBeLessThanOrEqual(prism.half[i]+1e-8))
})
it('uses tilted height for actual ray blocking and creature contact',()=>{
 const from={x:400,y:525,elevationFeet:75},to={x:650,y:525,elevationFeet:75}
 const interval=rectangularPrismRayInterval(map,area,from,to)!
 expect(interval[0]).toBeCloseTo(.3,9);expect(interval[1]).toBeCloseTo(.7,9)
 expect(rectangularPrismRayInterval(map,area,{...from,elevationFeet:81},{...to,elevationFeet:81})).toBeUndefined()
 expect(persistentAreaBlocksRay({map:{...map,dnd5ePluginAreas:[area]},from,to,fromElevationFeet:75,toElevationFeet:75,fromEyeHeightFeet:0,toEyeHeightFeet:0,purpose:'vision',overlapsHeight:()=>false})).toBe('wall')
 const token:Token={id:'target',label:'Target',type:'enemy',size:1,x:525,y:525,elevationFeet:70,color:'',emoji:''}
 expect(dnd5eTokenIntersectsPersistentAreaAt(token,map,area,token)).toBe(true)
 expect(dnd5eTokenIntersectsPersistentAreaAt({...token,x:650},map,area,{x:650,y:525})).toBe(false)
 expect(rectangularPrismOverlapsBox(map,area,{x:500,y:500,elevationFeet:81},{x:550,y:550,elevationFeet:86})).toBe(false)
})
it('roundtrips explicit angles and rejects malformed rotations',()=>{
 expect(migrateMapsState({maps:[{...map,dnd5ePluginAreas:[area]}]}).maps[0].dnd5ePluginAreas?.[0].rectGeometry?.pitchDegrees).toBe(90)
 for(const pitchDegrees of [NaN,Infinity,181,'45'])expect(normalizeDnd5ePersistentRectGeometry({...area.rectGeometry,pitchDegrees})).toBeUndefined()
 expect(normalizeDnd5ePersistentRectGeometry({...area.rectGeometry,gridAligned:true})).toBeUndefined()
})
it('client and actual player projection block the raised end of a tilted wall',()=>{
 const viewer:Token={id:'viewer',characterId:'mine',type:'player',label:'Viewer',size:1,x:400,y:525,elevationFeet:72.5,color:'',emoji:''}
 const target:Token={...viewer,id:'target',characterId:undefined,type:'enemy',x:650}
 const geometry=createEmptyMapGeometry(map.id,1);geometry.vision={enabled:true,ambientLight:'bright',defaultRangeFeet:120,sharePartyVision:true}
 for(const pitchDegrees of [0,90]){
  const current={...map,tokens:[viewer,target],dnd5ePluginAreas:[{...area,rectGeometry:{...area.rectGeometry!,pitchDegrees}}]}
  expect(mapGeometryCanSeeToken({map:current,geometry,viewer,target})).toBe(pitchDegrees===0)
  expect(projectMapsForPlayer({maps:[current],selectedId:map.id},{maps:[geometry]},'mine').maps[0].tokens.some((t:Token)=>t.id==='target')).toBe(pitchDegrees===0)
 }
})
it('Host rebuilds tilted footprint and creature targets instead of reusing upright cells',()=>{
 const caster:Token={id:'caster',characterId:'caster',type:'player',label:'Caster',size:1,x:125,y:125,elevationFeet:45,color:'',emoji:''}
 const raised:Token={...caster,id:'raised',characterId:undefined,type:'enemy',x:525,y:525,elevationFeet:70}
 const outside:Token={...raised,id:'outside',x:650,elevationFeet:45}
 const current={...map,tokens:[caster,raised,outside]}
 const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'tilted-wall',name:'Tilted wall',activation:{kind:'action'},
  target:{kind:'area',shape:'rect',origin:'point',relation:'any',placeRangeFeet:120,widthFeet:5,lengthFeet:60,heightFeet:10,rotatable:true,tiltable:true},
  consumption:[],outcomes:[],automation:automationCapabilityFromLegacyStatus('partial')}
 const input={activity,map:current,actorToken:caster,anchorCell:{col:10,row:10},targetElevationFeet:45,rectAngleDegrees:90}
 const upright=resolveDnd5eActivityAreaMapSelectionV1(input)!
 const tilted=resolveDnd5eActivityAreaMapSelectionV1({...input,rectPitchDegrees:90})!
 expect(upright.targetIds).toContain('outside');expect(upright.targetIds).not.toContain('raised')
 expect(tilted.targetIds).toEqual(['raised'])
 expect(tilted.cells.length).toBeLessThan(upright.cells.length)
 expect(tilted.rectGeometry).toMatchObject({pitchDegrees:90,rollDegrees:0})
 expect(tilted.areaPlacement).toMatchObject({pitchDegrees:90,heightFeet:10})
 expect(resolveDnd5eActivityAreaMapSelectionV1({...input,rectPitchDegrees:181})).toBeUndefined()
 expect(resolveDnd5eActivityAreaMapSelectionV1({...input,rectPitchDegrees:45,activity:{...activity,target:{...activity.target,tiltable:false} as typeof activity.target}})).toBeUndefined()
 const saved=applyDnd5eActivityMapHandoffsV1({map:current,activity,packageId:'local.tilt',actionId:'cast',actorId:'caster',sourceSaveDc:15,round:1,worldMinute:100,
  selection:{},areaSelection:tilted,handoffs:{movements:[],summons:[],invocations:[],persistentAreas:[{
   kind:'create-persistent-area',operationId:'wall',label:'Wall',durationRounds:100,concentration:true,anchorMode:'fixed',blocking:{vision:true},
   areaInstance:{...tilted.areaPlacement,shape:'rect',origin:'point'}}]}})
 expect(saved.ok,JSON.stringify(saved)).toBe(true)
 if(saved.ok)expect(migrateMapsState({maps:[saved.map]}).maps[0].dnd5ePluginAreas?.[0].rectGeometry).toMatchObject({pitchDegrees:90})
})
