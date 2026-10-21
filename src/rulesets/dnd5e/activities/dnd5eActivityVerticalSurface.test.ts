import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { createEmptyMapGeometry, setMapGeometryRuntime } from '../../../lib/mapGeometry'
import { migrateMapsState } from '../../../store/maps'
import { resolveDnd5eActivity } from './dnd5eActivityExecutor'
import { applyDnd5eActivityMapHandoffsV1 } from './dnd5eActivityMapInteraction'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'

it.each(['valid','moved','material','far','back','buried','oversized','wrong-mode'] as const)('Host reconstructs vertical surface: %s', kind => {
  const map=migrateMapsState({maps:[{id:'map',name:'Map',width:1000,height:1000,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,tokens:[{id:'actor',type:'player',label:'Caster',x:100,y:25,size:1,elevationFeet:2}]}]}).maps[0]
  const geometry=createEmptyMapGeometry(map.id,1)
  geometry.obstacles=[{id:'stone',kind:'obstacle',label:'Stone',points:[{x:50,y:50},{x:150,y:50},{x:150,y:150},{x:50,y:150}],baseHeightFeet:0,heightFeet:10,surfaceMaterial:'stone',cover:'total',blocksMovement:true,blocksVision:true,blocksLineOfEffect:true,createdAt:1}]
  const definition:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'paint',name:'Paint',activation:{kind:'action'},automation:automationCapabilityFromLegacyStatus('full'),
    target:{kind:'area',origin:'point',shape:'cube',widthFeet:5,lengthFeet:5,heightFeet:5,placeRangeFeet:30,relation:'any'},
    outcomes:[{id:'paint',when:{kind:'always'},operations:[{id:'paint',kind:'create-persistent-area',label:'Paint',durationRounds:600,concentration:false,anchorMode:'fixed',visual:{preset:'surface-color'},surfaceMaterials:['stone'],requireAllSurfaceMaterials:true,surfaceAtPlacementElevation:true}]}]}
  const areaPlacement={x:100,y:50,elevationFeet:2,widthFeet:5,lengthFeet:5,heightFeet:5,verticalSurface:{entityId:'stone',edgeIndex:0,centerFraction:0.5}}
  const resolved=resolveDnd5eActivity({activity:definition,actor:{id:'actor',controller:'players',level:5,proficiencyBonus:3,abilities:{str:10,dex:10,con:10,int:18,wis:10,cha:10},armorClass:12,conditions:[],currentHp:20,maxHp:20},targets:[],rolls:{},areaPlacement,areaPlacementDistanceFeet:5})
  expect(resolved.ok).toBe(true)
  if(!resolved.ok)throw Error('execution failed')
  const proposals=resolved.proposals.filter(p=>p.kind==='create-persistent-area')
  expect(proposals[0].areaInstance?.verticalSurface).toEqual(areaPlacement.verticalSurface)
  if(kind==='moved')geometry.obstacles[0].points.forEach(p=>p.y+=10)
  if(kind==='material')geometry.obstacles[0].surfaceMaterial='solid'
  if(kind==='far')map.tokens[0].x=900
  if(kind==='back')map.tokens[0].y=200
  if(kind==='buried')geometry.obstacles.push({...geometry.obstacles[0],id:'earth',terrainRegion:true,terrainElevationFeet:5,heightFeet:0,points:[{x:0,y:0},{x:200,y:0},{x:200,y:50},{x:0,y:50}]})
  if(kind==='oversized')proposals[0].areaInstance!.widthFeet=6
  if(kind==='wrong-mode')proposals[0].visual={preset:'arcane'}
  setMapGeometryRuntime([geometry])
  try {
    const before=JSON.stringify(map)
    const applied=applyDnd5eActivityMapHandoffsV1({map,activity:definition,packageId:'local.test',actionId:'paint',actorId:'actor',round:1,worldMinute:100,
      selection:{},areaSelection:{anchorCell:{col:2,row:1},cells:[{col:8,row:8}],targetIds:[],areaPlacement,areaPlacementDistanceFeet:5},
      handoffs:{movements:[],summons:[],invocations:[],persistentAreas:proposals}})
    expect(applied.ok,JSON.stringify(applied)).toBe(kind==='valid')
    expect(JSON.stringify(map)).toBe(before)
    if(applied.ok){
      const area=migrateMapsState(JSON.parse(JSON.stringify({maps:[applied.map]}))).maps[0].dnd5ePluginAreas![0]
      expect(area.visual?.verticalSurface).toMatchObject({entityId:'stone',a:{x:75,y:50},b:{x:125,y:50},outward:{x:0,y:-1},baseElevationFeet:2,heightFeet:5})
      expect(area.cells).toEqual([{col:1,row:0},{col:2,row:0}])
      expect(area.expiresAtWorldMinute).toBe(160)
    }
  } finally {setMapGeometryRuntime([])}
})
