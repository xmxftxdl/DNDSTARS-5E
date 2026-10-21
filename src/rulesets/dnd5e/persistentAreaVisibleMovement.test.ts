import {createEmptyMapGeometry} from '../../lib/mapGeometry'
import {normalizeCharacter} from '../../store/characters'
import {expect,it} from 'vitest'
import {migrateMapsState,type BattleMap,type Dnd5ePluginArea} from '../../store/maps'
import {moveDnd5eCoreSpellArea} from './coreSpellAreas'
const area:Dnd5ePluginArea={id:'dawn',pluginId:'test',featureId:'dawn',sourceKind:'plugin-feature',label:'Dawn',color:'#fff',sourceCharacterId:'owner',sourceTokenId:'caster',
  cells:[{col:13,row:1}],anchorCell:{col:13,row:1},anchorMode:'fixed',createdRound:1,expiresAfterRound:10,
  vertical:{mode:'volume',baseElevationFeet:0,heightFeet:40},movement:{economy:'bonus-action',maximumFeet:60,requiresVisibleDestination:true}}
function fixture():BattleMap{return {id:'map',name:'Map',width:2000,height:1000,gridSize:50,gridOffsetX:0,gridOffsetY:0,feetPerCell:5,showGrid:true,
  tokens:[{id:'caster',label:'Caster',type:'player',characterId:'owner',size:1,x:75,y:75,color:'',emoji:''}],dnd5ePluginAreas:[structuredClone(area)]}}

it.each(['visible','wall','dark','blind','too-far'])('validates visible destinations using Host senses: %s',mode=>{
 const map=fixture(),geometry=createEmptyMapGeometry(map.id)
 geometry.vision.enabled=true;geometry.vision.ambientLight=mode==='dark'?'darkness':'bright'
 if(mode==='wall')geometry.walls=[{id:'wall',kind:'wall',label:'Wall',points:[{x:100,y:0},{x:100,y:1000}],blocksVision:true,blocksMovement:false,blocksLineOfEffect:false,baseHeightFeet:0,heightFeet:100,createdAt:1}]
 const owner=normalizeCharacter({id:'owner',name:'Owner',conditions:mode==='blind'?['blinded']:[],currentHp:20,maxHp:20})
 const before=structuredClone(map)
 const saved=migrateMapsState(JSON.parse(JSON.stringify({maps:[map]}))).maps[0]
 expect(saved.dnd5ePluginAreas![0].movement!.requiresVisibleDestination).toBe(true)
 const result=moveDnd5eCoreSpellArea({map:saved,characters:[owner],geometry,areaId:area.id,sourceTokenId:'caster',targetCell:{col:mode==='too-far'?26:14,row:1}})
 expect(result.ok,JSON.stringify(result)).toBe(mode==='visible')
 expect(map).toEqual(before)
})
it('rejects malformed saved visibility constraints',()=>{
 for(const value of [false,1,'true']){const map=fixture();(map.dnd5ePluginAreas![0].movement as any).requiresVisibleDestination=value;expect(migrateMapsState(JSON.parse(JSON.stringify({maps:[map]}))).maps[0].dnd5ePluginAreas??[]).toHaveLength(0)}
})
