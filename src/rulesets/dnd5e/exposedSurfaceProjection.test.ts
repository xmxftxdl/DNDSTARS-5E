import {expect,it} from 'vitest'
import {projectCharactersForRoomMember,mergePlayerCharactersStateForAuthority} from '../../../scripts/shared-server-core.mjs'
import {normalizeCharacter,mergePlayerWritableCharacter} from '../../store/characters'
import {migrateMapsState} from '../../store/maps'
import {createEmptyMapGeometry} from '../../lib/mapGeometry'
import {mapGeometryWithObjectSurfaces} from './mapObjectSurfaceGeometry'

const profile={surfaceId:'stone-surface',material:'stone',widthFeet:1,lengthFeet:1,heightFeet:1,rotationDegrees:0}
const entry={instanceId:'stone',quantity:1,surfaceExposed:true,surfaceProfile:profile,identified:true,item:{name:'Secret item',rulesText:'Secret rules'}}
function project(entries:unknown[]){
 return projectCharactersForRoomMember({characters:[{id:'owner',name:'Owner',roomMemberId:'other',visibleToPlayers:true,
   dnd5eExposedSurfaces:[{...profile,surfaceId:'forged'}],dnd5eInventory:{schemaVersion:3,entries}}]}, {memberId:'viewer'} as any).characters[0]
}
it('projects only exposed physical data and feeds player surface selection after character normalization',()=>{
 const projected=project([entry,{...entry,instanceId:'hidden',surfaceExposed:false}])
 expect(projected.dnd5eInventory).toMatchObject({entries:[]})
 expect(projected.dnd5eExposedSurfaces).toEqual([profile])
 expect(JSON.stringify(projected)).not.toContain('Secret')
 const character=normalizeCharacter(projected as any)
 const map=migrateMapsState({maps:[{id:'map',name:'Map',width:500,height:500,gridSize:50,feetPerCell:5,
   tokens:[{id:'carrier',type:'player',characterId:'owner',x:75,y:75,size:1}]}]}).maps[0]
 expect(mapGeometryWithObjectSurfaces(map,createEmptyMapGeometry('map',1),[character]).obstacles[0].id).toBe('surface-object:stone-surface')
 const hidden=normalizeCharacter(project([]) as any)
 expect(mergePlayerWritableCharacter(character,hidden).dnd5eExposedSurfaces).toEqual([])
 expect(mapGeometryWithObjectSurfaces(map,createEmptyMapGeometry('map',1),[hidden]).obstacles).toEqual([])
})
it.each([
 {...entry,surfaceExposed:false}, {...entry,quantity:2}, {...entry,containerInstanceId:'pack'},
 {...entry,condition:{destroyed:true}}, {...entry,surfaceProfile:{...profile,widthFeet:NaN}},
])('does not project an ineligible surface',invalid=>{
 expect(project([invalid]).dnd5eExposedSurfaces).toEqual([])
})
it('does not accept player-created or player-updated public surface projections',()=>{
 const forged={id:'owner',roomMemberId:'viewer',dnd5eExposedSurfaces:[profile]}
 const created=mergePlayerCharactersStateForAuthority({characters:[]},{characters:[forged]},'viewer')
 expect(created.characters[0].dnd5eExposedSurfaces).toBeUndefined()
 const updated=mergePlayerCharactersStateForAuthority({characters:[{id:'owner',roomMemberId:'viewer'}]}, {characters:[forged]},'viewer')
 expect(updated.characters[0].dnd5eExposedSurfaces).toBeUndefined()
})
