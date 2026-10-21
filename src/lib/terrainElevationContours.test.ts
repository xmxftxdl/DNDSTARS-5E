import { expect, it } from 'vitest'
import { createEmptyMapGeometry } from './mapGeometry'
import { terrainElevationContours } from './terrainElevationContours'

const rect=(x:number,y:number,w:number,h:number)=>[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}]
const region=(id:string,points:ReturnType<typeof rect>,elevation:number)=>({id,kind:'obstacle' as const,label:id,points,terrainRegion:true,
  terrainElevationFeet:elevation,baseHeightFeet:elevation,heightFeet:0,cover:'none' as const,blocksMovement:false,blocksVision:false,blocksLineOfEffect:false,createdAt:1})
it('hides flat ground and the diagonal partition inside one raised surface',()=>{
  const g=createEmptyMapGeometry('map',1)
  g.obstacles=[region('ground',rect(0,0,500,500),0),region('a',[{x:50,y:50},{x:100,y:50},{x:100,y:100}],5),region('b',[{x:50,y:50},{x:100,y:100},{x:50,y:100}],5)]
  const groups=terrainElevationContours(g)
  expect(groups).toHaveLength(1)
  expect(groups[0].elevationFeet).toBe(5)
  expect(groups[0].edges).toHaveLength(4)
  expect(groups[0].edges.every(e=>e.a.x===e.b.x||e.a.y===e.b.y)).toBe(true)
})
it('clips buried boundaries and retains separate pit and pile labels',()=>{
  const g=createEmptyMapGeometry('map',1)
  g.obstacles=[region('below',rect(0,0,100,100),-10),region('top',rect(0,0,200,200),0),region('pit',rect(25,25,25,25),-5),region('pile',rect(75,25,25,25),5)]
  const groups=terrainElevationContours(g)
  expect(groups.map(g=>g.elevationFeet).sort()).toEqual([-5,5])
  expect(groups.flatMap(g=>g.edges)).toHaveLength(8)
})
it('splits crossings before testing visible height boundaries',()=>{
  const g=createEmptyMapGeometry('map',1)
  g.obstacles=[region('raised',rect(0,0,100,100),5),region('overpaint',rect(50,-25,100,150),0)]
  const groups=terrainElevationContours(g)
  expect(groups).toHaveLength(1)
  expect(groups[0].edges).toHaveLength(4)
  expect(groups[0].edges.every(e=>e.a.x<=50&&e.b.x<=50)).toBe(true)
})
