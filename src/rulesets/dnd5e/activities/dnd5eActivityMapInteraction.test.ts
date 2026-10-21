import {registerDnd5eRulesPlugin} from '../pluginApi'
import { normalizeSharedCampaignTime } from '../../../lib/campaignTime'
import {prepareDnd5eMightyFortressFeast} from '../mightyFortressServices'
import { createDnd5eMechanicalEffect, dnd5eConditionsFromActiveEffects } from '../activeEffects'
import {resolveDnd5eFortressServantControl} from '../fortressServantControl'
import {expireDnd5eStructureMapObjects} from '../structureObjectExpiry'
import {prepareDnd5eMapInventoryPickup} from '../mapInventoryPickup'
import {createDnd5eTurnEconomyCounts} from '../turnEconomy'
import { resolveDnd5eActivity } from './dnd5eActivityExecutor'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'
import { migrateMapsState } from '../../../store/maps'
import { beforeEach, describe, expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { cellToPixel } from '../../../lib/gridCombat'
import { createEmptyMapGeometry, setMapGeometryRuntime, mapGeometryMovementBlocked } from '../../../lib/mapGeometry'
import {normalizeMapGeometry} from '../../../lib/mapGeometry'
import {polygonSignedArea} from '../../../lib/convexPolygonPartition'
import {removePersistentAreaByDm} from '../persistentAreaRemoval'
import { dnd5eTokenIntersectsPersistentAreaAt, dnd5ePersistentWardProtectedFrom, dnd5ePersistentAreaMovementCostMultiplierAt } from '../persistentAreaGeometry'
import { createDnd5eMapCombatSnapshot, refreshDnd5eMapSpatialRelations } from '../mapBridge'
import { resolveDnd5eHeadlessAction } from '../headlessCombatEngine'
import { normalizeCharacter } from '../../../store/characters'
beforeEach(() => setMapGeometryRuntime([]))
import type { BattleMap, Token } from '../../../store/maps'
import type { Dnd5eActivityAuthorityHandoffs } from '../headlessCombatEngine'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { dnd5eActivityMapMovementEvents } from './dnd5eActivityMapMovementEvents'
import { reconcileDnd5eSummonedCreatures } from '../summonedCreatures'
import { prepareDnd5eMonsterAttack, resolvePreparedDnd5eMonsterAttack } from '../monsterAttackAction'
import {
  dnd5eActivityContinuationTeleportCells,
  dnd5eActivityGroundTeleportLevels,
  dnd5eActivitySummonPlacementCells,
  applyDnd5eActivityMapHandoffsV1,
  dnd5eActivityAutomaticDirectionalMovementCellV1,
  dnd5eActivityMovementOriginCellV1,
  dnd5eActivityMapTemplateV1,
  resolveDnd5eActivityAreaMapSelectionV1,
} from './dnd5eActivityMapInteraction'

const automation = automationCapabilityFromLegacyStatus('full')

it('routes an imported temple Activity to atomic geometry and rejects occupied sites before publication',()=>{
 const current={...map(),width:2000,height:2000}
 current.tokens=[{...current.tokens[0],x:25,y:25}]
 const geometry=createEmptyMapGeometry(current.id,1);setMapGeometryRuntime([geometry])
 const definition:Dnd5eActivityDefinitionV1={...activity,invocation:undefined,activation:{kind:'hour',value:1},
  target:{kind:'area',origin:'point',shape:'cube',relation:'any',widthFeet:30,lengthFeet:20,heightFeet:15,placeRangeFeet:120},
  outcomes:[{id:'create',when:{kind:'always'},operations:[{id:'temple',kind:'create-persistent-area',label:'Temple',durationRounds:14400,concentration:false,utilityProjectionId:'temple-of-the-gods'}]}]}
 const areaSelection={anchorCell:{col:2,row:2},cells:Array.from({length:24},(_,i)=>({col:2+i%6,row:2+Math.floor(i/6)})),targetIds:[],
  areaPlacement:{x:125,y:125,elevationFeet:0,angleDegrees:0,widthFeet:30,lengthFeet:20,heightFeet:15},areaPlacementDistanceFeet:10}
 expect(validateDnd5eActivityDefinitionV1(definition)).toEqual([])
 const resolved=resolveDnd5eActivity({activity:JSON.parse(JSON.stringify(definition)),actor:{id:'actor',controller:'players',level:15,proficiencyBonus:5,
  abilities:{str:10,dex:10,con:10,int:10,wis:20,cha:10},armorClass:12,conditions:[],currentHp:20,maxHp:20},targets:[],rolls:{},
  areaPlacement:areaSelection.areaPlacement,areaPlacementDistanceFeet:10,confirmedBy:'actor'})
 expect(resolved.ok).toBe(true);if(!resolved.ok)throw Error('temple Activity failed')
 const input:Parameters<typeof applyDnd5eActivityMapHandoffsV1>[0]={map:current,activity:definition,packageId:'test.temple',actionId:'cast-temple',actorId:'actor',round:1,
  worldMinute:100,castLevel:7,sourceSaveDc:18,sourceAbilityScores:{wis:20},areaSelection,selection:{},supportsStructureCommit:true,templeSelection:{authorizedCreatureIds:[],hostileCreatureTypes:['fiend'],lighting:'bright'},
  handoffs:{movements:[],summons:[],invocations:[],persistentAreas:resolved.proposals.filter(p=>p.kind==='create-persistent-area')}}
 expect(applyDnd5eActivityMapHandoffsV1({...input,supportsStructureCommit:false}).ok).toBe(false)
 expect(applyDnd5eActivityMapHandoffsV1({...input,templeSelection:undefined}).ok).toBe(false)
 expect(applyDnd5eActivityMapHandoffsV1({...input,castLevel:6}).ok).toBe(false)
 const result=applyDnd5eActivityMapHandoffsV1(input)
 expect(result.ok).toBe(true);if(!result.ok)throw Error('temple handoff failed')
 expect(result.structureGeometry?.structureLifetimes?.[0]).toMatchObject({createdWorldMinute:100,expiresWorldMinute:1540,replacementGroup:'temple-of-the-gods'})
 expect(result.structureGeometry?.doors).toHaveLength(1)
 expect(geometry.doors).toHaveLength(0)
 const occupied={...current,tokens:[...current.tokens,{...current.tokens[0],id:'occupied',x:200,y:200}]}
 expect(applyDnd5eActivityMapHandoffsV1({...input,map:occupied}).ok).toBe(false)
 geometry.obstacles.push({id:'ground-ridge',kind:'obstacle',label:'Raised ground',points:[{x:201,y:201},{x:201.1,y:201},{x:201.1,y:202},{x:201,y:202}],
  terrainRegion:true,terrainElevationFeet:2,baseHeightFeet:0,heightFeet:0,cover:'none',blocksMovement:false,blocksVision:false,blocksLineOfEffect:false,createdAt:1})
 setMapGeometryRuntime([geometry])
 const before=JSON.stringify({current,geometry})
 expect(applyDnd5eActivityMapHandoffsV1(input)).toMatchObject({ok:false,reason:'invalid-persistent-area'})
 expect(JSON.stringify({current,geometry})).toBe(before)
})

it('returns fortress geometry through Activity handoff only to a Host that can commit it atomically',()=>{
 const current={...map(),width:2000,height:2000}
 current.tokens=[{...current.tokens[0],x:25,y:25}]
 current.tokens.push({...current.tokens[0],id:'resident',type:'enemy',characterId:undefined,x:600,y:600,elevationFeet:0,hp:12,maxHp:20})
 const geometry=createEmptyMapGeometry(current.id,1)
 setMapGeometryRuntime([geometry])
 const definition:Dnd5eActivityDefinitionV1={...activity,invocation:undefined,activation:{kind:'action',cost:1},
  target:{kind:'area',origin:'point',shape:'rect',relation:'any',widthFeet:120,lengthFeet:120,heightFeet:1,placeRangeFeet:5280},
  outcomes:[{id:'create',when:{kind:'always'},operations:[{id:'fortress',kind:'create-persistent-area',label:'Fortress',durationRounds:100800,concentration:false,utilityProjectionId:'mighty-fortress',structureServices:{mealTemplateId:'srd-5.1:item:conjured-food-portion'}}]}]}
 const areaSelection={anchorCell:{col:2,row:2},cells:Array.from({length:576},(_,index)=>({col:2+index%24,row:2+Math.floor(index/24)})),targetIds:[],
  areaPlacement:{x:125,y:125,elevationFeet:0,angleDegrees:0,widthFeet:120,lengthFeet:120},areaPlacementDistanceFeet:10}
 expect(validateDnd5eActivityDefinitionV1(definition)).toEqual([])
 const resolved=resolveDnd5eActivity({activity:JSON.parse(JSON.stringify(definition)),actor:{id:'actor',controller:'players',level:15,proficiencyBonus:5,
  abilities:{str:10,dex:10,con:10,int:20,wis:10,cha:10},armorClass:12,conditions:[],currentHp:20,maxHp:20},targets:[],rolls:{},
  areaPlacement:areaSelection.areaPlacement,areaPlacementDistanceFeet:10,confirmedBy:'actor'})
 expect(resolved.ok).toBe(true)
 if(!resolved.ok)throw Error('fortress Activity execution failed')
 const input:Parameters<typeof applyDnd5eActivityMapHandoffsV1>[0]={map:current,activity:definition,packageId:'test.fortress',actionId:'cast-fortress',actorId:'actor',round:1,
  worldMinute:100,castLevel:8,areaSelection,selection:{},supportsStructureCommit:true,
  fortressSelection:{towerThicknessInches:12,floorThicknessInches:6,authorizedCreatureIds:['resident']},fortressQualifications:{naturalObstacleIds:[],naturalObjectTokenIds:[]},
  handoffs:{movements:[],summons:[],invocations:[],persistentAreas:resolved.proposals.filter(proposal=>proposal.kind==='create-persistent-area')}}
 expect(applyDnd5eActivityMapHandoffsV1({...input,supportsStructureCommit:false})).toMatchObject({ok:false})
 const result=applyDnd5eActivityMapHandoffsV1(input)
 expect(result.ok).toBe(true)
 if(!result.ok)throw Error('fortress handoff failed')
 expect(result.structureGeometry?.structureLifetimes?.[0]).toMatchObject({createdWorldMinute:100,expiresWorldMinute:10180,replacementGroup:'mighty-fortress'})
 expect(result.structureGeometry?.structureLifetimes?.[0].fortressServices).toMatchObject({authorizedCreatureIds:['resident'],mealTemplateId:'srd-5.1:item:conjured-food-portion'})
 const roster=result.structureGeometry!.structureLifetimes![0].fortressServices!.servants!
 expect(roster).toHaveLength(100)
 expect(new Set(roster.map(servant=>servant.tokenId)).size).toBe(100)
 const restored=migrateMapsState(JSON.parse(JSON.stringify({maps:[result.map]}))).maps[0]
 for(const servant of roster){
  const entity=restored.tokens.find(token=>token.id===servant.tokenId)!
  expect(entity).toMatchObject({type:'obstacle',obstacleKind:'marker',dnd5eObjectState:{structureBinding:{mapId:current.id,structureId:result.structureGeometry!.structureLifetimes![0].id}}})
  expect(entity.dnd5eSummon).toBeUndefined()
  expect(dnd5eConditionsFromActiveEffects(entity.dnd5eCombatState?.activeEffects??[])).toContain('invisible')
  expect(resolveDnd5eFortressServantControl({map:restored,geometry:result.structureGeometry!,servantTokenId:entity.id,commanderTokenId:'resident',worldMinute:100})?.member.number).toBe(servant.number)
  expect(result.changedTokenIds).toContain(entity.id)
 }
 expect(current.tokens).toHaveLength(2)
 const furnished=applyDnd5eActivityMapHandoffsV1({...input,
  fortressSelection:{towerThicknessInches:12,floorThicknessInches:6,...input.fortressSelection,furnishings:[{id:'bed',templateId:'srd-5.1:item:bedroll',level:1,x:75,y:75}]},
  handoffs:{...input.handoffs,persistentAreas:input.handoffs.persistentAreas.map(proposal=>({...proposal,
   structureServices:{mealTemplateId:'srd-5.1:item:conjured-food-portion',furnishings:[{templateId:'srd-5.1:item:bedroll',size:0.5}]}}))}})
 expect(furnished.ok).toBe(true)
 if(furnished.ok){
  const furniture=furnished.map.tokens.find(token=>token.id.endsWith(':furniture:bed'))!
  expect(furniture).toMatchObject({x:850,y:850,dnd5eObjectState:{inventoryItem:{templateId:'srd-5.1:item:bedroll'}}})
  expect(furnished.changedTokenIds).toContain(furniture.id)
  expect(furnished.structureGeometry?.structureLifetimes?.[0].fortressServices?.servants).toHaveLength(100)
 }
 for(const angle of [37,90]){
  const rotatedMap={...current,tokens:[current.tokens[0]]}
  const rotatedActivity:Dnd5eActivityDefinitionV1={...definition,target:{...definition.target,kind:'area',shape:'rect',origin:'point',relation:'any',widthFeet:120,lengthFeet:120,placeRangeFeet:5280,rotatable:true,gridAligned:false}}
  const selection=resolveDnd5eActivityAreaMapSelectionV1({activity:rotatedActivity,map:rotatedMap,actorToken:rotatedMap.tokens[0],anchorCell:{col:20,row:20},rectAngleDegrees:angle,targetElevationFeet:0})!
  expect(selection).toBeDefined()
  const rotated=applyDnd5eActivityMapHandoffsV1({...input,map:rotatedMap,activity:rotatedActivity,areaSelection:selection,
   fortressSelection:{towerThicknessInches:12,floorThicknessInches:6,furnishings:[{id:'bed',templateId:'srd-5.1:item:bedroll',level:1,x:75,y:75}]},
   handoffs:{...input.handoffs,persistentAreas:input.handoffs.persistentAreas.map(proposal=>({...proposal,structureServices:{mealTemplateId:'srd-5.1:item:conjured-food-portion',furnishings:[{templateId:'srd-5.1:item:bedroll',size:0.5}]}}))}})
  expect(rotated.ok).toBe(true)
  if(!rotated.ok)throw Error(rotated.reason)
  const record=rotated.structureGeometry!.structureLifetimes![0],corners=record.objectBoundary!.points
  expect(corners.reduce((sum,p)=>sum+p.x,0)/4).toBeCloseTo(1025,5)
  expect(corners.reduce((sum,p)=>sum+p.y,0)/4).toBeCloseTo(1025,5)
  const radians=angle*Math.PI/180
  expect(corners[1].x-corners[0].x).toBeCloseTo(1200*Math.cos(radians),5)
  expect(corners[1].y-corners[0].y).toBeCloseTo(1200*Math.sin(radians),5)
  const bed=rotated.map.tokens.find(token=>token.id.endsWith(':furniture:bed'))!
  expect(bed.x).toBeCloseTo(1025+150*(Math.cos(radians)-Math.sin(radians)),5)
  expect(bed.y).toBeCloseTo(1025+150*(Math.sin(radians)+Math.cos(radians)),5)
  expect(record.fortressServices!.servants).toHaveLength(100)
 }
 const worker=restored.tokens.find(token=>token.id===roster[0].tokenId)!
 const parcel:Token={id:'parcel',type:'obstacle',label:'Parcel',size:1,color:'',emoji:'',x:worker.x,y:worker.y,elevationFeet:worker.elevationFeet,
  dnd5eObjectState:{schemaVersion:1,weightPounds:30,inventoryItem:{templateId:'srd-5.1:item:holy-water-flask',quantity:1,receiptId:'parcel'}}}
 const pickup={map:{...restored,tokens:[...restored.tokens,parcel]},geometry:result.structureGeometry!,characters:[],actorTokenId:worker.id,objectTokenId:'parcel',
  expectedReceiptId:'parcel',expectedQuantity:1,fortressOrder:{commanderTokenId:'resident',worldMinute:100},combatActive:true,
  combat:{currentTokenId:'resident',turnEconomy:createDnd5eTurnEconomyCounts('turn')}}
 const picked=prepareDnd5eMapInventoryPickup(pickup)
 if(!picked.ok)throw Error(picked.reason)
 expect(picked.map.tokens.some(token=>token.id==='parcel')).toBe(false)
 expect(picked.map.tokens.find(token=>token.id===worker.id)?.dnd5eCarriedObjects).toHaveLength(1)
 expect(prepareDnd5eMapInventoryPickup({...pickup,combat:{...pickup.combat,turnEconomy:picked.turnEconomy!}})).toMatchObject({ok:false,reason:'pickup-action-unavailable'})
 expect(prepareDnd5eMapInventoryPickup({...pickup,fortressOrder:{commanderTokenId:'missing',worldMinute:100}})).toMatchObject({ok:false,reason:'pickup-fortress-unauthorized'})
 expect(prepareDnd5eMapInventoryPickup({...pickup,map:{...pickup.map,tokens:pickup.map.tokens.map(token=>token.id==='parcel'?{...token,dnd5eObjectState:{...token.dnd5eObjectState!,weightPounds:31}}:token)},companionCapacityPounds:1000})).toMatchObject({ok:false,reason:'pickup-too-heavy'})
 expect(pickup.map.tokens.find(token=>token.id===worker.id)?.dnd5eCarriedObjects).toBeUndefined()
 expect(expireDnd5eStructureMapObjects(restored,[{schemaVersion:1,mapId:current.id,structureId:result.structureGeometry!.structureLifetimes![0].id}]).tokens).toHaveLength(2)
 const feast=prepareDnd5eMightyFortressFeast({map:result.map,geometry:result.structureGeometry!,structureId:result.structureGeometry!.structureLifetimes![0].id,
  actorTokenId:'resident',worldMinute:100,expectedWorldDay:0,requestId:'first-feast',guests:5})
 expect(feast).toMatchObject({ok:true,remainingGuests:95})
 expect(applyDnd5eActivityMapHandoffsV1({...input,handoffs:{...input.handoffs,persistentAreas:input.handoffs.persistentAreas.map(proposal=>({...proposal,structureServices:{mealTemplateId:'unknown:item'}}))}})).toMatchObject({ok:false})
 const malformed=JSON.parse(JSON.stringify(definition))
 malformed.outcomes[0].operations[0].structureServices={mealTemplateId:'invalid id'}
 expect(validateDnd5eActivityDefinitionV1(malformed).some(error=>error.includes('structureServices'))).toBe(true)
 expect(result.structureGeometry?.obstacles.some(o=>o.dnd5eDurability?.armorClass===15&&o.dnd5eDurability?.maxHitPoints===360)).toBe(true)
 expect(result.map.tokens.find(token=>token.id==='resident')).toMatchObject({elevationFeet:31.5,hp:12})
 expect(result.changedTokenIds).toContain('resident')
 expect(current.tokens.find(token=>token.id==='resident')?.elevationFeet).toBe(0)
 expect(geometry.obstacles).toEqual([])
 expect(applyDnd5eActivityMapHandoffsV1({...input,areaSelection:{...areaSelection,cells:areaSelection.cells.slice(1)}})).toMatchObject({ok:false})
 geometry.walls.push({id:'existing',kind:'wall',label:'Existing',points:[{x:0,y:500},{x:1800,y:500}],baseHeightFeet:0,heightFeet:10,
   blocksMovement:true,blocksVision:true,blocksLineOfEffect:true,createdAt:1})
 setMapGeometryRuntime([geometry])
 expect(applyDnd5eActivityMapHandoffsV1(input)).toMatchObject({ok:false})
})

it('keeps the authorized Grove cube over raised terrain while ordinary areas remain occluded', () => {
  const current = { ...map(), width: 1000, height: 1000 }
  const actor = { ...current.tokens[0], x: 175, y: 175 }
  current.tokens = [actor]
  const geometry = createEmptyMapGeometry(current.id, 1)
  geometry.environment = 'outdoors'
  geometry.obstacles.push({ id: 'hill', kind: 'obstacle', label: 'Hill',
    points: [{ x: 150, y: 200 }, { x: 200, y: 200 }, { x: 200, y: 300 }, { x: 150, y: 300 }],
    baseHeightFeet: 0, heightFeet: 0, terrainRegion: true, terrainElevationFeet: 20,
    blocksMovement: false, blocksVision: false, blocksLineOfEffect: false, cover: 'none', createdAt: 1 })
  setMapGeometryRuntime([geometry])
  const definition: Dnd5eActivityDefinitionV1 = { ...activity,
    target: { kind: 'area', origin: 'point', shape: 'cube', relation: 'any', placeRangeFeet: 120,
      widthFeet: 30, lengthFeet: 30, heightFeet: 30 },
    outcomes: [{ id: 'grove', when: { kind: 'always' }, operations: [{
      id: 'grove', kind: 'create-persistent-area', label: 'Grove', durationRounds: 14400,
      concentration: false, utilityProjectionId: 'druid-grove',
    }] }],
  }
  const selection = resolveDnd5eActivityAreaMapSelectionV1({ activity: definition, map: current,
    actorToken: actor, anchorCell: { col: 3, row: 3 } })!
  expect(selection.cells).toHaveLength(36)
  expect(selection.cells).toContainEqual({ col: 3, row: 5 })
  const ordinary = resolveDnd5eActivityAreaMapSelectionV1({ activity: { ...definition, outcomes: [] }, map: current,
    actorToken: actor, anchorCell: { col: 3, row: 3 } })!
  expect(ordinary.cells.length).toBeLessThan(36)
})

it('receipts distinguish a harmless move following blocked harmful movement from an actual harmful displacement',()=>{
 const current=map()
 const run=(distance:number,harmful:true|undefined)=>applyDnd5eActivityMapHandoffsV1({map:current,activity,
  packageId:'test',actionId:'harmful-move',actorId:'actor',round:1,selection:{movementCellsByOperationId:{second:{col:3,row:1}}},
  handoffs:{summons:[],persistentAreas:[],invocations:[],movements:[
   {kind:'move',operationId:'first',targetId:'target',mode:'forced',cardinalDirection:'north',distanceFeet:distance,harmful},
   {kind:'move',operationId:'second',targetId:'target',mode:'forced',distanceFeet:30},
  ]}})
 for(const [distance,harmful,expected] of [[100,true,[]],[5,true,['target']],[5,undefined,[]]] as const){
  const result=run(distance,harmful)
  expect(result.ok,JSON.stringify(result)).toBe(true)
  if(result.ok)expect(result.harmfulMovementTargetIds).toEqual(expected)
 }
 expect(current).toEqual(map())
})

it('validates independent entity declarations without mixing automatic projection placement', () => {
  const operation = { id: 'pillars', kind: 'create-persistent-area' as const, label: 'Pillar',
    durationRounds: 1, permanent: true as const, concentration: false, separateSelectedInstances: true as const,
    entityProfile: { armorClass: 5, hitPoints: 30, strength: 10, cannotAttack: true, invisible: false,
      destructionTerrain: { radiusFeet: 10, squareFeetPerMinute: 25 } } }
  const definition: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'pillar-test', name: 'Pillar',
    activation: { kind: 'action', cost: 1 }, automation,
    target: { kind: 'area', origin: 'point', relation: 'any', shape: 'rect', widthFeet: 5, lengthFeet: 5,
      heightFeet: 30, placeRangeFeet: 120, instanceCount: 6, minimumInstanceCount: 1 },
    outcomes: [{ id: 'create', when: { kind: 'always' }, operations: [operation] }] }
  expect(validateDnd5eActivityDefinitionV1(definition)).toEqual([])
  for (const patch of [{ instanceCount: 2 }, { utilityProjectionId: 'mirror' }, { entityProfile: undefined },
    { entityProfile: { ...operation.entityProfile, destructionTerrain: { radiusFeet: -1, squareFeetPerMinute: 25 } } }]) {
    const invalid = { ...definition, outcomes: [{ ...definition.outcomes[0], operations: [{ ...operation, ...patch }] }] }
    expect(validateDnd5eActivityDefinitionV1(invalid).length).toBeGreaterThan(0)
  }
})

it('carries declared stone material from serialized Activity execution into a reloaded physical entity', () => {
  const current = map()
  const definition: Dnd5eActivityDefinitionV1 = JSON.parse(JSON.stringify({ ...activity,
    invocation: undefined,
    activation: { kind: 'action', cost: 1 },
    target: { kind: 'area', relation: 'any', origin: 'point', shape: 'sphere', radiusFeet: 5, placeRangeFeet: 60 },
    outcomes: [{ id: 'create', when: { kind: 'always' }, operations: [{
      id: 'stone', kind: 'create-persistent-area', label: 'Stone pillar', durationRounds: 10, concentration: false,
      entityProfile: { material: 'stone', armorClass: 15, hitPoints: 30, cannotAttack: true, invisible: false },
    }] }],
  }))
  expect(validateDnd5eActivityDefinitionV1(definition)).toEqual([])
  const areaSelection = resolveDnd5eActivityAreaMapSelectionV1({ activity: definition, map: current,
    actorToken: current.tokens[0], anchorCell: { col: 3, row: 3 } })!
  const resolved = resolveDnd5eActivity({ activity: definition,
    actor: { id: 'actor', controller: 'players', level: 6, proficiencyBonus: 3,
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 16, cha: 10 }, armorClass: 12, conditions: [], currentHp: 20, maxHp: 20 },
    targets: [], rolls: {}, areaPlacement: areaSelection.areaPlacement, areaPlacementDistanceFeet: 15, confirmedBy: 'actor',
  })
  expect(resolved.ok, JSON.stringify(resolved)).toBe(true)
  if (!resolved.ok) throw Error('entity execution failed')
  const proposals = resolved.proposals.filter(proposal => proposal.kind === 'create-persistent-area')
  expect(proposals[0]).toMatchObject({ entityProfile: { material: 'stone' } })
  const applied = applyDnd5eActivityMapHandoffsV1({ map: current, activity: definition, packageId: 'test.material',
    actionId: 'stone-material', actorId: 'actor', round: 1, areaSelection, selection: {},
    handoffs: { summons: [], movements: [], invocations: [], persistentAreas: proposals } })
  expect(applied.ok, JSON.stringify(applied)).toBe(true)
  if (!applied.ok) throw Error('entity handoff failed')
  const archive = JSON.parse(JSON.stringify({ maps: [applied.map] }))
  expect(migrateMapsState(archive).maps[0].dnd5ePluginAreas?.[0]?.entityProfile).toMatchObject({ material: 'stone', hitPoints: 30 })
  archive.maps[0].dnd5ePluginAreas[0].entityProfile.material = 'guess-from-appearance'
  expect(migrateMapsState(archive).maps[0].dnd5ePluginAreas).toEqual([])
  const invalid = JSON.parse(JSON.stringify(definition))
  invalid.outcomes[0].operations[0].entityProfile.material = 'guess-from-appearance'
  expect(validateDnd5eActivityDefinitionV1(invalid).length).toBeGreaterThan(0)
})

it('creates independent entities at selected anchors and rejects invalid later anchors atomically', () => {
  const current = map()
  const definition: Dnd5eActivityDefinitionV1 = { ...activity, target: {
    kind: 'area', relation: 'any', origin: 'point', shape: 'rect', placementSurface: 'ground', gridAligned: true,
    placeRangeFeet: 30, widthFeet: 5, lengthFeet: 5, heightFeet: 30, instanceCount: 6, minimumInstanceCount: 1,
  } }
  const areaSelection = resolveDnd5eActivityAreaMapSelectionV1({ activity: definition, map: current,
    actorToken: current.tokens[0], anchorCell: { col: 3, row: 3 } })!
  const run = (anchors: { col: number; row: number }[]) => applyDnd5eActivityMapHandoffsV1({
    map: current, activity: definition, packageId: 'test', actionId: 'pillars', actorId: 'actor', round: 1,
    areaSelection, selection: {}, handoffs: { summons: [], movements: [], invocations: [], persistentAreas: [{
      kind: 'create-persistent-area', operationId: 'pillars', label: 'Pillar', durationRounds: 1,
      permanent: true, concentration: false, separateSelectedInstances: true,
      entityProfile: { armorClass: 5, hitPoints: 30, strength: 10, cannotAttack: true, invisible: false,
        destructionTerrain: { radiusFeet: 10, squareFeetPerMinute: 25 } },
      areaInstance: { ...areaSelection.areaPlacement, origin: 'point', shape: 'rect',
        instances: anchors.map(cell => ({ ...cellToPixel(cell, current), elevationFeet: 0 })) },
    }] },
  })
  const original = structuredClone(current)
  const result = run([{ col: 3, row: 3 }, { col: 5, row: 4 }])
  expect(result.ok, JSON.stringify(result)).toBe(true)
  if (!result.ok) throw Error('pillar placement failed')
  const areas = result.map.dnd5ePluginAreas!
  expect(result.createdAreaIds).toEqual(areas.map(area => area.id))
  expect(areas.map(area => area.cells)).toEqual([[{ col: 3, row: 3 }], [{ col: 5, row: 4 }]])
  expect(new Set(areas.map(area => area.id)).size).toBe(2)
  expect(areas.every(area => area.entityCurrentHitPoints === 30 && area.vertical?.mode === 'volume' && area.vertical.heightFeet === 30)).toBe(true)
  expect(migrateMapsState({ maps: [result.map] }).maps[0].dnd5ePluginAreas).toHaveLength(2)
  expect(run([{ col: 3, row: 3 }, { col: 3, row: 3 }]).ok).toBe(false)
  expect(run([{ col: 3, row: 3 }, { col: 18, row: 18 }]).ok).toBe(false)
  expect(run([]).ok).toBe(false)
  expect(run(Array.from({ length: 7 }, (_, index) => ({ col: 3 + index, row: 3 }))).ok).toBe(false)
  expect(current).toEqual(original)
})

it.each([undefined, true] as const)('keeps residual terrain separate from the initial damage volume (groundOnly=%s)', groundOnly => {
  const current = map()
  const definition: Dnd5eActivityDefinitionV1 = { ...activity, target: {
    kind: 'area', relation: 'any', origin: 'point', shape: 'cube',
    placeRangeFeet: 30, widthFeet: 20, lengthFeet: 20, heightFeet: 20, includeSelf: true,
  } }
  const areaSelection = resolveDnd5eActivityAreaMapSelectionV1({ activity: definition, map: current,
    actorToken: current.tokens[0], anchorCell: { col: 2, row: 1 } })!
  expect(areaSelection.targetIds).toContain('target')
  const result = applyDnd5eActivityMapHandoffsV1({ map: current, activity: definition,
    packageId: 'test', actionId: 'terrain', actorId: 'actor', round: 1, areaSelection, selection: {},
    handoffs: { persistentAreas: [{ kind: 'create-persistent-area', operationId: 'terrain',
      label: 'Residual terrain', durationRounds: 1, permanent: true, concentration: false,
      movementCostMultiplier: 2, groundOnly,
      areaInstance: { ...areaSelection.areaPlacement, origin: 'point', shape: 'cube' },
    }], summons: [], movements: [], invocations: [] } })
  expect(result.ok, JSON.stringify(result)).toBe(true)
  if (!result.ok) throw new Error('terrain placement failed')
  const saved = migrateMapsState(JSON.parse(JSON.stringify({ maps: [result.map] }))).maps[0]
  const cost = (elevationFeet: number) => {
    const subject = { ...saved.tokens[1], elevationFeet }
    return dnd5ePersistentAreaMovementCostMultiplierAt({ map: saved, token: subject, position: subject })
  }
  expect(cost(0)).toBe(2)
  expect(cost(5)).toBe(groundOnly ? 1 : 2)
  expect(cost(25)).toBe(1)
  expect(current.dnd5ePluginAreas).toBeUndefined()
})

function token(map: BattleMap, id: string, col: number, row: number, type: Token['type']): Token {
  return {
    id, label: id, color: '#fff', emoji: id, size: 1, type,
    ...cellToPixel({ col, row }, map),
    ...(type === 'player' ? { characterId: id } : {}),
  }
}

function map(): BattleMap {
  const base: BattleMap = {
    id: 'activity-map', name: 'Activity map', width: 1000, height: 1000,
    gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
    tokens: [],
  }
  base.tokens = [token(base, 'actor', 1, 1, 'player'), token(base, 'target', 2, 1, 'enemy')]
  return base
}

const activity: Dnd5eActivityDefinitionV1 = {
  schemaVersion: 1,
  id: 'storm-zone',
  name: 'Storm zone',
  activation: { kind: 'reaction', cost: 1 },
  invocation: { kind: 'triggered', event: 'after-damage', confirmation: 'actor-choice' },
  target: {
    kind: 'area', relation: 'enemy', origin: 'point', shape: 'rect',
    placeRangeFeet: 30, widthFeet: 10, lengthFeet: 20, heightFeet: 5,
    maximumTargets: 8, rotatable: true,
  },
  outcomes: [],
  automation,
}

it('rejects a protected corpse in a mixed undead batch before any map mutation', () => {
  const current = map()
  current.tokens[1].hp = 0
  current.tokens.push({ ...token(current, 'protected', 4, 1, 'enemy'), hp: 0, maxHp: 10,
    dnd5eCombatState: { activeEffects: [createDnd5eMechanicalEffect({ definitionId: 'funeral', label: 'Funeral',
      source: { kind: 'spell', actorId: 'actor', rulesId: 'ceremony' }, targetId: 'protected',
      undeadCreationProtection: { minimumPower: 'wish' },
      duration: { type: 'rounds', remainingRounds: 100800, tickOn: 'source-turn-end' } })] } })
  const before = structuredClone(current)
  const run = () => applyDnd5eActivityMapHandoffsV1({ map: current, activity, packageId: 'local.test',
    actionId: 'protected-batch', actorId: 'actor', round: 1,
    handoffs: { summons: ['target', 'protected'].map(corpseTokenId => ({ kind: 'summon' as const,
      operationId: 'animate', monsterId: 'srd-5.1:skeleton', corpseTokenId, count: 1,
      timing: 'immediate' as const, durationRounds: 600, concentration: true, side: 'ally' as const,
      groupInitiative: true })), persistentAreas: [], movements: [], invocations: [] },
    selection: { summonInitiativeD20s: [12] } })
  expect(run()).toMatchObject({ ok: false, reason: 'invalid-summon-placement' })
  expect(current).toEqual(before)
  current.tokens[2].dnd5eCombatState!.activeEffects = []
  expect(run().ok).toBe(true)
})

it('protects one classified map corpse at the validated point and rejects invalid selections atomically', () => {
  const current = map()
  current.tokens.push({ ...token(current, 'corpse-object', 2, 1, 'obstacle'),
    dnd5eObjectState: { schemaVersion: 1, remains: { kind: 'humanoid-corpse', creatureSize: 'medium' } } })
  const definition: Dnd5eActivityDefinitionV1 = { ...activity, activation: { kind: 'free' }, invocation: undefined,
    target: { kind: 'area', relation: 'any', origin: 'point', shape: 'rect', placeRangeFeet: 5,
      widthFeet: 5, lengthFeet: 5, heightFeet: 5, gridAligned: true },
    outcomes: [{ id: 'protect', when: { kind: 'always' }, operations: [{ id: 'protect', kind: 'protect-map-remains',
      durationMinutes: 10080, minimumPower: 'wish' }] }] }
  expect(validateDnd5eActivityDefinitionV1(definition)).toEqual([])
  const areaSelection = resolveDnd5eActivityAreaMapSelectionV1({ activity: definition, map: current,
    actorToken: current.tokens[0], anchorCell: { col: 2, row: 1 } })!
  expect(areaSelection).toBeDefined()
  const run = (worldMinute: number | undefined = 100) => applyDnd5eActivityMapHandoffsV1({ map: current,
    activity: definition, packageId: 'test.funeral', actionId: 'funeral', actorId: 'actor', round: 1, worldMinute,
    areaSelection, handoffs: { summons: [], movements: [], invocations: [], persistentAreas: [],
      mapRemainsProtections: [{ kind: 'protect-map-remains', operationId: 'protect', durationMinutes: 10080,
        minimumPower: 'wish', spellLevel: 1 }] }, selection: {} })
  const before = structuredClone(current)
  const protectedResult = run()
  expect(protectedResult.ok, JSON.stringify(protectedResult)).toBe(true)
  if (!protectedResult.ok) throw Error('Map protection failed')
  expect(current).toEqual(before)
  expect(protectedResult.changedTokenIds).toEqual(['corpse-object'])
  expect(protectedResult.map.tokens[2].dnd5eObjectState?.undeadCreationProtection).toMatchObject({
    sourceTokenId: 'actor', sourcePackageId: 'test.funeral', createdWorldMinute: 100, expiresAtWorldMinute: 10180 })
  const restored = migrateMapsState({ maps: [JSON.parse(JSON.stringify(protectedResult.map))] }) as { maps: BattleMap[] }
  expect(restored.maps[0].tokens[2].dnd5eObjectState?.undeadCreationProtection?.expiresAtWorldMinute).toBe(10180)
  for (const minute of [-1, NaN, 0.5, Number.MAX_SAFE_INTEGER]) expect(run(minute).ok).toBe(false)
  current.tokens[2].elevationFeet = 50
  expect(run().ok).toBe(false)
  current.tokens[2].elevationFeet = 0
  current.tokens.push({ ...current.tokens[2], id: 'second-body' })
  expect(run().ok).toBe(false)
  current.tokens.pop()
  current.tokens[2].dnd5eObjectState = { schemaVersion: 1, remains: { kind: 'bone-pile' } }
  expect(run().ok).toBe(false)
  for (const creatureSize of ['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan'] as const) {
    current.tokens[2].dnd5eObjectState = { schemaVersion: 1, remains: { kind: 'creature-corpse', creatureSize, creatureType: 'dragon' } }
    expect(run().ok, creatureSize).toBe(true)
  }
  current.tokens[2].dnd5eObjectState = { schemaVersion: 1, remains: { kind: 'humanoid-corpse', creatureSize: 'medium' } }
  const geometry = createEmptyMapGeometry(current.id, 1)
  geometry.doors.push({ id: 'barrier', kind: 'door', label: 'Barrier', points: [{ x: 100, y: 0 }, { x: 100, y: 500 }],
    state: 'closed', openState: 'closed', lockState: 'unlocked', physicalState: 'intact', secret: false,
    blocksVision: false, blocksMovement: true, blocksLineOfEffect: true, baseHeightFeet: 0, heightFeet: 100, createdAt: 1 })
  setMapGeometryRuntime([geometry])
  expect(run().ok).toBe(false)
})

describe('typed map consumable purification', () => {
  it.each([false, true])('persists only eligible nonmagical food and drink (blocked=%s)', blocked => {
    const current = map()
    const food = (id: string, col = 3, elevationFeet = 0): Token => ({
      ...token(current, id, col, 1, 'obstacle'), elevationFeet,
      dnd5eObjectState: { schemaVersion: 1, consumable: { kind: 'food', contaminants: ['poison', 'disease'] } },
    })
    current.tokens.push(food('food'), { ...food('magic'), dnd5eObjectState: {
      ...food('magic').dnd5eObjectState!, magical: true } }, food('high', 3, 50), food('outside', 12),
      { ...food('creature'), type: 'enemy' }, token(current, 'untyped', 3, 1, 'obstacle'),
      { ...food('drink'), dnd5eObjectState: { schemaVersion: 1, consumable: { kind: 'drink', contaminants: ['poison'] } } })
    const definition: Dnd5eActivityDefinitionV1 = { ...activity, target: {
      kind: 'area', relation: 'any', origin: 'point', shape: 'sphere', placeRangeFeet: 30, radiusFeet: 10,
    } }
    const areaSelection = resolveDnd5eActivityAreaMapSelectionV1({ activity: definition, map: current,
      actorToken: current.tokens[0], anchorCell: { col: 2, row: 1 } })!
    expect(areaSelection).toBeDefined()
    if (blocked) {
      const geometry = createEmptyMapGeometry(current.id, 1)
      geometry.doors.push({ id: 'barrier', kind: 'door', label: 'Barrier',
        points: [{ x: 150, y: 0 }, { x: 150, y: 500 }], state: 'closed', openState: 'closed',
        lockState: 'unlocked', physicalState: 'intact', secret: false,
        blocksVision: true, blocksMovement: true, blocksLineOfEffect: true,
        baseHeightFeet: 0, heightFeet: 100, createdAt: 1 })
      setMapGeometryRuntime([geometry])
    }
    const before = structuredClone(current)
    const input = { map: current, activity: definition, packageId: 'test', actionId: 'purify', actorId: 'actor',
      round: 1, areaSelection, selection: {}, handoffs: { persistentAreas: [], summons: [], movements: [], invocations: [],
        mapObjectPurifications: [{ kind: 'purify-map-consumables' as const, operationId: 'purify', contaminants: ['poison' as const] }] } }
    const result = applyDnd5eActivityMapHandoffsV1(input)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(current).toEqual(before)
    expect(result.changedTokenIds).toEqual(blocked ? [] : ['food', 'drink'])
    expect(result.map.tokens.find(t => t.id === 'food')?.dnd5eObjectState?.consumable?.contaminants)
      .toEqual(blocked ? ['poison', 'disease'] : ['disease'])
    for (const id of ['magic', 'high', 'outside', 'creature', 'untyped']) {
      expect(result.map.tokens.find(t => t.id === id)).toEqual(before.tokens.find(t => t.id === id))
    }
    const restored: BattleMap = JSON.parse(JSON.stringify(result.map))
    const replay = applyDnd5eActivityMapHandoffsV1({ ...input, map: restored })
    expect(replay).toMatchObject({ ok: true, changedTokenIds: [], map: restored })
    expect(applyDnd5eActivityMapHandoffsV1({ ...input, areaSelection: undefined }))
      .toEqual({ ok: false, reason: 'activity-area-required' })
    const invalid = applyDnd5eActivityMapHandoffsV1({ ...input, handoffs: { ...input.handoffs,
      movements: [{ kind: 'move', operationId: 'invalid', targetId: 'actor', mode: 'forced', distanceFeet: 10 }] } })
    expect(invalid.ok).toBe(false)
    expect(current).toEqual(before)
  })
})

describe('typed noncreature vegetation', () => {
  it.each([false, true])('withers only eligible plants without removing physical objects (blocked=%s)', blocked => {
    const current = map()
    const plant = (id: string, col = 3, elevationFeet = 0): Token => ({
      ...token(current, id, col, 1, 'obstacle'), elevationFeet, hp: 20, maxHp: 20,
      dnd5eObjectState: { schemaVersion: 1, vegetation: 'living' },
    })
    current.tokens.push(plant('plant'), { ...plant('magic'), dnd5eObjectState: { schemaVersion: 1, vegetation: 'living', magical: true } },
      plant('high', 3, 50), plant('outside', 12), { ...plant('creature'), type: 'enemy' },
      token(current, 'untyped', 3, 1, 'obstacle'), { ...plant('dead'), dnd5eObjectState: { schemaVersion: 1, vegetation: 'dead' } })
    const definition: Dnd5eActivityDefinitionV1 = { ...activity, target: {
      kind: 'area', relation: 'any', origin: 'point', shape: 'cube', placeRangeFeet: 30, lengthFeet: 20, widthFeet: 20, heightFeet: 20,
    }, outcomes: [{ id: 'wither', when: { kind: 'always' }, operations: [{ id: 'wither', kind: 'wither-map-vegetation' }] }] }
    expect(validateDnd5eActivityDefinitionV1(definition)).toEqual([])
    const areaSelection = resolveDnd5eActivityAreaMapSelectionV1({ activity: definition, map: current,
      actorToken: current.tokens[0], anchorCell: { col: 2, row: 1 } })!
    if (blocked) {
      const geometry = createEmptyMapGeometry(current.id, 1)
      geometry.walls.push({ id: 'barrier', kind: 'wall', label: 'Barrier', points: [{ x: 150, y: 0 }, { x: 150, y: 500 }],
        blocksVision: true, blocksMovement: true, blocksLineOfEffect: true, baseHeightFeet: 0, heightFeet: 100, createdAt: 1 })
      setMapGeometryRuntime([geometry])
    }
    const before = structuredClone(current)
    const input = { map: current, activity: definition, packageId: 'test', actionId: 'wither', actorId: 'actor', round: 1,
      areaSelection, selection: {}, handoffs: { persistentAreas: [], summons: [], movements: [], invocations: [],
        mapVegetationChanges: [{ kind: 'wither-map-vegetation' as const, operationId: 'wither' }] } }
    const result = applyDnd5eActivityMapHandoffsV1(input)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(current).toEqual(before)
    expect(result.changedTokenIds).toEqual(blocked ? [] : ['plant'])
    expect(result.map.tokens.find(t => t.id === 'plant')).toMatchObject({ hp: 20, maxHp: 20,
      dnd5eObjectState: { vegetation: blocked ? 'living' : 'dead' } })
    for (const id of ['magic', 'high', 'outside', 'creature', 'untyped', 'dead']) {
      expect(result.map.tokens.find(t => t.id === id)).toEqual(before.tokens.find(t => t.id === id))
    }
    const restored = migrateMapsState(JSON.parse(JSON.stringify({ maps: [result.map], selectedId: result.map.id }))).maps[0]
    expect(restored.tokens.find(t => t.id === 'plant')?.dnd5eObjectState?.vegetation).toBe(blocked ? 'living' : 'dead')
    expect(applyDnd5eActivityMapHandoffsV1({ ...input, map: restored })).toMatchObject({ ok: true, changedTokenIds: [] })
    expect(applyDnd5eActivityMapHandoffsV1({ ...input, areaSelection: undefined })).toEqual({ ok: false, reason: 'activity-area-required' })
    expect(applyDnd5eActivityMapHandoffsV1({ ...input, handoffs: { ...input.handoffs,
      movements: [{ kind: 'move', operationId: 'invalid', targetId: 'actor', mode: 'forced', distanceFeet: 10 }] } }).ok).toBe(false)
    expect(current).toEqual(before)
  })
})

it.each(['forced', 'teleport', 'push', 'pull'] as const)('rejects malformed %s destinations before any map state can escape', mode => {
  const current = map(), before = structuredClone(current)
  for (const destination of [{ x: 3, y: 1 }, { col: NaN, row: 1 }, { col: 3, row: Infinity },
    { col: null, row: 1 }, { col: '3', row: 1 }, { col: 3 }]) {
    const selection = JSON.parse(JSON.stringify({ movementCellsByOperationId: { bad: destination } }))
    const result = applyDnd5eActivityMapHandoffsV1({ map: current, activity, packageId: 'test', actionId: 'malformed',
      actorId: 'actor', round: 1, handoffs: { persistentAreas: [], summons: [], invocations: [], movements: [
        { kind: 'move', operationId: 'first', targetId: 'target', mode: 'forced', distanceFeet: 10 },
        { kind: 'move', operationId: 'bad', targetId: 'actor', mode, distanceFeet: 30 },
      ] }, selection: { movementCellsByOperationId: { first: { col: 3, row: 1 }, ...selection.movementCellsByOperationId } } })
    expect(result).toMatchObject({ ok: false, reason: 'invalid-movement-placement' })
    expect(current).toEqual(before)
  }
})

it('rejects nonfinite area coordinates and rotation while retaining Host-owned self centers', () => {
  const current = map(), before = structuredClone(current)
  const select = (anchorCell: { col: number; row: number }, rectRotation = 0, definition = activity) =>
    resolveDnd5eActivityAreaMapSelectionV1({ activity: definition, map: current, actorToken: current.tokens[0], anchorCell, rectRotation })
  for (const anchor of [{ col: NaN, row: 1 }, { col: 3, row: Infinity }]) expect(select(anchor)).toBeUndefined()
  expect(select({ col: 3, row: 1 }, NaN)).toBeUndefined()
  expect(select({ col: 3, row: 1 }, Infinity)).toBeUndefined()
  const self: Dnd5eActivityDefinitionV1 = { ...activity, target: { kind: 'area', relation: 'any', origin: 'self', shape: 'sphere', radiusFeet: 10 } }
  expect(select({ col: NaN, row: NaN }, 0, self)?.anchorCell).toEqual({ col: 1, row: 1 })
  expect(current).toEqual(before)
})

it('uses the complete area center for directional movement and preserves actor and legacy origins', () => {
  const current = map()
  const cube: Dnd5eActivityDefinitionV1 = { ...activity, target: { kind: 'area', shape: 'cube', origin: 'point', relation: 'enemy', placeRangeFeet: 60, widthFeet: 20, lengthFeet: 20, heightFeet: 20 } }
  const selection = resolveDnd5eActivityAreaMapSelectionV1({ activity: cube, map: current, actorToken: current.tokens[0], anchorCell: { col: 5, row: 5 } })!
  expect(selection).toBeDefined()
  const input = { activity: cube, map: current, actorToken: current.tokens[0], areaSelection: selection }
  expect(dnd5eActivityMovementOriginCellV1({ ...input, directionOrigin: 'area-center' })).toEqual({ col: 5.5, row: 5.5 })
  expect(dnd5eActivityMovementOriginCellV1({ ...input, directionOrigin: 'area-center', areaSelection: undefined })).toBeUndefined()
  expect(dnd5eActivityMovementOriginCellV1({ ...input, legacyOriginCell: { col: 9, row: 9 } })).toEqual({ col: 9, row: 9 })
  expect(dnd5eActivityMovementOriginCellV1({ ...input, directionOrigin: 'actor', legacyOriginCell: { col: 9, row: 9 } })).toEqual({ col: 1, row: 1 })
})

it('authoritatively pushes away from the selected region instead of away from its caster', () => {
  const current = map()
  current.tokens[1] = token(current, 'target', 4, 1, 'enemy')
  const sphere: Dnd5eActivityDefinitionV1 = { ...activity, target: { kind: 'area', shape: 'sphere', origin: 'point', relation: 'enemy', placeRangeFeet: 60, radiusFeet: 10 } }
  const areaSelection = resolveDnd5eActivityAreaMapSelectionV1({ activity: sphere, map: current, actorToken: current.tokens[0], anchorCell: { col: 5, row: 1 } })!
  const apply = (col: number, withArea = true) => applyDnd5eActivityMapHandoffsV1({
    map: current, activity: sphere, packageId: 'test', actionId: 'push', actorId: 'actor', round: 1,
    areaSelection: withArea ? areaSelection : undefined,
    handoffs: { persistentAreas: [], summons: [], invocations: [], movements: [{ kind: 'move', operationId: 'push', targetId: 'target', mode: 'push', distanceFeet: 5, directionOrigin: 'area-center' }] },
    selection: { movementCellsByOperationId: { push: { col, row: 1 } } },
  })
  expect(apply(3).ok).toBe(true)
  expect(apply(5)).toMatchObject({ ok: false, reason: 'invalid-movement-placement' })
  expect(apply(3, false)).toMatchObject({ ok: false, reason: 'invalid-movement-placement' })
  expect(current.tokens[1]).toMatchObject(cellToPixel({ col: 4, row: 1 }, current))
})

it('keeps more than256 occupants in an unlimited area selection and honors explicit limits',()=>{
  const current=map()
  current.tokens=[current.tokens[0],...Array.from({length:300},(_,i)=>token(current,`enemy-${i}`,2,1,'enemy'))]
  const unlimited:Dnd5eActivityDefinitionV1={...activity,target:{kind:'area',relation:'enemy',origin:'point',shape:'sphere',placeRangeFeet:30,radiusFeet:20}}
  const select=(definition:Dnd5eActivityDefinitionV1)=>resolveDnd5eActivityAreaMapSelectionV1({activity:definition,map:current,actorToken:current.tokens[0],anchorCell:{col:2,row:1}})
  expect(select(unlimited)?.targetIds).toHaveLength(300)
  if(unlimited.target.kind!=='area')throw Error('expected area')
  expect(select({...unlimited,target:{...unlimited.target,maximumTargets:7}})?.targetIds).toHaveLength(7)
})

it('requires a distinct teleport destination in candidates and Host validation without changing legacy behavior', () => {
  const current = map(), actorToken = current.tokens[0]
  const movement = { kind: 'move' as const, operationId: 'step', targetId: 'actor', mode: 'teleport' as const, distanceFeet: 30, requiresDifferentDestination: true as const }
  const candidates = dnd5eActivityContinuationTeleportCells({ map: current, actorToken, movement })
  expect(candidates).not.toContainEqual({ col: 1, row: 1 })
  expect(candidates).not.toContainEqual({ col: 2, row: 1 })
  expect(candidates).toContainEqual({ col: 3, row: 1 })
  const apply = (col: number, distinct = true) => applyDnd5eActivityMapHandoffsV1({
    map: current, activity, packageId: 'test', actionId: 'step', actorId: 'actor', round: 1,
    handoffs: { persistentAreas: [], summons: [], invocations: [], movements: [{ ...movement, requiresDifferentDestination: distinct ? true : undefined }] },
    selection: { movementCellsByOperationId: { step: { col, row: 1 } } },
  })
  expect(apply(1)).toMatchObject({ ok: false, reason: 'invalid-movement-placement' })
  expect(apply(1, false).ok).toBe(true)
  expect(apply(2).ok).toBe(false)
  expect(apply(3).ok).toBe(true)
  current.tokens.push(token(current, 'new-occupant', 3, 1, 'enemy'))
  expect(apply(3).ok).toBe(false)
})

it('offers supported floor heights and rejects floating, removed, or undersized landing surfaces', () => {
  const current=map()
  current.tokens[0].elevationFeet=20
  const geometry=createEmptyMapGeometry(current.id)
  geometry.vision.ambientLight='bright'
  geometry.obstacles.push({id:'floor',kind:'obstacle',label:'Floor',surfaceMaterial:'stone',
    points:[{x:200,y:50},{x:250,y:50},{x:250,y:100},{x:200,y:100}],
    baseHeightFeet:19,heightFeet:1,blocksMovement:true,blocksVision:true,blocksLineOfEffect:true,cover:'total',createdAt:1})
  setMapGeometryRuntime([geometry])
  const movement={kind:'move' as const,operationId:'land',targetId:'target',mode:'teleport' as const,
    distanceFeet:150,maximumDistanceFromActorFeet:120,verticalDestination:'ground' as const,requiresVisibleDestination:true}
  const levels=()=>dnd5eActivityGroundTeleportLevels({map:current,actorToken:current.tokens[0],movement,destination:{col:4,row:1}})
  expect(levels()).toContain(20)
  expect(levels()).not.toContain(19)
  expect(dnd5eActivityContinuationTeleportCells({map:current,actorToken:current.tokens[0],movement})).toContainEqual({col:4,row:1})
  const apply=(elevationFeet:number)=>applyDnd5eActivityMapHandoffsV1({map:current,activity,packageId:'test',actionId:'floor',actorId:'actor',round:1,
    handoffs:{persistentAreas:[],summons:[],invocations:[],movements:[movement]},selection:{movementCellsByOperationId:{'land:target':{col:4,row:1,elevationFeet}}}})
  const result=apply(20)
  expect(result.ok).toBe(true)
  if(result.ok)expect(result.map.tokens.find(t=>t.id==='target')?.elevationFeet).toBe(20)
  current.tokens.push({...token(current,'downstairs',4,1,'enemy'),elevationFeet:0})
  expect(apply(20).ok).toBe(true)
  current.tokens[current.tokens.length-1].elevationFeet=20
  expect(apply(20).ok).toBe(false)
  current.tokens[current.tokens.length-1].elevationFeet=15
  expect(apply(20).ok).toBe(true)
  current.tokens[current.tokens.length-1].elevationFeet=16
  expect(apply(20).ok).toBe(false)
  current.tokens.pop()
  expect(apply(21).ok).toBe(false)
  expect(apply(Number.NaN).ok).toBe(false)
  geometry.obstacles[0].points[1].x=225;geometry.obstacles[0].points[2].x=225
  setMapGeometryRuntime([geometry])
  expect(apply(20).ok).toBe(false)
  geometry.obstacles=[];setMapGeometryRuntime([geometry])
  expect(apply(20).ok).toBe(false)
})

it('lands ground teleports at destination terrain and measures range from the caster', () => {
  const current = { ...map(), width: 2000, height: 1000 }
  current.tokens = [{ ...token(current, 'actor', 10, 1, 'player'), visionRangeFeet: 200, elevationFeet: 20 },
    { ...token(current, 'target', 4, 1, 'enemy'), elevationFeet: 200 }]
  const geometry = createEmptyMapGeometry(current.id)
  geometry.vision.ambientLight = 'bright'
  geometry.obstacles.push({ id: 'raised-ground', kind: 'obstacle', label: 'Ground',
    points: [{ x: 1700, y: 50 }, { x: 1800, y: 50 }, { x: 1800, y: 100 }, { x: 1700, y: 100 }],
    baseHeightFeet: 0, heightFeet: 0, terrainRegion: true, terrainElevationFeet: 20,
    blocksMovement: false, blocksVision: false, blocksLineOfEffect: false, cover: 'none', createdAt: 1 })
  setMapGeometryRuntime([geometry])
  const movement = { kind: 'move' as const, operationId: 'scatter', targetId: 'target',
    mode: 'teleport' as const, distanceFeet: 150, maximumDistanceFromActorFeet: 120,
    verticalDestination: 'ground' as const, requiresVisibleDestination: true }
  const apply = (col: number) => applyDnd5eActivityMapHandoffsV1({ map: current, activity,
    packageId: 'test', actionId: 'scatter', actorId: 'actor', round: 1,
    handoffs: { persistentAreas: [], summons: [], invocations: [], movements: [movement] },
    selection: { movementCellsByOperationId: { scatter: { col, row: 1 } } } })
  const before = structuredClone(current)
  const result = apply(34)
  expect(result).toMatchObject({ ok: true })
  if (!result.ok) throw Error('Ground teleport failed')
  expect(result.map.tokens.find(t => t.id === 'target')).toMatchObject({ x: 1725, y: 75, elevationFeet: 20 })
  expect(current).toEqual(before)
  expect(dnd5eActivityContinuationTeleportCells({ map: current, actorToken: current.tokens[0], movement }))
    .toContainEqual({ col: 34, row: 1 })
  expect(apply(35)).toMatchObject({ ok: false, reason: 'invalid-movement-placement' })
  current.tokens.push(token(current, 'occupant', 34, 1, 'enemy'))
  expect(apply(34)).toMatchObject({ ok: false, reason: 'invalid-movement-placement' })
  const sameCell = apply(4)
  expect(sameCell.ok).toBe(true)
  if (sameCell.ok) expect(sameCell.map.tokens.find(t => t.id === 'target')?.elevationFeet).toBe(0)
})

it('filters visible teleport cells and rechecks changed vision at placement without mutating the map',()=>{
  const current=map(),viewer=current.tokens[0]
  const hero=normalizeCharacter({id:'actor',name:'Actor',charClass:'战士',level:5,race:'人类'})
  const geometry=createEmptyMapGeometry(current.id);geometry.vision.ambientLight='darkness';setMapGeometryRuntime([geometry])
  const movement={kind:'move' as const,operationId:'teleport',targetId:'actor',mode:'teleport' as const,distanceFeet:60,requiresVisibleDestination:true}
  const cells=()=>dnd5eActivityContinuationTeleportCells({map:current,actorToken:viewer,movement,characters:[hero]})
  const apply=(requiresVisibleDestination=true)=>applyDnd5eActivityMapHandoffsV1({map:current,characters:[hero],activity,packageId:'test',actionId:'teleport',actorId:'actor',round:1,handoffs:{persistentAreas:[],summons:[],invocations:[],movements:[{...movement,requiresVisibleDestination}]},selection:{movementCellsByOperationId:{teleport:{col:4,row:1}}}})
  expect(cells()).not.toContainEqual({col:4,row:1})
  expect(apply()).toMatchObject({ok:false,reason:'invalid-movement-placement'})
  expect(apply(false).ok).toBe(true)
  viewer.darkvisionRangeFeet=15
  expect(cells()).toContainEqual({col:4,row:1})
  expect(apply().ok).toBe(true)
  hero.conditions=['blinded']
  const before=structuredClone(current)
  expect(apply()).toMatchObject({ok:false,reason:'invalid-movement-placement'})
  expect(current).toEqual(before)
  expect(cells()).not.toContainEqual({col:4,row:1})
  viewer.blindsightRangeFeet=15
  expect(apply().ok).toBe(true)
  viewer.blindsightRangeFeet=10
  expect(apply().ok).toBe(false)
})

it('rechecks summon range, occupancy and sight on the authoritative placement map', () => {
  const current = map()
  const hero = normalizeCharacter({ id: 'actor', name: 'Actor', charClass: '战士', level: 5, race: '人类' })
  const proposal = { kind: 'summon' as const, operationId: 'wolf', monsterId: 'srd-5.1:wolf', count: 1,
    timing: 'immediate' as const, durationRounds: 10, concentration: false, side: 'ally' as const,
    placementRangeFeet: 60, requiresVisiblePlacement: true }
  const apply = (col: number, overrides: Partial<typeof proposal> = {}) => applyDnd5eActivityMapHandoffsV1({
    map: current, characters: [hero], activity, packageId: 'test.summon', actionId: 'placement', actorId: 'actor', round: 1,
    handoffs: { summons: [{ ...proposal, ...overrides }], persistentAreas: [], movements: [], invocations: [] },
    selection: { summonCells: [{ col, row: 1 }], summonInitiativeD20s: [10] },
  })
  const geometry = createEmptyMapGeometry(current.id)
  geometry.vision.ambientLight = 'bright'
  setMapGeometryRuntime([geometry])
  expect(apply(13).ok).toBe(true)
  expect(apply(14)).toMatchObject({ ok: false, reason: 'invalid-summon-placement' })
  expect(apply(2).ok).toBe(false)
  expect(apply(7, { placementRangeFeet: undefined }).ok).toBe(true)
  expect(apply(8, { placementRangeFeet: undefined }).ok).toBe(false)
  for (const placementRangeFeet of [-1, 1.5, NaN, Infinity, 100001]) expect(apply(4, { placementRangeFeet }).ok).toBe(false)
  geometry.vision.ambientLight = 'darkness'
  setMapGeometryRuntime([geometry])
  expect(apply(4).ok).toBe(false)
  expect(apply(4, { requiresVisiblePlacement: false }).ok).toBe(true)
  current.tokens[0].darkvisionRangeFeet = 15
  expect(apply(4).ok).toBe(true)
  hero.conditions = ['blinded']
  const before = structuredClone(current)
  expect(apply(4).ok).toBe(false)
  expect(current).toEqual(before)
})

it('previews each summon using its own sight, range and selected batch occupancy', () => {
  const current = map()
  current.width = 400
  current.height = 400
  const hero = normalizeCharacter({ id: 'actor', name: 'Actor', charClass: '战士', level: 5, race: '人类' })
  const geometry = createEmptyMapGeometry(current.id)
  geometry.vision.ambientLight = 'darkness'
  setMapGeometryRuntime([geometry])
  const summons: Dnd5eActivityAuthorityHandoffs['summons'] = [
    { kind: 'summon', operationId: 'first', monsterId: 'srd-5.1:wolf', count: 1, timing: 'immediate',
      durationRounds: 1, concentration: false, side: 'ally', persistent: true, placementRangeFeet: 15, requiresVisiblePlacement: true },
    { kind: 'summon', operationId: 'second', monsterId: 'srd-5.1:wolf', count: 1, timing: 'immediate',
      durationRounds: 1, concentration: false, side: 'ally', persistent: true, placementRangeFeet: 5 },
  ]
  const cells = (selectedCells: { col: number; row: number }[] = []) => dnd5eActivitySummonPlacementCells({
    map: current, characters: [hero], activity, packageId: 'test.preview', actorId: 'actor', summons, selectedCells,
  })
  expect(cells()).toEqual([])
  current.tokens[0].darkvisionRangeFeet = 15
  const before = structuredClone(current)
  expect(cells()).toContainEqual({ col: 4, row: 1 })
  expect(cells()).not.toContainEqual({ col: 5, row: 1 })
  expect(cells()).not.toContainEqual({ col: 2, row: 1 })
  const second = cells([{ col: 4, row: 1 }])
  expect(second).toContainEqual({ col: 2, row: 2 })
  expect(second).not.toContainEqual({ col: 4, row: 2 })
  expect(second).not.toContainEqual({ col: 4, row: 1 })
  expect(cells([{ col: 4, row: 1 }, { col: 2, row: 2 }])).toEqual([])
  hero.conditions = ['blinded']
  expect(cells([{ col: 4, row: 1 }])).toEqual([])
  expect(current).toEqual(before)
})

it.each(['srd-5.1:wolf', 'srd-5.1:dire-wolf', 'srd-5.1:mammoth'])('bounds summon preview without dropping edge placements: %s', monsterId => {
  const current = map()
  current.width = 500
  current.height = 500
  current.gridOffsetX = 7
  current.gridOffsetY = 11
  current.tokens[0] = { ...token(current, 'actor', 4, 4, 'player'), size: 2 }
  const summon: Dnd5eActivityAuthorityHandoffs['summons'][number] = {
    kind: 'summon', operationId: 'bounded', monsterId, count: 1, timing: 'immediate', durationRounds: 10,
    concentration: false, side: 'ally', placementRangeFeet: 5,
  }
  const expected: { col: number; row: number }[] = []
  for (let row = 0; row < 10; row++) for (let col = 0; col < 10; col++) {
    const placed = applyDnd5eActivityMapHandoffsV1({ map: current, activity, actorId: 'actor', packageId: 'test.bounds',
      actionId: 'reference', round: 1, handoffs: { summons: [summon], persistentAreas: [], movements: [], invocations: [] },
      selection: { summonCells: [{ col, row }], summonInitiativeD20s: [10] } })
    if (placed.ok) expected.push({ col, row })
  }
  expect(expected.length).toBeGreaterThan(0)
  expect(dnd5eActivitySummonPlacementCells({ map: current, activity, actorId: 'actor', packageId: 'test.bounds',
    summons: [summon], selectedCells: [] })).toEqual(expected)
})

it('keeps short-range summon previews local on a 400-million-cell map', () => {
  const current = map()
  const input = { activity, actorId: 'actor', packageId: 'test.bounds', selectedCells: [],
    summons: [{ kind: 'summon' as const, operationId: 'bounded', monsterId: 'srd-5.1:wolf', count: 1,
      timing: 'immediate' as const, durationRounds: 10, concentration: false, side: 'ally' as const, placementRangeFeet: 10 }] }
  const expected = dnd5eActivitySummonPlacementCells({ ...input, map: current })
  expect(expected.length).toBeGreaterThan(0)
  const huge = { ...current, width: 1000000, height: 1000000 }
  expect(dnd5eActivitySummonPlacementCells({ ...input, map: huge })).toEqual(expected)
})

describe('unified Activity production map interaction', () => {
  it('captures a condition-only area DC and rejects missing Host DC without changing the map', () => {
    const current = map()
    const before = structuredClone(current)
    const areaSelection = resolveDnd5eActivityAreaMapSelectionV1({ activity, map: current, actorToken: current.tokens[0]!, anchorCell: { col: 2, row: 1 }, rectRotation: 0 })!
    const handoffs: Dnd5eActivityAuthorityHandoffs = { summons: [], movements: [], invocations: [], persistentAreas: [{
      kind: 'create-persistent-area', operationId: 'trap', label: 'Synthetic trap', durationRounds: 4800, concentration: false,
      areaInstance: { ...areaSelection.areaPlacement, origin: 'point', shape: 'rect' },
      triggers: [{ id: 'enter', label: 'Enter', timing: 'on-enter', condition: { condition: 'restrained',
        duration: { expiresAt: 'target-turn-end-save', remainingRounds: 4800, saveAbility: 'dex', saveDc: 'source-save-dc' },
        escapeCheck: { ability: 'str', dc: 'source-save-dc', economy: 'action' } } }],
    }] }
    const run = (sourceSaveDc?: number) => applyDnd5eActivityMapHandoffsV1({ map: current, activity, packageId: 'local.dc',
      actionId: 'trap-dc', actorId: 'actor', round: 1, handoffs, areaSelection, selection: {}, sourceSaveDc })
    for (const dc of [undefined, Number.NaN, 0, 41]) expect(run(dc)).toMatchObject({ ok: false, reason: 'invalid-persistent-area' })
    const result = run(17)
    expect(result.ok, JSON.stringify(result)).toBe(true)
    if (!result.ok) throw Error('Missing map')
    const restored = migrateMapsState(JSON.parse(JSON.stringify({ maps: [result.map] }))).maps[0]
    expect(restored.dnd5ePluginAreas?.[0].triggers?.[0].condition).toMatchObject({
      duration: { saveDc: 17 }, escapeCheck: { dc: 17 },
    })
    expect(current).toEqual(before)
  })
  it.each([0, 1, 2, 3])('retains authoritative rectangular dimensions and orientation across map persistence (%s)', rotation => {
    const current = map()
    const selected = resolveDnd5eActivityAreaMapSelectionV1({ activity, map: current, actorToken: current.tokens[0]!, anchorCell: { col: 5, row: 5 }, rectRotation: rotation })!
    expect(selected).toBeDefined()
    const directions = [{ dc: 0, dr: -1 }, { dc: 1, dr: 0 }, { dc: 0, dr: 1 }, { dc: -1, dr: 0 }]
    expect(selected.rectGeometry).toEqual({ widthFeet: 10, lengthFeet: 20, gridAligned: false, direction: directions[rotation] })
    const expectedGeometry = selected.rectGeometry
    // Production UI handoffs may rebuild the selection from the resolved area placement.
    if (rotation === 1) delete selected.rectGeometry
    const before = JSON.stringify(current)
    const result = applyDnd5eActivityMapHandoffsV1({ map: current, activity, packageId: 'local.geometry', actionId: 'cast', actorId: 'actor', round: 1, selection: {}, areaSelection: selected,
      handoffs: { persistentAreas: [{ kind: 'create-persistent-area', operationId: 'wall', label: 'Wall', durationRounds: 10, concentration: true, areaInstance: { ...selected.areaPlacement, shape: 'rect', origin: 'point' } }], summons: [], movements: [], invocations: [] } })
    expect(result.ok, JSON.stringify(result)).toBe(true)
    if (!result.ok) return
    const restored = migrateMapsState(JSON.parse(JSON.stringify({ maps: [result.map] }))).maps[0]
    expect(restored.dnd5ePluginAreas?.[0]?.rectGeometry).toEqual(expectedGeometry)
    expect(restored.dnd5ePluginAreas?.[0]?.cells).toEqual(selected.cells)
    expect(result.map.dnd5ePluginAreas?.[0]?.rectGeometry).not.toBe(selected.rectGeometry)
    expect(JSON.stringify(current)).toBe(before)
  })

  it('measures area placement from the owned granting area and rejects ambiguous grants', () => {
    const current = map()
    const move: Dnd5eActivityDefinitionV1 = { ...activity, target: {
      kind: 'area', relation: 'any', origin: 'point', shape: 'cube', rangeOrigin: 'granting-area',
      placeRangeFeet: 30, lengthFeet: 5, widthFeet: 5, heightFeet: 5, maximumTargets: 1,
    } }
    current.dnd5ePluginAreas = [{ id: 'spirit', pluginId: 'test', featureId: 'test:spirit', label: 'spirit', color: '#fff', sourceTokenId: 'actor', sourceCharacterId: 'actor', cells: [{ col: 10, row: 1 }], anchorCell: { col: 10, row: 1 }, createdRound: 1, expiresAfterRound: 11, grantedActivities: [{ activityId: move.id }] }]
    const select = (col: number, grantingPersistentAreaId?: string) => resolveDnd5eActivityAreaMapSelectionV1({ activity: move, map: current, actorToken: current.tokens[0], anchorCell: { col, row: 1 }, grantingPersistentAreaId })
    expect(select(11)?.areaPlacementDistanceFeet).toBe(5)
    expect(select(17)).toBeUndefined()
    current.dnd5ePluginAreas.push({ ...current.dnd5ePluginAreas[0], id: 'other-spirit' })
    expect(select(11)).toBeUndefined()
    expect(select(11, 'spirit')).toBeDefined()
    current.dnd5ePluginAreas[0].sourceTokenId = 'other-caster'
    expect(select(11, 'spirit')).toBeUndefined()
  })
  it('keeps the summon ward fixed, blocks only its demon, and refreshes protection after movement', () => {
    const current=map()
    const result=applyDnd5eActivityMapHandoffsV1({map:current,activity,packageId:'local.test',actionId:'ward',actorId:'actor',round:1,handoffs:{summons:[{kind:'summon',operationId:'demon',monsterId:'srd-5.1:dretch',count:1,timing:'immediate',durationRounds:600,concentration:true,side:'ally',protectiveCircle:true}],persistentAreas:[],movements:[],invocations:[]},selection:{summonCells:[{col:4,row:1}],summonInitiativeD20s:[12]}})
    expect(result.ok,JSON.stringify(result)).toBe(true);if(!result.ok)return
    const demon=result.map.tokens.find(token=>token.dnd5eSummon)!, caster=result.map.tokens[0]
    expect(dnd5ePersistentWardProtectedFrom(result.map,caster)).toEqual([demon.id])
    expect(mapGeometryMovementBlocked({map:result.map,token:demon,to:caster}).blocked).toBe(true)
    expect(mapGeometryMovementBlocked({map:result.map,token:result.map.tokens[1],to:caster}).blocked).toBe(false)
    const character=normalizeCharacter({id:'actor',name:'Caster',currentHp:30,maxHp:30})
    const snapshot=createDnd5eMapCombatSnapshot({combatId:'ward',map:result.map,characters:[character],initiativeOrder:[result.initiativeEntries[0],{tokenId:caster.id,label:'Caster',emoji:'',color:'',roll:1}]})
    expect(snapshot.state.combatants[caster.id].protectedFromActorIds).toEqual([demon.id])
    expect(resolveDnd5eHeadlessAction(snapshot.state,{type:'attack',actorId:demon.id,targetId:caster.id,attackModifier:4,d20:20,damage:{count:1,sides:6,bonus:2,rolls:[3],type:'slashing'}})).toMatchObject({ok:false,reason:'invalid-target'})
    snapshot.state.combatants[caster.id].position={x:375,y:75}
    refreshDnd5eMapSpatialRelations(snapshot.state,result.map)
    expect(snapshot.state.combatants[caster.id].protectedFromActorIds).toEqual([])
    expect(result.map.dnd5ePluginAreas![0].cells).toEqual([{col:1,row:1}])
  })
  it.each(['skeleton', 'zombie'])('retains %s summon attack and damage bonuses through map serialization and actual attacks', slug => {
    const current = map()
    current.tokens[1] = { ...current.tokens[1], hp: 0, maxHp: 10, creatureSize: '中型' }
    current.tokens.push({ ...token(current, 'victim', 3, 1, 'enemy'), poolId: 'srd-5.1:goblin', hp: 30, maxHp: 30 })
    const original = structuredClone(current)
    const run = (bonus: number) => {
      const placed = applyDnd5eActivityMapHandoffsV1({ map: current, activity, packageId: 'local.test',
        actionId: 'bonus-test', actorId: 'actor', round: 1,
        handoffs: { summons: [{ kind: 'summon', operationId: 'animate', monsterId: `srd-5.1:${slug}`,
          corpseTokenId: 'target', count: 1, timing: 'immediate', durationRounds: 600, concentration: true,
          side: 'ally', commandPolicy: 'persistent-order', weaponAttackBonus: bonus, weaponDamageBonus: bonus }],
          persistentAreas: [], movements: [], invocations: [] }, selection: { summonInitiativeD20s: [12] } })
      expect(placed.ok, JSON.stringify(placed)).toBe(true)
      if (!placed.ok) throw new Error('summon placement failed')
      const restored = JSON.parse(JSON.stringify(placed.map)) as BattleMap
      const attacker = restored.tokens.find(entry => entry.dnd5eSummon)!
      attacker.dnd5eCombatState = { ...attacker.dnd5eCombatState, companionCommand: {
        schemaVersion: 1, sourceOwnerId: 'actor', sourceFeatureId: attacker.dnd5eSummon!.featureId,
        command: 'attack', issuedRound: 1, persistentOrder: true,
      } }
      const prepared = prepareDnd5eMonsterAttack({ combatId: 'bonus-test', map: restored, characters: [],
        actorTokenId: attacker.id, targetTokenId: 'victim', actionIndex: 0,
        initiativeOrder: [attacker, restored.tokens.find(entry => entry.id === 'victim')!].map((entry, index) => ({
          tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
        })) })
      expect(prepared.ok, JSON.stringify(prepared)).toBe(true)
      if (!prepared.ok) throw new Error('attack preparation failed')
      const resolved = resolvePreparedDnd5eMonsterAttack({ prepared: prepared.prepared,
        rolls: prepared.prepared.attacks.map(() => ({ d20: 15, damageRolls: [[3]] })) })
      expect(resolved.result.ok, JSON.stringify(resolved.result)).toBe(true)
      if (!resolved.result.ok) throw new Error('attack settlement failed')
      const attack = resolved.result.events.find(event => event.type === 'attack-resolved')
      if (attack?.type !== 'attack-resolved') throw new Error('missing attack event')
      return { total: attack.total, hp: resolved.result.state.combatants.victim.currentHp }
    }
    const baseline = run(0), boosted = run(4)
    expect(boosted.total - baseline.total).toBe(4)
    expect(baseline.hp - boosted.hp).toBe(4)
    expect(current).toEqual(original)
  })
  it.each(['concentration', 'expiry', 'defeat', 'dismissal'] as const)('animates mixed corpses and restores bodies after %s', ending => {
    const current=map()
    current.tokens[1]={...current.tokens[1],hp:0,maxHp:10,creatureSize:'中型'}
    current.tokens.push({...token(current,'corpse-two',4,1,'enemy'),hp:0,maxHp:8,creatureSize:'小型'})
    const original=structuredClone(current)
    const summons=['skeleton','zombie'].map((slug,index)=>({kind:'summon' as const,operationId:'animate',monsterId:`srd-5.1:${slug}`,corpseTokenId:index===0?'target':'corpse-two',count:1,timing:'immediate' as const,durationRounds:600,concentration:true,side:'ally' as const,groupInitiative:true,commandPolicy:'persistent-order' as const}))
    const result=applyDnd5eActivityMapHandoffsV1({map:current,activity,packageId:'local.test',actionId:'mixed',actorId:'actor',round:1,handoffs:{summons,persistentAreas:[],movements:[],invocations:[]},selection:{summonInitiativeD20s:[12]}})
    expect(result.ok).toBe(true)
    expect(current).toEqual(original)
    if(!result.ok)return
    expect(result.removedTokenIds).toEqual(['target','corpse-two'])
    expect(result.initiativeEntries.map(entry=>entry.roll)).toEqual([14,14])
    const summoned=result.map.tokens.filter(token=>token.dnd5eSummon)
    expect(summoned.map(token=>token.poolId)).toEqual(['srd-5.1:skeleton','srd-5.1:zombie'])
    expect(summoned[0]).toMatchObject({x:original.tokens[1].x,y:original.tokens[1].y})
    expect(summoned[1].dnd5eSummon?.commandPolicy).toBe('persistent-order')
    const restored = JSON.parse(JSON.stringify(result.map)) as BattleMap
    const owner = restored.tokens.find(entry => entry.id === 'actor')!
    owner.dnd5eCombatState = { concentrationSpellId: summoned[0].dnd5eSummon!.concentrationId }
    expect(reconcileDnd5eSummonedCreatures({ map: restored, characters: [], round: 600 }).removedTokenIds).toEqual([])
    const movedSummons = restored.tokens.filter(entry => entry.dnd5eSummon)
    for (const entry of movedSummons) {
      entry.x += 100
      entry.y += 50
      entry.elevationFeet = 20
      if (ending === 'defeat') entry.hp = 0
      if (ending === 'dismissal') entry.dnd5eSummon!.dismissed = true
    }
    if (ending === 'concentration') owner.dnd5eCombatState = {}
    const beforeEnd = structuredClone(restored)
    const ended=reconcileDnd5eSummonedCreatures({map:restored,characters:[],round:ending === 'expiry' ? 601 : 2})
    expect(ended.map.tokens.map(token=>token.id)).toEqual(['actor','target','corpse-two'])
    expect(ended.map.tokens.slice(1).map(token=>token.hp)).toEqual([0,0])
    for (const [index, body] of ended.map.tokens.slice(1).entries()) {
      expect(body).toMatchObject({ x: movedSummons[index].x, y: movedSummons[index].y, elevationFeet: 20 })
      expect(body.dnd5eSummon).toBeUndefined()
    }
    expect(restored).toEqual(beforeEnd)
    const again = reconcileDnd5eSummonedCreatures({ map: JSON.parse(JSON.stringify(ended.map)), characters: [], round: 602 })
    expect(again.removedTokenIds).toEqual([])
    expect(again.map.tokens).toHaveLength(3)
    const invalid=applyDnd5eActivityMapHandoffsV1({map:original,activity,packageId:'local.test',actionId:'invalid',actorId:'actor',round:1,handoffs:{summons:[summons[0],{...summons[1],corpseTokenId:'missing'}],persistentAreas:[],movements:[],invocations:[]},selection:{summonInitiativeD20s:[12]}})
    expect(invalid.ok).toBe(false)
    expect(original).toEqual(current)
  })
  it('derives follow-up distance from the actual destination, including an unmoved target', () => {
    const before = map()
    before.tokens[1] = token(before, 'target', 4, 1, 'enemy')
    const movement = { kind: 'move' as const, operationId: 'pull', targetId: 'target', mode: 'pull' as const, distanceFeet: 10 }
    const after = { ...before, tokens: [before.tokens[0], token(before, 'target', 2, 1, 'enemy')] }
    expect(dnd5eActivityMapMovementEvents({ before, after, actorId: 'actor', activityId: 'pull-test', movements: [movement] }))
      .toEqual([expect.objectContaining({ type: 'moved', actorId: 'target', movementKind: 'forced',
        distance: 10, distanceFromSourceFeet: 5, sourceActorId: 'actor', activityId: 'pull-test' })])
    expect(dnd5eActivityMapMovementEvents({ before, after: before, actorId: 'actor', activityId: 'pull-test', movements: [movement] }))
      .toEqual([expect.objectContaining({ distance: 0, distanceFromSourceFeet: 15 })])
    expect(before.tokens[1]).toEqual(token(before, 'target', 4, 1, 'enemy'))
  })
  it.each([
    { mode: 'voluntary' as const, ignoresOpportunityAttacks: undefined, provokesOpportunityAttacks: undefined, expected: true },
    { mode: 'voluntary' as const, ignoresOpportunityAttacks: true, provokesOpportunityAttacks: undefined, expected: false },
    { mode: 'voluntary' as const, ignoresOpportunityAttacks: true, provokesOpportunityAttacks: true, expected: false },
    { mode: 'forced' as const, ignoresOpportunityAttacks: undefined, provokesOpportunityAttacks: undefined, expected: false },
  ])('preserves movement opportunity semantics: %j', ({ expected, ...movement }) => {
    const current = map()
    current.tokens[1] = token(current, 'target', 7, 1, 'enemy')
    const result = applyDnd5eActivityMapHandoffsV1({ map: current, activity, packageId: 'test.movement',
      actionId: 'move-opportunity', actorId: 'actor', round: 1,
      handoffs: { persistentAreas: [], summons: [], invocations: [], movements: [{ kind: 'move',
        operationId: 'move', targetId: 'target', distanceFeet: 15, ...movement }] },
      selection: { movementCellsByOperationId: { move: { col: 8, row: 1 } } } })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.movementPaths).toHaveLength(1)
    expect(result.movementPaths[0].provokesOpportunityAttacks).toBe(expected)
  })
  it('moves telekinetically in any planar direction, respecting movement and caster range limits', () => {
    const current = map()
    current.tokens[1] = token(current, 'target', 7, 1, 'enemy')
    const apply = (col: number, row: number) => applyDnd5eActivityMapHandoffsV1({
      map: current, activity, packageId: 'srd-5.1', actionId: 'tele-move', actorId: 'actor', round: 1,
      handoffs: { persistentAreas: [], summons: [], invocations: [], movements: [{
        kind: 'move', operationId: 'tele-move', targetId: 'target', mode: 'forced', distanceFeet: 30,
        maximumDistanceFromActorFeet: 60, ignoresOpportunityAttacks: true,
      }] }, selection: { movementCellsByOperationId: { 'tele-move': { col, row } } },
    })
    for (const [col, row] of [[7, 4], [4, 1], [13, 1], [7, 1]]) {
      const result = apply(col, row)
      expect(result.ok).toBe(true)
      if (result.ok) {
        const moved = result.map.tokens.find(t => t.id === 'target')!
        expect(moved).toMatchObject(cellToPixel({ col, row }, current))
        if (col !== 7 || row !== 1) {
          expect(moved.movementAnimation?.points[0]).toEqual({ x: current.tokens[1].x, y: current.tokens[1].y })
          expect(moved.movementAnimation?.points.at(-1)).toEqual({ x: moved.x, y: moved.y })
        } else expect(moved.movementAnimation).toBeUndefined()
      }
    }
    expect(apply(14, 1).ok).toBe(false)
    expect(apply(1, 1).ok).toBe(false)
    current.tokens[1] = token(current, 'target', 12, 1, 'enemy')
    expect(apply(14, 1).ok).toBe(false)
    const geometry = createEmptyMapGeometry(current.id, 1)
    geometry.doors.push({ id: 'door', kind: 'door', label: 'door',
      points: [{ x: 650, y: 0 }, { x: 650, y: 200 }], state: 'closed', openState: 'closed',
      lockState: 'unlocked', physicalState: 'intact', secret: false,
      blocksVision: true, blocksMovement: true, blocksLineOfEffect: true,
      baseHeightFeet: 0, heightFeet: 10, createdAt: 1 })
    setMapGeometryRuntime([geometry])
    expect(apply(13, 1).ok).toBe(false)
  })

  it('raises and lowers a non-flying Minotaur without exceeding the caster range', () => {
    const current = map()
    current.tokens[1].poolId = 'srd-5.1:minotaur'
    const apply = (mode: 'ascend' | 'descend') => applyDnd5eActivityMapHandoffsV1({
      map: current, activity, packageId: 'srd-5.1', actionId: 'tele-vertical', actorId: 'actor', round: 1,
      handoffs: { persistentAreas: [], summons: [], invocations: [], movements: [{
        kind: 'move', operationId: 'tele-move', targetId: 'target', mode, distanceFeet: 30,
        maximumDistanceFromActorFeet: 60,
      }] }, selection: {},
    })
    const raised = apply('ascend')
    expect(raised.ok).toBe(true)
    if (raised.ok) expect(raised.map.tokens[1].elevationFeet).toBe(30)
    current.tokens[1].elevationFeet = 50
    expect(apply('ascend').ok).toBe(false)
    const lowered = apply('descend')
    expect(lowered.ok).toBe(true)
    if (lowered.ok) expect(lowered.map.tokens[1].elevationFeet).toBe(20)
  })

  it('rejects vertical movement through overhead solids even without an actor-distance constraint', () => {
    const current = map(), geometry = createEmptyMapGeometry(current.id, 1)
    const subject = current.tokens[1]
    geometry.obstacles.push({ id: 'ceiling', kind: 'obstacle', label: 'Ceiling',
      points: [{ x: subject.x - 30, y: subject.y - 30 }, { x: subject.x + 30, y: subject.y - 30 },
        { x: subject.x + 30, y: subject.y + 30 }, { x: subject.x - 30, y: subject.y + 30 }],
      baseHeightFeet: 15, heightFeet: 1, blocksMovement: true, blocksVision: true,
      blocksLineOfEffect: true, cover: 'total', createdAt: 1 })
    setMapGeometryRuntime([geometry])
    const run = (stopAtMappedObstacle?: true) => applyDnd5eActivityMapHandoffsV1({ map: current, activity, packageId: 'test',
      actionId: 'vertical', actorId: 'actor', round: 1, selection: {}, handoffs: {
        persistentAreas: [], summons: [], invocations: [], movements: [{
          kind: 'move', operationId: 'lift', targetId: 'target', mode: 'ascend', distanceFeet: 30, stopAtMappedObstacle,
        }],
      } })
    expect(run()).toMatchObject({ ok: false, reason: 'invalid-movement-placement' })
    const stopped = run(true)
    expect(stopped.ok).toBe(true)
    if (stopped.ok) expect(stopped.map.tokens.find(t => t.id === 'target')?.elevationFeet).toBe(10)
    expect(subject.elevationFeet).toBeUndefined()
  })

  it('rebuilds a rotatable area and its affected targets from the Host map', () => {
    const current = map()
    const actor = current.tokens[0]!
    expect(dnd5eActivityMapTemplateV1(activity)).toMatchObject({
      shape: 'rect', widthFeet: 10, heightFeet: 20, rotatable: true,
    })
    const selected = resolveDnd5eActivityAreaMapSelectionV1({
      activity,
      map: current,
      actorToken: actor,
      anchorCell: { col: 2, row: 1 },
      rectRotation: 1,
    })
    expect(selected).toMatchObject({
      targetIds: ['target'],
      areaPlacementDistanceFeet: 5,
      areaPlacement: { angleDegrees: 90, widthFeet: 10, lengthFeet: 20, heightFeet: 5 },
    })
  })

  it('rejects an occupied creature-sized area anchor at selection and commit time', () => {
    const current = map()
    const actor = current.tokens[0]!
    const anchoredActivity: Dnd5eActivityDefinitionV1 = {
      ...activity,
      target: {
        kind: 'area', relation: 'enemy', origin: 'point', shape: 'circle',
        placeRangeFeet: 30, radiusFeet: 10, maximumTargets: 8,
        unoccupiedAnchorSizeFeet: 10,
      },
    }
    expect(resolveDnd5eActivityAreaMapSelectionV1({
      activity: anchoredActivity, map: current, actorToken: actor,
      anchorCell: { col: 2, row: 1 },
    })).toBeUndefined()

    const emptySelection = resolveDnd5eActivityAreaMapSelectionV1({
      activity: anchoredActivity, map: current, actorToken: actor,
      anchorCell: { col: 4, row: 1 },
    })!
    const occupiedAtCommit = structuredClone(current)
    occupiedAtCommit.tokens.push(token(occupiedAtCommit, 'late-occupant', 4, 1, 'enemy'))
    const result = applyDnd5eActivityMapHandoffsV1({
      map: occupiedAtCommit, activity: anchoredActivity,
      packageId: 'local.activity-test', actionId: 'occupied-anchor', actorId: actor.id,
      round: 1, areaSelection: emptySelection, selection: {},
      handoffs: {
        persistentAreas: [{
          kind: 'create-persistent-area', operationId: 'guardian', label: 'Guardian',
          durationRounds: 10, concentration: false,
          areaInstance: { ...emptySelection.areaPlacement, origin: 'point', shape: 'circle' },
        }],
        summons: [], movements: [], invocations: [],
      },
    })
    expect(result).toEqual({ ok: false, reason: 'invalid-persistent-area' })
  })

  it('atomically places persistent areas, multiple summons, and a validated push', () => {
    const current = map()
    const areaSelection = resolveDnd5eActivityAreaMapSelectionV1({
      activity,
      map: current,
      actorToken: current.tokens[0]!,
      anchorCell: { col: 2, row: 1 },
      rectRotation: 0,
    })!
    const handoffs: Dnd5eActivityAuthorityHandoffs = {
      persistentAreas: [{
        kind: 'create-persistent-area', operationId: 'zone', label: 'Storm zone',
        durationRounds: 3, concentration: true, areaInstance: {
          ...areaSelection.areaPlacement, origin: 'point', shape: 'rect',
        },
        utilityProjectionId: 'storm-projection',
        movementCostMultiplier: 2,
        movementRequiresGroundedSource: true,
        obscuration: { kind: 'heavy' },
        occupantModifiers: { preventsVerbalComponents: true, damageImmunities: ['thunder'] },
        blocking: { vision: true },
        teleportationExitSavingThrow: { ability: 'cha', dc: 'source-save-dc' },
        grantedActivities: [{ activityId: 'storm-control', activateOnCreate: true }],
        triggers: [{
          id: 'zone-turn-start', label: 'Zone damage', timing: 'turn-start', oncePerTurn: true,
          savingThrow: { ability: 'dex', dc: 'source-save-dc', onSuccess: 'half', magical: true },
          condition: { condition: 'restrained', duration: { expiresAt: 'target-turn-end-save', saveAbility: 'dex', saveDc: 'source-save-dc' },
            escapeCheck: { ability: 'str', dc: 'source-save-dc', economy: 'action' } },
          damage: { count: 1, sides: 6, type: 'lightning' },
        }],
      }],
      summons: [{
        kind: 'summon', operationId: 'wolves', monsterId: 'srd-5.1:wolf', count: 2,
        timing: 'immediate', durationRounds: 3, concentration: false, side: 'ally',
        walkingSpeedFeet: 100, dismissAfterDamageRounds: 10,
      }],
      movements: [{ kind: 'move', operationId: 'push', targetId: 'target', mode: 'push', distanceFeet: 5 }],
      invocations: [],
    }
    const result = applyDnd5eActivityMapHandoffsV1({
      map: current,
      activity,
      packageId: 'local.activity-test',
      actionId: 'activity-action-1',
      actorId: 'actor',
      sourceSaveDc: 15,
      round: 2,
      handoffs,
      areaSelection,
      selection: {
        summonCells: [{ col: 4, row: 3 }, { col: 5, row: 3 }],
        summonInitiativeD20s: [12, 8],
        movementCellsByOperationId: { push: { col: 3, row: 1 } },
      },
    })
    expect(result.ok, JSON.stringify(result)).toBe(true)
    if (!result.ok) return
    expect(result.map.dnd5ePluginAreas).toHaveLength(1)
    expect(result.map.dnd5ePluginAreas?.[0]).toMatchObject({
      pluginId: 'local.activity-test', featureId: 'storm-zone', concentrationId: 'activity:storm-zone',
      sourceKind: 'plugin-feature', utilityProjectionId: 'storm-projection',
      movementCostMultiplier: 2,
      movementRequiresGroundedSource: true,
      obscuration: { kind: 'heavy' },
      occupantModifiers: {
        preventsVerbalComponents: true, damageImmunities: ['thunder'],
      },
      blocking: {
        vision: true,
        blocksTeleportationExit: true,
        teleportationExitSavingThrow: { ability: 'cha', dc: 15 },
      },
      grantedActivities: [{ activityId: 'storm-control', activateOnCreate: true }],
      triggers: [{
        id: 'zone-turn-start',
        savingThrow: { ability: 'dex', dc: 15, onSuccess: 'half' },
        condition: { duration: { saveDc: 15 }, escapeCheck: { dc: 15 } },
        damage: { count: 1, sides: 6, type: 'lightning' },
      }],
    })
    expect(result.map.tokens.filter((candidate) => candidate.dnd5eSummon)).toHaveLength(2)
    expect(result.map.tokens.find((candidate) => candidate.dnd5eSummon)?.dnd5eSummon).toMatchObject({
      walkingSpeedFeet: 100, dismissAfterDamageRounds: 10,
    })
    expect(result.initiativeEntries).toHaveLength(2)
    expect(result.initiativeEntries).toEqual([
      expect.objectContaining({
        roll: 14,
        initiativeCalculation: { rolls: [12], d20: 12, modifier: 2, mode: 'normal' },
      }),
      expect.objectContaining({
        roll: 10,
        initiativeCalculation: { rolls: [8], d20: 8, modifier: 2, mode: 'normal' },
      }),
    ])
    expect(result.map.tokens.find((candidate) => candidate.id === 'target')).toMatchObject(
      cellToPixel({ col: 3, row: 1 }, current),
    )
    expect(current.tokens).toHaveLength(2)
  })

  it.each(['one-operation', 'two-operations'] as const)('preserves the complete persistent summon batch: %s', shape => {
    const current = map()
    const old = { ...token(current, 'old-companion', 4, 4, 'enemy'), hp: 11, maxHp: 11,
      dnd5eSummon: { schemaVersion: 1 as const, pluginId: 'test.batch', featureId: activity.id,
        sourceCharacterId: 'actor', sourceTokenId: 'actor', createdRound: 1, expiresAfterRound: 999,
        side: 'player' as const, persistent: true as const } }
    current.tokens.push(old, { ...structuredClone(old), id: 'other-module', ...cellToPixel({ col: 8, row: 8 }, current),
      dnd5eSummon: { ...old.dnd5eSummon, pluginId: 'other.module' } })
    const before = structuredClone(current)
    const proposal = { kind: 'summon' as const, operationId: 'wolves', monsterId: 'srd-5.1:wolf', count: 2,
      timing: 'immediate' as const, durationRounds: 1, persistent: true, concentration: false, side: 'ally' as const }
    const summons = shape === 'one-operation' ? [proposal] : [
      { ...proposal, count: 1 }, { ...proposal, count: 1, operationId: 'second' },
    ]
    const apply = (secondCol: number) => applyDnd5eActivityMapHandoffsV1({ map: current, activity,
      packageId: 'test.batch', actionId: 'batch', actorId: 'actor', round: 2,
      handoffs: { summons, persistentAreas: [], movements: [], invocations: [] },
      selection: { summonCells: [{ col: 3, row: 3 }, { col: secondCol, row: 3 }], summonInitiativeD20s: [15, 10] },
    })
    const result = apply(4)
    expect(result.ok, JSON.stringify(result)).toBe(true)
    if (!result.ok) throw Error(result.reason)
    const created = result.map.tokens.filter(candidate => candidate.dnd5eSummon?.pluginId === 'test.batch')
    expect(created).toHaveLength(2)
    expect(new Set(created.map(candidate => candidate.id)).size).toBe(2)
    expect(result.initiativeEntries.map(entry => entry.tokenId).sort()).toEqual(created.map(candidate => candidate.id).sort())
    expect(result.removedTokenIds).toEqual(['old-companion'])
    expect(result.map.tokens.find(candidate => candidate.id === 'other-module')).toEqual(before.tokens.find(candidate => candidate.id === 'other-module'))
    expect(apply(3)).toMatchObject({ ok: false, reason: 'invalid-summon-placement' })
    expect(current).toEqual(before)
    const restored = migrateMapsState(JSON.parse(JSON.stringify({ maps: [result.map] }))).maps[0]
    expect(restored.tokens.filter(candidate => candidate.dnd5eSummon?.pluginId === 'test.batch')).toHaveLength(2)
  })

  it('rejects a summon with missing catalog data without adding tokens', () => {
    const current = map()
    const before = structuredClone(current)
    const result = applyDnd5eActivityMapHandoffsV1({
      map: current, activity, packageId: 'local.activity-test', actionId: 'missing-summon', actorId: 'actor', round: 1,
      handoffs: { persistentAreas: [], movements: [], invocations: [], summons: [{ kind: 'summon', operationId: 'missing', monsterId: 'local.missing:monster', count: 1, timing: 'immediate', durationRounds: 10, concentration: false, side: 'ally' }] },
      selection: { summonCells: [{ col: 4, row: 3 }], summonInitiativeD20s: [10] },
    })
    expect(result.ok).toBe(false)
    expect(current).toEqual(before)
  })

  it.each([false,true])('replaces a same-source summon and drops possessions on recast (persistent=%s)', async persistent => {
    const current = map()
    current.tokens.push({
      ...token(current, 'old-celestial', 4, 4, 'enemy'),
      hp: 59,
      maxHp: 59,
      dnd5eCarriedObjects: [{id:'marked-stone',pickupReceipt:'pickup-stone',label:'Marked stone',objectState:{
        schemaVersion:1,wornOrCarried:true,
        inventoryItem:{templateId:'srd-5.1:item:holy-water-flask',quantity:1,receiptId:'stone-original'},
        surfaceProfile:{surfaceId:'original-stone',material:'stone',widthFeet:1,lengthFeet:1,heightFeet:1,rotationDegrees:0},
      }}],
      dnd5eSummon: {
        schemaVersion: 1,
        pluginId: 'srd-5.1',
        featureId: 'spell:conjure-celestial',
        sourceCharacterId: 'actor',
        sourceTokenId: 'actor',
        createdRound: 1,
        expiresAfterRound: 600,
        concentrationId: persistent ? undefined : 'conjure-celestial',
        persistent: persistent ? true : undefined,
        side: 'player',
      },
    })
    const conjureActivity: Dnd5eActivityDefinitionV1 = {
      ...activity,
      id: 'spell:conjure-celestial',
      name: 'Conjure Celestial',
    }
    const result = applyDnd5eActivityMapHandoffsV1({
      map: current,
      activity: conjureActivity,
      packageId: 'srd-5.1',
      actionId: 'new-celestial-cast',
      actorId: 'actor',
      concentrationId: 'conjure-celestial',
      round: 2,
      handoffs: {
        persistentAreas: [],
        summons: [{
          kind: 'summon',
          operationId: 'celestial',
          monsterId: 'srd-5.1:unicorn',
          count: 1,
          timing: 'immediate',
          durationRounds: 600,
          concentration: !persistent,
          persistent,
          side: 'ally',
        }],
        movements: [],
        invocations: [],
      },
      selection: {
        summonCells: [{ col: 6, row: 6 }],
        summonInitiativeD20s: [12],
      },
    })
    expect(result.ok, JSON.stringify(result)).toBe(true)
    if (!result.ok) return
    expect(result.removedTokenIds).toEqual(['old-celestial'])
    expect(result.map.tokens.find(candidate=>candidate.id==='carried:marked-stone')).toMatchObject({
      type:'obstacle',x:current.tokens.find(candidate=>candidate.id==='old-celestial')!.x,
      y:current.tokens.find(candidate=>candidate.id==='old-celestial')!.y,
      dnd5eObjectState:{wornOrCarried:false,surfaceProfile:{surfaceId:'original-stone'}},
    })
    expect(result.changedTokenIds).toContain('carried:marked-stone')
    expect(current.tokens.find(candidate=>candidate.id==='old-celestial')!.dnd5eCarriedObjects).toHaveLength(1)
    const {rebaseDnd5ePluginFeatureApplication}=await import('../pluginFeatureAction')
    const rebased=rebaseDnd5ePluginFeatureApplication({baseMap:current,latestMap:current,baseCharacters:[],latestCharacters:[],
      removedTokenIds:result.removedTokenIds,application:{map:result.map,characters:[],changedCharacterIds:[],changedTokenIds:result.changedTokenIds}})
    expect(rebased.ok).toBe(true)
    if(rebased.ok){
      expect(rebased.application.map.tokens.some(candidate=>candidate.id==='old-celestial')).toBe(false)
      expect(rebased.application.map.tokens.filter(candidate=>candidate.id==='carried:marked-stone')).toHaveLength(1)
    }
    expect(result.map.tokens.some((candidate) => candidate.id === 'old-celestial')).toBe(false)
    expect(result.map.tokens.filter((candidate) => candidate.dnd5eSummon)).toHaveLength(1)
    expect(result.map.tokens.find((candidate) => candidate.dnd5eSummon)?.poolId)
      .toBe('srd-5.1:unicorn')
  })

  it('turns a prior Conjure Elemental summon hostile instead of removing it on recast', () => {
    const current = map()
    current.tokens.push({
      ...token(current, 'old-elemental', 4, 4, 'enemy'),
      hp: 102,
      maxHp: 102,
      dnd5eSummon: {
        schemaVersion: 1,
        pluginId: 'srd-5.1',
        featureId: 'spell:conjure-elemental',
        sourceCharacterId: 'actor',
        sourceTokenId: 'actor',
        createdRound: 1,
        expiresAfterRound: 600,
        concentrationId: 'conjure-elemental',
        side: 'player',
        becomesHostileAfterConcentrationEnds: true,
      },
    })
    const conjureActivity: Dnd5eActivityDefinitionV1 = {
      ...activity,
      id: 'spell:conjure-elemental',
      name: 'Conjure Elemental',
    }
    const result = applyDnd5eActivityMapHandoffsV1({
      map: current,
      activity: conjureActivity,
      packageId: 'srd-5.1',
      actionId: 'new-elemental-cast',
      actorId: 'actor',
      concentrationId: 'conjure-elemental',
      round: 2,
      handoffs: {
        persistentAreas: [],
        summons: [{
          kind: 'summon', operationId: 'elemental',
          monsterId: 'srd-5.1:invisible-stalker', count: 1,
          timing: 'immediate', durationRounds: 600,
          concentration: true, side: 'ally',
          becomesHostileAfterConcentrationEnds: true,
        }],
        movements: [], invocations: [],
      },
      selection: {
        summonCells: [{ col: 7, row: 6 }],
        summonInitiativeD20s: [12],
      },
    })
    expect(result.ok, JSON.stringify(result)).toBe(true)
    if (!result.ok) return
    expect(result.removedTokenIds).toEqual([])
    expect(result.map.tokens.find((candidate) => candidate.id === 'old-elemental')?.dnd5eSummon)
      .toMatchObject({ side: 'enemy', controlEnded: true, concentrationId: undefined })
    expect(result.map.tokens.find((candidate) => candidate.poolId === 'srd-5.1:invisible-stalker')?.dnd5eSummon)
      .toMatchObject({ side: 'player', concentrationId: 'conjure-elemental' })
  })

  it('turns a prior Conjure Fey summon hostile and keeps its independent token on recast', () => {
    const current = map()
    current.tokens.push({
      ...token(current, 'old-fey', 4, 4, 'enemy'),
      hp: 126,
      maxHp: 126,
      dnd5eSummon: {
        schemaVersion: 1,
        pluginId: 'srd-5.1',
        featureId: 'spell:conjure-fey',
        sourceCharacterId: 'actor',
        sourceTokenId: 'actor',
        createdRound: 1,
        expiresAfterRound: 600,
        concentrationId: 'conjure-fey',
        side: 'player',
        becomesHostileAfterConcentrationEnds: true,
      },
    })
    const conjureActivity: Dnd5eActivityDefinitionV1 = {
      ...activity,
      id: 'spell:conjure-fey',
      name: 'Conjure Fey',
    }
    const result = applyDnd5eActivityMapHandoffsV1({
      map: current,
      activity: conjureActivity,
      packageId: 'srd-5.1',
      actionId: 'new-fey-cast',
      actorId: 'actor',
      concentrationId: 'conjure-fey',
      round: 2,
      handoffs: {
        persistentAreas: [],
        summons: [{
          kind: 'summon', operationId: 'fey',
          monsterId: 'srd-5.1:giant-ape', count: 1,
          timing: 'immediate', durationRounds: 600,
          concentration: true, side: 'ally',
          becomesHostileAfterConcentrationEnds: true,
        }],
        movements: [], invocations: [],
      },
      selection: {
        summonCells: [{ col: 7, row: 6 }],
        summonInitiativeD20s: [12],
      },
    })
    expect(result.ok, JSON.stringify(result)).toBe(true)
    if (!result.ok) return
    expect(result.removedTokenIds).toEqual([])
    expect(result.map.tokens.find((candidate) => candidate.id === 'old-fey')?.dnd5eSummon)
      .toMatchObject({ side: 'enemy', controlEnded: true, concentrationId: undefined })
    expect(result.map.tokens.find((candidate) => candidate.poolId === 'srd-5.1:giant-ape')?.dnd5eSummon)
      .toMatchObject({ side: 'player', concentrationId: 'conjure-fey' })
  })

  it('places an upcast Conjure Minor Elementals group with one shared initiative roll', () => {
    const current = map()
    const conjureActivity: Dnd5eActivityDefinitionV1 = {
      ...activity,
      id: 'spell:conjure-minor-elementals',
      name: 'Conjure Minor Elementals',
    }
    const result = applyDnd5eActivityMapHandoffsV1({
      map: current,
      activity: conjureActivity,
      packageId: 'srd-5.1',
      actionId: 'minor-elementals-sixth-level',
      actorId: 'actor',
      concentrationId: 'conjure-minor-elementals',
      round: 2,
      handoffs: {
        persistentAreas: [],
        summons: [{
          kind: 'summon', operationId: 'azer-pair',
          monsterId: 'srd-5.1:azer', count: 2,
          timing: 'immediate', durationRounds: 600,
          concentration: true, side: 'ally',
        }],
        movements: [], invocations: [],
      },
      selection: {
        summonCells: [{ col: 6, row: 5 }, { col: 7, row: 5 }],
        summonInitiativeD20s: [13, 13],
      },
    })
    expect(result.ok, JSON.stringify(result)).toBe(true)
    if (!result.ok) return
    const azers = result.map.tokens.filter((candidate) => candidate.poolId === 'srd-5.1:azer')
    expect(azers).toHaveLength(2)
    expect(azers.every((candidate) => candidate.dnd5eSummon?.concentrationId === 'conjure-minor-elementals'))
      .toBe(true)
    expect(result.initiativeEntries).toHaveLength(2)
    expect(new Set(result.initiativeEntries.map((entry) => entry.roll))).toEqual(new Set([14]))
  })

  it('places an upcast Conjure Woodland Beings group with one shared initiative roll', () => {
    const current = map()
    const conjureActivity: Dnd5eActivityDefinitionV1 = {
      ...activity,
      id: 'spell:conjure-woodland-beings',
      name: 'Conjure Woodland Beings',
    }
    const result = applyDnd5eActivityMapHandoffsV1({
      map: current,
      activity: conjureActivity,
      packageId: 'srd-5.1',
      actionId: 'woodland-eighth-level',
      actorId: 'actor',
      concentrationId: 'conjure-woodland-beings',
      round: 2,
      handoffs: {
        persistentAreas: [],
        summons: [{
          kind: 'summon', operationId: 'sea-hag-trio',
          monsterId: 'srd-5.1:sea-hag', count: 3,
          timing: 'immediate', durationRounds: 600,
          concentration: true, side: 'ally',
        }],
        movements: [], invocations: [],
      },
      selection: {
        summonCells: [{ col: 5, row: 4 }, { col: 6, row: 4 }, { col: 7, row: 4 }],
        summonInitiativeD20s: [11, 11, 11],
      },
    })
    expect(result.ok, JSON.stringify(result)).toBe(true)
    if (!result.ok) return
    const seaHags = result.map.tokens.filter((candidate) => candidate.poolId === 'srd-5.1:sea-hag')
    expect(seaHags).toHaveLength(3)
    expect(seaHags.every((candidate) => candidate.dnd5eSummon?.concentrationId === 'conjure-woodland-beings'))
      .toBe(true)
    expect(result.initiativeEntries).toHaveLength(3)
    expect(new Set(result.initiativeEntries.map((entry) => entry.roll))).toEqual(new Set([12]))
  })

  it('does not replace a selected object for True Polymorph', () => {
    const current = map()
    current.tokens = [
      {
        ...token(current, 'actor', 1, 1, 'player'),
        dnd5eCombatState: { concentrationSpellId: 'true-polymorph' },
      },
      {
        ...token(current, 'granite-statue', 5, 1, 'obstacle'),
        label: '花岗岩雕像', size: 2, hp: 27, maxHp: 27,
        obstacleKind: 'statue', visibilityMode: 'always',
      },
    ]
    const truePolymorphActivity: Dnd5eActivityDefinitionV1 = {
      ...activity,
      id: 'spell:true-polymorph', name: '完全变形术',
      activation: { kind: 'action', cost: 1 }, invocation: { kind: 'active' },
      target: {
        kind: 'area', relation: 'any', origin: 'point', shape: 'circle',
        placeRangeFeet: 30, radiusFeet: 5, maximumTargets: 256,
        includeSelf: true, requiresLineOfSight: true, requiresLineOfEffect: true,
      },
    }
    const areaSelection = resolveDnd5eActivityAreaMapSelectionV1({
      activity: truePolymorphActivity, map: current, actorToken: current.tokens[0]!,
      anchorCell: { col: 5, row: 1 },
    })!
    const handoffs: Dnd5eActivityAuthorityHandoffs = {
      persistentAreas: [], movements: [], invocations: [],
      summons: [{
        kind: 'summon', operationId: 'true-polymorph-bear',
        monsterId: 'srd-5.1:brown-bear', count: 1, timing: 'immediate',
        durationRounds: 600, concentration: true, side: 'ally',
        persistAfterConcentrationCompletes: true,
      }],
    }
    const applied = applyDnd5eActivityMapHandoffsV1({
      map: current, activity: truePolymorphActivity, packageId: 'srd-5.1',
      actionId: 'true-polymorph-object-cast', actorId: 'actor', concentrationId: 'true-polymorph',
      round: 1, handoffs, areaSelection, selection: { summonInitiativeD20s: [12] },
    })
    expect(applied.ok, JSON.stringify(applied)).toBe(true)
    if (!applied.ok) return
    expect(applied.map.tokens).toEqual(current.tokens)
    expect(applied.map.tokens.some((candidate) => candidate.dnd5eSummon)).toBe(false)
    expect(applied.changedTokenIds).toEqual([])
    expect(applied.initiativeEntries).toEqual([])
  })

  it('creates a profiled spell entity only in an unoccupied cell', () => {
    const current = map()
    const entityActivity: Dnd5eActivityDefinitionV1 = {
      ...activity,
      id: 'spell:unseen-servant',
      legacySource: { kind: 'spell', id: 'unseen-servant' },
      target: {
        kind: 'area', relation: 'any', origin: 'point', shape: 'circle',
        placeRangeFeet: 60, radiusFeet: 1, maximumTargets: 1,
      },
    }
    const handoffs: Dnd5eActivityAuthorityHandoffs = {
      persistentAreas: [{
        kind: 'create-persistent-area', operationId: 'servant', label: '隐形仆役',
        durationRounds: 600, concentration: false,
        movement: {
          economy: 'bonus-action', maximumFeet: 15, maximumDistanceFromSourceFeet: 60,
          endWhenExceedingSourceDistance: true,
        },
        creationConstraints: { maximumCreatureCount: 0 },
        entityProfile: {
          armorClass: 10, hitPoints: 1, strength: 2, cannotAttack: true, invisible: true,
        },
        effectToken: { label: '隐形仆役', hiddenBody: true },
      }],
      summons: [], movements: [], invocations: [],
    }
    const selectionAt = (anchorCell: { col: number; row: number }) =>
      resolveDnd5eActivityAreaMapSelectionV1({
        activity: entityActivity, map: current, actorToken: current.tokens[0]!, anchorCell,
      })!
    const occupied = selectionAt({ col: 2, row: 1 })
    expect(applyDnd5eActivityMapHandoffsV1({
      map: current, activity: entityActivity, packageId: 'srd-5.1', actionId: 'occupied',
      actorId: 'actor', round: 1, handoffs: {
        ...handoffs,
        persistentAreas: handoffs.persistentAreas.map((proposal) => ({
          ...proposal, areaInstance: { ...occupied.areaPlacement, origin: 'point', shape: 'circle' },
        })),
      }, areaSelection: occupied, selection: {},
    })).toMatchObject({ ok: false, reason: 'invalid-persistent-area' })

    const empty = selectionAt({ col: 4, row: 4 })
    const created = applyDnd5eActivityMapHandoffsV1({
      map: current, activity: entityActivity, packageId: 'srd-5.1', actionId: 'empty',
      actorId: 'actor', round: 1, worldMinute: 100, handoffs: {
        ...handoffs,
        persistentAreas: handoffs.persistentAreas.map((proposal) => ({
          ...proposal, areaInstance: { ...empty.areaPlacement, origin: 'point', shape: 'circle' },
        })),
      }, areaSelection: empty, selection: {},
    })
    expect(created.ok, JSON.stringify(created)).toBe(true)
    if (!created.ok) return
    expect(created.map.dnd5ePluginAreas?.[0]).toMatchObject({
      coreSpellId: 'unseen-servant', cells: [{ col: 4, row: 4 }],
      createdRound: 1, expiresAfterRound: 601,
      createdWorldMinute: 100, expiresAtWorldMinute: 160,
      movement: {
        economy: 'bonus-action', maximumFeet: 15, maximumDistanceFromSourceFeet: 60,
        endWhenExceedingSourceDistance: true,
      },
      entityProfile: {
        armorClass: 10, hitPoints: 1, strength: 2, cannotAttack: true, invisible: true,
      },
      entityCurrentHitPoints: 1,
      anchorMode: 'effect-token',
    })
    expect(created.map.tokens.find((candidate) => candidate.dnd5eSpellEffect)?.dnd5eSpellEffect)
      .toMatchObject({ createdRound: 1, expiresAfterRound: 601 })
    expect(created.map.tokens.find((candidate) => candidate.dnd5eSpellEffect)?.visibilityMode)
      .toBe('line-of-sight')
  })

  it('replaces same-source concentration areas and their effect tokens on a same-spell recast', () => {
    const current = map()
    const projectActivity: Dnd5eActivityDefinitionV1 = {
      ...activity,
      id: 'spell:project-image',
      legacySource: { kind: 'spell', id: 'project-image' },
      target: {
        kind: 'area', relation: 'any', origin: 'point', shape: 'circle',
        placeRangeFeet: 100_000, radiusFeet: 5, maximumTargets: 1,
      },
    }
    current.dnd5ePluginAreas = [{
      id: 'activity-area:old-cast:project-image-projection',
      pluginId: 'srd-5.1', featureId: 'spell:project-image', sourceKind: 'core-spell',
      coreSpellId: 'project-image', label: '投影术', color: '#60a5fa',
      sourceCharacterId: 'actor', sourceTokenId: 'actor',
      cells: [{ col: 3, row: 3 }], createdRound: 1, expiresAfterRound: 14_401,
      concentrationId: 'project-image', anchorMode: 'effect-token',
      anchorTokenId: 'activity-effect:old-cast:project-image-projection',
      anchorCell: { col: 3, row: 3 },
    }]
    current.tokens.push({
      ...token(current, 'activity-effect:old-cast:project-image-projection', 3, 3, 'obstacle'),
      dnd5eSpellEffect: {
        schemaVersion: 1, spellId: 'project-image', sourceCharacterId: 'actor',
        sourceTokenId: 'actor', createdRound: 1, expiresAfterRound: 14_401,
        concentrationId: 'project-image',
      },
    })
    const areaSelection = resolveDnd5eActivityAreaMapSelectionV1({
      activity: projectActivity, map: current, actorToken: current.tokens[0]!,
      anchorCell: { col: 6, row: 3 },
    })!
    const result = applyDnd5eActivityMapHandoffsV1({
      map: current, activity: projectActivity, packageId: 'srd-5.1',
      actionId: 'new-cast', actorId: 'actor', concentrationId: 'project-image',
      round: 1, areaSelection, selection: {},
      handoffs: {
        persistentAreas: [{
          kind: 'create-persistent-area', operationId: 'project-image-projection',
          label: '投影术', durationRounds: 14_400, concentration: true,
          areaInstance: { ...areaSelection.areaPlacement, origin: 'point', shape: 'circle' },
          effectToken: { label: '投影术' },
        }],
        summons: [], movements: [], invocations: [],
      },
    })
    expect(result.ok, JSON.stringify(result)).toBe(true)
    if (!result.ok) return
    expect(result.map.dnd5ePluginAreas?.filter((area) => area.coreSpellId === 'project-image'))
      .toHaveLength(1)
    expect(result.map.dnd5ePluginAreas?.[0]).toMatchObject({
      id: 'activity-area:new-cast:project-image-projection',
      anchorCell: { col: 6, row: 3 },
    })
    expect(result.map.tokens.filter((candidate) =>
      candidate.dnd5eSpellEffect?.spellId === 'project-image')).toHaveLength(1)
    expect(result.map.tokens.some((candidate) =>
      candidate.id === 'activity-effect:old-cast:project-image-projection')).toBe(false)
  })

  it('chooses the farthest legal pull destination toward a persistent-area origin', () => {
    const current = map()
    current.tokens[1] = token(current, 'target', 7, 1, 'enemy')
    expect(dnd5eActivityAutomaticDirectionalMovementCellV1({
      map: current,
      actorToken: current.tokens[0]!,
      targetToken: current.tokens[1]!,
      mode: 'pull',
      distanceFeet: 20,
      directionOriginCell: { col: 2, row: 1 },
    })).toEqual({ col: 3, row: 1 })
  })

  it.each([0.5, 3])('relocates a size %s persistent entity without losing its logical anchor offset', (size) => {
    const current = map()
    current.tokens[1] = token(current, 'target', 5, 3, 'enemy')
    const areaSelection = resolveDnd5eActivityAreaMapSelectionV1({
      activity,
      map: current,
      actorToken: current.tokens[0]!,
      anchorCell: { col: 2, row: 3 },
      rectRotation: 0,
    })!
    const created = applyDnd5eActivityMapHandoffsV1({
      map: current,
      activity,
      packageId: 'local.activity-test',
      actionId: 'create-sword-entity',
      actorId: 'actor',
      sourceSaveDc: 15,
      round: 1,
      handoffs: {
        persistentAreas: [{
          kind: 'create-persistent-area', operationId: 'sword-entity', label: 'Sword entity',
          durationRounds: 10, concentration: true,
          areaInstance: { ...areaSelection.areaPlacement, origin: 'point', shape: 'rect' },
          grantedActivities: [{ activityId: 'sword-attack' }],
          effectToken: { label: 'Sword entity', emoji: '⚔', size },
        }],
        summons: [], movements: [], invocations: [],
      },
      areaSelection,
      selection: {},
    })
    expect(created.ok, JSON.stringify(created)).toBe(true)
    if (!created.ok) return
    const area = created.map.dnd5ePluginAreas?.[0]
    expect(area).toBeDefined()
    if (size === 3) {
      area!.anchorTokenOffsetCells = { col: 1, row: 1 }
      area!.cells = [1, 2, 3].flatMap(col => [2, 3, 4].map(row => ({ col, row })))
      const entity = created.map.tokens.find(entry => entry.id === area!.anchorTokenId)!
      Object.assign(entity, cellToPixel({ col: 2, row: 3 }, created.map))
    }
    const relocationActivity: Dnd5eActivityDefinitionV1 = {
      schemaVersion: 1,
      id: 'sword-attack', name: 'Sword attack',
      activation: { kind: 'bonus-action', cost: 1 },
      invocation: { kind: 'active', confirmation: 'actor-choice' },
      target: { kind: 'creature', relation: 'enemy', rangeFeet: 60, count: 1 },
      outcomes: [], automation,
    }
    const relocated = applyDnd5eActivityMapHandoffsV1({
      map: created.map,
      activity: relocationActivity,
      packageId: 'local.activity-test',
      actionId: 'sword-attack',
      actorId: 'actor',
      sourceSaveDc: 15,
      round: 1,
      grantingPersistentAreaId: area!.id,
      handoffs: {
        persistentAreas: [], summons: [], movements: [], invocations: [],
        areaRelocations: [{
          kind: 'relocate-granting-area', operationId: 'move-sword', targetId: 'target', maximumFeet: 20,
          requiresDifferentAnchor: true,
        }],
      },
      selection: {},
    })
    expect(relocated.ok, JSON.stringify({ relocated, area, target: created.map.tokens.find((entry) => entry.id === 'target') })).toBe(true)
    if (!relocated.ok) return
    expect(relocated.map.dnd5ePluginAreas?.[0]?.anchorCell).toEqual({ col: 5, row: 3 })
    const effectTokenId = relocated.map.dnd5ePluginAreas?.[0]?.anchorTokenId
    expect(relocated.map.tokens.find((entry) => entry.id === effectTokenId)).toMatchObject(
      cellToPixel({ col: 5, row: 3 }, relocated.map),
    )
    if (size === 3) {
      expect(relocated.map.dnd5ePluginAreas?.[0]?.cells).toEqual(
        [4, 5, 6].flatMap(col => [2, 3, 4].map(row => ({ col, row }))),
      )
      expect(relocated.map.dnd5ePluginAreas?.[0]?.anchorTokenOffsetCells).toEqual({ col: 1, row: 1 })
    }
    const repeat = applyDnd5eActivityMapHandoffsV1({
      map: relocated.map, activity: relocationActivity, packageId: 'local.activity-test',
      actionId: 'repeat-move', actorId: 'actor', sourceSaveDc: 15, round: 1,
      grantingPersistentAreaId: area!.id, selection: {},
      handoffs: { persistentAreas: [], summons: [], movements: [], invocations: [],
        areaRelocations: [{ kind: 'relocate-granting-area', operationId: 'move-sword',
          targetId: 'target', maximumFeet: 20, requiresDifferentAnchor: true }] },
    })
    expect(repeat).toMatchObject({ ok: false, reason: 'invalid-movement-placement' })
    expect(relocated.map.dnd5ePluginAreas?.[0]?.anchorCell).toEqual({ col: 5, row: 3 })
  })

  it('atomically swaps the actor with a nearby allied token without a placement prompt', () => {
    const current = map()
    current.tokens[1] = token(current, 'ally', 4, 2, 'player')
    const actorBefore = { x: current.tokens[0]!.x, y: current.tokens[0]!.y }
    const allyBefore = { x: current.tokens[1]!.x, y: current.tokens[1]!.y }
    const result = applyDnd5eActivityMapHandoffsV1({
      map: current,
      activity,
      packageId: 'local.activity-test',
      actionId: 'activity-action-swap',
      actorId: 'actor',
      round: 2,
      handoffs: {
        persistentAreas: [], summons: [], invocations: [],
        movements: [{
          kind: 'move', operationId: 'swap', targetId: 'ally', mode: 'swap', distanceFeet: 30,
        }],
      },
      selection: {},
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.map.tokens.find((candidate) => candidate.id === 'actor')).toMatchObject(allyBefore)
    expect(result.map.tokens.find((candidate) => candidate.id === 'ally')).toMatchObject(actorBefore)
    expect(result.changedTokenIds).toEqual(expect.arrayContaining(['actor', 'ally']))
  })

  it('creates independently addressable projection instances in the nearest legal cells', () => {
    const current = map()
    const projectionActivity: Dnd5eActivityDefinitionV1 = {
      ...activity,
      id: 'mirror-images',
      target: {
        kind: 'area', relation: 'any', origin: 'point', shape: 'rect',
        placeRangeFeet: 30, widthFeet: 5, lengthFeet: 5, heightFeet: 5,
        maximumTargets: 8, rotatable: false,
      },
    }
    const areaSelection = resolveDnd5eActivityAreaMapSelectionV1({
      activity: projectionActivity,
      map: current,
      actorToken: current.tokens[0]!,
      anchorCell: { col: 4, row: 4 },
    })!
    const result = applyDnd5eActivityMapHandoffsV1({
      map: current,
      activity: projectionActivity,
      packageId: 'local.activity-test',
      actionId: 'activity-action-projections',
      actorId: 'actor',
      round: 2,
      handoffs: {
        summons: [], movements: [], invocations: [],
        persistentAreas: [{
          kind: 'create-persistent-area', operationId: 'images', label: 'Mirror',
          instanceCount: 4, durationRounds: 10, concentration: true,
          utilityProjectionId: 'mirror',
          areaInstance: { ...areaSelection.areaPlacement, origin: 'point', shape: 'rect' },
        }],
      },
      areaSelection,
      selection: {},
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.map.dnd5ePluginAreas).toHaveLength(4)
    expect(new Set(result.map.dnd5ePluginAreas?.map((area) => area.id)).size).toBe(4)
    const placedCells = result.map.dnd5ePluginAreas?.flatMap((area) =>
      area.cells.map((cell) => `${cell.col}:${cell.row}`)) ?? []
    expect(new Set(placedCells).size).toBe(placedCells.length)
    expect(new Set(result.map.dnd5ePluginAreas?.map((area) => `${area.anchorCell?.col}:${area.anchorCell?.row}`)).size).toBe(4)
    expect(result.map.dnd5ePluginAreas?.every((area) => area.utilityProjectionId === 'mirror')).toBe(true)
  })

  it('anchors self-origin persistent areas to the source token', () => {
    const current = map()
    const selfAreaActivity: Dnd5eActivityDefinitionV1 = {
      ...activity,
      id: 'guardian-aura',
      target: {
        kind: 'area', relation: 'enemy', origin: 'self', shape: 'circle',
        radiusFeet: 10, maximumTargets: 8, includeSelf: false,
      },
    }
    const areaSelection = resolveDnd5eActivityAreaMapSelectionV1({
      activity: selfAreaActivity,
      map: current,
      actorToken: current.tokens[0]!,
      anchorCell: { col: 1, row: 1 },
    })!
    const result = applyDnd5eActivityMapHandoffsV1({
      map: current,
      activity: selfAreaActivity,
      packageId: 'local.activity-test',
      actionId: 'activity-action-source-area',
      actorId: 'actor',
      round: 2,
      handoffs: {
        summons: [], movements: [], invocations: [],
        persistentAreas: [{
          kind: 'create-persistent-area', operationId: 'aura', label: 'Guardian aura',
          durationRounds: 3, concentration: false,
          sourceOverlapBehavior: 'remove-area',
          areaInstance: { ...areaSelection.areaPlacement, origin: 'self', shape: 'circle' },
        }],
      },
      areaSelection,
      selection: {},
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.map.dnd5ePluginAreas?.[0]).toMatchObject({
      anchorMode: 'source-token',
      anchorTokenId: 'actor',
      sourceTokenId: 'actor',
      sourceOverlapBehavior: 'remove-area',
    })
  })

  it('reshapes a source-anchored line without teleporting its source token', () => {
    const current = map()
    const actor = current.tokens[0]!
    const originalPosition = { x: actor.x, y: actor.y }
    const redirectActivity: Dnd5eActivityDefinitionV1 = {
      ...activity,
      id: 'gust-redirect',
      invocation: { kind: 'active', confirmation: 'actor-choice' },
      target: {
        kind: 'area', relation: 'any', origin: 'self', shape: 'line',
        lengthFeet: 60, widthFeet: 10, placeRangeFeet: 60,
        maximumTargets: 256, includeSelf: false, rotatable: true,
      },
    }
    current.dnd5ePluginAreas = [{
      id: 'gust-area', pluginId: 'local.activity-test', featureId: 'spell:gust-of-wind',
      label: 'Gust of Wind', color: '#fff', sourceCharacterId: 'actor', sourceTokenId: 'actor',
      cells: [{ col: 2, row: 1 }], createdRound: 1, expiresAfterRound: 11,
      anchorMode: 'source-token', anchorTokenId: 'actor', anchorCell: { col: 1, row: 1 },
      grantedActivities: [{ activityId: 'gust-redirect', label: 'Redirect' }],
    }]
    const areaSelection = resolveDnd5eActivityAreaMapSelectionV1({
      activity: redirectActivity,
      map: current,
      actorToken: actor,
      anchorCell: { col: 1, row: 3 },
    })!

    const result = applyDnd5eActivityMapHandoffsV1({
      map: current,
      activity: redirectActivity,
      packageId: 'local.activity-test',
      actionId: 'gust-redirect-action',
      actorId: 'actor',
      round: 1,
      handoffs: {
        summons: [], movements: [], invocations: [], persistentAreas: [],
        areaReshapes: [{ kind: 'reshape-granting-area', operationId: 'reshape', targetId: 'actor' }],
      },
      areaSelection,
      selection: {},
      grantingPersistentAreaId: 'gust-area',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.map.tokens.find((candidate) => candidate.id === actor.id)).toMatchObject(originalPosition)
    expect(result.map.dnd5ePluginAreas?.[0]).toMatchObject({
      anchorCell: { col: 1, row: 1 },
      cells: areaSelection.cells,
    })
  })

  it.each([[false,'none'],[true,'none'],[false,'inside'],[true,'inside'],[false,'above'],[false,'expired']] as const)('creates shared-vision sensors only outside temple protection (inherit %s, ward %s)', (inherit,wardMode) => {
    const current = map()
    const sensorActivity: Dnd5eActivityDefinitionV1 = {
      ...activity,
      id: 'arcane-eye',
      legacySource: { kind: 'spell', id: 'arcane-eye', magical: true },
      target: {
        kind: 'area', relation: 'any', origin: 'point', shape: 'circle',
        placeRangeFeet: 30, radiusFeet: 5, maximumTargets: 1,
      },
    }
    const areaSelection = resolveDnd5eActivityAreaMapSelectionV1({
      activity: sensorActivity,
      map: current,
      actorToken: current.tokens[0]!,
      anchorCell: { col: 4, row: 4 },
    })!
    if(wardMode!=='none'){
      const geometry=createEmptyMapGeometry(current.id)
      geometry.structureLifetimes=[{id:'temple',casterId:'actor',createdWorldMinute:0,expiresWorldMinute:1440,entityIds:[],replacementGroup:'temple-of-the-gods',siteKey:'site',
        objectBoundary:{points:[{x:200,y:200},{x:300,y:200},{x:300,y:300},{x:200,y:300}],bottomFeet:0,topFeet:20},
        templeWard:{hostileCreatureTypes:['fiend'],saveDc:18,healingBonus:5,lighting:'none'}}]
      setMapGeometryRuntime([geometry])
      if(wardMode==='above')areaSelection.areaPlacement.elevationFeet=20
    }
    const before=structuredClone(current)
    const result = applyDnd5eActivityMapHandoffsV1({
      map: current,
      activity: sensorActivity,
      worldMinute:wardMode==='expired'?1440:100,
      packageId: 'srd-5.1',
      actionId: 'arcane-eye-cast',
      actorId: 'actor',
      round: 2,
      handoffs: {
        summons: [], movements: [], invocations: [],
        persistentAreas: [{
          kind: 'create-persistent-area', operationId: 'sensor', label: 'Arcane Eye',
          durationRounds: 600, concentration: true,
          movement: { economy: 'action', maximumFeet: 30 },
          effectToken: {
            label: 'Arcane Eye', hiddenBody: true,
            shareVisionWithSource: true, ...(inherit ? { visionFromSource: true as const } : { darkvisionRangeFeet: 30 }),
          },
          areaInstance: { ...areaSelection.areaPlacement, origin: 'point', shape: 'circle' },
        }],
      },
      areaSelection,
      selection: {},
    })
    expect(current).toEqual(before)
    if(wardMode==='inside'){
      expect(result).toEqual({ok:false,reason:'invalid-persistent-area'})
      return
    }
    expect(result.ok, JSON.stringify(result)).toBe(true)
    if (!result.ok) return
    const effectToken = result.map.tokens.find((candidate) => candidate.dnd5eSpellEffect?.spellId === 'arcane-eye')
    expect(effectToken?.elevationFeet).toBe(wardMode==='above'?20:0)
    expect(JSON.parse(JSON.stringify(result.map)).tokens.find((candidate:Token)=>candidate.id===effectToken?.id)?.elevationFeet).toBe(wardMode==='above'?20:0)
    expect(effectToken).toMatchObject({
      type: 'obstacle', visibilityMode: 'line-of-sight', darkvisionRangeFeet: inherit ? undefined : 30,
      dnd5eSpellEffect: {
        sourceCharacterId: 'actor', sourceTokenId: 'actor',
        shareVisionWithSource: true, hiddenBody: true,
        visionFromSource: inherit ? true : undefined,
      },
    })
    expect(result.map.dnd5ePluginAreas?.[0]).toMatchObject({
      anchorMode: 'effect-token', anchorTokenId: effectToken?.id,
      movement: { economy: 'action', maximumFeet: 30 },
    })
    expect(result.changedTokenIds).toContain(effectToken?.id)
  })

  it.each([['divination','inside'],['divination','above'],['divination','expired'],['conjuration','inside']] as const)('uses registered imported sensor school (%s, %s)',(school,wardMode)=>{
    const inherit=false,packageId='local.temple.sensor-audit'
    const dispose=registerDnd5eRulesPlugin({manifest:{id:packageId,name:'Sensor audit',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0'},setup(api){
      api.registerSpell(JSON.parse(JSON.stringify({id:'sensor',name:'Imported sensor',level:1,school,ritual:false,
        castingTime:{value:1,unit:'action'},range:{type:'distance',feet:30},components:{verbal:true,somatic:true,material:false},
        duration:{type:'timed',value:10,unit:'minute',concentration:true},classes:['wizard'],description:'Test sensor',automation:{mode:'reference-only'}})))
    }})
    try{
    const current = map()
    const sensorActivity: Dnd5eActivityDefinitionV1 = {
      ...activity,
      id: 'sensor',
      legacySource: { kind: 'spell', id: 'sensor', magical: true },
      target: {
        kind: 'area', relation: 'any', origin: 'point', shape: 'circle',
        placeRangeFeet: 30, radiusFeet: 5, maximumTargets: 1,
      },
    }
    const areaSelection = resolveDnd5eActivityAreaMapSelectionV1({
      activity: sensorActivity,
      map: current,
      actorToken: current.tokens[0]!,
      anchorCell: { col: 4, row: 4 },
    })!
    if(true){
      const geometry=createEmptyMapGeometry(current.id)
      geometry.structureLifetimes=[{id:'temple',casterId:'actor',createdWorldMinute:0,expiresWorldMinute:1440,entityIds:[],replacementGroup:'temple-of-the-gods',siteKey:'site',
        objectBoundary:{points:[{x:200,y:200},{x:300,y:200},{x:300,y:300},{x:200,y:300}],bottomFeet:0,topFeet:20},
        templeWard:{hostileCreatureTypes:['fiend'],saveDc:18,healingBonus:5,lighting:'none'}}]
      setMapGeometryRuntime([geometry])
      if(wardMode==='above')areaSelection.areaPlacement.elevationFeet=20
    }
    const before=structuredClone(current)
    const result = applyDnd5eActivityMapHandoffsV1({
      map: current,
      activity: sensorActivity,
      worldMinute:wardMode==='expired'?1440:100,
      packageId,
      actionId: 'arcane-eye-cast',
      actorId: 'actor',
      round: 2,
      handoffs: {
        summons: [], movements: [], invocations: [],
        persistentAreas: [{
          kind: 'create-persistent-area', operationId: 'sensor', label: 'Arcane Eye',
          durationRounds: 600, concentration: true,
          movement: { economy: 'action', maximumFeet: 30 },
          effectToken: {
            label: 'Arcane Eye', hiddenBody: true,
            shareVisionWithSource: true, ...(inherit ? { visionFromSource: true as const } : { darkvisionRangeFeet: 30 }),
          },
          areaInstance: { ...areaSelection.areaPlacement, origin: 'point', shape: 'circle' },
        }],
      },
      areaSelection,
      selection: {},
    })
    expect(current).toEqual(before)
    if(wardMode==='inside'&&school==='divination'){
      expect(result).toEqual({ok:false,reason:'invalid-persistent-area'})
      return
    }
    expect(result.ok, JSON.stringify(result)).toBe(true)
    if (!result.ok) return
    const effectToken = result.map.tokens.find((candidate) => candidate.dnd5eSpellEffect?.spellId === packageId+':sensor')
    expect(effectToken?.elevationFeet).toBe(wardMode==='above'?20:0)
    expect(JSON.parse(JSON.stringify(result.map)).tokens.find((candidate:Token)=>candidate.id===effectToken?.id)?.elevationFeet).toBe(wardMode==='above'?20:0)
    expect(effectToken).toMatchObject({
      type: 'obstacle', visibilityMode: 'line-of-sight', darkvisionRangeFeet: inherit ? undefined : 30,
      dnd5eSpellEffect: {
        sourceCharacterId: 'actor', sourceTokenId: 'actor',
        shareVisionWithSource: true, hiddenBody: true,
        visionFromSource: inherit ? true : undefined,
      },
    })
    expect(result.map.dnd5ePluginAreas?.[0]).toMatchObject({
      anchorMode: 'effect-token', anchorTokenId: effectToken?.id,
      movement: { economy: 'action', maximumFeet: 30 },
    })
    expect(result.changedTokenIds).toContain(effectToken?.id)
    }finally{dispose()}
  })

  it('captures Tiny Hut occupants on the Host and persists a fixed permission boundary', () => {
    const current = map()
    current.tokens[1] = token(current, 'ally', 2, 1, 'player')
    current.tokens.push(token(current, 'outsider', 8, 8, 'enemy'))
    const hutActivity: Dnd5eActivityDefinitionV1 = {
      ...activity,
      id: 'tiny-hut',
      target: {
        kind: 'area', relation: 'any', origin: 'self', shape: 'sphere',
        radiusFeet: 10, maximumTargets: 16, includeSelf: true,
      },
    }
    const areaSelection = resolveDnd5eActivityAreaMapSelectionV1({
      activity: hutActivity,
      map: current,
      actorToken: current.tokens[0]!,
      anchorCell: { col: 1, row: 1 },
    })!
    const result = applyDnd5eActivityMapHandoffsV1({
      map: current,
      activity: hutActivity,
      packageId: 'srd-5.1',
      actionId: 'tiny-hut-cast',
      actorId: 'actor',
      round: 2,
      handoffs: {
        summons: [], movements: [], invocations: [],
        persistentAreas: [{
          kind: 'create-persistent-area', operationId: 'tiny-hut-area', label: 'Tiny Hut',
          durationRounds: 4_800, concentration: false,
          areaInstance: { ...areaSelection.areaPlacement, origin: 'self', shape: 'sphere' },
          creationConstraints: { maximumCreatureCount: 10, maximumCreatureSizeRank: 2 },
          anchorMode: 'fixed',
          sourceExitBehavior: 'remove-area',
          // Synthetic lifecycle extension tests the shared handoff, not Tiny Hut rules.
          sourceIncapacitatedBehavior: 'remove-area',
          blocking: {
            movement: true,
            movementMode: 'enter',
            entryPermission: 'occupants-at-creation',
            authorizedTokenIds: ['spoofed-client-id'],
            blocksTeleportationEntry: true,
            vision: true,
            visionMode: 'outside-in',
            lineOfEffect: true,
            lineOfEffectMode: 'boundary',
          },
        }],
      },
      areaSelection,
      selection: {},
    })
    expect(result.ok, JSON.stringify(result)).toBe(true)
    if (!result.ok) return
    expect(result.map.dnd5ePluginAreas?.[0]).toMatchObject({
      anchorMode: 'fixed',
      anchorTokenId: undefined,
      sourceExitBehavior: 'remove-area',
      sourceIncapacitatedBehavior: 'remove-area',
      blocking: {
        entryPermission: 'occupants-at-creation',
        authorizedTokenIds: expect.arrayContaining(['actor', 'ally']),
        visionMode: 'outside-in',
        lineOfEffectMode: 'boundary',
      },
    })
    expect(result.map.dnd5ePluginAreas?.[0]?.blocking?.authorizedTokenIds).not.toContain('outsider')
    expect(result.map.dnd5ePluginAreas?.[0]?.blocking?.authorizedTokenIds).not.toContain('spoofed-client-id')
  })

  it('canonicalizes a self-origin Tiny Hut sphere to the caster cell', () => {
    const current = map()
    const hutActivity: Dnd5eActivityDefinitionV1 = {
      ...activity,
      id: 'tiny-hut-self-origin',
      target: {
        kind: 'area', relation: 'any', origin: 'self', shape: 'sphere',
        radiusFeet: 10, maximumTargets: 16, includeSelf: true,
      },
    }

    const selection = resolveDnd5eActivityAreaMapSelectionV1({
      activity: hutActivity,
      map: current,
      actorToken: current.tokens[0]!,
      anchorCell: { col: 8, row: 8 },
    })

    expect(selection).toMatchObject({
      anchorCell: { col: 1, row: 1 },
      areaPlacementDistanceFeet: 0,
    })
    expect(selection?.targetIds).toEqual(expect.arrayContaining(['actor', 'target']))
  })

  it('allows Tiny Hut to hold the caster plus nine other creatures but rejects an eleventh occupant', () => {
    const current = map()
    current.tokens = [
      current.tokens[0]!,
      ...Array.from({ length: 9 }, (_, index) =>
        token(current, `ally-${index + 1}`, 1, 1, 'player')),
    ]
    const hutActivity: Dnd5eActivityDefinitionV1 = {
      ...activity,
      id: 'tiny-hut-capacity',
      target: {
        kind: 'area', relation: 'any', origin: 'self', shape: 'sphere',
        radiusFeet: 10, maximumTargets: 16, includeSelf: true,
      },
    }
    const areaSelection = resolveDnd5eActivityAreaMapSelectionV1({
      activity: hutActivity,
      map: current,
      actorToken: current.tokens[0]!,
      anchorCell: { col: 1, row: 1 },
    })!
    const cast = (map: BattleMap) => applyDnd5eActivityMapHandoffsV1({
      map,
      activity: hutActivity,
      packageId: 'srd-5.1',
      actionId: 'tiny-hut-capacity-cast',
      actorId: 'actor',
      round: 2,
      handoffs: {
        summons: [], movements: [], invocations: [],
        persistentAreas: [{
          kind: 'create-persistent-area', operationId: 'tiny-hut-area', label: 'Tiny Hut',
          durationRounds: 4_800, concentration: false,
          areaInstance: { ...areaSelection.areaPlacement, origin: 'self', shape: 'sphere' },
          creationConstraints: { maximumCreatureCount: 10, maximumCreatureSizeRank: 2 },
        }],
      },
      areaSelection,
      selection: {},
    })

    expect(cast(current).ok).toBe(true)
    const overflow = {
      ...current,
      tokens: [...current.tokens, token(current, 'ally-10', 1, 1, 'player')],
    }
    expect(cast(overflow)).toEqual({ ok: false, reason: 'invalid-persistent-area' })
  })

  it('rejects persistent-area creation when a bounded occupant constraint is exceeded', () => {
    const current = map()
    current.tokens[1] = { ...current.tokens[1]!, size: 3 }
    const boundedActivity: Dnd5eActivityDefinitionV1 = {
      ...activity,
      id: 'bounded-area',
      target: {
        kind: 'area', relation: 'any', origin: 'self', shape: 'sphere',
        radiusFeet: 10, maximumTargets: 16, includeSelf: true,
      },
    }
    const areaSelection = resolveDnd5eActivityAreaMapSelectionV1({
      activity: boundedActivity,
      map: current,
      actorToken: current.tokens[0]!,
      anchorCell: { col: 1, row: 1 },
    })!
    const result = applyDnd5eActivityMapHandoffsV1({
      map: current,
      activity: boundedActivity,
      packageId: 'local.activity-test',
      actionId: 'bounded-area-cast',
      actorId: 'actor',
      round: 2,
      handoffs: {
        summons: [], movements: [], invocations: [],
        persistentAreas: [{
          kind: 'create-persistent-area', operationId: 'bounded', label: 'Bounded area',
          durationRounds: 10, concentration: false,
          areaInstance: { ...areaSelection.areaPlacement, origin: 'self', shape: 'sphere' },
          creationConstraints: { maximumCreatureSizeRank: 2 },
        }],
      },
      areaSelection,
      selection: {},
    })
    expect(result).toEqual({ ok: false, reason: 'invalid-persistent-area' })
  })

  it('removes only eligible magical-darkness areas within the actor radius', () => {
    const current = map()
    current.dnd5ePluginAreas = [
      {
        id: 'near-darkness', pluginId: 'local.activity-test', featureId: 'darkness',
        label: 'Near darkness', color: '#000', sourceCharacterId: 'caster', sourceTokenId: 'caster',
        cells: [{ col: 3, row: 1 }], createdRound: 1, expiresAfterRound: 20,
        lighting: { kind: 'magical-darkness', radiusFeet: 15, spellLevel: 2 },
      },
      {
        id: 'high-level-darkness', pluginId: 'local.activity-test', featureId: 'darkness',
        label: 'High level darkness', color: '#000', sourceCharacterId: 'caster', sourceTokenId: 'caster',
        cells: [{ col: 2, row: 1 }], createdRound: 1, expiresAfterRound: 20,
        lighting: { kind: 'magical-darkness', radiusFeet: 15, spellLevel: 5 },
      },
      {
        id: 'far-darkness', pluginId: 'local.activity-test', featureId: 'darkness',
        label: 'Far darkness', color: '#000', sourceCharacterId: 'caster', sourceTokenId: 'caster',
        cells: [{ col: 9, row: 1 }], createdRound: 1, expiresAfterRound: 20,
        lighting: { kind: 'magical-darkness', radiusFeet: 15, spellLevel: 2 },
      },
      {
        id: 'near-light', pluginId: 'local.activity-test', featureId: 'light',
        label: 'Near light', color: '#fff', sourceCharacterId: 'caster', sourceTokenId: 'caster',
        cells: [{ col: 2, row: 1 }], createdRound: 1, expiresAfterRound: 20,
        lighting: { kind: 'light', brightRadiusFeet: 10, dimRadiusFeet: 20, color: '#fff', spellLevel: 2 },
      },
    ]
    const result = applyDnd5eActivityMapHandoffsV1({
      map: current,
      activity,
      packageId: 'local.activity-test',
      actionId: 'activity-action-dispel-darkness',
      actorId: 'actor',
      round: 2,
      handoffs: {
        persistentAreas: [], summons: [], movements: [], invocations: [],
        areaDispels: [{
          kind: 'dispel-area', operationId: 'dispel-darkness', actorId: 'actor',
          areaKind: 'magical-darkness', radiusFeet: 30, maximumSpellLevel: 3,
        }],
      },
      selection: {},
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.map.dnd5ePluginAreas?.map((area) => area.id)).toEqual([
      'high-level-darkness', 'far-darkness', 'near-light',
    ])
    expect(current.dnd5ePluginAreas).toHaveLength(4)
  })

  it('leaves Arcane Lock and Knock object state to the DM', () => {
    const current = map()
    const lockActivity: Dnd5eActivityDefinitionV1 = {
      ...activity,
      id: 'arcane-lock',
      target: {
        kind: 'area', relation: 'any', origin: 'point', shape: 'circle',
        placeRangeFeet: 60, radiusFeet: 5, maximumTargets: 1,
      },
    }
    const anchor = { col: 3, row: 1 }
    const selected = resolveDnd5eActivityAreaMapSelectionV1({
      activity: lockActivity,
      map: current,
      actorToken: current.tokens[0]!,
      anchorCell: anchor,
    })!
    const midpoint = cellToPixel(anchor, current)
    const geometry = createEmptyMapGeometry(current.id, 1)
    geometry.doors.push({
      id: 'vault-door', kind: 'door', label: 'Vault door',
      points: [{ x: midpoint.x, y: midpoint.y - 20 }, { x: midpoint.x, y: midpoint.y + 20 }],
      state: 'closed', openState: 'closed', lockState: 'unlocked', physicalState: 'intact',
      secret: false, blocksVision: true, blocksMovement: true, blocksLineOfEffect: true,
      baseHeightFeet: 0, heightFeet: 10, createdAt: 1,
    })
    setMapGeometryRuntime([geometry])
    const locked = applyDnd5eActivityMapHandoffsV1({
      map: current,
      activity: lockActivity,
      packageId: 'srd-5.1',
      actionId: 'arcane-lock-cast',
      actorId: 'actor',
      round: 4,
      worldMinute: 50,
      handoffs: {
        persistentAreas: [], summons: [], movements: [], invocations: [],
        mapObjectLocks: [{
          kind: 'modify-map-object-lock', operationId: 'arcane-lock-map-object',
          mode: 'arcane-lock', targetKinds: ['door', 'obstacle'], spellLevel: 2,
          authorizedTargetIds: ['ally'], passwordDigest: 'fnv1a32:01020304',
        }],
      },
      areaSelection: selected,
      selection: {},
    })
    expect(locked.ok, JSON.stringify(locked)).toBe(true)
    if (!locked.ok) return
    expect(locked.map).toEqual(current)
    expect(locked.geometryDoorPatches).toEqual([])
    const knocked = applyDnd5eActivityMapHandoffsV1({
      map: current,
      activity: { ...lockActivity, id: 'knock' },
      packageId: 'srd-5.1',
      actionId: 'knock-cast',
      actorId: 'actor',
      round: 7,
      combatId: 'combat-1',
      handoffs: {
        persistentAreas: [], summons: [], movements: [], invocations: [],
        mapObjectLocks: [{
          kind: 'modify-map-object-lock', operationId: 'knock-map-object',
          mode: 'knock', targetKinds: ['door', 'obstacle'], spellLevel: 2,
          suppressionMinutes: 10,
        }],
      },
      areaSelection: selected,
      selection: {},
    })
    expect(knocked.ok, JSON.stringify(knocked)).toBe(true)
    if (!knocked.ok) return
    expect(knocked.map).toEqual(current)
    expect(knocked.geometryDoorPatches).toEqual([])
  })

  it('does not attach Magic Mouth to a map object', () => {
    const current = map()
    current.tokens.push({
      ...token(current, 'magic-mouth-statue', 3, 1, 'obstacle'),
      label: '魔嘴石像',
    })
    const magicMouthActivity: Dnd5eActivityDefinitionV1 = {
      ...activity,
      id: 'spell:magic-mouth',
      legacySource: { kind: 'spell', id: 'magic-mouth' },
      target: {
        kind: 'area', relation: 'any', origin: 'point', shape: 'circle',
        placeRangeFeet: 30, radiusFeet: 30, maximumTargets: 256,
        includeSelf: true, requiresLineOfSight: true, requiresLineOfEffect: true,
      },
    }
    const selection = resolveDnd5eActivityAreaMapSelectionV1({
      activity: magicMouthActivity,
      map: current,
      actorToken: current.tokens[0]!,
      anchorCell: { col: 3, row: 1 },
    })!
    const proposal = {
      kind: 'create-persistent-area' as const,
      operationId: 'magic-mouth-object-enchantment',
      label: '魔嘴术',
      durationRounds: 14_400,
      permanent: true as const,
      concentration: false,
      mappedObjectEnchantment: 'magic-mouth' as const,
      magicMouth: {
        schemaVersion: 1 as const,
        message: '警告：前方有危险',
        trigger: '任意生物进入物件周围 30 尺',
        triggerMode: 'proximity' as const,
        repeat: false,
      },
      triggers: [{
        id: 'magic-mouth-proximity', label: '魔嘴术·触发讯息', timing: 'on-enter' as const,
        oncePerRound: false, maximumTotalUses: 1,
        notification: { delivery: 'audible' as const, audibleRadiusFeet: 30, message: '警告：前方有危险' },
      }],
      areaInstance: { ...selection.areaPlacement, origin: 'point' as const, shape: 'circle' as const },
    }
    const created = applyDnd5eActivityMapHandoffsV1({
      map: current,
      activity: magicMouthActivity,
      packageId: 'srd-5.1',
      actionId: 'magic-mouth-cast',
      actorId: 'actor',
      round: 1,
      handoffs: { persistentAreas: [proposal], summons: [], movements: [], invocations: [] },
      areaSelection: selection,
      selection: {},
    })
    expect(created.ok, JSON.stringify(created)).toBe(true)
    if (!created.ok) return
    expect(created.map).toEqual(current)
    expect(created.map.dnd5ePluginAreas).toBeUndefined()

    // A skipped object enchantment must not discard independent supported work.
    const beforeMixed = structuredClone(current)
    const supported = { kind: 'create-persistent-area' as const, operationId: 'supported-zone', label: 'Supported zone',
      durationRounds: 10, concentration: false, areaInstance: proposal.areaInstance }
    const mixedInput = { map: current, activity: magicMouthActivity, packageId: 'srd-5.1', actionId: 'mixed-cast',
      actorId: 'actor', round: 1, areaSelection: selection, selection: {},
      handoffs: { persistentAreas: [proposal, supported], summons: [], movements: [], invocations: [] } }
    const mixed = applyDnd5eActivityMapHandoffsV1(mixedInput)
    expect(mixed.ok, JSON.stringify(mixed)).toBe(true)
    if (mixed.ok) {
      expect(mixed.map.dnd5ePluginAreas?.map(area => area.label)).toEqual(['Supported zone'])
      expect(mixed.map.tokens).toEqual(current.tokens)
    }
    const invalidMixed = applyDnd5eActivityMapHandoffsV1({ ...mixedInput, areaSelection: undefined })
    expect(invalidMixed).toEqual({ ok: false, reason: 'activity-area-required' })
    const limitedMixed = applyDnd5eActivityMapHandoffsV1({ ...mixedInput,
      handoffs: { ...mixedInput.handoffs, persistentAreas: [proposal,
        { ...supported, sourceLimit: { groupId: 'zone', maximum: 1 } }] } })
    expect(limitedMixed).toEqual({ ok: false, reason: 'invalid-persistent-area' })
    expect(current).toEqual(beforeMixed)

    const emptySelection = resolveDnd5eActivityAreaMapSelectionV1({
      activity: magicMouthActivity,
      map: current,
      actorToken: current.tokens[0]!,
      anchorCell: { col: 4, row: 4 },
    })!
    const rejected = applyDnd5eActivityMapHandoffsV1({
      map: current,
      activity: magicMouthActivity,
      packageId: 'srd-5.1',
      actionId: 'magic-mouth-invalid-cast',
      actorId: 'actor',
      round: 1,
      handoffs: {
        persistentAreas: [{
          ...proposal,
          areaInstance: { ...emptySelection.areaPlacement, origin: 'point', shape: 'circle' },
        }],
        summons: [], movements: [], invocations: [],
      },
      areaSelection: emptySelection,
      selection: {},
    })
    expect(rejected).toMatchObject({ ok: true, map: current, changedTokenIds: [] })
  })

  it('does not attach Light to a mapped object', () => {
    const current = map()
    current.tokens.push(token(current, 'lantern', 2, 2, 'obstacle'))
    const lightActivity: Dnd5eActivityDefinitionV1 = {
      ...activity,
      id: 'light',
      target: {
        kind: 'area', relation: 'any', origin: 'point', shape: 'circle',
        placeRangeFeet: 5, radiusFeet: 5, maximumTargets: 1,
      },
    }
    const selectedObject = resolveDnd5eActivityAreaMapSelectionV1({
      activity: lightActivity,
      map: current,
      actorToken: current.tokens[0]!,
      anchorCell: { col: 2, row: 2 },
    })!
    const carried = applyDnd5eActivityMapHandoffsV1({
      map: current,
      activity: lightActivity,
      packageId: 'srd-5.1',
      actionId: 'light-object-cast',
      actorId: 'actor',
      round: 1,
      worldMinute: 25,
      handoffs: {
        persistentAreas: [], summons: [], movements: [], invocations: [],
        mapObjectLights: [{
          kind: 'enchant-map-object-light', operationId: 'light-map-object',
          brightRadiusFeet: 20, dimRadiusFeet: 20, color: '#fef3c7', durationMinutes: 60,
        }],
      },
      areaSelection: selectedObject,
      selection: {},
    })
    expect(carried.ok, JSON.stringify(carried)).toBe(true)
    if (!carried.ok) return
    expect(carried.map).toEqual(current)
    expect(carried.changedTokenIds).toEqual([])
    expect(carried.map.tokens.find((candidate) => candidate.id === 'lantern')?.lightSource).toBeUndefined()
  })

  it('rejects the complete handoff without mutating the map when one placement is invalid', () => {
    const current = map()
    const result = applyDnd5eActivityMapHandoffsV1({
      map: current,
      activity,
      packageId: 'local.activity-test',
      actionId: 'activity-action-2',
      actorId: 'actor',
      round: 2,
      handoffs: {
        persistentAreas: [], invocations: [],
        summons: [{
          kind: 'summon', operationId: 'wolf', monsterId: 'srd-5.1:wolf', count: 1,
          timing: 'immediate', durationRounds: 3, concentration: false, side: 'ally',
        }],
        movements: [],
      },
      selection: { summonCells: [{ col: 2, row: 1 }], summonInitiativeD20s: [10] },
    })
    expect(result).toEqual({ ok: false, reason: 'invalid-summon-placement' })
    expect(current.tokens).toHaveLength(2)
  })

  it('creates a persistent half-hit-point simulacrum beside the selected creature', () => {
    const current = map()
    const result = applyDnd5eActivityMapHandoffsV1({
      map: current,
      activity: { ...activity, id: 'simulacrum' },
      packageId: 'srd-5.1',
      actionId: 'simulacrum-cast-1',
      actorId: 'actor',
      sourceSaveDc: 15,
      sourceInitiative: 14,
      combatId: 'combat-simulacrum',
      round: 3,
      handoffs: {
        persistentAreas: [], summons: [], movements: [], invocations: [],
        duplications: [{
          kind: 'duplicate-creature', operationId: 'duplicate-simulacrum',
          sourceActorId: 'actor', targetId: 'target', profile: 'simulacrum', persistent: true,
          level: 8, proficiencyBonus: 3, abilities: { str: 14, dex: 12, con: 14, int: 10, wis: 10, cha: 8 },
          armorClass: 15, maximumHitPoints: 18, speed: 30, sizeRank: 2,
          creatureType: 'humanoid', saveDc: 13,
          classLevels: { fighter: 8 }, resources: { 'dnd5e-spell-slot-1': { current: 2, maximum: 4 } },
          cannotIncreaseLevel: true, cannotRegainSpellSlots: true,
        }],
      },
      selection: {},
    })
    expect(result.ok, JSON.stringify(result)).toBe(true)
    if (!result.ok) return
    const duplicate = result.map.tokens.find((candidate) => candidate.id === 'activity-simulacrum:actor')
    expect(duplicate).toMatchObject({
      label: 'target·拟像', hp: 18, maxHp: 18, type: 'player', dnd5eSide: 'player',
      dnd5eSummon: { persistent: true, sourceTokenId: 'actor' },
      dnd5eSimulacrum: {
        subjectTokenId: 'target', maximumHitPoints: 18,
        classResources: { 'dnd5e-spell-slot-1': { current: 2, maximum: 4 } },
        cannotIncreaseLevel: true, cannotRegainSpellSlots: true, cannotRegainHitPoints: true,
      },
    })
    expect(result.initiativeEntries).toContainEqual(expect.objectContaining({
      tokenId: 'activity-simulacrum:actor', roll: 14,
      turnKind: 'source-companion',
    }))
    expect(result.initiativeEntries[0]?.initiativeCalculation).toBeUndefined()
  })

  it('rejects an in-combat duplicate when the Host did not provide the source initiative', () => {
    const current = map()
    const result = applyDnd5eActivityMapHandoffsV1({
      map: current,
      activity: { ...activity, id: 'simulacrum' },
      packageId: 'srd-5.1',
      actionId: 'simulacrum-cast-missing-initiative',
      actorId: 'actor',
      combatId: 'combat-simulacrum',
      round: 3,
      handoffs: {
        persistentAreas: [], summons: [], movements: [], invocations: [],
        duplications: [{
          kind: 'duplicate-creature', operationId: 'duplicate-simulacrum',
          sourceActorId: 'actor', targetId: 'target', profile: 'simulacrum', persistent: true,
          level: 8, proficiencyBonus: 3, abilities: { str: 14, dex: 12, con: 14, int: 10, wis: 10, cha: 8 },
          armorClass: 15, maximumHitPoints: 18, speed: 30, sizeRank: 2,
          creatureType: 'humanoid', saveDc: 13, resources: {},
          cannotIncreaseLevel: true, cannotRegainSpellSlots: true,
        }],
      },
      selection: {},
    })
    expect(result).toEqual({ ok: false, reason: 'invalid-summon-placement' })
    expect(current.tokens).toHaveLength(2)
  })

  it('creates an exploration simulacrum without inventing an initiative entry', () => {
    const current = map()
    const result = applyDnd5eActivityMapHandoffsV1({
      map: current,
      activity: { ...activity, id: 'simulacrum' },
      packageId: 'srd-5.1',
      actionId: 'simulacrum-exploration-cast',
      actorId: 'actor',
      round: 1,
      handoffs: {
        persistentAreas: [], summons: [], movements: [], invocations: [],
        duplications: [{
          kind: 'duplicate-creature', operationId: 'duplicate-simulacrum',
          sourceActorId: 'actor', targetId: 'target', profile: 'simulacrum', persistent: true,
          level: 8, proficiencyBonus: 3, abilities: { str: 14, dex: 12, con: 14, int: 10, wis: 10, cha: 8 },
          armorClass: 15, maximumHitPoints: 18, speed: 30, sizeRank: 2,
          creatureType: 'humanoid', saveDc: 13, resources: {},
          cannotIncreaseLevel: true, cannotRegainSpellSlots: true,
        }],
      },
      selection: {},
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.initiativeEntries).toEqual([])
  })
})

it('restricts terminal teleport to vacant cells near authoritative previous targets', () => {
  const current = map()
  current.tokens[1] = token(current,'target',8,8,'enemy')
  const movement = {kind:'move' as const,operationId:'finish',targetId:'actor',mode:'teleport' as const,distanceFeet:1000,continuationTargetRadiusFeet:5,continuationTargetIds:['target']}
  const cells = dnd5eActivityContinuationTeleportCells({map:current,actorToken:current.tokens[0],movement})
  expect(cells).toContainEqual({col:7,row:8})
  expect(cells).not.toContainEqual({col:8,row:8})
  expect(cells).not.toContainEqual({col:5,row:8})
  const apply = (col:number,row:number) => applyDnd5eActivityMapHandoffsV1({map:current,activity,packageId:'local.test',actionId:'finish',actorId:'actor',sourceSaveDc:15,round:1,handoffs:{persistentAreas:[],summons:[],invocations:[],movements:[movement]},selection:{movementCellsByOperationId:{finish:{col,row}}}})
  expect(apply(7,8).ok).toBe(true)
  expect(apply(8,8).ok).toBe(false)
  expect(apply(5,8).ok).toBe(false)
  expect(current.tokens[0]).toMatchObject(token(current,'actor',1,1,'player'))
  current.tokens = [current.tokens[0]]
  expect(dnd5eActivityContinuationTeleportCells({map:current,actorToken:current.tokens[0],movement})).toEqual([])
  expect(apply(7,8).ok).toBe(false)
})

it('keeps vertical minimum height separate from rectangular footprint length', () => {
  const target = { ...activity.target, kind: 'area' as const, relation: 'any' as const, origin: 'point' as const, shape: 'rect' as const, maximumTargets: 8, lengthFeet: 30, widthFeet: 10, heightFeet: 10, minimumHeightFeet: 5 }
  expect(dnd5eActivityMapTemplateV1({ ...activity, target })).toMatchObject({ heightFeet: 30, minimumHeightFeet: undefined })
  expect(dnd5eActivityMapTemplateV1({ ...activity, target: { ...target, minimumLengthFeet: 10 } })).toMatchObject({ heightFeet: 30, minimumHeightFeet: 10 })
})

it('rebuilds generic area targets using declared vertical height rather than footprint length', () => {
  const current = map()
  const target = { ...activity.target, kind: 'area' as const, relation: 'any' as const, origin: 'point' as const, shape: 'rect' as const, lengthFeet: 30, widthFeet: 10, heightFeet: 5, maximumTargets: 8 }
  const declared = { ...activity, target }
  const initial = resolveDnd5eActivityAreaMapSelectionV1({ activity: declared, map: current, actorToken: current.tokens[0], anchorCell: { col: 5, row: 5 } })!
  const spot = initial.cells[0]
  current.tokens = [current.tokens[0], { ...token(current, 'inside', spot.col, spot.row, 'enemy'), elevationFeet: 2 }, { ...token(current, 'above', spot.col, spot.row, 'enemy'), elevationFeet: 20 }]
  const selected = resolveDnd5eActivityAreaMapSelectionV1({ activity: declared, map: current, actorToken: current.tokens[0], anchorCell: { col: 5, row: 5 } })!
  expect(selected.targetIds).toEqual(['inside'])
})

it('rejects an airborne ground-only persistent area at map commit', () => {
  const current = map()
  const declared: Dnd5eActivityDefinitionV1 = { ...activity, target: { ...activity.target, kind: 'area', relation: 'any', origin: 'point', shape: 'rect', maximumTargets: 8, placementSurface: 'ground' } }
  const selected = resolveDnd5eActivityAreaMapSelectionV1({ activity: declared, map: current, actorToken: current.tokens[0], anchorCell: { col: 5, row: 5 } })!
  const apply = (elevationFeet: number) => applyDnd5eActivityMapHandoffsV1({ map: current, activity: declared, packageId: 'local.ground', actionId: 'cast', actorId: 'actor', round: 1, areaSelection: selected, selection: {}, handoffs: { persistentAreas: [{ kind: 'create-persistent-area', operationId: 'wall', label: 'Wall', durationRounds: 10, concentration: false, areaInstance: { ...selected.areaPlacement, elevationFeet, shape: 'rect', origin: 'point' } }], summons: [], movements: [], invocations: [] } })
  expect(apply(0).ok).toBe(true)
  expect(apply(10)).toEqual({ ok: false, reason: 'invalid-persistent-area' })
  expect(apply(-5)).toEqual({ ok: false, reason: 'invalid-persistent-area' })
  expect(current.dnd5ePluginAreas).toBeUndefined()
})


it('exports a rest-bound Activity and binds its executed area only to the Host rest-start event', () => {
  const current = map()
  const definition: Dnd5eActivityDefinitionV1 = JSON.parse(JSON.stringify({ ...activity,
    activation: { kind: 'free' }, invocation: { kind: 'triggered', event: 'long-rest-started', confirmation: 'actor-choice', retention: 'single-event' },
    target: { kind: 'area', relation: 'any', origin: 'self', shape: 'sphere', radiusFeet: 30, includeSelf: true },
    outcomes: [{ id: 'create', when: { kind: 'always' }, operations: [{ id: 'shelter', kind: 'create-persistent-area',
      label: 'Synthetic rest area', durationRounds: 4800, permanent: true, concentration: false, bindToRestSession: true, sourceExitBehavior: 'remove-area' }] }],
  }))
  expect(validateDnd5eActivityDefinitionV1(definition)).toEqual([])
  const areaSelection = resolveDnd5eActivityAreaMapSelectionV1({ activity: definition, map: current, actorToken: current.tokens[0], anchorCell: { col: 1, row: 1 } })!
  const resolved = resolveDnd5eActivity({ activity: definition,
    actor: { id: 'actor', controller: 'players', level: 6, proficiencyBonus: 3,
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 16, cha: 10 }, armorClass: 12, conditions: [], currentHp: 20, maxHp: 20 },
    targets: [], rolls: {}, areaPlacement: areaSelection.areaPlacement, areaPlacementDistanceFeet: 0, confirmedBy: 'actor',
    triggerContext: { event: 'long-rest-started', eventId: 'rest-start:rest-1', eligibleActorIds: ['actor'], eligibleTargetIds: [], source: { kind: 'combat', id: 'long-rest-started' } },
  })
  expect(resolved.ok, JSON.stringify(resolved)).toBe(true)
  if (!resolved.ok) throw Error('execution failed')
  const proposals = resolved.proposals.filter(proposal => proposal.kind === 'create-persistent-area')
  expect(proposals[0]).toMatchObject({ bindToRestSession: true })
  const clock = normalizeSharedCampaignTime({ worldMinute: 480, restSessions: [{ id: 'rest-1', kind: 'long-rest', characterIds: ['actor'],
    status: 'active', startedAtWorldMinute: 480, startedByMemberId: 'host', createdAt: 1 }] })
  const input = { map: current, activity: definition, packageId: 'test.rest-area', actionId: 'rest-area', actorId: 'actor', round: 1,
    worldMinute: 480, restAuthority: { clock, eventId: 'rest-start:rest-1' }, areaSelection, selection: {},
    handoffs: { summons: [], movements: [], invocations: [], persistentAreas: proposals } }
  const applied = applyDnd5eActivityMapHandoffsV1(input)
  expect(applied.ok, JSON.stringify(applied)).toBe(true)
  if (!applied.ok) throw Error('handoff failed')
  expect(applied.map.dnd5ePluginAreas?.[0]).toMatchObject({ restSessionId: 'rest-1', sourceCharacterId: 'actor', sourceExitBehavior: 'remove-area' })
  const archive = JSON.parse(JSON.stringify({ maps: [applied.map] }))
  expect(migrateMapsState(archive).maps[0].dnd5ePluginAreas?.[0]?.restSessionId).toBe('rest-1')
  archive.maps[0].dnd5ePluginAreas[0].restSessionId = ' '
  expect(migrateMapsState(archive).maps[0].dnd5ePluginAreas).toEqual([])
  for (const invalid of [
    { ...input, restAuthority: undefined },
    { ...input, restAuthority: { clock, eventId: 'rest-start:stale' } },
    { ...input, worldMinute: 481 },
    { ...input, activity: { ...definition, invocation: { kind: 'triggered' as const, event: 'long-rest-complete' as const, confirmation: 'actor-choice' as const } } },
    { ...input, restAuthority: { clock: { ...clock, restSessions: clock.restSessions!.map(session => ({ ...session, characterIds: ['outsider'] })) }, eventId: 'rest-start:rest-1' } },
  ]) expect(applyDnd5eActivityMapHandoffsV1(invalid)).toMatchObject({ ok: false, reason: 'invalid-persistent-area' })
  expect(current.dnd5ePluginAreas).toBeUndefined()
})


it.each(['nonmagical','magical','unknown','thin-magic','thin-unknown','mud'] as const)('requires explicit nonmagical stone through Activity execution and map handoff: %s',kind=>{
 const current=map(),geometry=createEmptyMapGeometry(current.id,1)
 geometry.obstacles=[{id:'stone',kind:'obstacle',label:'Stone',points:[{x:0,y:0},{x:1000,y:0},{x:1000,y:1000},{x:0,y:1000}],
  cover:'none',blocksMovement:false,blocksVision:false,blocksLineOfEffect:false,baseHeightFeet:0,heightFeet:0,terrainElevationFeet:0,
  surfaceMaterial:kind==='mud'?'mud':'stone',...(kind==='unknown'?{}:{materialMagic:kind==='magical'?'magical' as const:'nonmagical' as const}),createdAt:1}]
 const definition:Dnd5eActivityDefinitionV1={...activity,invocation:undefined,activation:{kind:'action'},target:{kind:'area',relation:'any',origin:'point',shape:'cube',placeRangeFeet:120,widthFeet:20,lengthFeet:20,heightFeet:20,includeSelf:true},
  outcomes:[{id:'mud',when:{kind:'always'},operations:[{id:'mud',kind:'create-persistent-area',label:'Mud',durationRounds:1,permanent:true,concentration:false,groundOnly:true,movementCostMultiplier:4,
   anchorMode:'fixed',surfaceMaterials:['stone'],requireAllSurfaceMaterials:true,requireNonmagicalSurfaceMaterials:true}]}]}
 expect(validateDnd5eActivityDefinitionV1(definition)).toEqual([])
 const areaSelection=resolveDnd5eActivityAreaMapSelectionV1({activity:definition,map:current,actorToken:current.tokens[0],anchorCell:{col:4,row:4}})!
 if(kind==='thin-magic'||kind==='thin-unknown'){
  const cell=areaSelection.cells[0],x=cell.col*50+10,y=cell.row*50+10
  geometry.obstacles.push({...geometry.obstacles[0],id:'thin',points:[{x,y},{x:x+.1,y},{x:x+.1,y:y+1},{x,y:y+1}],materialMagic:kind==='thin-magic'?'magical':undefined})
 }
 setMapGeometryRuntime([geometry])
 const resolved=resolveDnd5eActivity({activity:JSON.parse(JSON.stringify(definition)),actor:{id:'actor',controller:'players',level:9,proficiencyBonus:4,abilities:{str:10,dex:10,con:10,int:18,wis:10,cha:10},armorClass:12,conditions:[],currentHp:20,maxHp:20},targets:[],rolls:{},areaPlacement:areaSelection.areaPlacement,areaPlacementDistanceFeet:20,confirmedBy:'actor'})
 expect(resolved.ok,JSON.stringify(resolved)).toBe(true);if(!resolved.ok)throw Error('Activity failed')
 expect(resolved.proposals[0]).toMatchObject({requireNonmagicalSurfaceMaterials:true})
 const before=JSON.stringify({current,geometry})
 const result=applyDnd5eActivityMapHandoffsV1({map:current,activity:definition,packageId:'test.material',actionId:'cast',actorId:'actor',round:1,areaSelection,selection:{},
  handoffs:{summons:[],movements:[],invocations:[],persistentAreas:resolved.proposals.filter(p=>p.kind==='create-persistent-area')}})
 expect(result.ok,JSON.stringify(result)).toBe(kind==='nonmagical')
 if(result.ok)expect(result.map.dnd5ePluginAreas?.[0].movementCostMultiplier).toBe(4)
 else expect(result.reason).toBe('invalid-persistent-area')
 expect(JSON.stringify({current,geometry})).toBe(before)
})

it.each(['rock-to-mud','mud-to-rock'] as const)('creates reversible ground material from imported Activity declaration: %s',mode=>{
 const current=map(),geometry=createEmptyMapGeometry(current.id,1)
 geometry.obstacles=[{id:'body',kind:'obstacle',label:'Body',points:[{x:0,y:0},{x:1000,y:0},{x:1000,y:1000},{x:0,y:1000}],
  cover:'none',blocksMovement:false,blocksVision:false,blocksLineOfEffect:false,baseHeightFeet:-10,heightFeet:10,terrainElevationFeet:0,
  surfaceMaterial:mode==='rock-to-mud'?'stone':'mud',materialMagic:'nonmagical',createdAt:1}]
 setMapGeometryRuntime([geometry])
 const operation={id:'transform',kind:'create-persistent-area' as const,label:'Transform',durationRounds:1,permanent:true as const,concentration:false,
  groundOnly:true as const,anchorMode:'fixed' as const,surfaceMaterials:[mode==='rock-to-mud'?'stone' as const:'mud' as const],requireAllSurfaceMaterials:true as const,
  requireNonmagicalSurfaceMaterials:true as const,materialTransformation:{mode,depthFeet:mode==='rock-to-mud'?'selected-height' as const:5}}
 const definition:Dnd5eActivityDefinitionV1={...activity,invocation:undefined,activation:{kind:'action'},target:{kind:'area',relation:'any',origin:'point',shape:'rect',placeRangeFeet:120,widthFeet:20,lengthFeet:10,heightFeet:5,includeSelf:true,rotatable:true},outcomes:[{id:'convert',when:{kind:'always'},operations:[operation]}]}
 expect(validateDnd5eActivityDefinitionV1(definition)).toEqual([])
 const selection=resolveDnd5eActivityAreaMapSelectionV1({activity:definition,map:current,actorToken:current.tokens[0],anchorCell:{col:4,row:4},rectAngleDegrees:35,targetElevationFeet:0})!
 const resolved=resolveDnd5eActivity({activity:JSON.parse(JSON.stringify(definition)),actor:{id:'actor',controller:'players',level:9,proficiencyBonus:4,abilities:{str:10,dex:10,con:10,int:18,wis:10,cha:10},armorClass:12,conditions:[],currentHp:20,maxHp:20},targets:[],rolls:{},areaPlacement:selection.areaPlacement,areaPlacementDistanceFeet:20,confirmedBy:'actor'})
 expect(resolved.ok,JSON.stringify(resolved)).toBe(true);if(!resolved.ok)throw Error('resolve failed')
 const input={map:current,activity:definition,packageId:'test.material',actionId:'cast',actorId:'actor',round:1,areaSelection:selection,selection:{},supportsStructureCommit:true,
  handoffs:{summons:[],movements:[],invocations:[],persistentAreas:resolved.proposals.filter(p=>p.kind==='create-persistent-area')}}
 const before=JSON.stringify({current,geometry}),result=applyDnd5eActivityMapHandoffsV1(input)
 expect(result.ok,JSON.stringify(result)).toBe(true);if(!result.ok)throw Error(result.reason)
 const converted=result.structureGeometry!.obstacles.filter(o=>o.materialMagic==='magical')
 expect(converted.reduce((n,o)=>n+Math.abs(polygonSignedArea(o.points))/100*o.heightFeet,0)).toBeCloseTo(1000)
 expect(converted.every(o=>o.surfaceMaterial===(mode==='rock-to-mud'?'mud':'stone')&&o.baseHeightFeet===-5&&o.heightFeet===5)).toBe(true)
 const loaded=migrateMapsState(JSON.parse(JSON.stringify({maps:[result.map]}))).maps[0]
 const area=loaded.dnd5ePluginAreas![0];expect(area.materialTransformation).toBeDefined()
 expect(removePersistentAreaByDm({map:loaded,characters:[],areaId:area.id,geometry:result.structureGeometry})?.geometry).toEqual(normalizeMapGeometry(geometry))
 expect(applyDnd5eActivityMapHandoffsV1({...input,supportsStructureCommit:false})).toMatchObject({ok:false,reason:'invalid-persistent-area'})
 for(const patch of [{depthFeet:0},{depthFeet:41},{mode:'unknown'},{original:{}}]){
  expect(validateDnd5eActivityDefinitionV1({...definition,outcomes:[{id:'bad',when:{kind:'always'},operations:[{...operation,materialTransformation:{...operation.materialTransformation,...patch} as any}]}]}).length).toBeGreaterThan(0)
 }
 expect(JSON.stringify({current,geometry})).toBe(before)
})

it('creates residual terrain only on the Host-authored matching ground cells and permits none', () => {
  const current = map()
  const definition: Dnd5eActivityDefinitionV1 = { ...activity, target: {
    kind: 'area', relation: 'any', origin: 'point', shape: 'cube',
    placeRangeFeet: 30, widthFeet: 20, lengthFeet: 20, heightFeet: 20, includeSelf: true,
  } }
  const areaSelection = resolveDnd5eActivityAreaMapSelectionV1({ activity: definition, map: current,
    actorToken: current.tokens[0], anchorCell: { col: 2, row: 1 } })!
  const geometry = createEmptyMapGeometry(current.id, 1)
  const [earth, stone] = areaSelection.cells
  const paint = (id: string, cell: typeof earth, surfaceMaterial: 'loose-earth' | 'stone' | 'solid') => ({
    id, kind: 'obstacle' as const, label: id, cover: 'none' as const,
    points: [{x:cell.col*50,y:cell.row*50},{x:(cell.col+1)*50,y:cell.row*50},
      {x:(cell.col+1)*50,y:(cell.row+1)*50},{x:cell.col*50,y:(cell.row+1)*50}],
    blocksMovement:false,blocksVision:false,blocksLineOfEffect:false,baseHeightFeet:0,heightFeet:0,
    terrainElevationFeet:0,surfaceMaterial,createdAt:1,
  })
  const run = () => applyDnd5eActivityMapHandoffsV1({ map: current, activity: definition,
    packageId: 'test', actionId: 'surface-filter', actorId: 'actor', round: 1, areaSelection, selection: {},
    handoffs: { persistentAreas: [{ kind: 'create-persistent-area', operationId: 'terrain',
      label: 'Residual terrain', durationRounds: 1, permanent: true, concentration: false,
      movementCostMultiplier: 2, groundOnly:true, anchorMode:'fixed', surfaceMaterials:['loose-earth','stone'],
      terrainClearing:{squareFeetPerMinute:25},
      areaInstance: { ...areaSelection.areaPlacement, origin: 'point', shape: 'cube' },
    }], summons: [], movements: [], invocations: [] } })
  try {
    geometry.obstacles=[paint('earth',earth,'loose-earth'),paint('stone',stone,'stone')]
    setMapGeometryRuntime([geometry])
    const result=run();expect(result.ok).toBe(true);if(!result.ok)throw Error(result.reason)
    expect(result.map.dnd5ePluginAreas?.[0].cells).toEqual([earth,stone])
    const saved=migrateMapsState(JSON.parse(JSON.stringify({maps:[result.map]}))).maps[0]
    expect(saved.dnd5ePluginAreas?.[0].cells).toEqual([earth,stone])
    expect(saved.dnd5ePluginAreas?.[0].terrainClearing).toEqual({squareFeetPerMinute:25})
    geometry.obstacles.push(paint('pavement',earth,'solid'));setMapGeometryRuntime([geometry])
    const paved=run();expect(paved.ok).toBe(true);if(!paved.ok)throw Error(paved.reason)
    expect(paved.map.dnd5ePluginAreas?.[0].cells).toEqual([stone])
    setMapGeometryRuntime([])
    const empty=run();expect(empty.ok).toBe(true);if(!empty.ok)throw Error(empty.reason)
    expect(empty.map.dnd5ePluginAreas??[]).toEqual([])
    expect(current.dnd5ePluginAreas).toBeUndefined()
  } finally {setMapGeometryRuntime([])}
})


it('filters ground-contact occupants at map selection using local terrain height',()=>{
 const current=map()
 current.tokens.push({...current.tokens[1],id:'flying',elevationFeet:5})
 const definition:Dnd5eActivityDefinitionV1={...activity,target:{kind:'area',origin:'self',shape:'circle',radiusFeet:10,relation:'any',includeSelf:false,requiresGroundContact:true}}
 const select=()=>resolveDnd5eActivityAreaMapSelectionV1({activity:definition,map:current,actorToken:current.tokens[0],anchorCell:{col:1,row:1}})!
 expect(select().targetIds).toEqual(['target'])
 expect(select().cells.length).toBeGreaterThan(1)
 for(const invalid of [false,'true',1]){
 const malformed=structuredClone(definition);Object.assign(malformed.target,{requiresGroundContact:invalid})
 expect(validateDnd5eActivityDefinitionV1(malformed)).toContain('activity.target.requiresGroundContact is invalid')
 }
})

it('animates a selected object in place through the summon handoff and rejects duplicate object use atomically',()=>{
 const current=map();current.tokens[1]={...current.tokens[1],type:'obstacle',hp:5,maxHp:5,
  dnd5eObjectState:{schemaVersion:1,magical:false,wornOrCarried:false,animateObjects:{size:'tiny',mobility:'walk',damageType:'bludgeoning'}}}
 const original=structuredClone(current)
 const summon={kind:'summon' as const,operationId:'animate-object',monsterId:'srd-5.1:owl',objectTokenId:'target',animatedObjectSize:'tiny' as const,count:1,timing:'immediate' as const,durationRounds:4800,concentration:false,side:'ally' as const,commandPolicy:'persistent-order' as const}
 const input={map:current,activity,packageId:'local.test',actionId:'object-animation',actorId:'actor',round:1,worldMinute:100,
 handoffs:{summons:[summon],persistentAreas:[],movements:[],invocations:[]},selection:{summonInitiativeD20s:[12]}}
 const result=applyDnd5eActivityMapHandoffsV1(input)
 expect(result.ok).toBe(true)
 if(!result.ok)throw Error('object handoff failed')
 expect(result.map.tokens.some(token=>token.id==='target')).toBe(false)
 expect(result.map.tokens.find(token=>token.dnd5eSummon)?.dnd5eSummon?.truePolymorphOriginalObject).toMatchObject({id:'target',hp:5})
 expect(current).toEqual(original)
 expect(applyDnd5eActivityMapHandoffsV1({...input,handoffs:{...input.handoffs,summons:[summon,summon]}}).ok).toBe(false)
 expect(current).toEqual(original)
 // Source-bound animation cannot be moved to an arbitrary selected destination.
 const remoteCell = applyDnd5eActivityMapHandoffsV1({...input,selection:{...input.selection,summonCells:[{col:15,row:15}]}})
 expect(remoteCell.ok).toBe(true)
 if(!remoteCell.ok)throw Error(remoteCell.reason)
 expect(remoteCell.map.tokens.find(token=>token.dnd5eSummon)).toMatchObject({x:current.tokens[1].x,y:current.tokens[1].y})
 // Touch range is three-dimensional even if the horizontal cells are adjacent.
 const highMap=structuredClone(current);highMap.tokens[1].elevationFeet=100
 expect(applyDnd5eActivityMapHandoffsV1({...input,map:highMap,handoffs:{...input.handoffs,summons:[{...summon,placementRangeFeet:5}]}}).ok).toBe(false)
 expect(highMap.tokens[1].elevationFeet).toBe(100)
})

it('hands ceiling transformation to Host geometry and persists exact downward target volumes',()=>{
 const current=map(),geometry=createEmptyMapGeometry(current.id,1)
 geometry.obstacles=[{id:'ceiling',kind:'obstacle',label:'Ceiling',points:[{x:0,y:0},{x:1000,y:0},{x:1000,y:1000},{x:0,y:1000}],cover:'total',blocksMovement:true,blocksVision:true,blocksLineOfEffect:true,baseHeightFeet:20,heightFeet:10,surfaceMaterial:'stone',materialMagic:'nonmagical',createdAt:1}]
 setMapGeometryRuntime([geometry])
 const operation={id:'fall',kind:'create-persistent-area' as const,label:'Falling mud',durationRounds:1,permanent:true as const,concentration:false,anchorMode:'fixed' as const,materialTransformation:{mode:'ceiling-rock-to-mud' as const,depthFeet:'selected-height' as const}}
 const definition:Dnd5eActivityDefinitionV1={...activity,invocation:undefined,activation:{kind:'action'},target:{kind:'area',relation:'any',origin:'point',shape:'rect',placeRangeFeet:120,widthFeet:20,lengthFeet:10,heightFeet:5,includeSelf:true,rotatable:true},outcomes:[{id:'convert',when:{kind:'always'},operations:[operation]}]}
 expect(validateDnd5eActivityDefinitionV1(definition)).toEqual([])
 const selection=resolveDnd5eActivityAreaMapSelectionV1({activity:definition,map:current,actorToken:current.tokens[0],anchorCell:{col:4,row:4},rectAngleDegrees:35,targetElevationFeet:20})!
 expect(selection).toBeDefined()
 const resolved=resolveDnd5eActivity({activity:JSON.parse(JSON.stringify(definition)),actor:{id:'actor',controller:'players',level:9,proficiencyBonus:4,abilities:{str:10,dex:10,con:10,int:18,wis:10,cha:10},armorClass:12,conditions:[],currentHp:20,maxHp:20},targets:[],rolls:{},areaPlacement:selection.areaPlacement,areaPlacementDistanceFeet:20,confirmedBy:'actor'})
 expect(resolved.ok,JSON.stringify(resolved)).toBe(true);if(!resolved.ok)throw Error('resolve failed')
 const input={map:current,activity:definition,packageId:'test.material',actionId:'ceiling-cast',actorId:'actor',round:1,areaSelection:selection,selection:{},supportsStructureCommit:true,handoffs:{summons:[],movements:[],invocations:[],persistentAreas:resolved.proposals.filter(p=>p.kind==='create-persistent-area')}}
 const result=applyDnd5eActivityMapHandoffsV1(input)
 expect(result.ok,JSON.stringify(result)).toBe(true);if(!result.ok)throw Error(result.reason)
 const loaded=migrateMapsState(JSON.parse(JSON.stringify({maps:[result.map]}))).maps[0],area=loaded.dnd5ePluginAreas![0]
 expect(area.materialFallVolumes?.length).toBeGreaterThan(0)
 expect(area.materialFallVolumes?.every(v=>v.bottomFeet===0&&v.topFeet===20)).toBe(true)
 expect(area.vertical).toMatchObject({mode:'volume',baseElevationFeet:0,heightFeet:20})
 const token={...current.tokens[1],x:selection.areaPlacement.x,y:selection.areaPlacement.y}
 expect(dnd5eTokenIntersectsPersistentAreaAt(token,loaded,area,token,area.cells,0)).toBe(true)
 expect(dnd5eTokenIntersectsPersistentAreaAt(token,loaded,area,token,area.cells,10)).toBe(true)
 expect(dnd5eTokenIntersectsPersistentAreaAt(token,loaded,area,token,area.cells,20)).toBe(false)
 expect(dnd5eTokenIntersectsPersistentAreaAt(token,loaded,area,{x:900,y:900},area.cells,0)).toBe(false)
 expect(removePersistentAreaByDm({map:loaded,characters:[],areaId:area.id,geometry:result.structureGeometry})?.geometry).toEqual(normalizeMapGeometry(geometry))
 expect(applyDnd5eActivityMapHandoffsV1({...input,supportsStructureCommit:false}).ok).toBe(false)
 geometry.obstacles[0].materialMagic='magical';setMapGeometryRuntime([geometry])
 expect(applyDnd5eActivityMapHandoffsV1(input).ok).toBe(false)
 const invalid=structuredClone(definition)
 Object.assign(invalid.outcomes[0].operations[0],{groundOnly:true})
 expect(validateDnd5eActivityDefinitionV1(invalid).length).toBeGreaterThan(0)
})
it('creates a target-following sensor from serialized Activity and rejects ambiguous Host selections', () => {
  const current = map()
  current.tokens[1].characterId = 'observed-character'
  current.tokens[1].elevationFeet = 25
  const definition: Dnd5eActivityDefinitionV1 = JSON.parse(JSON.stringify({ ...activity,
    invocation: undefined, activation: { kind: 'action', cost: 1 },
    target: { kind: 'area', relation: 'any', origin: 'point', shape: 'sphere', radiusFeet: 5, placeRangeFeet: 60 },
    outcomes: [{ id: 'create', when: { kind: 'always' }, operations: [{
      id: 'sensor', kind: 'create-persistent-area', label: 'Sensor', durationRounds: 100, concentration: true,
      anchorMode: 'target-token', effectToken: { label: 'Sensor', hiddenBody: true,
        shareVisionWithSource: true, visionFromSource: true, hearingFromSource: true, followSelectedTarget: true },
    }] }],
  }))
  expect(validateDnd5eActivityDefinitionV1(definition)).toEqual([])
  const areaSelection = resolveDnd5eActivityAreaMapSelectionV1({ activity: definition, map: current,
    actorToken: current.tokens[0], anchorCell: { col: 3, row: 3 } })!
  const resolved = resolveDnd5eActivity({ activity: definition,
    actor: { id: 'actor', controller: 'players', level: 14, proficiencyBonus: 5,
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 18, cha: 10 }, armorClass: 12, conditions: [], currentHp: 20, maxHp: 20 },
    targets: [], rolls: {}, areaPlacement: areaSelection.areaPlacement, areaPlacementDistanceFeet: 15, confirmedBy: 'actor',
  })
  expect(resolved.ok, JSON.stringify(resolved)).toBe(true)
  if (!resolved.ok) throw Error('sensor execution failed')
  const proposals = resolved.proposals.filter(proposal => proposal.kind === 'create-persistent-area')
  expect(proposals[0]).toMatchObject({ effectToken: { followSelectedTarget: true } })
  const run = (targetIds: string[], selectedMap = current) => applyDnd5eActivityMapHandoffsV1({
    map: selectedMap, activity: definition, packageId: 'test.sensor', actionId: 'sensor-follow', actorId: 'actor', round: 1,
    areaSelection: { ...areaSelection, targetIds }, selection: {},
    handoffs: { summons: [], movements: [], invocations: [], persistentAreas: proposals },
  })
  const before = structuredClone(current)
  const result = run(['target'])
  expect(result.ok, JSON.stringify(result)).toBe(true)
  if (!result.ok) throw Error('sensor handoff failed')
  const restored = migrateMapsState(JSON.parse(JSON.stringify({ maps: [result.map] }))).maps[0]
  const area = restored.dnd5ePluginAreas![0]
  expect(area.sensorTarget).toEqual({ tokenId: 'target', characterId: 'observed-character' })
  expect(restored.tokens.find(token => token.id === area.anchorTokenId)).toMatchObject({
    x: current.tokens[1].x, y: current.tokens[1].y, elevationFeet: 25,
  })
  expect(area.anchorCell).toEqual({ col: 2, row: 1 })
  expect(run([]).ok).toBe(false)
  expect(run(['target', 'actor']).ok).toBe(false)
  expect(run(['missing']).ok).toBe(false)
  expect(run(['target'], { ...current, tokens: [...current.tokens, { ...current.tokens[1], id: 'duplicate' }] }).ok).toBe(false)
  expect(current).toEqual(before)
  for (const override of [{ followSelectedTarget: false }, { hiddenBody: false }, { remotePlacement: { memoryPrompt: 'Seen?' } }]) {
    const malformed = structuredClone(definition)
    const operation = malformed.outcomes[0].operations[0]
    if (operation.kind !== 'create-persistent-area') throw Error('wrong operation')
    Object.assign(operation.effectToken!, override)
    expect(validateDnd5eActivityDefinitionV1(malformed).length).toBeGreaterThan(0)
  }
})

it('binds a failed creature save to its sensor without a separate player point selection',()=>{
 const current=map()
 const definition:Dnd5eActivityDefinitionV1={...activity,activation:{kind:'action'},invocation:undefined,
  target:{kind:'creature',relation:'any',count:1},
  checks:[{id:'save',kind:'saving-throw',rollId:'save',ability:'wis',dc:{kind:'constant',value:16},allowWillingFailure:true}],
  outcomes:[{id:'failed',when:{kind:'check',checkId:'save',result:'failure'},operations:[{
   id:'sensor',kind:'create-persistent-area',label:'Sensor',durationRounds:100,concentration:true,anchorMode:'target-token',
   effectToken:{label:'Sensor',hiddenBody:true,shareVisionWithSource:true,visionFromSource:true,hearingFromSource:true,followSelectedTarget:true},
  }]}]}
 expect(validateDnd5eActivityDefinitionV1(definition)).toEqual([])
 const actor={id:'actor',controller:'players' as const,level:14,proficiencyBonus:5,
  abilities:{str:10,dex:10,con:10,int:10,wis:18,cha:10},armorClass:12,conditions:[],currentHp:20,maxHp:20}
 for(const mode of ['failure','success','willing']){
  const resolved=resolveDnd5eActivity({activity:JSON.parse(JSON.stringify(definition)),actor,
   targets:[{...actor,id:'target',controller:'dm',savingThrowModifiers:{wis:0}}],
   rolls:mode==='willing'?{}:{save:{values:[mode==='success'?20:1]}},willingTargetIds:mode==='willing'?['target']:undefined})
  expect(resolved.ok,JSON.stringify(resolved)).toBe(true);if(!resolved.ok)throw Error('save failed')
  const persistentAreas=resolved.proposals.filter(proposal=>proposal.kind==='create-persistent-area')
  if(mode==='success'){expect(persistentAreas).toEqual([]);continue}
  expect(persistentAreas[0].sensorTargetId).toBe('target')
  const apply=(mapValue=current,proposals=persistentAreas)=>applyDnd5eActivityMapHandoffsV1({map:mapValue,
   activity:definition,packageId:'test.creature-sensor',actionId:'creature-sensor',actorId:'actor',round:1,
   handoffs:{persistentAreas:proposals,movements:[],summons:[],invocations:[]},selection:{}})
  const applied=apply()
  expect(applied.ok,JSON.stringify(applied)).toBe(true);if(!applied.ok)throw Error('sensor failed')
  expect(applied.map.dnd5ePluginAreas?.[0].sensorTarget?.tokenId).toBe('target')
  expect(apply({...current,tokens:current.tokens.filter(token=>token.id!=='target')}).ok).toBe(false)
  expect(apply(current,persistentAreas.map(proposal=>({...proposal,sensorTargetId:undefined}))).ok).toBe(false)
 }
 expect(validateDnd5eActivityDefinitionV1({...definition,target:{kind:'creature',relation:'any',count:2}}).length).toBeGreaterThan(0)
})
