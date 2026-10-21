import {expect,it} from 'vitest'
import {migrateMapsState,type BattleMap,type Dnd5ePluginArea} from '../../store/maps'
import {moveDnd5eCoreSpellArea} from './coreSpellAreas'
const area:Dnd5ePluginArea={id:'dawn',pluginId:'test',featureId:'dawn',sourceKind:'plugin-feature',label:'Dawn',color:'#fff',sourceCharacterId:'owner',sourceTokenId:'caster',
  cells:[{col:13,row:1}],anchorCell:{col:13,row:1},anchorMode:'fixed',createdRound:1,expiresAfterRound:10,
  vertical:{mode:'volume',baseElevationFeet:0,heightFeet:40},movement:{economy:'bonus-action',maximumFeet:60,maximumSourceDistanceBeforeMoveFeet:60}}
function fixture():BattleMap{return {id:'map',name:'Map',width:2000,height:1000,gridSize:50,gridOffsetX:0,gridOffsetY:0,feetPerCell:5,showGrid:true,
  tokens:[{id:'caster',label:'Caster',type:'player',characterId:'owner',size:1,x:75,y:75,color:'',emoji:''}],dnd5ePluginAreas:[structuredClone(area)]}}
it.each(['edge','far','inside','vertical-edge','vertical-far','missing'] as const)('gates movement against the current volume, not destination: %s',mode=>{
 const map=fixture()
 if(mode==='far')map.tokens[0].x=25
 if(mode==='inside'){map.tokens[0].x=25;map.dnd5ePluginAreas![0].cells.push({col:0,row:1})}
 if(mode==='vertical-edge')map.tokens[0].elevationFeet=100
 if(mode==='vertical-far')map.tokens[0].elevationFeet=105
 if(mode==='missing')map.tokens=[]
 const before=structuredClone(map)
 const saved=migrateMapsState(JSON.parse(JSON.stringify({maps:[map]}))).maps[0]
 expect(saved.dnd5ePluginAreas![0].movement?.maximumSourceDistanceBeforeMoveFeet).toBe(60)
 const moved=moveDnd5eCoreSpellArea({map:saved,areaId:area.id,sourceTokenId:'caster',targetCell:{col:25,row:1}})
 expect(moved.ok).toBe(!['far','vertical-far','missing'].includes(mode))
 if(moved.ok){expect(moved.area.anchorCell).toEqual({col:25,row:1});expect(moved.distanceFeet).toBe(60)}
 expect(map).toEqual(before)
})
it.each([0,-1,1.5,10001])('rejects malformed command range in saved areas: %s',value=>{
 const map=fixture();map.dnd5ePluginAreas![0].movement!.maximumSourceDistanceBeforeMoveFeet=value
 expect(migrateMapsState(JSON.parse(JSON.stringify({maps:[map]}))).maps[0].dnd5ePluginAreas??[]).toHaveLength(0)
})
