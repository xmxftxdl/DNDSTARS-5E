import {expect,it} from 'vitest'
import type {BattleMap} from '../../store/maps'
import type {MapGeometryLight} from '../../lib/mapGeometry'
import {prepareStrongWindGeometryFlames} from './strongWindGeometryFlames'
it.each([14,15,19,20,29,30])('scene flame observes its actual wind column at elevation %i',elevationFeet=>{
 const map:BattleMap={id:'map',name:'Map',width:500,height:500,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[],
 dnd5ePluginAreas:[{id:'wall',pluginId:'test.grove',featureId:'test.grove:grove',label:'Wind wall',color:'#ffffff',sourceTokenId:'caster',sourceCharacterId:'caster',
 cells:[{col:0,row:0},{col:1,row:0}],strongWind:true,createdRound:1,expiresAfterRound:100,
 vertical:{mode:'volume',baseElevationFeet:0,heightFeet:30,columns:[{col:0,row:0,baseElevationFeet:0,heightFeet:15},{col:1,row:0,baseElevationFeet:20,heightFeet:10}]}}]}
 const light:MapGeometryLight={id:'light',kind:'light',label:'Fire',points:[{x:75,y:25}],elevationFeet,createdAt:0,enabled:true,
   sourceKind:'custom',flame:true,flameProtected:true,color:'#ffffff',brightRadiusFeet:20,dimRadiusFeet:20}
 const input={map,lights:[light],worldMinute:1,round:1}
 expect(prepareStrongWindGeometryFlames(input).candidates).toHaveLength(elevationFeet>=20&&elevationFeet<30?1:0)
 light.points=[{x:25,y:25}]
 expect(prepareStrongWindGeometryFlames(input).candidates).toHaveLength(elevationFeet<15?1:0)
 light.flameProtected=false
 expect(prepareStrongWindGeometryFlames(input).lights[0].enabled).toBe(elevationFeet>=15)
})
