import {it,expect} from 'vitest'
import {createEmptyMapGeometry,type MapGeometryLight} from '../../lib/mapGeometry'
import type {BattleMap,Dnd5ePluginArea} from '../../store/maps'
import {prepareDnd5eEndedAreaFlames} from './persistentAreaEndFlames'

it('extinguishes ordinary fires at the ground-impact boundary once, preserving magical and distant flames',()=>{
 const source={enabled:true,sourceKind:'torch' as const,flame:true,brightRadiusFeet:20,dimRadiusFeet:20,color:'#ff8000'}
 const area={id:'water',anchorCell:{col:0,row:0},cells:[{col:0,row:0}],endFlameExtinguishRadiusFeet:30} as Dnd5ePluginArea
 const before:BattleMap={id:'end-water',name:'Test',width:1000,height:1000,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,
  dnd5ePluginAreas:[area],tokens:[{id:'torch',type:'npc',label:'Torch',x:325,y:25,size:1,color:'',emoji:'',lightSource:source}]}
 const geometry=createEmptyMapGeometry(before.id,1)
 const light=(id:string,x:number,z=0):MapGeometryLight=>({...source,id,kind:'light',label:id,points:[{x,y:25}],elevationFeet:z,createdAt:1})
 geometry.lights=[light('boundary',325),light('outside',326),{...light('protected',25),flameProtected:true},
  {...light('magic',25),sourceKind:'spell'},light('above',25,31)]
 const after={...before,dnd5ePluginAreas:[]},copy=structuredClone({before,after,geometry})
 const result=prepareDnd5eEndedAreaFlames({before,after,geometry,worldMinute:1})
 expect(result.changedTokenIds).toEqual(['torch'])
 const withoutGeometry=prepareDnd5eEndedAreaFlames({before,after,worldMinute:1})
 expect(withoutGeometry.changedTokenIds).toEqual(['torch'])
 expect(withoutGeometry.map.tokens[0].lightSource).toBeUndefined()
 expect(withoutGeometry.changedLightIds).toEqual([])
 expect(result.changedLightIds).toEqual(['boundary','protected'])
 expect({before,after,geometry}).toEqual(copy)
 expect(prepareDnd5eEndedAreaFlames({before:result.map,after:result.map,geometry:{...geometry,lights:[...result.lights]},worldMinute:1}).changedLightIds).toEqual([])
 expect(prepareDnd5eEndedAreaFlames({before,after:before,geometry,worldMinute:1}).changedLightIds).toEqual([])
})
