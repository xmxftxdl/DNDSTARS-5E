import {expect,it} from 'vitest'
import {createEmptyMapGeometry,type MapGeometryObstacle} from '../../lib/mapGeometry'
import {planDnd5eAreaGroundDescent} from './persistentAreaDescent'

const terrain=(id:string,left:number,right:number,height:number):MapGeometryObstacle=>({id,kind:'obstacle',label:id,
 points:[{x:left,y:0},{x:right,y:0},{x:right,y:100},{x:left,y:100}],terrainRegion:true,terrainElevationFeet:height,
 baseHeightFeet:height,heightFeet:0,cover:'none',blocksMovement:false,blocksVision:false,blocksLineOfEffect:false,createdAt:1})
it('drops at a narrow pit boundary rather than diagonally before reaching it',()=>{
 const geometry=createEmptyMapGeometry('pit',1)
 geometry.obstacles.push(terrain('pit',49,100,-30))
 const before=structuredClone(geometry)
 const result=planDnd5eAreaGroundDescent({geometry,from:{x:0,y:50},to:{x:80,y:50},bottomFeet:0,maximumClearanceFeet:10})
 expect(result).toEqual({ok:true,bottomFeet:-20,path:[{x:0,y:50,elevationFeet:0},{x:49,y:50,elevationFeet:0},{x:49,y:50,elevationFeet:-20},{x:80,y:50,elevationFeet:-20}]})
 expect(geometry).toEqual(before)
})
it('does not skip an intermediate pit or automatically climb out of it',()=>{
 const geometry=createEmptyMapGeometry('pit',1)
 geometry.obstacles.push(terrain('pit',49,51,-30))
 expect(planDnd5eAreaGroundDescent({geometry,from:{x:0,y:50},to:{x:80,y:50},bottomFeet:0,maximumClearanceFeet:10})).toEqual({ok:false,reason:'terrain-rise'})
})
it('respects later terrain overlays and preserves altitude over a shallow depression',()=>{
 const geometry=createEmptyMapGeometry('pit',1)
 geometry.obstacles.push(terrain('pit',20,100,-30),terrain('fill',20,100,-5))
 expect(planDnd5eAreaGroundDescent({geometry,from:{x:0,y:50},to:{x:80,y:50},bottomFeet:0,maximumClearanceFeet:10})).toMatchObject({ok:true,bottomFeet:0})
})
