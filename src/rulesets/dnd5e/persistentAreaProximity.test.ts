import {createEmptyMapGeometry,setMapGeometryRuntime} from '../../lib/mapGeometry'
afterEach(()=>setMapGeometryRuntime([]))
import {it,expect,afterEach} from 'vitest'
import type {BattleMap, Dnd5ePluginArea, Token} from '../../store/maps'
import {collectDnd5ePersistentAreaTriggers} from './pluginAreas'
import {normalizeDnd5ePersistentAreaTriggerSnapshot} from './persistentAreaTypes'
import {dnd5ePersistentAreaProximityIncludes} from './persistentAreaProximity'

function fixture() {
 const token: Token={id:'target',label:'Target',type:'enemy',x:175,y:125,size:1,hp:20,maxHp:20,color:'',emoji:''}
 const area:Dnd5ePluginArea={id:'vortex',pluginId:'test.dust',featureId:'dust',label:'Dust',sourceCharacterId:'owner',sourceTokenId:'source',
  cells:[{col:2,row:2}],anchorCell:{col:2,row:2},anchorMode:'fixed',color:'',createdRound:1,expiresAfterRound:10,
  relation:'any',includeSelf:true,vertical:{mode:'volume',baseElevationFeet:0,heightFeet:5},
  triggers:[{id:'end',label:'End',timing:'turn-end',oncePerTurn:true,proximityFeet:5,damage:{count:1,sides:8,type:'bludgeoning'}}]}
 const map:BattleMap={id:'map',name:'map',width:1000,height:1000,gridSize:50,gridOffsetX:0,gridOffsetY:0,feetPerCell:5,showGrid:true,tokens:[token],dnd5ePluginAreas:[area]}
 return {token,area,map,collect:()=>collectDnd5ePersistentAreaTriggers({map,timing:'turn-end',round:1,targetTokenId:'target',turnKey:'turn1'})}
}
it('queues adjacent turn-end targets without enlarging the physical body or triggering on entry',()=>{
 const {map,area,token,collect}=fixture()
 expect(collect()).toHaveLength(1)
 expect(area.cells).toEqual([{col:2,row:2}])
 expect(dnd5ePersistentAreaProximityIncludes(token,map,area)).toBe(false)
 token.x=225;expect(collect()).toEqual([])
 token.x=175
 expect(collectDnd5ePersistentAreaTriggers({map,timing:'on-create',round:1,turnKey:'turn1'})).toEqual([])
 area.cells=[{col:8,row:2}];area.anchorCell={col:8,row:2}
 expect(collect()).toEqual([])
 token.x=475;expect(collect()).toHaveLength(1)
})
it('uses creature footprint and the vertical distance from the actual five-foot volume',()=>{
 const {token,collect}=fixture()
 token.elevationFeet=10;expect(collect()).toHaveLength(1)
 token.elevationFeet=10.01;expect(collect()).toEqual([])
 token.elevationFeet=0;token.size=2;token.x=200;token.y=150
 expect(collect()).toHaveLength(1)
 token.x=250;expect(collect()).toEqual([])
})
it('keeps proximity on save/reload declarations and rejects unsupported timing or distances',()=>{
 const {area}=fixture(),trigger=area.triggers![0]
 expect(normalizeDnd5ePersistentAreaTriggerSnapshot(JSON.parse(JSON.stringify(trigger)))?.proximityFeet).toBe(5)
 for(const proximityFeet of [-1,0,1001,NaN,'5'])expect(normalizeDnd5ePersistentAreaTriggerSnapshot({...trigger,proximityFeet})).toBeUndefined()
 expect(normalizeDnd5ePersistentAreaTriggerSnapshot({...trigger,timing:'on-enter'})).toBeUndefined()
})

it('checks physical obstruction from the saved vortex anchor, not the caster, after movement',()=>{
 const {map,area,collect,token}=fixture()
 area.triggers![0].requiresAnchorLineOfEffect=true
 map.tokens.push({...token,id:'source',x:175,y:175})
 const geometry=createEmptyMapGeometry(map.id,1)
 geometry.walls=[{id:'wall',kind:'wall',label:'Wall',points:[{x:150,y:0},{x:150,y:300}],blocksVision:true,blocksMovement:true,blocksLineOfEffect:true,baseHeightFeet:0,heightFeet:10,createdAt:1}]
 setMapGeometryRuntime([geometry])
 expect(collect()).toHaveLength(0)
 geometry.walls[0].blocksLineOfEffect=false
 setMapGeometryRuntime([geometry])
 expect(collect()).toHaveLength(1)
 geometry.walls[0].blocksLineOfEffect=true
 setMapGeometryRuntime([geometry])
 area.anchorCell={col:3,row:3};area.cells=[{col:3,row:3}]
 map.tokens[1].x=125
 expect(collect()).toHaveLength(1)
 area.anchorCell=undefined
 expect(collect()).toHaveLength(0)
})
it('preserves the anchor effect-path declaration on reload and rejects malformed values',()=>{
 const {area}=fixture()
 const trigger={...area.triggers![0],requiresAnchorLineOfEffect:true}
 expect(normalizeDnd5ePersistentAreaTriggerSnapshot(JSON.parse(JSON.stringify(trigger)))?.requiresAnchorLineOfEffect).toBe(true)
 expect(normalizeDnd5ePersistentAreaTriggerSnapshot({...trigger,requiresAnchorLineOfEffect:'true'})).toBeUndefined()
})
