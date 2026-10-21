import {expect,it} from 'vitest'
import type {BattleMap,Dnd5ePluginArea} from '../store/maps'
import {createEmptyMapGeometry,mapGeometryIlluminationAtPoint,mapGeometrySpellLightingSources} from './mapGeometry'
const map:BattleMap={id:'raised-light',name:'Raised light',width:4000,height:4000,gridSize:50,gridOffsetX:0,gridOffsetY:0,feetPerCell:5,showGrid:true,tokens:[]}
const area:Dnd5ePluginArea={id:'light',pluginId:'test',featureId:'light',label:'Light',color:'#fff',sourceTokenId:'caster',sourceCharacterId:'caster',createdRound:1,expiresAfterRound:100,anchorCell:{col:10,row:10},cells:[{col:10,row:10}],vertical:{mode:'volume',baseElevationFeet:300,heightFeet:10},lighting:{kind:'light',brightRadiusFeet:120,dimRadiusFeet:120,color:'#fff',spellLevel:5}}
it('keeps fixed volume light at its declared elevation and resolves both radius boundaries in 3D',()=>{
 const current={...map,dnd5ePluginAreas:[area]},geometry=createEmptyMapGeometry(map.id,1)
 geometry.vision.ambientLight='darkness'
 expect(mapGeometrySpellLightingSources(current,geometry)[0].elevationFeet).toBe(300)
 for(const [height,expected] of [[0,'darkness'],[59,'darkness'],[60,'dim'],[179,'dim'],[180,'bright'],[300,'bright'],[420,'bright'],[421,'dim'],[540,'dim'],[541,'darkness']] as const)
 expect(mapGeometryIlluminationAtPoint({map:current,geometry,point:{x:525,y:525},elevationFeet:height}),String(height)).toBe(expected)
 expect(mapGeometryIlluminationAtPoint({map:current,geometry,point:{x:1525,y:525},elevationFeet:400})).toBe('dim')
 expect(mapGeometryIlluminationAtPoint({map:current,geometry,point:{x:2525,y:525},elevationFeet:500})).toBe('darkness')
})
it('retains spherical light origin at the sphere center',()=>{
 const current={...map,dnd5ePluginAreas:[{...area,vertical:{mode:'volume' as const,shape:'sphere' as const,baseElevationFeet:300,heightFeet:20}}]}
 expect(mapGeometrySpellLightingSources(current)[0].elevationFeet).toBe(310)
})
