import {expect,it} from 'vitest'
import {igniteUnattendedFuelInVolume} from './areaFuelIgnition'
import {createEmptyMapGeometry,normalizeMapGeometryEntity,type MapGeometryLight} from '../../lib/mapGeometry'
import type {BattleMap} from '../../store/maps'
import {validateSharedStateShape,projectMapGeometryForPlayer} from '../../../scripts/shared-server-core.mjs'
const map:BattleMap={id:'m',name:'M',width:500,height:500,gridSize:50,gridOffsetX:100,gridOffsetY:50,feetPerCell:5,showGrid:true,tokens:[]}
const fuel=():MapGeometryLight=>({id:'f',kind:'light',label:'Fuel',points:[{x:175,y:125}],elevationFeet:10,enabled:false,brightRadiusFeet:20,dimRadiusFeet:20,color:'#ffaa00',createdAt:1,
 controlledFlame:{id:'f',magical:false,burning:false,extentFeet:1,brightRadiusFeet:20,dimRadiusFeet:20,color:'#ffaa00',alterations:[],fuelAvailable:true,custody:'unattended'}})
it.each(['unattended','carried','worn',undefined] as const)('only ignites explicitly unattended fuel (%s)',custody=>{
 const light=fuel();light.controlledFlame!.custody=custody
 const before=structuredClone(light),args={map,cells:[{col:1,row:1}],baseElevationFeet:10,heightFeet:5,lights:[light]}
 const result=igniteUnattendedFuelInVolume(args)
 expect(result[0].controlledFlame!.burning).toBe(custody==='unattended')
 expect(light).toEqual(before)
 expect(igniteUnattendedFuelInVolume({...args,lights:result})).toEqual(result)
})
it.each(['unknown-fuel','ordinary-light','above','below','outside','touching-edge','invalid-state'])('excludes %s',scenario=>{
 const light=fuel()
 if(scenario==='unknown-fuel')delete light.controlledFlame!.fuelAvailable
 if(scenario==='ordinary-light')delete light.controlledFlame
 if(scenario==='above')light.elevationFeet=15
 if(scenario==='below')light.elevationFeet=9
 if(scenario==='outside')light.points[0].x=400
 if(scenario==='touching-edge')light.points[0].x=145
 if(scenario==='invalid-state')light.controlledFlame!.extentFeet=Number.NaN
 expect(igniteUnattendedFuelInVolume({map,cells:[{col:1,row:1}],baseElevationFeet:10,heightFeet:5,lights:[light]})[0]).toBe(light)
})
it.each(['unattended','carried','worn'] as const)('preserves %s through server validation, player projection and reload',custody=>{
 const light=fuel();light.controlledFlame!.custody=custody
 const state={schemaVersion:3,maps:[{...createEmptyMapGeometry('m',1),lights:[light]}],updatedAt:1}
 expect(validateSharedStateShape('map-geometry',state)).toEqual({ok:true})
 const projected=projectMapGeometryForPlayer(state,null,100)
 const loaded=normalizeMapGeometryEntity(JSON.parse(JSON.stringify(projected.maps[0].lights[0])))
 expect(loaded?.kind==='light'&&loaded.controlledFlame?.custody).toBe(custody)
})
