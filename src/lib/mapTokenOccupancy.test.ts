import {expect,it} from 'vitest'
import type {BattleMap,Token} from '../store/maps'
import {createMapTokenOccupancy,mapTokenSweepBlocked} from './mapTokenOccupancy'

it('allows marker passage while keeping ordinary objects and creatures solid',()=>{
 const mover:Token={id:'mover',type:'player',label:'Mover',x:25,y:25,size:1,color:'',emoji:''}
 const obstacle:Token={...mover,id:'other',type:'obstacle',x:75}
 const base:BattleMap={id:'occupancy',name:'Map',width:500,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,feetPerCell:5,showGrid:true,tokens:[mover]}
 for(const other of [obstacle,{...obstacle,obstacleKind:'marker' as const},{...obstacle,type:'enemy' as const}]){
  const map={...base,tokens:[mover,other]},solid=other.type!=='obstacle'||other.obstacleKind!=='marker'
  expect(createMapTokenOccupancy(map,undefined,mover)(0).has('1,0')).toBe(solid)
  expect(mapTokenSweepBlocked({map,mover,from:mover,to:{x:125,y:25},fromElevationFeet:0,toElevationFeet:0})).toBe(solid)
 }
})
