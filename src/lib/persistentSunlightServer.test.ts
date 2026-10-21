import {expect,it} from 'vitest'
import {projectMapsForPlayer,validateSharedStateShape} from '../../scripts/shared-server-core.mjs'
import {createEmptyMapGeometry,mapGeometryIlluminationAtPoint} from './mapGeometry'
import type {BattleMap,Dnd5ePluginArea} from '../store/maps'
it('accepts serialized sunlight area flags and rejects malformed flags at server boundary',()=>{
 const lighting={kind:'light',brightRadiusFeet:30,dimRadiusFeet:0,color:'#fff1b8',spellLevel:5,sunlight:true,areaOnly:true}
 const validate=(value:unknown)=>validateSharedStateShape('maps',{maps:[{id:'map',tokens:[],dnd5ePluginAreas:[{id:'dawn',label:'Dawn',createdRound:1,expiresAfterRound:11,lighting:value}]}]})
 expect(validate(JSON.parse(JSON.stringify(lighting)))).toEqual({ok:true})
 for(const patch of [{sunlight:'true'},{sunlight:1},{areaOnly:'true'},{areaOnly:false},{extra:'untrusted'}])expect(validate({...lighting,...patch})).toMatchObject({ok:false,reason:'invalid-dnd5e-plugin-area'})
})

it.each([
 ['inside',4,0,0,true],
 ['outside cells',4,0,1,false],
 ['above volume',4,40,0,false],
 ['stronger darkness',5,0,0,false],
 ['light outside local darkness',8,0,0,true],
] as const)('keeps server player visibility aligned with beam illumination: %s',(name,threshold,elevation,col,visible)=>{
 const geometry=createEmptyMapGeometry('map',1)
 geometry.vision={...geometry.vision,enabled:true,ambientLight:'darkness',defaultRangeFeet:120,sharePartyVision:false}
 const beam:Dnd5ePluginArea={id:'beam',pluginId:'test',featureId:'beam',sourceCharacterId:'hero',sourceTokenId:'viewer',label:'Dawn',color:'#fff',createdRound:1,expiresAfterRound:11,anchorMode:'fixed',anchorCell:{col:4,row:4},cells:[{col:4,row:4}],vertical:{mode:'volume',baseElevationFeet:0,heightFeet:40},lighting:{kind:'light',brightRadiusFeet:30,dimRadiusFeet:0,color:'#fff',spellLevel:5,sunlight:true,areaOnly:true}}
 const dark:Dnd5ePluginArea={...beam,id:'dark',anchorCell:name==='light outside local darkness'?{col:7,row:4}:beam.anchorCell,lighting:{kind:'magical-darkness',radiusFeet:name==='light outside local darkness'?10:60,spellLevel:8,suppressesMagicalLightThroughLevel:threshold,lightSuppressionScope:'within-area'}}
 const target={id:'target',label:'Visible target',type:'enemy' as const,size:1,x:225+col*50,y:225,elevationFeet:elevation,color:'#fff',emoji:'T'}
 const map:BattleMap={id:'map',name:'Parity',width:1000,height:1000,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[{id:'viewer',characterId:'hero',type:'player',label:'Viewer',size:1,x:175,y:225,elevationFeet:elevation,color:'#fff',emoji:'V'},target],dnd5ePluginAreas:[beam,dark]}
 const illumination=mapGeometryIlluminationAtPoint({map,geometry,point:target,elevationFeet:elevation})
 expect(illumination==='bright').toBe(visible)
 const projected=projectMapsForPlayer({maps:[map]},{schemaVersion:2,updatedAt:1,maps:[geometry]},'hero',{characters:[{id:'hero'}]})
 const actual=projected.maps[0].tokens.find((token:{id:string})=>token.id==='target')
 expect(actual?.label==='Visible target').toBe(visible)
})
