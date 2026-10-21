import {expect,it} from 'vitest'
import {createEmptyMapGeometry} from '../../lib/mapGeometry'
import {pendingMaterialGeometryCanCommit} from './pendingMaterialGeometry'
it('restages after a pre-cast shared refresh but never overwrites a geometry edit',()=>{
 const before=createEmptyMapGeometry('map',1),after=structuredClone(before)
 after.obstacles.push({id:'mud',kind:'obstacle',label:'Mud',points:[{x:0,y:0},{x:10,y:0},{x:10,y:10},{x:0,y:10}],baseHeightFeet:0,heightFeet:5,surfaceMaterial:'mud',materialMagic:'magical',cover:'none',blocksMovement:false,blocksVision:false,blocksLineOfEffect:false,createdAt:1})
 const pending={before,after},snapshot=JSON.stringify(pending)
 expect(pendingMaterialGeometryCanCommit(pending,{...before,updatedAt:200})).toBe(true)
 expect(pendingMaterialGeometryCanCommit(pending,JSON.parse(JSON.stringify(after)))).toBe(true)
 const changed=structuredClone(after);changed.obstacles[0].heightFeet=6
 expect(pendingMaterialGeometryCanCommit(pending,changed)).toBe(false)
 expect(pendingMaterialGeometryCanCommit(pending,undefined)).toBe(false)
 expect(pendingMaterialGeometryCanCommit(pending,{...before,mapId:'other'})).toBe(false)
 expect(JSON.stringify(pending)).toBe(snapshot)
})
