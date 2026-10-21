import {expect,it} from 'vitest'
import {sweptSphereBoxContact,firstSpherePathContact,firstCylinderPathContact} from './sweptSphereContact'
it('sweeps a cylinder through intermediate bodies at both top and bottom without spherical taper',()=>{
 const path=[{x:0,y:0,elevationFeet:0},{x:300,y:0,elevationFeet:0}]
 for(const z of [0,25])expect(firstCylinderPathContact(path,10,10,30,[14,-1,z],[16,1,z+5])?.fraction).toBeCloseTo(4/30)
 expect(firstCylinderPathContact(path,10,10,30,[14,-1,31],[16,1,36])).toBeUndefined()
 expect(firstCylinderPathContact(path,10,10,30,[14,11,0],[16,12,5])).toBeUndefined()
 const reverse=[...path].reverse()
 expect(firstCylinderPathContact(reverse,10,10,30,[14,-1,25],[16,1,30])?.fraction).toBeCloseTo(4/30)
})
it('finds a body crossed between distant endpoints',()=>{
 expect(sweptSphereBoxContact([0,0,0],[100,0,0],1,[49,-1,-1],[51,1,1])).toBeCloseTo(.48)
 expect(sweptSphereBoxContact([100,0,0],[0,0,0],1,[49,-1,-1],[51,1,1])).toBeCloseTo(.48)
})
it('checks curved corners and height instead of an inflated bounding box',()=>{
 expect(sweptSphereBoxContact([0,2,2],[10,2,2],1,[4,0,0],[6,1,1])).toBeUndefined()
 expect(sweptSphereBoxContact([0,0,10],[10,0,10],1,[4,-1,0],[6,1,5])).toBeUndefined()
 expect(sweptSphereBoxContact([5,0,0],[5,0,0],1,[4,-1,-1],[6,1,1])).toBe(0)
 expect(sweptSphereBoxContact([0,2,0],[10,2,0],1,[4,-1,-1],[6,1,1])).toBeCloseTo(.4)
})
it('detects contact during a vertical drop in path order',()=>{
 const path=[{x:0,y:0,elevationFeet:20},{x:100,y:0,elevationFeet:20},{x:100,y:0,elevationFeet:-20}]
 const contact=firstSpherePathContact(path,10,5,[9,-1,-5],[11,1,0])!
 expect(contact.segment).toBe(1)
 expect(contact.point.elevationFeet).toBeCloseTo(0)
 expect(firstSpherePathContact(path,10,5,[4,-1,-5],[6,1,0])?.point.elevationFeet).toBeCloseTo(-2)
 expect(firstSpherePathContact(path,10,5,[2,-1,-5],[4,1,0])).toBeUndefined()
})
