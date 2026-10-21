import {expect,it} from 'vitest'
import {normalizeDnd5eMapObjectSurface} from './mapObjectSurface'
import {normalizeDnd5eMapObjectStateV1} from './mapObjectState'
import {migrateMapsState} from '../../store/maps'
const profile={material:'stone' as const,widthFeet:0.5,lengthFeet:1,heightFeet:0.25,rotationDegrees:45}
it('preserves explicit fractional dimensions independently of the icon footprint',()=>{
 const state=normalizeDnd5eMapObjectStateV1({schemaVersion:1,weightPounds:1,locked:true,surfaceProfile:profile})!
 expect(state.surfaceProfile).toEqual(profile)
 expect(state.surfaceProfile).not.toBe(profile)
 const map=migrateMapsState(JSON.parse(JSON.stringify({maps:[{id:'map',name:'Map',width:500,height:500,gridSize:50,tokens:[{id:'object',type:'obstacle',label:'Stone',x:25,y:25,size:1,dnd5eObjectState:state}]}]}))).maps[0]
 expect(map.tokens[0]).toMatchObject({size:1,dnd5eObjectState:{surfaceProfile:profile,locked:true,weightPounds:1}})
 expect(normalizeDnd5eMapObjectStateV1({schemaVersion:1})?.surfaceProfile).toBeUndefined()
})
it.each([{material:'wood'},{widthFeet:0},{lengthFeet:-1},{heightFeet:Infinity},{rotationDegrees:360},{rotationDegrees:-1},{widthFeet:'5'},{widthFeet:100001},{script:'run'},{surfaceId:''},{surfaceId:' '},{surfaceId:42},{surfaceId:'x'.repeat(241)},{surfaceId:'bad\nidentity'}])('rejects invalid or executable metadata %j',patch=>{
 expect(normalizeDnd5eMapObjectSurface({...profile,...patch})).toBeUndefined()
 expect(normalizeDnd5eMapObjectStateV1({schemaVersion:1,surfaceProfile:{...profile,...patch}})).toBeUndefined()
})

it('preserves a bounded physical surface identity',()=>{
 expect(normalizeDnd5eMapObjectSurface({...profile,surfaceId:'original-object'})).toEqual({...profile,surfaceId:'original-object'})
})
