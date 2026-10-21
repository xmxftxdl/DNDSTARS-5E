import {expect,it} from 'vitest'
import {migrateMapsState,type BattleMap,type Dnd5ePluginArea,type Token} from '../../store/maps'
import {dnd5ePersistentAreaOccupantModifiersAt} from './persistentAreaGeometry'
import {normalizeDnd5ePersistentAreaOccupantModifiers} from './persistentAreaTypes'
import {resolveDnd5ePersistentAreaModeState,projectDnd5ePersistentAreaMode,changeDnd5ePersistentAreaMode} from './persistentAreaModes'
const token:Token={id:'falling',type:'enemy',label:'Falling',x:25,y:25,elevationFeet:150,size:1,color:'',emoji:''}
const area:Dnd5ePluginArea={id:'up',pluginId:'test.updraft',featureId:'wind',label:'Updraft',sourceTokenId:'source',sourceCharacterId:'source',color:'',createdRound:1,expiresAfterRound:601,anchorMode:'fixed',relation:'any',includeSelf:true,cells:[{col:0,row:0}],vertical:{mode:'volume',baseElevationFeet:0,heightFeet:100},occupantModifiers:{halvesFallingDamage:true,verticalJumpBonusFeet:10}}
const map:BattleMap={id:'m',name:'M',width:300,height:300,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[token],dnd5ePluginAreas:[area]}
it('evaluates final landing altitude and position instead of the falling origin, without physical damage resistance',()=>{
 const query=(x:number,elevationFeet:number)=>dnd5ePersistentAreaOccupantModifiersAt({map,token,position:{x,y:25},elevationFeet})
 expect(query(25,150).halvesFallingDamage).toBe(false)
 expect(query(25,0)).toMatchObject({halvesFallingDamage:true,verticalJumpBonusFeet:10,damageResistances:[]})
 expect(query(125,0)).toMatchObject({halvesFallingDamage:false,verticalJumpBonusFeet:0})
})
it('preserves projection after save and suppresses both mechanics while paused or removed',()=>{
 const state=resolveDnd5ePersistentAreaModeState({profiles:[{id:'up',occupantModifiers:area.occupantModifiers}],initialModeId:'up'})!
 const active=projectDnd5ePersistentAreaMode(area,state)
 const paused=changeDnd5ePersistentAreaMode(active,{change:'pause',receipt:'pause'})!
 const resumed=changeDnd5ePersistentAreaMode(paused,{change:'resume',receipt:'resume'})!
 for(const [value,expected] of [[active,true],[paused,false],[resumed,true]] as const){
  const saved=migrateMapsState(JSON.parse(JSON.stringify({maps:[{...map,dnd5ePluginAreas:[value]}]}))).maps[0]
  expect(dnd5ePersistentAreaOccupantModifiersAt({map:saved,token,position:token,elevationFeet:0}).halvesFallingDamage).toBe(expected)
 }
 expect(dnd5ePersistentAreaOccupantModifiersAt({map:{...map,dnd5ePluginAreas:[]},token,position:token,elevationFeet:0}).verticalJumpBonusFeet).toBe(0)
})
it('does not multiply the same environmental benefit when volumes overlap',()=>{
 const result=dnd5ePersistentAreaOccupantModifiersAt({map:{...map,dnd5ePluginAreas:[area,{...area,id:'other'}]},token,position:token,elevationFeet:0})
 expect(result).toMatchObject({halvesFallingDamage:true,verticalJumpBonusFeet:10})
})
it.each([0,-1,101,NaN,'10',null])('rejects an invalid jump declaration %s',verticalJumpBonusFeet=>{
 const result=normalizeDnd5ePersistentAreaOccupantModifiers({verticalJumpBonusFeet})
 expect(result).toBeUndefined()
})
it('rejects nonboolean falling reduction',()=>{
 expect(normalizeDnd5ePersistentAreaOccupantModifiers({halvesFallingDamage:'true'})).toBeUndefined()
})
